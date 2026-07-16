import 'server-only';

/**
 * Trade-recap rollup shared by the shareable recap card, the Naka Wrapped card,
 * and the weekly-recap cron. Aggregates a user's coin_trades over a time window
 * into honest headline numbers: realized PnL, volume, coins traded, win rate and
 * their single best coin. Realized PnL uses the same running-average basis as
 * position-card / lib/coins/social.ts, so a sell of tokens with no recorded
 * on-platform buy is basis-unknown and is never booked as pure profit.
 */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface TradeRow {
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  side: 'buy' | 'sell';
  usd_amount: number | string;
  token_amount: number | string;
  created_at: string;
}

export interface RecapBestCoin {
  chain: string;
  tokenKey: string;
  tokenAddress: string;
  symbol: string | null;
  logoUrl: string | null;
  pnlUsd: number;
}

export interface TradeRecap {
  realizedUsd: number;
  volumeUsd: number;
  tradeCount: number;
  coinsTraded: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  best: RecapBestCoin | null;
}

const EMPTY: TradeRecap = {
  realizedUsd: 0,
  volumeUsd: 0,
  tradeCount: 0,
  coinsTraded: 0,
  wins: 0,
  losses: 0,
  winRatePct: null,
  best: null,
};

/**
 * Roll a user's coin_trades in [startISO, endISO) into a recap. `winRatePct` is
 * over settled sells with a known basis only; a window with no such sells has a
 * null win rate (honest "not enough data" rather than a fake 0%). The best coin
 * is the one with the highest realized-plus-live-unrealized PnL, enriched with a
 * real logo from coin_registry when we have one.
 */
export async function computeTradeRecap(userId: string, startISO: string, endISO: string): Promise<TradeRecap> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('coin_trades')
    .select('chain, token_key, token_address, symbol, side, usd_amount, token_amount, created_at')
    .eq('user_id', userId)
    .gte('created_at', startISO)
    .lt('created_at', endISO)
    .order('created_at', { ascending: true })
    .limit(20000);
  const rows = (data as TradeRow[]) ?? [];
  if (rows.length === 0) return { ...EMPTY };

  interface Agg {
    chain: string;
    tokenKey: string;
    tokenAddress: string;
    symbol: string | null;
    net: number;
    costTokens: number;
    costUsd: number;
    realized: number;
  }
  const byCoin = new Map<string, Agg>();
  let volumeUsd = 0;
  let wins = 0;
  let losses = 0;

  for (const r of rows) {
    const key = `${r.chain}:${r.token_key}`;
    const a = byCoin.get(key) ?? {
      chain: r.chain,
      tokenKey: r.token_key,
      tokenAddress: r.token_address,
      symbol: r.symbol,
      net: 0,
      costTokens: 0,
      costUsd: 0,
      realized: 0,
    };
    const tok = Number(r.token_amount) || 0;
    const usd = Number(r.usd_amount) || 0;
    volumeUsd += usd;
    if (r.side === 'buy') {
      a.net += tok;
      a.costTokens += tok;
      a.costUsd += usd;
    } else if (a.costTokens > 0) {
      // Realize only against a known basis (matches position-card / social.ts):
      // sells of off-platform-funded tokens are basis-unknown, not full profit.
      const avg = a.costUsd / a.costTokens;
      const sold = Math.min(tok, a.costTokens);
      const realized = usd * (tok > 0 ? sold / tok : 0) - sold * avg;
      a.realized += realized;
      a.net -= tok;
      a.costTokens = Math.max(0, a.costTokens - tok);
      a.costUsd = Math.max(0, a.costUsd - sold * avg);
      if (realized >= 0) wins += 1;
      else losses += 1;
    } else {
      a.net -= tok;
    }
    if (r.symbol) a.symbol = r.symbol;
    byCoin.set(key, a);
  }

  const aggs = [...byCoin.values()];

  // Live prices for open remainders, so the "best coin" reflects realized plus
  // current unrealized rather than realized alone.
  const keys = [...new Set(aggs.map((a) => a.tokenKey))];
  const priceMap = new Map<string, { price: number | null; logo: string | null; symbol: string | null }>();
  if (keys.length) {
    const { data: reg } = await sb
      .from('coin_registry')
      .select('chain, token_key, price_usd, logo_url, symbol')
      .in('token_key', keys);
    for (const r of (reg as Array<Record<string, unknown>>) ?? []) {
      priceMap.set(`${r.chain}:${r.token_key}`, {
        price: r.price_usd != null ? Number(r.price_usd) : null,
        logo: (r.logo_url as string) ?? null,
        symbol: (r.symbol as string) ?? null,
      });
    }
  }

  let realizedUsd = 0;
  let best: RecapBestCoin | null = null;
  let bestPnl = -Infinity;
  for (const a of aggs) {
    realizedUsd += a.realized;
    const meta = priceMap.get(`${a.chain}:${a.tokenKey}`);
    const price = meta?.price ?? null;
    const avg = a.costTokens > 0 ? a.costUsd / a.costTokens : null;
    const unrealized = price != null && a.net > 0 && avg != null ? a.net * (price - avg) : 0;
    const pnlUsd = a.realized + unrealized;
    if (pnlUsd > bestPnl) {
      bestPnl = pnlUsd;
      best = {
        chain: a.chain,
        tokenKey: a.tokenKey,
        tokenAddress: a.tokenAddress,
        symbol: a.symbol ?? meta?.symbol ?? null,
        logoUrl: meta?.logo ?? null,
        pnlUsd,
      };
    }
  }

  const settled = wins + losses;
  return {
    realizedUsd,
    volumeUsd,
    tradeCount: rows.length,
    coinsTraded: aggs.length,
    wins,
    losses,
    winRatePct: settled > 0 ? (wins / settled) * 100 : null,
    // Only surface a best coin when it actually made money; a losing week has no
    // "best coin" worth putting on a share card.
    best: best && best.pnlUsd > 0 ? best : null,
  };
}

// ─── ISO-week helpers (UTC) ─────────────────────────────────────────────────────

/** The ISO-8601 week (YYYY-Www) that a UTC date falls in. */
export function isoWeekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weeks run Monday(1)-Sunday(7); shift to the Thursday of this week.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * UTC [start, end) for an ISO week string (YYYY-Www). Weeks start Monday
 * 00:00:00 UTC. Invalid input falls back to the current week.
 */
export function isoWeekRange(week: string): { startISO: string; endISO: string; label: string } {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) {
    const now = isoWeekOf(new Date());
    return isoWeekRange(now);
  }
  const year = Number(m[1]);
  const wk = Number(m[2]);
  // Jan 4th is always in ISO week 1; anchor from the Monday of that week.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (wk - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { startISO: start.toISOString(), endISO: end.toISOString(), label: `${m[1]}-W${m[2]}` };
}

/** UTC [start, end) for a rolling recap period ending now. */
export function periodRange(period: 'month' | 'year'): { startISO: string; endISO: string } {
  const end = new Date();
  const start = new Date(end);
  if (period === 'year') start.setUTCFullYear(end.getUTCFullYear() - 1);
  else start.setUTCMonth(end.getUTCMonth() - 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}
