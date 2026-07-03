import 'server-only';
import { cacheKey, TTL, withCache } from '../api/cache-manager';
import type { DexPair } from './dexscreener';

/**
 * GeckoTerminal service — real, free (no key) source for freshly-created
 * EVM liquidity pools. Used by the Sniper "New Token Feed" so it surfaces
 * genuine just-launched EVM tokens (replacing the old pumpfun-only search).
 *
 * Docs: https://www.geckoterminal.com/dex-api  → /networks/{network}/new_pools
 * Free tier ~30 req/min, so results are cached per chain.
 */

const BASE = 'https://api.geckoterminal.com/api/v2';
const TIMEOUT_MS = 9000;

// Our canonical chain id → GeckoTerminal network slug. Now includes Solana —
// GeckoTerminal DOES index Solana pools (pump.fun, Raydium, Meteora, …), which
// is where the bulk of launchpad activity lives. Excluding it was the main
// reason the feed looked empty.
const GT_NETWORK: Record<string, string> = {
  solana: 'solana',
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  bsc: 'bsc',
  polygon: 'polygon_pos',
  avalanche: 'avax',
};

export const SNIPER_EVM_CHAINS = Object.keys(GT_NETWORK).filter((c) => c !== 'solana');
/** Every chain the feed ingests (Solana first — highest launchpad volume). */
export const SNIPER_FEED_CHAINS = Object.keys(GT_NETWORK);

interface GtToken {
  id: string; // "network_0xaddress"
  type: 'token';
  attributes?: { address?: string; name?: string; symbol?: string; image_url?: string | null };
}
interface GtDex {
  id: string;
  type: 'dex';
  attributes?: { name?: string };
}
interface GtPool {
  id: string;
  attributes?: {
    name?: string;
    address?: string;
    base_token_price_usd?: string | null;
    reserve_in_usd?: string | null;
    fdv_usd?: string | null;
    market_cap_usd?: string | null;
    pool_created_at?: string | null;
    volume_usd?: { m5?: string | null; h1?: string | null; h6?: string | null; h24?: string | null };
    price_change_percentage?: { m5?: string | null; h1?: string | null; h6?: string | null; h24?: string | null };
    transactions?: {
      m5?: { buys?: number; sells?: number };
      h1?: { buys?: number; sells?: number };
      h6?: { buys?: number; sells?: number };
      h24?: { buys?: number; sells?: number };
    };
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
}

async function gtFetch(path: string): Promise<{ data?: GtPool[]; included?: (GtToken | GtDex)[] }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json;version=20230302' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GeckoTerminal error: ${res.status}`);
  return res.json();
}

function mapPoolsToPairs(chain: string, body: { data?: GtPool[]; included?: (GtToken | GtDex)[] }): DexPair[] {
  const tokensById = new Map<string, GtToken>();
  const dexById = new Map<string, GtDex>();
  for (const inc of body.included ?? []) {
    if (inc.type === 'token') tokensById.set(inc.id, inc as GtToken);
    else if (inc.type === 'dex') dexById.set(inc.id, inc as GtDex);
  }

  const out: DexPair[] = [];
  for (const pool of body.data ?? []) {
    const a = pool.attributes ?? {};
    const baseId = pool.relationships?.base_token?.data?.id;
    const quoteId = pool.relationships?.quote_token?.data?.id;
    const baseTok = baseId ? tokensById.get(baseId) : undefined;
    const quoteTok = quoteId ? tokensById.get(quoteId) : undefined;
    const baseAddr = baseTok?.attributes?.address ?? (baseId ? baseId.split('_')[1] : '');
    if (!baseAddr) continue;
    const dexId = pool.relationships?.dex?.data?.id;
    const dexName = (dexId ? dexById.get(dexId)?.attributes?.name : undefined) ?? 'dex';
    out.push({
      chainId: chain,
      dexId: dexName,
      url: `https://www.geckoterminal.com/${GT_NETWORK[chain]}/pools/${a.address ?? ''}`,
      pairAddress: a.address ?? '',
      baseToken: {
        address: baseAddr,
        name: baseTok?.attributes?.name ?? a.name ?? 'Unknown',
        symbol: baseTok?.attributes?.symbol ?? '???',
      },
      quoteToken: {
        address: quoteTok?.attributes?.address ?? '',
        name: quoteTok?.attributes?.name ?? '',
        symbol: quoteTok?.attributes?.symbol ?? '',
      },
      priceNative: '0',
      priceUsd: a.base_token_price_usd ?? '0',
      // GeckoTerminal pool attributes carry real txn counts + price-change %
      // per window — map them so the feed shows accurate TX 24h and 24h %
      // even for pools with no DexScreener pair (previously hard-coded to 0).
      txns: {
        m5: { buys: a.transactions?.m5?.buys ?? 0, sells: a.transactions?.m5?.sells ?? 0 },
        h1: { buys: a.transactions?.h1?.buys ?? 0, sells: a.transactions?.h1?.sells ?? 0 },
        h6: { buys: a.transactions?.h6?.buys ?? 0, sells: a.transactions?.h6?.sells ?? 0 },
        h24: { buys: a.transactions?.h24?.buys ?? 0, sells: a.transactions?.h24?.sells ?? 0 },
      },
      volume: {
        h24: a.volume_usd?.h24 ? parseFloat(a.volume_usd.h24) : 0,
        h6: a.volume_usd?.h6 ? parseFloat(a.volume_usd.h6) : 0,
        h1: a.volume_usd?.h1 ? parseFloat(a.volume_usd.h1) : 0,
        m5: a.volume_usd?.m5 ? parseFloat(a.volume_usd.m5) : 0,
      },
      priceChange: {
        m5: a.price_change_percentage?.m5 ? parseFloat(a.price_change_percentage.m5) : 0,
        h1: a.price_change_percentage?.h1 ? parseFloat(a.price_change_percentage.h1) : 0,
        h6: a.price_change_percentage?.h6 ? parseFloat(a.price_change_percentage.h6) : 0,
        h24: a.price_change_percentage?.h24 ? parseFloat(a.price_change_percentage.h24) : 0,
      },
      liquidity: { usd: a.reserve_in_usd ? parseFloat(a.reserve_in_usd) : 0, base: 0, quote: 0 },
      fdv: a.fdv_usd ? parseFloat(a.fdv_usd) : undefined,
      marketCap: a.market_cap_usd ? parseFloat(a.market_cap_usd) : undefined,
      pairCreatedAt: a.pool_created_at ? Date.parse(a.pool_created_at) : undefined,
      info: baseTok?.attributes?.image_url ? { imageUrl: baseTok.attributes.image_url } : undefined,
    });
  }
  return out;
}

async function newPoolsForChain(chain: string, minLiquidityUsd: number): Promise<DexPair[]> {
  const network = GT_NETWORK[chain];
  if (!network) return [];
  const key = cacheKey('geckoterminal', 'new_pools', { chain, minLiquidityUsd });
  return withCache(key, TTL.NEW_TOKEN, async () => {
    try {
      const body = await gtFetch(`/networks/${network}/new_pools?include=base_token,quote_token,dex&page=1`);
      return mapPoolsToPairs(chain, body).filter(p => (p.liquidity?.usd ?? 0) >= minLiquidityUsd);
    } catch {
      return [];
    }
  });
}

/**
 * Fresh EVM pools across the supported chains (or a single chain). Sorted
 * newest-first. EVM only — kept for the legacy live path; the primary feed now
 * reads from the ingested sniper_feed_tokens table.
 */
export async function getNewEvmPairs(minLiquidityUsd = 3000, chain?: string): Promise<DexPair[]> {
  const chains = chain ? [chain] : SNIPER_EVM_CHAINS;
  const results = await Promise.all(chains.map(c => newPoolsForChain(c, minLiquidityUsd)));
  return results
    .flat()
    .sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
}

/**
 * Raw new/trending pools for a single chain + page — uncached, no liquidity
 * filter. Used by the ingestion cron (#61) which normalizes + upserts into
 * sniper_feed_tokens. `feed` selects the endpoint: 'new_pools' (freshest) or
 * 'trending_pools' (active). Returns [] on any error so one bad chain/page
 * never aborts a whole ingest run.
 */
export async function getPoolsForIngest(
  chain: string,
  page = 1,
  feed: 'new_pools' | 'trending_pools' = 'new_pools',
): Promise<DexPair[]> {
  const network = GT_NETWORK[chain];
  if (!network) return [];
  try {
    const body = await gtFetch(`/networks/${network}/${feed}?include=base_token,quote_token,dex&page=${page}`);
    return mapPoolsToPairs(chain, body);
  } catch {
    return [];
  }
}

// ─── Token info (logos + socials) ───────────────────────────────────────────
// The new/trending pool payloads and DexScreener pair.info are frequently empty
// for brand-new EVM tokens, which is why sniper logo/social coverage is so low.
// The token `/info` endpoint carries the CoinGecko-sourced logo + social handles
// and fills that gap. It's a single request per token, so callers MUST batch and
// limit their calls to stay under the ~30 req/min free-tier cap.

export interface GtTokenInfo {
  imageUrl?: string;
  websites?: string[];
  twitter?: string;
  telegram?: string;
  discord?: string;
}

interface GtTokenInfoResponse {
  data?: {
    attributes?: {
      image_url?: string | null;
      websites?: string[] | null;
      twitter_handle?: string | null;
      telegram_handle?: string | null;
      discord_url?: string | null;
    };
  };
}

// GeckoTerminal returns a "…/missing.png" sentinel when it has no artwork — treat
// that as "no logo" rather than surfacing a placeholder image.
function realImage(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.endsWith('missing.png') ? undefined : url;
}

/**
 * Real logo + socials for a single token via GET /networks/{network}/tokens/{address}/info.
 * Cached for 24h (this metadata is near-static). Returns null on any error or
 * when GeckoTerminal doesn't know the token, so callers can fall through to
 * other sources. Only real fetched values are returned — nothing is fabricated.
 */
export async function getTokenInfo(chain: string, address: string): Promise<GtTokenInfo | null> {
  const network = GT_NETWORK[chain];
  if (!network || !address) return null;
  const key = cacheKey('geckoterminal', 'token_info', { chain, address });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      const res = await fetch(`${BASE}/networks/${network}/tokens/${address}/info`, {
        headers: { Accept: 'application/json;version=20230302' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as GtTokenInfoResponse;
      const a = body.data?.attributes;
      if (!a) return null;
      const websites = a.websites?.filter((w): w is string => typeof w === 'string' && w.length > 0);
      return {
        imageUrl: realImage(a.image_url),
        websites: websites && websites.length ? websites : undefined,
        twitter: a.twitter_handle ?? undefined,
        telegram: a.telegram_handle ?? undefined,
        discord: a.discord_url ?? undefined,
      };
    } catch {
      return null;
    }
  });
}

// ─── Universal CA resolution + search (swap token selector) ─────────────────
// GeckoTerminal indexes 100+ DEX networks keylessly, making it the widest
// free fallback behind DexScreener for resolving arbitrary pasted contract
// addresses and free-text token search.

export interface GtTokenMeta {
  symbol: string;
  name: string;
  decimals: number | null;
  logo: string | null;
  priceUsd: number | null;
  chain: string;
}

interface GtTokenMetaResponse {
  data?: {
    attributes?: {
      symbol?: string;
      name?: string;
      decimals?: number;
      image_url?: string | null;
      price_usd?: string | null;
    };
  };
}

/** Symbol/name/decimals/logo/price for a contract on one network. */
export async function getTokenMeta(chain: string, address: string): Promise<GtTokenMeta | null> {
  const network = GT_NETWORK[chain];
  if (!network || !address) return null;
  const key = cacheKey('geckoterminal', 'token_meta', { chain, address });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      const res = await fetch(`${BASE}/networks/${network}/tokens/${encodeURIComponent(address)}`, {
        headers: { Accept: 'application/json;version=20230302' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as GtTokenMetaResponse;
      const a = body.data?.attributes;
      if (!a?.symbol) return null;
      return {
        symbol: a.symbol.toUpperCase(),
        name: a.name || a.symbol,
        decimals: typeof a.decimals === 'number' ? a.decimals : null,
        logo: realImage(a.image_url) ?? null,
        priceUsd: a.price_usd ? Number(a.price_usd) : null,
        chain,
      };
    } catch {
      return null;
    }
  });
}

const GT_NETWORK_TO_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(GT_NETWORK).map(([chain, net]) => [net, chain]),
);

export interface GtSearchHit {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  liquidityUsd: number;
}

interface GtSearchResponse {
  data?: Array<{
    attributes?: { name?: string; reserve_in_usd?: string | null };
    relationships?: { base_token?: { data?: { id?: string } } };
  }>;
}

/**
 * Free-text pool search → base tokens. Base-token network+address parse out
 * of the relationship id ("eth_0xabc…"); symbol comes from the "SYM / SYM"
 * pool name. Merged with DexScreener search by the token-search route.
 */
export async function searchTokens(query: string, chainFilter?: string): Promise<GtSearchHit[]> {
  const key = cacheKey('geckoterminal', 'search', { query, chainFilter: chainFilter ?? '' });
  const cached = await withCache(key, TTL.TOKEN_PRICE, async () => {
    try {
      const res = await fetch(`${BASE}/search/pools?query=${encodeURIComponent(query)}&page=1`, {
        headers: { Accept: 'application/json;version=20230302' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as GtSearchResponse;
      const out: GtSearchHit[] = [];
      for (const pool of body.data ?? []) {
        const tokenId = pool.relationships?.base_token?.data?.id;
        if (!tokenId) continue;
        const sep = tokenId.indexOf('_');
        if (sep <= 0) continue;
        const chain = GT_NETWORK_TO_CHAIN[tokenId.slice(0, sep)];
        const address = tokenId.slice(sep + 1);
        if (!chain || !address) continue;
        if (chainFilter && chain !== chainFilter.toLowerCase()) continue;
        const symbol = (pool.attributes?.name || '').split('/')[0]?.trim();
        if (!symbol) continue;
        out.push({
          chain,
          address,
          symbol: symbol.toUpperCase(),
          name: symbol,
          liquidityUsd: pool.attributes?.reserve_in_usd ? Number(pool.attributes.reserve_in_usd) : 0,
        });
      }
      return out;
    } catch {
      return [];
    }
  });
  return cached ?? [];
}
