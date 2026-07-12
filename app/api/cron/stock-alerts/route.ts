import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getStockRows } from '@/lib/services/yahooFinance';
import { verifyCron } from '../_shared';

/**
 * Stock price-alert poller. Runs on the cron dispatcher: pulls every armed
 * alert, fetches the latest price for the distinct symbols from Yahoo, and for
 * each alert that crossed its target it (1) writes an in-app notification and
 * (2) marks the alert fired + inactive. This is what makes stock alerts fire
 * even when the app is closed.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AlertRow { id: string; user_id: string; symbol: string; name: string | null; target: number; direction: 'above' | 'below'; }

export async function GET(req: NextRequest) {
  // Shared cron gate: fails CLOSED when CRON_SECRET is missing in non-dev, and
  // honors the CRONS_PAUSED kill switch — same contract as every other cron.
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const db = getSupabaseAdmin();
  const { data: alerts } = await db
    .from('stock_alerts')
    .select('id, user_id, symbol, name, target, direction')
    .eq('active', true)
    .is('fired_at', null)
    .limit(500);

  const list = (alerts ?? []) as AlertRow[];
  if (list.length === 0) return NextResponse.json({ ok: true, checked: 0, fired: 0 });

  const symbols = Array.from(new Set(list.map((a) => a.symbol)));
  const rows = await getStockRows(symbols);
  const priceBySym = new Map(rows.map((r) => [r.symbol, r.price]));

  let fired = 0;
  for (const a of list) {
    const price = priceBySym.get(a.symbol);
    if (price == null) continue;
    const crossed = a.direction === 'above' ? price >= Number(a.target) : price <= Number(a.target);
    if (!crossed) continue;

    // Claim the row FIRST, conditional on it still being armed. If two runs
    // overlap only one update matches a still-active/unfired row, so only that
    // run notifies — no duplicate notifications.
    const { data: claimed } = await db
      .from('stock_alerts')
      .update({ fired_at: new Date().toISOString(), active: false })
      .eq('id', a.id)
      .eq('active', true)
      .is('fired_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    const label = a.symbol.replace(/^\^/, '');
    await db.from('notifications').insert({
      user_id: a.user_id,
      title: `${label} price alert`,
      body: `${a.name || label} is now ${a.direction} ${Number(a.target).toLocaleString(undefined, { maximumFractionDigits: 2 })} (at ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}).`,
      type: 'stock_alert',
      read: false,
      url: '/dashboard?subtab=stocks',
      metadata: { symbol: a.symbol, target: a.target, direction: a.direction, price },
    });
    fired++;
  }

  return NextResponse.json({ ok: true, checked: list.length, fired });
}
