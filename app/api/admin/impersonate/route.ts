import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requirePermission, logAdminAction, hasPermission } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * ADM6: short-lived admin impersonation token. Mints a 10-minute JWT
 * scoped to a target user_id and records the issuance on
 * admin_impersonation_tokens so we have a paper trail beyond
 * admin_audit_log alone.
 *
 * Only super_admin has user.impersonate. The frontend stores the
 * returned token in sessionStorage and attaches it on Supabase auth
 * via a custom header the middleware unpacks.
 */

export const runtime = 'nodejs';

const Body = z.object({
  target_id: z.string().uuid(),
  reason: z.string().min(8).max(500),
});

function secret() {
  const s = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('JWT_SECRET or SESSION_SECRET required');
  return new TextEncoder().encode(s);
}

export async function POST(request: NextRequest) {
  const ctx = await requirePermission(request, 'user.impersonate');
  if (ctx instanceof Response) return ctx;

  // Super-admin only, even if the matrix is ever broadened to include
  // other roles. Defense in depth — `user.impersonate` is intentionally
  // restricted today, but the explicit re-check protects against a
  // future matrix mistake.
  if (!hasPermission(ctx.role, 'user.impersonate') || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
  }

  // Verify target exists. We don't leak whether the user exists in the
  // error so an admin can't enumerate IDs (though super-admin already
  // has direct DB access; this is more about audit hygiene).
  const supabase = getSupabaseAdmin();
  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', parsed.data.target_id)
    .maybeSingle<{ id: string }>();
  if (!target) return NextResponse.json({ error: 'Target not found' }, { status: 404 });

  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const token = await new SignJWT({
    impersonator_id: ctx.userId,
    target_id: parsed.data.target_id,
    role: 'impersonation',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(jti)
    .setExpirationTime('10m')
    .sign(secret());

  await supabase.from('admin_impersonation_tokens').insert({
    admin_id: ctx.userId,
    target_id: parsed.data.target_id,
    jti,
    expires_at: expiresAt.toISOString(),
    reason: parsed.data.reason,
  });

  await logAdminAction(ctx, {
    action: 'user.impersonate',
    target_type: 'user',
    target_id: parsed.data.target_id,
    after_state: { jti, expires_at: expiresAt.toISOString(), reason: parsed.data.reason },
  });

  return NextResponse.json({
    token,
    jti,
    expires_at: expiresAt.toISOString(),
  });
}
