import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTrendingTokens } from '@/lib/services/coingecko';
import { searchPairs } from '@/lib/services/dexscreener';

/**
 * Market Data Proxy
 * GET /api/market?type=fear-greed
 * GET /api/market?type=trending
 * GET /api/market?type=trending-tokens&chain=solana
 *
 * Centralises all third-party market data fetches so client components
 * never talk directly to external APIs.
 */

export const dynamic = 'force-dynamic';

// ─── Fear & Greed ─────────────────────────────────────────────────────────────

async function getFearAndGreed(): Promise<{ value: number; label: string }> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1', {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error('Fear & Greed fetch failed');
  const data = await res.json() as { data?: Array<{ value: string; value_classification: string }> };
  const item = data?.data?.[0];
  if (!item) throw new Error('No Fear & Greed data');
  return { value: parseInt(item.value, 10), label: item.value_classification };
}

// ─── Trending Coins (CoinGecko) ───────────────────────────────────────────────

async function getTrending(): Promise<Array<{ symbol: string; change: number }>> {
  // getTrendingTokens only exposes id/name/symbol/thumb/score; for change24h
  // we need the raw /search/trending data which the service strips. Fetch
  // directly from within this server route (safe — never reaches the client).
  const res = await fetch('https://api.coingecko.com/api/v3/search/trending', {
    headers: { accept: 'application/json' },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    // Fallback: use service layer (no change data, but better than nothing)
    const coins = await getTrendingTokens();
    return coins.slice(0, 8).map(c => ({ symbol: c.symbol.toUpperCase(), change: 0 }));
  }
  const data = await res.json() as {
    coins?: Array<{ item?: { symbol?: string; data?: { price_change_percentage_24h?: { usd?: number } } } }>;
  };
  return (data.coins || []).slice(0, 8).map(c => ({
    symbol: (c.item?.symbol || '???').toUpperCase(),
    change: c.item?.data?.price_change_percentage_24h?.usd ?? 0,
  }));
}

// ─── Trending Tokens by Chain (DexScreener) ───────────────────────────────────

interface TrendingToken {
  symbol: string;
  name: string;
  address: string;
  price: string;
  change24h: number;
  chain: string;
  imageUri?: string;
  dexUrl?: string;
}

async function getTrendingTokensByChain(chain: string): Promise<TrendingToken[]> {
  const pairs = await searchPairs(chain);
  return pairs
    .filter(p => p.chainId === chain && p.priceUsd && (p.volume?.h24 ?? 0) > 10_000)
    .slice(0, 6)
    .map(p => ({
      symbol: p.baseToken?.symbol || '???',
      name: p.baseToken?.name || 'Unknown',
      address: p.baseToken?.address || '',
      price: p.priceUsd || '0',
      change24h: p.priceChange?.h24 ?? 0,
      chain: p.chainId,
      imageUri: p.info?.imageUrl,
      dexUrl: p.url,
    }));
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const chain = req.nextUrl.searchParams.get('chain') ?? 'ethereum';

  try {
    switch (type) {
      case 'fear-greed': {
        const data = await getFearAndGreed();
        return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=300' } });
      }
      case 'trending': {
        const coins = await getTrending();
        return NextResponse.json({ coins }, { headers: { 'Cache-Control': 'public, max-age=300' } });
      }
      case 'trending-tokens': {
        const tokens = await getTrendingTokensByChain(chain);
        return NextResponse.json({ tokens }, { headers: { 'Cache-Control': 'public, max-age=60' } });
      }
      default:
        return NextResponse.json({ error: 'type must be fear-greed | trending | trending-tokens' }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Market data fetch failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
