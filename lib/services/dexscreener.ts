import 'server-only';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';
import { normalizeAddress, type Chain } from '../utils/addressNormalize';

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

// Live-cadence fetch — used by the terminal token-stats panel's ~4s poller.
// A tight 5s Next data-cache window keeps the panel feeling live while still
// collapsing a burst of polls (many users on the same hot token) down to one
// upstream call per 5s, well under DexScreener's ~300 req/min budget.
async function dexFetchLive(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 5 },
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
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { label: string; url: string }[]; socials?: { type: string; url: string }[] };
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
  const key = cacheKey('dexscreener', 'token_pairs', { tokenAddress: normalizeAddress(tokenAddress) });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await dexFetch(`/latest/dex/tokens/${tokenAddress}`) as { pairs: DexPair[] | null };
    return data.pairs ?? [];
  });
}

export async function getPair(chain: string, pairAddress: string): Promise<DexPair | null> {
  const key = cacheKey('dexscreener', 'pair', { chain, pairAddress: normalizeAddress(pairAddress, chain) });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await dexFetch(`/latest/dex/pairs/${chain}/${pairAddress}`) as { pairs: DexPair[] | null };
    return data.pairs?.[0] ?? null;
  });
}

/**
 * Live variant of getTokenPairs for the terminal stats panel. Short 5s cache
 * (vs the 30s TOKEN_PRICE cache the rest of the app shares) so the ~4s poll
 * surfaces genuinely fresh pair data without touching global TTLs.
 */
export async function getTokenPairsLive(tokenAddress: string): Promise<DexPair[]> {
  const key = cacheKey('dexscreener', 'token_pairs_live', { tokenAddress: normalizeAddress(tokenAddress) });
  return withCache(key, 5_000, async () => {
    const data = await dexFetchLive(`/latest/dex/tokens/${tokenAddress}`) as { pairs: DexPair[] | null };
    return data.pairs ?? [];
  });
}

export interface DexSocials {
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

/** Pull website / twitter / telegram out of a pair's `info` block. Real links
 *  only — returns null for any channel DexScreener doesn't carry. */
export function extractDexSocials(pair: DexPair): DexSocials {
  const website = pair.info?.websites?.find((w) => !!w?.url)?.url ?? null;
  let twitter: string | null = null;
  let telegram: string | null = null;
  for (const s of pair.info?.socials ?? []) {
    const t = (s.type || '').toLowerCase();
    if (!twitter && (t === 'twitter' || t === 'x')) twitter = s.url;
    else if (!telegram && t === 'telegram') telegram = s.url;
  }
  return { website, twitter, telegram };
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
 * Chain-scoped live price: the deepest-liquidity pair FOR THE GIVEN CHAIN.
 * getBestPair/getDexPrice pick the best pair across ALL chains, which mis-prices
 * a token that also trades on another chain — the market maker swaps on one
 * specific chain, so it must price against that chain. DexScreener pair.chainId
 * matches our slugs (ethereum/base/bsc/arbitrum/optimism/polygon/avalanche/solana).
 * Returns 0 when the token has no pair on that chain.
 */
export async function getDexPriceForChain(tokenAddress: string, chain: string): Promise<number> {
  const pairs = await getTokenPairs(tokenAddress);
  const c = chain.toLowerCase();
  const onChain = pairs.filter((p) => p.chainId?.toLowerCase() === c);
  if (onChain.length === 0) return 0;
  const best = onChain.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  return best.priceUsd ? parseFloat(best.priceUsd) || 0 : 0;
}

/**
 * Batch fetch token data for up to 30 token addresses at once.
 * Returns a map of mintAddress → best pair (highest liquidity).
 * Used for logo resolution and identity verification.
 *
 * Map keys are canonicalized via normalizeAddress(addr, chain): EVM addresses
 * are lowercased, Solana (and other case-sensitive chains) are preserved.
 * Pass `chain` when the caller knows it so two Solana mints differing only by
 * case cannot collide; without it, address shape decides (0x-hex → lowercase,
 * otherwise case-preserved). Look up results with the same normalization.
 */
export async function getTokensMulti(
  tokenAddresses: string[],
  chain?: Chain
): Promise<Map<string, DexPair>> {
  const result = new Map<string, DexPair>();
  if (tokenAddresses.length === 0) return result;

  // Check individual caches first
  const uncached: string[] = [];
  for (const addr of tokenAddresses) {
    const key = cacheKey('dexscreener', 'token_pairs', { tokenAddress: normalizeAddress(addr, chain) });
    const hit = cache.get<DexPair[]>(key);
    if (hit && hit.length > 0) {
      const best = hit.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      result.set(normalizeAddress(addr, chain), best);
    } else {
      uncached.push(addr);
    }
  }

  if (uncached.length === 0) return result;

  // DexScreener supports up to 30 addresses per batch call
  const CHUNK = 30;
  for (let i = 0; i < uncached.length; i += CHUNK) {
    const chunk = uncached.slice(i, i + CHUNK);
    try {
      const data = await dexFetch(
        `/latest/dex/tokens/${chunk.join(',')}`
      ) as { pairs: DexPair[] | null };

      const pairs = data.pairs ?? [];

      // Group ALL pairs by base token address. We need the full per-token list
      // (not just the single deepest pair) because we cache it under the SHARED
      // `token_pairs` key that getTokenPairs()/getDexPriceForChain() also read.
      // Caching only `[best]` here corrupted that key: a later chain-scoped
      // price lookup (getDexPriceForChain) filters the cached list by chain, so
      // a token whose deepest pair is on another chain read back as $0 even
      // though it really trades on the requested chain.
      const pairsByToken = new Map<string, DexPair[]>();
      for (const pair of pairs) {
        const addr = normalizeAddress(pair.baseToken.address, pair.chainId);
        const list = pairsByToken.get(addr);
        if (list) list.push(pair);
        else pairsByToken.set(addr, [pair]);
      }

      // Write results + cache each token's FULL pair list.
      for (const addr of chunk) {
        const norm = normalizeAddress(addr, chain);
        const list = pairsByToken.get(norm);
        if (list && list.length) {
          const best = list.reduce((a, b) =>
            (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a,
          );
          result.set(norm, best);
          cache.set(
            cacheKey('dexscreener', 'token_pairs', { tokenAddress: norm }),
            list,
            TTL.TOKEN_PRICE
          );
        }
      }
    } catch (err) {
      console.error(`[dexscreener] getTokensMulti chunk ${i} failed:`, err);
    }
  }

  return result;
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
