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

// Our canonical chain id → GeckoTerminal network slug. EVM only (no Solana).
const GT_NETWORK: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  bsc: 'bsc',
  polygon: 'polygon_pos',
  avalanche: 'avax',
};

export const SNIPER_EVM_CHAINS = Object.keys(GT_NETWORK);

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
    volume_usd?: { h24?: string | null };
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
      txns: { m5: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } },
      volume: { h24: a.volume_usd?.h24 ? parseFloat(a.volume_usd.h24) : 0, h6: 0, h1: 0, m5: 0 },
      priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
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
 * newest-first. EVM only — Solana is intentionally excluded for now.
 */
export async function getNewEvmPairs(minLiquidityUsd = 3000, chain?: string): Promise<DexPair[]> {
  const chains = chain ? [chain] : SNIPER_EVM_CHAINS;
  const results = await Promise.all(chains.map(c => newPoolsForChain(c, minLiquidityUsd)));
  return results
    .flat()
    .sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
}
