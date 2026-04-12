import 'server-only';
import { NextResponse } from 'next/server';
import { getTopTokens, getTrendingTokens } from '@/lib/services/coingecko';
import type { CoinGeckoMarketToken } from '@/lib/services/coingecko';

interface TradingSuiteResult {
  trending: unknown[];
  topTokens: unknown[];
  newPairs: unknown[];
  fearGreed: { value: string; classification: string };
  timestamp: number;
}

let cache: { data: TradingSuiteResult; timestamp: number } | null = null;
const CACHE_TTL = 30000;

const EMPTY_RESULT: TradingSuiteResult = {
  trending: [], topTokens: [], newPairs: [],
  fearGreed: { value: '50', classification: 'Neutral' },
  timestamp: Date.now(),
};

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    // Fear & Greed and new token profiles have no service layer equivalent — direct calls kept server-side
    const [trendingResult, topTokensResult, fearResult, dexResult] = await Promise.allSettled([
      getTrendingTokens(),
      getTopTokens(1, 20, true),
      fetch('https://api.alternative.me/fng/?limit=1'),
      fetch('https://api.dexscreener.com/token-profiles/latest/v1', { signal: AbortSignal.timeout(5000) }),
    ]);

    const trending = trendingResult.status === 'fulfilled'
      ? trendingResult.value.slice(0, 15).map(c => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol.toUpperCase(),
          thumb: c.thumb,
          marketCapRank: null,
          price: null,
          priceChange24h: 0,
          marketCap: null,
          volume: null,
          sparkline: null,
          score: c.score,
        }))
      : [];

    const topTokens = topTokensResult.status === 'fulfilled'
      ? topTokensResult.value.map((t: CoinGeckoMarketToken) => ({
          id: t.id,
          name: t.name,
          symbol: t.symbol?.toUpperCase(),
          image: t.image,
          price: t.current_price,
          priceChange1h: t.price_change_percentage_1h_in_currency ?? null,
          priceChange24h: t.price_change_percentage_24h,
          priceChange7d: t.price_change_percentage_7d_in_currency ?? null,
          volume: t.total_volume,
          marketCap: t.market_cap,
          sparkline: t.sparkline_in_7d?.price?.slice(-24) || [],
          high24h: t.high_24h,
          low24h: t.low_24h,
          ath: t.ath,
          athChange: t.ath_change_percentage,
          circulatingSupply: t.circulating_supply,
          totalSupply: t.total_supply,
          rank: t.market_cap_rank,
        }))
      : [];

    let fearGreed = { value: '50', classification: 'Neutral' };
    if (fearResult.status === 'fulfilled' && fearResult.value.ok) {
      const data = await fearResult.value.json();
      if (data.data?.[0]) {
        fearGreed = { value: data.data[0].value, classification: data.data[0].value_classification };
      }
    }

    let newPairs: unknown[] = [];
    if (dexResult.status === 'fulfilled' && dexResult.value.ok) {
      const dexData = await dexResult.value.json();
      newPairs = (Array.isArray(dexData) ? dexData : []).slice(0, 12).map((p: Record<string, unknown>) => ({
        address: p.tokenAddress,
        chain: p.chainId,
        icon: p.icon,
        description: String(p.description || '').slice(0, 80),
        links: (p.links as unknown[] | undefined)?.slice(0, 2),
      }));
    }

    const result: TradingSuiteResult = { trending, topTokens, newPairs, fearGreed, timestamp: Date.now() };
    cache = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(EMPTY_RESULT);
  }
}
