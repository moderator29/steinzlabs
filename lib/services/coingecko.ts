import 'server-only';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * CoinGecko Market Intelligence Service
 *
 * Single source of truth for every CoinGecko call in the codebase. All
 * routes must import from here so we get one cache, one rate-limit
 * budget, and one usage counter.
 *
 * Key handling is Demo-by-default (we're on the free Demo plan today)
 * with auto-upgrade to the Pro base URL + header when COINGECKO_PLAN=pro
 * is set in env. Falls back to the unauthenticated public endpoint on
 * 429 so the platform keeps working during a credit blowout.
 */

const API_KEY = process.env.COINGECKO_API_KEY || '';
const PLAN = (process.env.COINGECKO_PLAN || 'demo').toLowerCase(); // 'demo' | 'pro'
const BASE_PRO = 'https://pro-api.coingecko.com/api/v3';
const BASE_PUBLIC = 'https://api.coingecko.com/api/v3';
const TIMEOUT_MS = parseInt(process.env.COINGECKO_TIMEOUT_MS || '12000', 10);

function getBase(): string {
  if (!API_KEY) return BASE_PUBLIC;
  return PLAN === 'pro' ? BASE_PRO : BASE_PUBLIC;
}

function getHeaders(): Record<string, string> {
  if (!API_KEY) return {};
  // Demo keys use the demo header on the PUBLIC base; Pro keys use the pro
  // header on the PRO base. Sending the wrong one was the reason ~11 routes
  // around the codebase silently fell through to unauth'd calls.
  return PLAN === 'pro'
    ? { 'x-cg-pro-api-key': API_KEY }
    : { 'x-cg-demo-api-key': API_KEY };
}

// ─── Usage tracking ──────────────────────────────────────────────────────────

interface UsageCounter { total: number; byEndpoint: Record<string, number>; lastReset: number; }
const USAGE: UsageCounter = { total: 0, byEndpoint: {}, lastReset: Date.now() };

export function getCoingeckoUsage(): UsageCounter {
  return { ...USAGE, byEndpoint: { ...USAGE.byEndpoint } };
}

export function resetCoingeckoUsage(): void {
  USAGE.total = 0;
  USAGE.byEndpoint = {};
  USAGE.lastReset = Date.now();
}

function logCall(endpoint: string): void {
  USAGE.total += 1;
  USAGE.byEndpoint[endpoint] = (USAGE.byEndpoint[endpoint] ?? 0) + 1;
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

async function cgFetch(endpoint: string, params?: Record<string, string>): Promise<unknown> {
  logCall(endpoint);
  const url = new URL(`${getBase()}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  let res = await fetch(url.toString(), {
    headers: getHeaders(),
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // 429 fallback — drop to unauth'd public API so we at least get degraded service.
  if (res.status === 429) {
    const publicUrl = new URL(`${BASE_PUBLIC}${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) publicUrl.searchParams.set(k, v);
    }
    res = await fetch(publicUrl.toString(), {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  if (!res.ok) throw new Error(`CoinGecko ${endpoint} failed: ${res.status}`);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoinGeckoMarketToken {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  sparkline_in_7d?: { price: number[] };
}

export interface CoinGeckoTokenDetail {
  id: string;
  symbol: string;
  name: string;
  description: { en: string };
  image: { thumb: string; small: string; large: string };
  market_cap_rank: number;
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    fully_diluted_valuation: { usd: number };
    total_volume: { usd: number };
    high_24h: { usd: number };
    low_24h: { usd: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    ath: { usd: number };
    ath_change_percentage: { usd: number };
    ath_date: { usd: string };
  };
  platforms: Record<string, string>;
}

export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface GlobalMarketData {
  totalMarketCapUSD: number;
  totalVolumeUSD: number;
  btcDominancePercent: number;
  marketCapChange24hPercent: number;
  activeCryptocurrencies: number;
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number;
  price_btc: number;
  score: number;
  data?: { price_change_percentage_24h?: { usd?: number } };
}

// ─── Category mapping (for /coins/markets?category=) ─────────────────────────
// Keeps the front-end category names decoupled from CoinGecko's slugs.
export const COINGECKO_CATEGORY_MAP: Record<string, string | null> = {
  all: null,
  majors: null,
  defi: 'decentralized-finance-defi',
  layer1: 'layer-1',
  layer2: 'layer-2',
  gaming: 'gaming',
  ai: 'artificial-intelligence',
  meme: 'meme-token',
  depin: 'depin',
};

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getTopTokens(
  page = 1,
  perPage = 100,
  sparkline = false,
  category?: string,
): Promise<CoinGeckoMarketToken[]> {
  const key = cacheKey('coingecko', 'markets', {
    page: String(page), perPage: String(perPage), sparkline: String(sparkline), category: category ?? 'none',
  });
  return withCache(key, TTL.MARKET_CAP, async () => {
    const params: Record<string, string> = {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: String(perPage),
      page: String(page),
      sparkline: sparkline ? 'true' : 'false',
      price_change_percentage: '1h,24h,7d',
    };
    if (category) params.category = category;
    const data = await cgFetch('/coins/markets', params);
    return data as CoinGeckoMarketToken[];
  });
}

/** Top N gainers by 24h % change. Uses /coins/markets ordered by price_change_percentage_24h desc. */
export async function getTopGainers(limit = 10): Promise<CoinGeckoMarketToken[]> {
  const key = cacheKey('coingecko', 'gainers', { limit: String(limit) });
  return withCache(key, TTL.MARKET_CAP, async () => {
    const data = await cgFetch('/coins/markets', {
      vs_currency: 'usd',
      order: 'price_change_percentage_24h_desc',
      per_page: String(limit),
      page: '1',
      sparkline: 'true',
      price_change_percentage: '24h,7d',
    });
    return data as CoinGeckoMarketToken[];
  });
}

export async function getCoinsByCategory(category: string, limit = 20): Promise<CoinGeckoMarketToken[]> {
  return getTopTokens(1, limit, true, category);
}

export async function getTokenDetail(coinId: string): Promise<CoinGeckoTokenDetail> {
  const key = cacheKey('coingecko', 'detail', { coinId });
  return withCache(key, TTL.MARKET_CAP, async () => {
    const data = await cgFetch(`/coins/${coinId}`, {
      localization: 'false',
      tickers: 'false',
      market_data: 'true',
      community_data: 'false',
      developer_data: 'false',
      sparkline: 'false',
    });
    return data as CoinGeckoTokenDetail;
  });
}

export async function getOHLCV(
  coinId: string,
  days: number | 'max' = 1,
): Promise<OHLCVCandle[]> {
  const key = cacheKey('coingecko', 'ohlcv', { coinId, days: String(days) });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await cgFetch(`/coins/${coinId}/ohlc`, {
      vs_currency: 'usd',
      days: String(days),
    }) as number[][];
    return data.map(([time, open, high, low, close]) => ({
      time: Math.floor(time / 1000),
      open, high, low, close,
    }));
  });
}

export interface CoinMarketChartPoint { t: number; price: number; }
export async function getCoinMarketChart(coinId: string, days = 7): Promise<CoinMarketChartPoint[]> {
  const key = cacheKey('coingecko', 'market_chart', { coinId, days: String(days) });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await cgFetch(`/coins/${coinId}/market_chart`, {
      vs_currency: 'usd',
      days: String(days),
    }) as { prices: [number, number][] };
    return (data.prices ?? []).map(([t, price]) => ({ t, price }));
  });
}

export async function searchTokens(query: string): Promise<{
  coins: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }[];
}> {
  const key = cacheKey('coingecko', 'search', { query });
  return withCache(key, TTL.SEARCH_RESULT, async () => {
    const data = await cgFetch('/search', { query });
    return data as { coins: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }[] };
  });
}

export async function getGlobalMarketData(): Promise<GlobalMarketData> {
  const key = 'coingecko:global';
  return withCache(key, TTL.MARKET_CAP, async () => {
    const resp = await cgFetch('/global') as { data: Record<string, unknown> };
    const d = resp.data;
    return {
      totalMarketCapUSD: ((d.total_market_cap as Record<string, number>)?.usd) || 0,
      totalVolumeUSD: ((d.total_volume as Record<string, number>)?.usd) || 0,
      btcDominancePercent: ((d.market_cap_percentage as Record<string, number>)?.btc) || 0,
      marketCapChange24hPercent: (d.market_cap_change_percentage_24h_usd as number) || 0,
      activeCryptocurrencies: (d.active_cryptocurrencies as number) || 0,
    };
  });
}

export async function getTokenPrice(coinId: string, currency = 'usd'): Promise<number> {
  const key = cacheKey('coingecko', 'price', { coinId, currency });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await cgFetch('/simple/price', {
      ids: coinId,
      vs_currencies: currency,
    }) as Record<string, Record<string, number>>;
    return data[coinId]?.[currency] ?? 0;
  });
}

export interface TokenPriceDetailed { price: number; change24h: number; }
export async function getTokenPriceDetailed(coinIds: string[], currency = 'usd'): Promise<Record<string, TokenPriceDetailed>> {
  if (coinIds.length === 0) return {};
  const key = cacheKey('coingecko', 'price_detailed', { ids: coinIds.sort().join(','), currency });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await cgFetch('/simple/price', {
      ids: coinIds.join(','),
      vs_currencies: currency,
      include_24hr_change: 'true',
    }) as Record<string, Record<string, number>>;
    const out: Record<string, TokenPriceDetailed> = {};
    for (const id of coinIds) {
      const row = data[id] ?? {};
      out[id] = {
        price: row[currency] ?? 0,
        change24h: row[`${currency}_24h_change`] ?? 0,
      };
    }
    return out;
  });
}

export async function getContractPrice(
  address: string,
  chain: string,
  currency = 'usd',
): Promise<number> {
  const PLATFORM_MAP: Record<string, string> = {
    ethereum: 'ethereum', eth: 'ethereum',
    bsc: 'binance-smart-chain', bnb: 'binance-smart-chain',
    polygon: 'polygon-pos', matic: 'polygon-pos',
    avalanche: 'avalanche', avax: 'avalanche',
    base: 'base',
    arbitrum: 'arbitrum-one',
    optimism: 'optimistic-ethereum',
    solana: 'solana',
  };
  const platform = PLATFORM_MAP[chain.toLowerCase()] ?? chain;
  const key = cacheKey('coingecko', 'contract_price', { address: address.toLowerCase(), platform });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await cgFetch(`/simple/token_price/${platform}`, {
      contract_addresses: address,
      vs_currencies: currency,
    }) as Record<string, Record<string, number>>;
    return data[address.toLowerCase()]?.[currency] ?? 0;
  });
}

/** Fetch market data for a specific set of coin IDs (for attaching sparklines / prices to a known set). */
export async function getMarketsByIds(ids: string[], sparkline = true): Promise<CoinGeckoMarketToken[]> {
  if (!ids.length) return [];
  const key = cacheKey('coingecko', 'markets_by_ids', { ids: ids.slice().sort().join(','), spark: String(sparkline) });
  return withCache(key, TTL.MARKET_CAP, async () => {
    const data = await cgFetch('/coins/markets', {
      vs_currency: 'usd',
      ids: ids.join(','),
      per_page: String(Math.max(ids.length, 1)),
      page: '1',
      sparkline: sparkline ? 'true' : 'false',
      price_change_percentage: '24h,7d',
    });
    return data as CoinGeckoMarketToken[];
  });
}

export async function getTrendingTokens(): Promise<TrendingCoin[]> {
  const key = 'coingecko:trending';
  return withCache(key, TTL.MARKET_CAP, async () => {
    const data = await cgFetch('/search/trending') as {
      coins: { item: TrendingCoin }[];
    };
    return data.coins.map(c => c.item);
  });
}

/** Recently added coins — used by Context Feed "New Listing" events. */
export interface NewCoin { id: string; symbol: string; name: string; activated_at?: number; }
export async function getRecentlyAdded(limit = 20): Promise<NewCoin[]> {
  const key = cacheKey('coingecko', 'new_coins', { limit: String(limit) });
  return withCache(key, TTL.MARKET_CAP, async () => {
    // /coins/list/new is a Pro endpoint; fall back to sorting /coins/markets
    // by id desc isn't meaningful so if we're not on Pro we return an empty
    // list rather than fabricate.
    if (PLAN !== 'pro') return [];
    const data = await cgFetch('/coins/list/new') as NewCoin[];
    return data.slice(0, limit);
  });
}
