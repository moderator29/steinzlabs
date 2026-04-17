import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w" | "1M";

const TF_TO_DAYS: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 1,
  "15m": 1,
  "1h": 7,
  "4h": 30,
  "1d": 365,
  "1w": 365,
  "1M": 1825,
};

// DexScreener resolution mapping (their chart endpoint uses different codes)
const DS_RESOLUTION: Record<Timeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "1D",
  "1w": "1W",
  "1M": "1M",
};

async function fetchCoingeckoOhlc(tokenId: string, tf: Timeframe): Promise<Candle[] | null> {
  try {
    const days = TF_TO_DAYS[tf];
    const res = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/coins/${tokenId}/ohlc?vs_currency=usd&days=${days}`,
      { source: "coingecko-ohlc", timeoutMs: 6000, retries: 2 },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<[number, number, number, number, number]>;
    return rows.map(([ts, open, high, low, close]) => ({
      time: Math.floor(ts / 1000),
      open,
      high,
      low,
      close,
    }));
  } catch {
    return null;
  }
}

async function fetchDexscreenerOhlc(
  chain: string,
  pairAddress: string,
  tf: Timeframe,
): Promise<Candle[] | null> {
  try {
    const res = await fetchWithRetry(
      `https://io.dexscreener.com/dex/chart/amm/uniswap/bars/${chain}/${pairAddress}?from=0&to=${Date.now()}&res=${DS_RESOLUTION[tf]}&cb=${Date.now()}`,
      { source: "dexscreener-chart", timeoutMs: 6000, retries: 2 },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { bars?: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume?: number }> };
    const bars = json.bars ?? [];
    return bars.map((b) => ({
      time: Math.floor(b.timestamp / 1000),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
  } catch {
    return null;
  }
}

/**
 * Fetch OHLCV data with graceful fallback.
 * - If `chain` is a CoinGecko id (e.g. "bitcoin") and `token` is that same id, use CoinGecko.
 * - If `chain` looks like an on-chain network and `token` looks like a pair address, use DexScreener.
 * - Otherwise try CoinGecko first, then DexScreener.
 */
export async function fetchOhlcv(
  chain: string,
  token: string,
  tf: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  // Heuristic: short lowercase slug without 0x = CoinGecko id
  const looksLikeCgId = !/^0x|^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(token) && token.length < 40;
  let candles: Candle[] | null = null;

  if (looksLikeCgId) {
    candles = await fetchCoingeckoOhlc(token, tf);
  }
  if (!candles || candles.length === 0) {
    candles = await fetchDexscreenerOhlc(chain, token, tf);
  }
  if (!candles) candles = [];

  // Deduplicate + sort
  const byTime = new Map<number, Candle>();
  for (const c of candles) byTime.set(c.time, c);
  const out = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  return out.slice(-limit);
}
