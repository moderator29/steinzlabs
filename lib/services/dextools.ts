import 'server-only';
import { cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * DexTools service — ENV-GATED.
 *
 * DexTools' API requires a paid key (X-API-KEY). This module is a strict no-op
 * unless DEXTOOLS_API_KEY is configured: every function returns []/null so the
 * caller falls back to DexScreener / GeckoTerminal / CoinGecko honestly. No key
 * is ever hardcoded. When a key IS present, we use DexTools' v2 REST API as an
 * ADDITIONAL real-data source for contract resolution (price, mcap, FDV, logo).
 *
 * Docs: https://developer.dextools.io  (v2)
 */

const KEY = process.env.DEXTOOLS_API_KEY || '';
// Trial + standard plans use different base hosts; default to the standard v2
// host, overridable so a trial key works without a code change.
const BASE = process.env.DEXTOOLS_API_BASE || 'https://public-api.dextools.io/standard/v2';
const TIMEOUT_MS = 8000;

/** Our canonical chain id → DexTools chain slug. */
const DT_CHAIN: Record<string, string> = {
  ethereum: 'ether',
  bsc: 'bsc',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  base: 'base',
  avalanche: 'avalanche',
  solana: 'solana',
};

export function dextoolsEnabled(): boolean {
  return !!KEY;
}

async function dtFetch<T>(path: string): Promise<T | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'X-API-KEY': KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface DextoolsToken {
  chain: string;
  address: string;
  name: string;
  symbol: string;
  logo: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
}

interface DtTokenResponse {
  data?: { name?: string; symbol?: string; logo?: string | null };
}
interface DtPriceResponse {
  data?: { price?: number | null };
}
interface DtInfoResponse {
  data?: { mcap?: number | null; fdv?: number | null };
}

/**
 * Resolve a contract on one chain via DexTools. Returns null when disabled,
 * on any error, or when DexTools doesn't know the token — never a fabricated
 * record. Cached (TOKEN_PRICE) to respect the trial rate budget.
 */
export async function getDextoolsToken(chain: string, address: string): Promise<DextoolsToken | null> {
  if (!KEY) return null;
  const dtChain = DT_CHAIN[chain.toLowerCase()];
  if (!dtChain || !address) return null;

  const key = cacheKey('dextools', 'token', { chain: dtChain, address: address.toLowerCase() });
  const cached = await withCache(key, TTL.TOKEN_PRICE, async (): Promise<DextoolsToken | null> => {
    const [meta, price, info] = await Promise.all([
      dtFetch<DtTokenResponse>(`/token/${dtChain}/${address}`),
      dtFetch<DtPriceResponse>(`/token/${dtChain}/${address}/price`),
      dtFetch<DtInfoResponse>(`/token/${dtChain}/${address}/info`),
    ]);
    if (!meta?.data?.symbol && !price?.data?.price) return null;
    return {
      chain,
      address,
      name: meta?.data?.name ?? address,
      symbol: (meta?.data?.symbol ?? '').toUpperCase(),
      logo: meta?.data?.logo ?? null,
      priceUsd: typeof price?.data?.price === 'number' ? price.data.price : null,
      marketCap: typeof info?.data?.mcap === 'number' ? info.data.mcap : null,
      fdv: typeof info?.data?.fdv === 'number' ? info.data.fdv : null,
    };
  });
  return cached ?? null;
}
