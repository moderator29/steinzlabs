import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getUserPositions } from '@/lib/coins/social';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { COIN_CHAINS, type CoinChain } from '@/lib/coins/types';

export const dynamic = 'force-dynamic';

type Range = '7d' | '30d' | 'all';

function parseRange(v: string | null): Range {
  return v === '7d' || v === '30d' ? v : 'all';
}

/** Cutoff in ms for a range, or null for all-time. */
function cutoffMs(range: Range): number | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : 30;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - (days - 1) * 86400_000;
}

/** UTC day key YYYY-MM-DD for a timestamp. */
function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

interface RawTrade {
  chain: string;
  token_key: string;
  symbol: string | null;
  side: 'buy' | 'sell';
  usd_amount: number | string;
  token_amount: number | string;
  created_at: string;
}

interface ChainStat { realizedUsd: number; unrealizedUsd: number; netValueUsd: number; tradeCount: number; volumeUsd: number }

function emptyChainStat(): ChainStat {
  return { realizedUsd: 0, unrealizedUsd: 0, netValueUsd: 0, tradeCount: 0, volumeUsd: 0 };
}

/**
 * Real trading analytics for the caller. Open positions are valued from the
 * registry price cache (same approach as the coins trade route); realized PnL,
 * volume and the cumulative series are computed directly from coin_trades with a
 * running average cost basis, so wins/losses are honest.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get('range'));
  const cutoff = cutoffMs(range);
  const sb = getSupabaseAdmin();

  // Open positions (all-time snapshot) valued from cached registry prices.
  const positions = await getUserPositions(user.id, true);

  // Raw trade history for the range-scoped series + stats.
  const { data: rawData } = await sb
    .from('coin_trades')
    .select('chain, token_key, symbol, side, usd_amount, token_amount, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(10000);
  const trades = (rawData as RawTrade[]) ?? [];

  // Registry meta (price + logo + symbol) for every token we touch.
  const tokenKeys = [...new Set([...positions.map((p) => p.tokenKey), ...trades.map((t) => t.token_key)])];
  const metaByKey = new Map<string, { chain: string; symbol: string | null; logo: string | null; price: number | null }>();
  if (tokenKeys.length > 0) {
    const { data: reg } = await sb
      .from('coin_registry')
      .select('chain, token_key, symbol, logo_url, price_usd')
      .in('token_key', tokenKeys);
    for (const r of (reg as Array<Record<string, unknown>>) ?? []) {
      metaByKey.set(`${r.chain}:${r.token_key}`, {
        chain: String(r.chain),
        symbol: (r.symbol as string) ?? null,
        logo: (r.logo_url as string) ?? null,
        price: r.price_usd != null ? Number(r.price_usd) : null,
      });
    }
  }

  const perChain: Record<CoinChain, ChainStat> = {
    solana: emptyChainStat(), ethereum: emptyChainStat(), bsc: emptyChainStat(),
  };
  const isChain = (c: string): c is CoinChain => (COIN_CHAINS as readonly string[]).includes(c);

  // Per-coin accumulator keyed by chain:token_key.
  interface CoinAgg { chain: string; tokenKey: string; symbol: string | null; realized: number; unrealized: number; netValue: number }
  const coinMap = new Map<string, CoinAgg>();
  const coinOf = (chain: string, tokenKey: string, symbol: string | null): CoinAgg => {
    const key = `${chain}:${tokenKey}`;
    let c = coinMap.get(key);
    if (!c) { c = { chain, tokenKey, symbol, realized: 0, unrealized: 0, netValue: 0 }; coinMap.set(key, c); }
    if (symbol && !c.symbol) c.symbol = symbol;
    return c;
  };

  // ── Unrealized from open positions valued at registry price ──
  let totalUnrealizedUsd = 0;
  for (const p of positions) {
    const m = metaByKey.get(`${p.chain}:${p.tokenKey}`);
    const price = m?.price ?? null;
    if (price == null) continue;
    const netValue = p.netTokens * price;
    const unrealized = p.avgBuyPrice != null ? (price - p.avgBuyPrice) * p.netTokens : 0;
    totalUnrealizedUsd += unrealized;
    const c = coinOf(p.chain, p.tokenKey, p.symbol);
    c.unrealized += unrealized;
    c.netValue += netValue;
    if (isChain(p.chain)) { perChain[p.chain].unrealizedUsd += unrealized; perChain[p.chain].netValueUsd += netValue; }
  }

  // ── Realized + volume + series from raw trades (running average cost) ──
  const cost = new Map<string, { tokens: number; usd: number; firstBuyMs: number | null }>();
  const realizedByDay = new Map<string, number>();
  let totalRealizedUsd = 0;
  let totalVolumeUsd = 0;
  let tradeCount = 0;
  let wins = 0;
  let losses = 0;
  let holdNumer = 0; // Σ soldTokens * holdMs
  let holdDenom = 0;

  for (const t of trades) {
    const ts = Date.parse(t.created_at);
    const inRange = cutoff == null || ts >= cutoff;
    const tok = Number(t.token_amount) || 0;
    const usd = Number(t.usd_amount) || 0;
    const key = `${t.chain}:${t.token_key}`;
    const c = cost.get(key) ?? { tokens: 0, usd: 0, firstBuyMs: null };

    if (inRange) {
      tradeCount += 1;
      totalVolumeUsd += usd;
      if (isChain(t.chain)) { perChain[t.chain].tradeCount += 1; perChain[t.chain].volumeUsd += usd; }
    }

    if (t.side === 'buy') {
      c.tokens += tok; c.usd += usd;
      if (c.firstBuyMs == null || ts < c.firstBuyMs) c.firstBuyMs = ts;
    } else {
      const avg = c.tokens > 0 ? c.usd / c.tokens : 0;
      const realized = usd - tok * avg;
      if (inRange) {
        totalRealizedUsd += realized;
        if (realized >= 0) wins += 1; else losses += 1;
        const day = dayKey(ts);
        realizedByDay.set(day, (realizedByDay.get(day) ?? 0) + realized);
        if (c.firstBuyMs != null) { holdNumer += tok * Math.max(0, ts - c.firstBuyMs); holdDenom += tok; }
        const coin = coinOf(t.chain, t.token_key, t.symbol);
        coin.realized += realized;
        if (isChain(t.chain)) perChain[t.chain].realizedUsd += realized;
      }
      c.tokens = Math.max(0, c.tokens - tok);
      c.usd = Math.max(0, c.usd - tok * avg);
    }
    cost.set(key, c);
  }

  // ── Cumulative realized series over the range window ──
  const pnlSeries: Array<{ day: string; cumulativeRealizedUsd: number }> = [];
  if (realizedByDay.size > 0) {
    let start: number;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (cutoff != null) {
      start = cutoff;
    } else {
      const firstDay = [...realizedByDay.keys()].sort()[0];
      start = Date.parse(`${firstDay}T00:00:00.000Z`);
    }
    // Cap the number of buckets so an all-time series stays bounded.
    const maxDays = 366;
    let cursor = start;
    let cumulative = 0;
    let guard = 0;
    while (cursor <= today.getTime() && guard < maxDays) {
      const day = dayKey(cursor);
      cumulative += realizedByDay.get(day) ?? 0;
      pnlSeries.push({ day, cumulativeRealizedUsd: Number(cumulative.toFixed(2)) });
      cursor += 86400_000;
      guard += 1;
    }
  }

  const perCoin = [...coinMap.values()]
    .map((c) => {
      const m = metaByKey.get(`${c.chain}:${c.tokenKey}`);
      return {
        chain: c.chain,
        symbol: c.symbol || m?.symbol || c.tokenKey.slice(0, 6),
        logo: m?.logo ?? null,
        realized: Number(c.realized.toFixed(2)),
        unrealized: Number(c.unrealized.toFixed(2)),
        netValue: Number(c.netValue.toFixed(2)),
      };
    })
    .sort((a, b) => (b.netValue + b.realized) - (a.netValue + a.realized));

  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;
  const avgHoldMs = holdDenom > 0 ? holdNumer / holdDenom : null;

  return NextResponse.json({
    range,
    totalRealizedUsd: Number(totalRealizedUsd.toFixed(2)),
    totalUnrealizedUsd: Number(totalUnrealizedUsd.toFixed(2)),
    winRate,
    tradeCount,
    totalVolumeUsd: Number(totalVolumeUsd.toFixed(2)),
    avgHoldMs,
    openPositions: positions.length,
    perChain,
    perCoin,
    pnlSeries,
  });
}
