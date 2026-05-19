import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sb = createServerClient(
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
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

async function isAdmin(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  return (data as { role?: string } | null)?.role === 'admin';
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
