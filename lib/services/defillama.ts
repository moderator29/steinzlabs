import 'server-only';
import { cache, TTL } from '../api/cache-manager';

const BASE = 'https://api.llama.fi';
const COINS = 'https://coins.llama.fi';
const TIMEOUT = parseInt(process.env.API_TIMEOUT_MS || '600000');

async function get<T>(url: string, ttl: number = TTL.WALLET_BALANCE): Promise<T> {
  const cached = cache.get<T>(url);
  if (cached) return cached;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`DefiLlama ${url} → ${res.status}`);
  const data = await res.json() as T;
  cache.set(url, data, ttl);
  return data;
}

// ─── Protocol TVL ─────────────────────────────────────────────────────────────
export interface DLProtocol {
  id: string; name: string; slug: string; tvl: number;
  chainTvls: Record<string, number>; change_1d: number;
  change_7d: number; mcap?: number; logo?: string; url?: string;
  category?: string; chains: string[];
}

export async function getDLProtocol(slug: string): Promise<DLProtocol | null> {
  try {
    return await get<DLProtocol>(`${BASE}/protocol/${slug}`, TTL.TOKEN_SECURITY);
  } catch { return null; }
}

export async function getDLProtocols(): Promise<DLProtocol[]> {
  try {
    const data = await get<DLProtocol[]>(`${BASE}/protocols`, TTL.TOKEN_SECURITY);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ─── Chain TVL ────────────────────────────────────────────────────────────────
export interface DLChain { gecko_id: string; tvl: number; tokenSymbol: string; cmcId?: string; name: string; chainId?: number; }

export async function getDLChains(): Promise<DLChain[]> {
  try {
    return await get<DLChain[]>(`${BASE}/v2/chains`, TTL.WALLET_BALANCE);
  } catch { return []; }
}

export async function getDLChainTvl(chain: string): Promise<{ date: number; tvl: number }[]> {
  try {
    const data = await get<{ date: number; tvl: number }[]>(
      `${BASE}/v2/historicalChainTvl/${chain}`, TTL.TOKEN_SECURITY
    );
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ─── Token Prices (coins.llama.fi) ────────────────────────────────────────────
export interface DLCoinPrice {
  decimals?: number; price: number; symbol: string;
  timestamp: number; confidence: number;
}

export async function getDLCoinPrices(coins: string[]): Promise<Record<string, DLCoinPrice>> {
  if (!coins.length) return {};
  try {
    const coinsParam = coins.slice(0, 25).join(',');
    const data = await get<{ coins: Record<string, DLCoinPrice> }>(
      `${COINS}/prices/current/${coinsParam}`, TTL.TOKEN_PRICE
    );
    return data?.coins ?? {};
  } catch { return {}; }
}

// ─── Stablecoin Market Cap ─────────────────────────────────────────────────────
export interface DLStablecoin {
  id: string; name: string; symbol: string;
  pegType: string; circulating: { peggedUSD: number };
  circulatingPrevDay?: { peggedUSD: number };
}

export async function getDLStablecoins(): Promise<DLStablecoin[]> {
  try {
    const data = await get<{ peggedAssets: DLStablecoin[] }>(
      'https://stablecoins.llama.fi/stablecoins?includePrices=true', TTL.TOKEN_SECURITY
    );
    return data?.peggedAssets ?? [];
  } catch { return []; }
}

// ─── Global TVL ───────────────────────────────────────────────────────────────
export async function getDLGlobalTvl(): Promise<{ date: number; tvl: number }[]> {
  try {
    const data = await get<{ date: number; tvl: number }[]>(
      `${BASE}/v2/historicalChainTvl`, TTL.TOKEN_SECURITY
    );
    return Array.isArray(data) ? data.slice(-90) : [];
  } catch { return []; }
}
