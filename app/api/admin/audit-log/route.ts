import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminContext } from '@/lib/auth/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Was cookie-session-only, but the admin UI logs in via the static
  // ADMIN_BEARER_TOKEN (no Supabase cookie), so the viewer was ALWAYS 401.
  // Use the shared verifyAdminContext which accepts both the bearer and a
  // role='admin' cookie session — matching every other admin route.
  const ctx = await verifyAdminContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const actor = url.searchParams.get('actor');
  const target = url.searchParams.get('target');
  const action = url.searchParams.get('action');
  const since = url.searchParams.get('since'); // ISO
  const until = url.searchParams.get('until'); // ISO
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);

  try {
    const admin = getSupabaseAdmin();
    let q = admin
      .from('admin_audit_log')
      .select('id, admin_id, target_user_id, action, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (actor) q = q.eq('admin_id', actor);
    if (target) q = q.eq('target_user_id', target);
    if (action) q = q.eq('action', action);
    if (since) q = q.gte('created_at', since);
    if (until) q = q.lte('created_at', until);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin/audit-log' } });
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
