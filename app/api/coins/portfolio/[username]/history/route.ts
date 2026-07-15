import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Portfolio value flow for a profile over the last 30 days, reconstructed from
 * their settled coin_trades. We do not store per-day historical coin prices, so
 * this is NOT a mark-to-market equity curve: it takes the user's net token
 * holdings per coin cumulatively by day and values every day at the CURRENT
 * registry price (a flat proxy). The result reflects how their net invested
 * position built up over time ("cost-basis flow"), not day-by-day price moves.
 * Gated by the profile's holdings visibility. Returns an empty series when the
 * user has no trades or has hidden their holdings.
 */

const WINDOW_DAYS = 30;

interface TradeRow {
  chain: string;
  token_key: string;
  side: 'buy' | 'sell';
  token_amount: number | string;
  created_at: string;
}

/** UTC day string (YYYY-MM-DD) for a millisecond timestamp. */
function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const sb = getSupabaseAdmin();

  const { data: prof } = await sb
    .from('profiles')
    .select('id, show_holdings')
    .ilike('username', username)
    .maybeSingle();
  if (!prof) return NextResponse.json({ label: 'cost-basis flow', points: [] });

  const showHoldings = (prof as { show_holdings: boolean }).show_holdings !== false;
  if (!showHoldings) return NextResponse.json({ label: 'cost-basis flow', points: [] });

  const { data } = await sb
    .from('coin_trades')
    .select('chain, token_key, side, token_amount, created_at')
    .eq('user_id', (prof as { id: string }).id)
    .order('created_at', { ascending: true })
    .limit(10000);
  const rows = (data as TradeRow[]) ?? [];
  if (rows.length === 0) return NextResponse.json({ label: 'cost-basis flow', points: [] });

  // Current registry price per coin: the flat proxy we value every day at.
  const keys = [...new Set(rows.map((r) => r.token_key))];
  const priceByCoin = new Map<string, number>();
  if (keys.length) {
    const { data: reg } = await sb
      .from('coin_registry')
      .select('chain, token_key, price_usd')
      .in('token_key', keys);
    for (const r of (reg as Array<Record<string, unknown>>) ?? []) {
      if (r.price_usd != null) priceByCoin.set(`${r.chain}:${r.token_key}`, Number(r.price_usd));
    }
  }

  // Build the 30-day UTC window ending today.
  const todayStart = Date.parse(`${dayKey(Date.now())}T00:00:00.000Z`);
  const days: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
    days.push(dayKey(todayStart - i * 86400000));
  }

  // Walk trades in order, snapshotting the cumulative net holdings valued at the
  // current price at the end of each day in the window.
  const net = new Map<string, number>(); // coinKey -> net tokens
  let cursor = 0;
  const points = days.map((day) => {
    const endOfDay = Date.parse(`${day}T23:59:59.999Z`);
    while (cursor < rows.length && Date.parse(rows[cursor].created_at) <= endOfDay) {
      const r = rows[cursor];
      const coinKey = `${r.chain}:${r.token_key}`;
      const signed = (Number(r.token_amount) || 0) * (r.side === 'buy' ? 1 : -1);
      net.set(coinKey, (net.get(coinKey) ?? 0) + signed);
      cursor += 1;
    }
    let valueUsd = 0;
    for (const [coinKey, tokens] of net) {
      if (tokens <= 0.0000001) continue; // exited or basis-unknown short
      const price = priceByCoin.get(coinKey);
      if (price != null) valueUsd += tokens * price;
    }
    return { day, valueUsd: Math.round(valueUsd * 100) / 100 };
  });

  return NextResponse.json({ label: 'cost-basis flow', points });
}
