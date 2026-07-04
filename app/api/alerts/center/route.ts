import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Alerts Center — one place to see and manage every alert a user has, across
 * the tables where they live (price_alerts, user_wallet_alerts, trend_alerts,
 * composite_alerts).
 *
 *   GET    → all of the caller's alerts, normalised
 *   PATCH  { type, id, enabled } → toggle a rule on/off
 *   DELETE { type, id }          → remove a rule
 *
 * Safe by design: this endpoint only reads, toggles, or deletes existing rules
 * — it never CREATES an alert, so it can never cause a surprise notification.
 * Every write is double-bound to the authenticated user_id on top of RLS.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Per-type table + the column that means "on". price alerts have no enabled
// flag (they're armed until they trigger), so they're delete-only.
const TYPE_MAP: Record<string, { table: string; toggle: string | null }> = {
  price: { table: 'price_alerts', toggle: null },
  wallet: { table: 'user_wallet_alerts', toggle: 'enabled' },
  trend: { table: 'trend_alerts', toggle: 'is_active' },
  composite: { table: 'composite_alerts', toggle: 'active' },
  general: { table: 'alerts', toggle: 'active' }, // the whale/price/launch builder's table
};

async function getUser() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return cookieStore.get(n)?.value; }, set() {}, remove() {} } },
  );
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

function short(a: string): string { return a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();

  const [price, wallet, trend, composite, general] = await Promise.all([
    admin.from('price_alerts').select('id, token_symbol, direction, price, chain, triggered, triggered_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    admin.from('user_wallet_alerts').select('id, wallet_address, chain, alert_on, min_trade_usd, enabled, last_alerted_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    admin.from('trend_alerts').select('id, chain, metric_name, direction, threshold_value, threshold_type, is_active, last_triggered_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    admin.from('composite_alerts').select('id, name, active, last_triggered_at, cooldown_seconds, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    admin.from('alerts').select('id, alert_type, label, active, triggered, triggered_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  const alerts = [
    ...((price.data ?? []).map((a: { id: string; token_symbol: string | null; direction: string | null; price: number | null; chain: string | null; triggered: boolean | null; triggered_at: string | null; created_at: string }) => ({
      id: a.id, type: 'price' as const, canToggle: false, enabled: !a.triggered,
      title: `${a.token_symbol ?? 'Token'} ${a.direction === 'below' ? '≤' : '≥'} $${a.price ?? '—'}`,
      subtitle: a.chain ?? 'price alert', status: a.triggered ? 'triggered' : 'armed',
      lastTriggered: a.triggered_at, createdAt: a.created_at,
    }))),
    ...((wallet.data ?? []).map((a: { id: string; wallet_address: string; chain: string | null; alert_on: string | null; min_trade_usd: number | null; enabled: boolean | null; last_alerted_at: string | null; created_at: string }) => ({
      id: a.id, type: 'wallet' as const, canToggle: true, enabled: a.enabled !== false,
      title: short(a.wallet_address),
      subtitle: `${a.alert_on ?? 'any move'}${a.min_trade_usd ? ` · ≥$${Number(a.min_trade_usd).toLocaleString()}` : ''}${a.chain ? ` · ${a.chain}` : ''}`,
      status: null, lastTriggered: a.last_alerted_at, createdAt: a.created_at,
    }))),
    ...((trend.data ?? []).map((a: { id: string; chain: string | null; metric_name: string | null; direction: string | null; threshold_value: number | null; threshold_type: string | null; is_active: boolean | null; last_triggered_at: string | null; created_at: string }) => ({
      id: a.id, type: 'trend' as const, canToggle: true, enabled: a.is_active !== false,
      title: `${a.metric_name ?? 'metric'} ${a.direction === 'below' ? '↓' : '↑'} ${a.threshold_value ?? ''}${a.threshold_type === 'percent' ? '%' : ''}`,
      subtitle: a.chain ?? 'trend alert', status: null, lastTriggered: a.last_triggered_at, createdAt: a.created_at,
    }))),
    ...((composite.data ?? []).map((a: { id: string; name: string | null; active: boolean | null; last_triggered_at: string | null; cooldown_seconds: number | null; created_at: string }) => ({
      id: a.id, type: 'composite' as const, canToggle: true, enabled: a.active !== false,
      title: a.name ?? 'Composite rule', subtitle: 'multi-condition rule', status: null,
      lastTriggered: a.last_triggered_at, createdAt: a.created_at,
    }))),
    ...((general.data ?? []).map((a: { id: string; alert_type: string | null; label: string | null; active: boolean | null; triggered: boolean | null; triggered_at: string | null; created_at: string }) => ({
      id: a.id, type: 'general' as const, canToggle: true, enabled: a.active !== false,
      title: a.label ?? `${a.alert_type ?? 'Alert'}`, subtitle: `${a.alert_type ?? 'alert'} rule`,
      status: a.triggered ? 'triggered' : null, lastTriggered: a.triggered_at, createdAt: a.created_at,
    }))),
  ];

  const counts = {
    total: alerts.length,
    active: alerts.filter((a) => a.enabled).length,
    price: (price.data ?? []).length, wallet: (wallet.data ?? []).length,
    trend: (trend.data ?? []).length, composite: (composite.data ?? []).length,
    general: (general.data ?? []).length,
  };

  return NextResponse.json({ alerts, counts });
}

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { type?: string; id?: string; enabled?: boolean };
  const map = body.type ? TYPE_MAP[body.type] : undefined;
  if (!map || !body.id || typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'type, id, enabled required' }, { status: 400 });
  if (!map.toggle) return NextResponse.json({ error: `${body.type} alerts can't be toggled — delete instead` }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from(map.table)
    .update({ [map.toggle]: body.enabled })
    .eq('id', body.id)
    .eq('user_id', user.id); // double-bind to owner
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { type?: string; id?: string };
  const map = body.type ? TYPE_MAP[body.type] : undefined;
  if (!map || !body.id) return NextResponse.json({ error: 'type, id required' }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from(map.table)
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
