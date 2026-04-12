import 'server-only';
import { cache, TTL } from '../api/cache-manager';

const BASE = 'https://public-api.birdeye.so';
const KEY = process.env.BIRDEYE_API_KEY ?? '';

function headers(chain = 'solana') {
  return { 'X-API-KEY': KEY, 'x-chain': chain, Accept: 'application/json' };
}

async function get<T>(path: string, chain = 'solana'): Promise<T> {
  const cacheKey = `birdeye:${chain}:${path}`;
  const cached = cache.get<T>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE}${path}`, {
    headers: headers(chain),
    signal: AbortSignal.timeout(parseInt(process.env.API_TIMEOUT_MS || '600000')),
  });
  if (!res.ok) throw new Error(`Birdeye ${path} → ${res.status}`);
  const json = await res.json() as { data: T };
  cache.set(cacheKey, json.data, TTL.TOKEN_PRICE);
  return json.data;
}

// ─── Token Price ──────────────────────────────────────────────────────────────
export async function getBirdeyePrice(address: string, chain = 'solana'): Promise<number> {
  try {
    const data = await get<{ value: number }>(`/defi/price?address=${address}`, chain);
    return data?.value ?? 0;
  } catch { return 0; }
}

// ─── Token Overview ───────────────────────────────────────────────────────────
export interface BirdeyeTokenOverview {
  address: string; symbol: string; name: string; decimals: number;
  price: number; priceChange24hPercent: number; volume24h: number;
  marketCap: number; liquidity: number; holder: number;
  logoURI?: string; extensions?: Record<string, string>;
}

export async function getBirdeyeTokenOverview(address: string, chain = 'solana'): Promise<BirdeyeTokenOverview | null> {
  try {
    return await get<BirdeyeTokenOverview>(`/defi/token_overview?address=${address}`, chain);
  } catch { return null; }
}

// ─── Token Holders ────────────────────────────────────────────────────────────
export interface BirdeyeHolder {
  address: string; amount: number; decimals: number;
  uiAmount: number; uiAmountString: string; owner: string;
}

export async function getBirdeyeHolders(
  address: string, limit = 100, chain = 'solana'
): Promise<BirdeyeHolder[]> {
  try {
    const data = await get<{ items: BirdeyeHolder[] }>(
      `/defi/v3/token/holder?address=${address}&limit=${limit}&offset=0`, chain
    );
    return data?.items ?? [];
  } catch { return []; }
}

// ─── OHLCV Data ───────────────────────────────────────────────────────────────
export interface BirdeyeOHLCV {
  unixTime: number; open: number; high: number; low: number;
  close: number; volume: number;
}

export async function getBirdeyeOHLCV(
  address: string, type = '1H', limit = 100, chain = 'solana'
): Promise<BirdeyeOHLCV[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 86400 * 7;
    const data = await get<{ items: BirdeyeOHLCV[] }>(
      `/defi/ohlcv?address=${address}&type=${type}&time_from=${from}&time_to=${now}`, chain
    );
    return (data?.items ?? []).slice(0, limit);
  } catch { return []; }
}

// ─── Token List ───────────────────────────────────────────────────────────────
export interface BirdeyeTokenListItem {
  address: string; symbol: string; name: string;
  decimals: number; logoURI?: string; v24hUSD?: number;
}

export async function getBirdeyeTopTokens(limit = 20, chain = 'solana'): Promise<BirdeyeTokenListItem[]> {
  try {
    const cacheKey = `birdeye:top:${chain}:${limit}`;
    const cached = cache.get<BirdeyeTokenListItem[]>(cacheKey);
    if (cached) return cached;
    const data = await get<{ tokens: BirdeyeTokenListItem[] }>(
      `/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=${limit}`, chain
    );
    const tokens = data?.tokens ?? [];
    cache.set(cacheKey, tokens, TTL.TOKEN_PRICE);
    return tokens;
  } catch { return []; }
}
