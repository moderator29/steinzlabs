import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * HIGH-5: step-up re-authentication. Issues a short-lived
 * `recent_auth_token` cookie (5-minute TTL) the caller can attach to
 * sensitive operations: wallet export, account delete, swap >$10K, etc.
 *
 * POST { method: 'password'|'totp', code|password } → 200 + cookie
 * GET  → { valid: boolean, expiresAt?: string } — quick check used by
 *        client modals before they prompt.
 *
 * The downstream guard `requireRecentAuth(request)` verifies the cookie
 * is present, unexpired, and bound to the authenticated user.
 */

export const runtime = 'nodejs';

const COOKIE_NAME = 'naka_recent_auth';
const MAX_AGE_SEC = 5 * 60;

function secret() {
  const s = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('JWT_SECRET or SESSION_SECRET required');
  return new TextEncoder().encode(s);
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

const Body = z.object({
  method: z.enum(['password', 'totp']),
  code: z.string().min(4).max(64).optional(),
  password: z.string().min(4).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  let ok = false;
  if (parsed.data.method === 'password') {
    if (!parsed.data.password) return NextResponse.json({ error: 'password required' }, { status: 400 });
    // Re-verify via Supabase's password sign-in. signInWithPassword
    // returns 400 on mismatch without disturbing the existing session.
    const test = await supabase.auth.signInWithPassword({
      email: user.email ?? '',
      password: parsed.data.password,
    });
    ok = !test.error && Boolean(test.data.user);
  } else if (parsed.data.method === 'totp') {
    if (!parsed.data.code) return NextResponse.json({ error: 'code required' }, { status: 400 });
    // TOTP secret lives on admin_roles only today. For non-admins we
    // fall back to rejecting TOTP step-up; they should use password.
    const admin = getSupabaseAdmin();
    const { data: row } = await admin
      .from('admin_roles')
      .select('totp_secret, totp_enrolled')
      .eq('user_id', user.id)
      .maybeSingle<{ totp_secret: string | null; totp_enrolled: boolean }>();
    if (!row?.totp_enrolled || !row.totp_secret) {
      return NextResponse.json({ error: 'TOTP not enrolled' }, { status: 400 });
    }
    // Dynamic import — lib/auth/totp ships in feat/admin-rbac-and-cron-dashboard
    // (Branch 17). When that branch isn't merged yet, TOTP step-up is
    // unavailable; password step-up still works.
    // Variable specifier defeats TS's static module resolution so this
    // branch compiles cleanly even before lib/auth/totp lands. Runtime
    // import fails closed → 503 if the file isn't present yet.
    try {
      const totpPath = '@' + '/lib/auth/totp';
      const totpMod = (await import(/* webpackIgnore: true */ totpPath)) as { verifyTotp: (s: string, c: string) => boolean };
      ok = totpMod.verifyTotp(row.totp_secret, parsed.data.code);
    } catch {
      return NextResponse.json({ error: 'TOTP module unavailable' }, { status: 503 });
    }
  }

  if (!ok) return NextResponse.json({ error: 'Re-auth failed' }, { status: 401 });

  const expiresAt = new Date(Date.now() + MAX_AGE_SEC * 1000);
  const token = await new SignJWT({ user_id: user.id, method: parsed.data.method })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());

  const res = NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SEC,
    path: '/',
  });
  return res;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ valid: false });
  try {
    const { payload } = await jwtVerify(token, secret());
    return NextResponse.json({
      valid: true,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
