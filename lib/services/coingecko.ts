import 'server-only';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * CoinGecko Market Intelligence Service
 * Uses paid API key (COINGECKO_API_KEY) with public endpoint fallback on rate limit.
 */

const API_KEY = process.env.COINGECKO_API_KEY || '';
const BASE_PRO = 'https://pro-api.coingecko.com/api/v3';
const BASE_PUBLIC = 'https://api.coingecko.com/api/v3';

const TIMEOUT_MS = parseInt(process.env.COINGECKO_TIMEOUT_MS || '12000', 10);

function getBase(): string {
  return API_KEY ? BASE_PRO : BASE_PUBLIC;
}

function getHeaders(): Record<string, string> {
  if (!API_KEY) return {};
  return { 'x-cg-pro-api-key': API_KEY };
}

async function cgFetch(endpoint: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(`${getBase()}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  let res = await fetch(url.toString(), {
    headers: getHeaders(),
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // Fallback to public API on rate limit
  if (res.status === 429 && API_KEY) {
    const publicUrl = new URL(`${BASE_PUBLIC}${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        publicUrl.searchParams.set(k, v);
      }
    }
    res = await fetch(publicUrl.toString(), {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
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
  time: number;  // unix timestamp (seconds)
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

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getTopTokens(
  page = 1,
  perPage = 100,
  sparkline = false
): Promise<CoinGeckoMarketToken[]> {
  const key = cacheKey('coingecko', 'markets', { page: String(page), perPage: String(perPage) });
  return withCache(key, TTL.MARKET_CAP, async () => {
    const data = await cgFetch('/coins/markets', {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: String(perPage),
      page: String(page),
      sparkline: sparkline ? 'true' : 'false',
      price_change_percentage: '1h,24h,7d',
    });
    return data as CoinGeckoMarketToken[];
  });
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
  days: number | 'max' = 1
): Promise<OHLCVCandle[]> {
  const key = cacheKey('coingecko', 'ohlcv', { coinId, days: String(days) });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await cgFetch(`/coins/${coinId}/ohlc`, {
      vs_currency: 'usd',
      days: String(days),
    }) as number[][];
    return data.map(([time, open, high, low, close]) => ({
      time: Math.floor(time / 1000), // Convert ms to seconds for lightweight-charts
      open, high, low, close,
    }));
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

export async function getTokenPrice(
  coinId: string,
  currency = 'usd'
): Promise<number> {
  const key = cacheKey('coingecko', 'price', { coinId, currency });
  return withCache(key, TTL.TOKEN_PRICE, async () => {
    const data = await cgFetch('/simple/price', {
      ids: coinId,
      vs_currencies: currency,
    }) as Record<string, Record<string, number>>;
    return data[coinId]?.[currency] ?? 0;
  });
}

export async function getContractPrice(
  address: string,
  chain: string,
  currency = 'usd'
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

export async function getTrendingTokens(): Promise<{
  id: string; name: string; symbol: string; thumb: string; score: number;
}[]> {
  const key = 'coingecko:trending';
  return withCache(key, TTL.MARKET_CAP, async () => {
    const data = await cgFetch('/search/trending') as {
      coins: { item: { id: string; name: string; symbol: string; thumb: string; score: number } }[];
    };
    return data.coins.map(c => c.item);
  });
}
