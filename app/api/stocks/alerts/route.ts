import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Server-backed stock price alerts (so they fire even when the app is closed —
 * the /api/cron/stock-alerts job polls prices and notifies).
 *   GET    → the caller's alerts
 *   POST   → create { symbol, name, target, direction }
 *   DELETE ?id= → remove one
 * Owner-scoped: user_id is always the session user, never the client.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authUser() {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  return user;
}

export async function GET() {
  const user = await authUser();
  if (!user) return NextResponse.json({ alerts: [] });
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('stock_alerts')
    .select('id, symbol, name, target, direction, active, fired_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const symbol = typeof b?.symbol === 'string' ? b.symbol.trim().toUpperCase().slice(0, 16) : '';
  const target = Number(b?.target);
  const direction = b?.direction === 'below' ? 'below' : 'above';
  const name = typeof b?.name === 'string' ? b.name.slice(0, 80) : null;
  if (!symbol || !Number.isFinite(target) || target <= 0) {
    return NextResponse.json({ error: 'Invalid alert' }, { status: 400 });
  }
  const db = getSupabaseAdmin();
  // Cap per user so nobody spams the poller.
  const { count } = await db.from('stock_alerts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('active', true);
  if ((count ?? 0) >= 50) return NextResponse.json({ error: 'Alert limit reached (50)' }, { status: 400 });

  const { data, error } = await db
    .from('stock_alerts')
    .insert({ user_id: user.id, symbol, name, target, direction, active: true })
    .select('id, symbol, name, target, direction, active, fired_at, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}

export async function DELETE(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const db = getSupabaseAdmin();
  await db.from('stock_alerts').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
