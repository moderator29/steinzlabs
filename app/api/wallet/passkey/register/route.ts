import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpConfig, isPasskeyFeatureEnabled } from '@/lib/wallet/passkeyConfig';
import { putChallenge, takeChallenge } from '@/lib/wallet/passkeyChallengeStore';

export const runtime = 'nodejs';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function ensureFlagOn(): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('feature_flags')
    .select('enabled')
    .eq('key', 'passkey_unlock')
    .maybeSingle<{ enabled: boolean }>();
  return isPasskeyFeatureEnabled(data);
}

// ─── GET → registration options ──────────────────────────────────────────────
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ensureFlagOn())) {
    return NextResponse.json({ error: 'Passkey unlock is not enabled' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('user_passkeys')
    .select('credential_id, transports')
    .eq('user_id', user.id);

  const { rpName, rpID } = getRpConfig();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
  });

  // Persist the server-issued challenge so verify can prove the
  // assertion came from THIS request.
  await putChallenge('reg', user.id);
  // Overwrite the random with what generateRegistrationOptions used so
  // verify reads the same value back from storage.
  // (We stored a random above just to reserve the key; replace it now.)
  // Simpler: write the options.challenge directly via cacheSet.
  const { cacheSet } = await import('@/lib/cache/redis');
  await cacheSet(`webauthn:reg:${user.id}`, options.challenge, 5 * 60);

  return NextResponse.json(options);
}

// ─── POST → verify registration response ────────────────────────────────────
const RegisterBody = z.object({
  response: z.unknown(),
  deviceName: z.string().min(1).max(80).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ensureFlagOn())) {
    return NextResponse.json({ error: 'Passkey unlock is not enabled' }, { status: 403 });
  }

  const parsed = RegisterBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const expectedChallenge = await takeChallenge('reg', user.id);
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired or not found — restart registration' }, { status: 400 });
  }

  const { rpID, expectedOrigin } = getRpConfig();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Verification failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Registration not verified' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('user_passkeys').insert({
    user_id: user.id,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey),
    sign_count: credential.counter,
    transports: credential.transports ?? null,
    device_name: parsed.data.deviceName ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credentialId: credential.id });
}

// ─── DELETE → rollback / revoke a credential ─────────────────────────────────
// Used by the client when the post-registration PRF ceremony fails so we
// don't leave a registered credential the user can't actually unwrap with.
// Also serves as the "remove this passkey" admin action.
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const credentialId = req.nextUrl.searchParams.get('credentialId');
  if (!credentialId) {
    return NextResponse.json({ error: 'credentialId required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('user_passkeys')
    .delete()
    .eq('user_id', user.id)
    .eq('credential_id', credentialId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
