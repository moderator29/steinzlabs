import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getStockRows } from '@/lib/services/yahooFinance';

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
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const qs = req.nextUrl.searchParams.get('secret') || '';
    if (auth !== `Bearer ${secret}` && qs !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    await db.from('stock_alerts').update({ fired_at: new Date().toISOString(), active: false }).eq('id', a.id);
    fired++;
  }

  return NextResponse.json({ ok: true, checked: list.length, fired });
}
