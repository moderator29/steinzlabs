import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { generateSecret, otpauthUri, verifyTotp } from '@/lib/auth/totp';
import { verifyAdminContext, logAdminAction } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * ADM2: TOTP enrollment + verification for admin sessions.
 *
 * GET  → issue a new secret + otpauth:// URI for QR rendering. Does NOT
 *        persist until POST confirms the user can produce a valid code.
 * POST { secret, code } → verify the code, persist the secret on
 *        admin_roles.totp_secret + flip totp_enrolled=true.
 * PATCH { code }        → step-up verification: returns 200 if code is
 *        valid for the enrolled secret. The admin layout reads this to
 *        elevate the session.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const ctx = await verifyAdminContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const secret = generateSecret();
  const uri = otpauthUri('Naka Labs Admin', ctx.userId, secret);
  return NextResponse.json({ secret, uri });
}

export async function POST(request: NextRequest) {
  const ctx = await verifyAdminContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.staticBearer) {
    return NextResponse.json({ error: 'Static bearer cannot enroll TOTP' }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as { secret?: string; code?: string } | null;
  if (!body?.secret || !body.code) {
    return NextResponse.json({ error: 'secret and code required' }, { status: 400 });
  }
  if (!verifyTotp(body.secret, body.code)) {
    return NextResponse.json({ error: 'Code did not verify' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from('admin_roles').upsert({
    user_id: ctx.userId,
    role: ctx.role,
    totp_secret: body.secret,
    totp_enrolled: true,
  }, { onConflict: 'user_id' });

  await logAdminAction(ctx, {
    action: 'admin.totp.enroll',
    target_type: 'user',
    target_id: ctx.userId,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const ctx = await verifyAdminContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as { code?: string } | null;
  if (!body?.code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from('admin_roles')
    .select('totp_secret, totp_enrolled')
    .eq('user_id', ctx.userId)
    .maybeSingle<{ totp_secret: string | null; totp_enrolled: boolean }>();

  if (!row?.totp_enrolled || !row.totp_secret) {
    return NextResponse.json({ error: 'TOTP not enrolled' }, { status: 400 });
  }
  if (!verifyTotp(row.totp_secret, body.code)) {
    return NextResponse.json({ error: 'Code did not verify' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, verifiedAt: new Date().toISOString() });
}
