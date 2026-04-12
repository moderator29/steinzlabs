import 'server-only';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * Dexscreener Service
 * Public API — no key required, always available as fallback.
 * Provides: token pairs, live prices, recent trades, new pair detection.
 */

const BASE = 'https://api.dexscreener.com';
const TIMEOUT_MS = parseInt(process.env.DEXSCREENER_TIMEOUT_MS || '10000', 10);

async function dexFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 10 },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Dexscreener error: ${res.status}`);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: { h24: number; h6: number; h1: number; m5: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  liquidity?: { usd: number; base: number; quote: number };
  fdv?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { label: string; url: string }[] };
}

export interface DexRecentTrade {
  timestamp: number;
  type: 'buy' | 'sell';
  priceUsd: string;
  amountToken: string;
  amountUsd: string;
  wallet: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getTokenPairs(tokenAddress: string): Promise<DexPair[]> {
  const key = cacheKey('dexscreener', 'token_pairs', { tokenAddress: tokenAddress.toLowerCase() });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await dexFetch(`/latest/dex/tokens/${tokenAddress}`) as { pairs: DexPair[] | null };
    return data.pairs ?? [];
  });
}

export async function getPair(chain: string, pairAddress: string): Promise<DexPair | null> {
  const key = cacheKey('dexscreener', 'pair', { chain, pairAddress: pairAddress.toLowerCase() });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await dexFetch(`/latest/dex/pairs/${chain}/${pairAddress}`) as { pairs: DexPair[] | null };
    return data.pairs?.[0] ?? null;
  });
}

export async function searchPairs(query: string): Promise<DexPair[]> {
  const key = cacheKey('dexscreener', 'search', { query });
  return withCache(key, TTL.SEARCH_RESULT, async () => {
    const data = await dexFetch(`/latest/dex/search?q=${encodeURIComponent(query)}`) as { pairs: DexPair[] | null };
    return data.pairs ?? [];
  });
}

/**
 * Get the best pair for a token (highest liquidity).
 */
export async function getBestPair(tokenAddress: string): Promise<DexPair | null> {
  const pairs = await getTokenPairs(tokenAddress);
  if (pairs.length === 0) return null;
  return pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

/**
 * Get live price for a token via its best Dexscreener pair.
 */
export async function getDexPrice(tokenAddress: string): Promise<number> {
  const pair = await getBestPair(tokenAddress);
  if (!pair?.priceUsd) return 0;
  return parseFloat(pair.priceUsd);
}

/**
 * Get buyer/seller ratio from 24h transaction data.
 * Returns { buyersPercent, sellersPercent, buyCount, sellCount }
 */
export function getOrderBookRatio(pair: DexPair): {
  buyersPercent: number;
  sellersPercent: number;
  buyCount: number;
  sellCount: number;
} {
  const { buys, sells } = pair.txns.h24;
  const total = buys + sells;
  if (total === 0) return { buyersPercent: 50, sellersPercent: 50, buyCount: 0, sellCount: 0 };
  return {
    buyersPercent: Math.round((buys / total) * 100),
    sellersPercent: Math.round((sells / total) * 100),
    buyCount: buys,
    sellCount: sells,
  };
}

/**
 * Get newly listed pairs (last 24h) across all chains.
 * Used by sniper bot for new token detection.
 */
export async function getNewPairs(
  minLiquidityUsd = 5000,
  chain?: string
): Promise<DexPair[]> {
  const key = cacheKey('dexscreener', 'new_pairs', { chain: chain ?? 'all', minLiquidityUsd });
  return withCache(key, TTL.NEW_TOKEN, async () => {
    // Dexscreener doesn't have a direct "new pairs" endpoint on the public API
    // Use search with recent tokens from known launchpads as a proxy
    const data = await dexFetch('/latest/dex/search?q=pumpfun') as { pairs: DexPair[] | null };
    const pairs = (data.pairs ?? []).filter(p => {
      const ageMs = Date.now() - (p.pairCreatedAt ?? 0);
      const isRecent = ageMs < 24 * 3600 * 1000;
      const hasLiquidity = (p.liquidity?.usd ?? 0) >= minLiquidityUsd;
      const matchesChain = !chain || p.chainId.toLowerCase() === chain.toLowerCase();
      return isRecent && hasLiquidity && matchesChain;
    });
    return pairs;
  });
}
