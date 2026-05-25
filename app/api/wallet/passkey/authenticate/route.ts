import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpConfig, isPasskeyFeatureEnabled } from '@/lib/wallet/passkeyConfig';
import { takeChallenge } from '@/lib/wallet/passkeyChallengeStore';
import { cacheSet } from '@/lib/cache/redis';

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

// ─── GET → authentication options ────────────────────────────────────────────
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ensureFlagOn())) {
    return NextResponse.json({ error: 'Passkey unlock is not enabled' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data: creds } = await admin
    .from('user_passkeys')
    .select('credential_id, transports')
    .eq('user_id', user.id);

  if (!creds || creds.length === 0) {
    return NextResponse.json({ error: 'No passkeys registered' }, { status: 404 });
  }

  const { rpID } = getRpConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
  });

  await cacheSet(`webauthn:auth:${user.id}`, options.challenge, 5 * 60);
  return NextResponse.json(options);
}

// ─── POST → verify assertion ────────────────────────────────────────────────
const AuthBody = z.object({
  response: z.unknown(),
});

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ensureFlagOn())) {
    return NextResponse.json({ error: 'Passkey unlock is not enabled' }, { status: 403 });
  }

  const parsed = AuthBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const assertion = parsed.data.response as AuthenticationResponseJSON;
  const credentialId = assertion.id;
  if (!credentialId) {
    return NextResponse.json({ error: 'Missing credential id' }, { status: 400 });
  }

  const expectedChallenge = await takeChallenge('auth', user.id);
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired — retry passkey unlock' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: cred } = await admin
    .from('user_passkeys')
    .select('credential_id, public_key, sign_count, transports')
    .eq('user_id', user.id)
    .eq('credential_id', credentialId)
    .maybeSingle<{ credential_id: string; public_key: Buffer; sign_count: number; transports: string[] | null }>();
  if (!cred) {
    return NextResponse.json({ error: 'Unknown credential' }, { status: 404 });
  }

  const { rpID, expectedOrigin } = getRpConfig();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(cred.public_key),
        counter: Number(cred.sign_count),
        transports: (cred.transports ?? []) as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Verification failed' }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Assertion not verified' }, { status: 401 });
  }

  // Bump sign_count to defend against cloned authenticators per the spec.
  await admin
    .from('user_passkeys')
    .update({
      sign_count: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('credential_id', credentialId);

  return NextResponse.json({ ok: true });
}
