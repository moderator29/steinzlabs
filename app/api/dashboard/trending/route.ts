import { NextResponse } from 'next/server';
import {
  getTrendingTokens,
  getMarketsByIds,
  type TrendingCoin,
  type CoinGeckoMarketToken,
} from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

async function withDeadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  try { return await Promise.race([p, t]); } finally { if (timer) clearTimeout(timer); }
}

interface EnrichedTrending {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  sparkline_in_7d?: { price: number[] };
}

export async function GET() {
  try {
    const trending = await withDeadline<TrendingCoin[]>(getTrendingTokens(), 8000, []);
    if (!trending.length) return NextResponse.json({ coins: [] });

    const ids = trending.map(c => c.id);
    const markets = await withDeadline<CoinGeckoMarketToken[]>(getMarketsByIds(ids, true), 8000, []);
    const byId = new Map(markets.map(m => [m.id, m]));

    // Only surface a trending coin once its REAL market data (price, 24h
    // change, market cap) resolved from the CoinGecko markets join. Previously
    // a missing/timed-out join fell back to `?? 0`, so a coin rendered as a
    // real "$0.00 / +0.0%" — a fabricated flat reading. If the markets fetch
    // fails entirely the list is empty and the UI shows its honest "nothing
    // trending" state instead of a wall of $0 coins.
    const enriched: EnrichedTrending[] = trending
      .map((t): EnrichedTrending | null => {
        const m = byId.get(t.id);
        if (!m || typeof m.current_price !== 'number') return null;
        return {
          id: t.id,
          name: t.name,
          symbol: t.symbol,
          thumb: t.thumb,
          market_cap_rank: t.market_cap_rank,
          current_price: m.current_price,
          price_change_percentage_24h: m.price_change_percentage_24h ?? 0,
          market_cap: m.market_cap ?? 0,
          sparkline_in_7d: m.sparkline_in_7d,
        };
      })
      .filter((c): c is EnrichedTrending => c !== null);

    return NextResponse.json({ coins: enriched }, {
      headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300' },
    });
  } catch (err) {
    console.error('[dashboard/trending]', err);
    return NextResponse.json({ coins: [] }, { status: 502 });
  }
}
