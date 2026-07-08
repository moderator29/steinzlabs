import { fetchWithRetry } from "@/lib/api/fetchWithRetry";
import { getGtTopPool, getGtCandles } from "@/lib/services/geckoterminal";

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

// Our timeframe → GeckoTerminal OHLCV (timeframe, aggregate) pair.
const GT_TF: Record<Timeframe, ['minute' | 'hour' | 'day', number]> = {
  "1m": ["minute", 1],
  "5m": ["minute", 5],
  "15m": ["minute", 15],
  "1h": ["hour", 1],
  "4h": ["hour", 4],
  "1d": ["day", 1],
  "1w": ["day", 7],
  "1M": ["day", 30],
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
 * When we know the coin's real on-chain identity (contract/pool + network),
 * prefer GeckoTerminal's pool OHLCV — it returns REAL per-bar volume, which
 * CoinGecko's /ohlc endpoint never does. `pool` is a pair/pool address (used
 * directly); otherwise `address` is a token contract whose deepest pool is
 * resolved first. Returns null when no pool can be found or the source is
 * empty, so callers fall through to the candles-only CoinGecko path.
 */
async function fetchGeckoterminalOhlcv(
  network: string,
  tf: Timeframe,
  opts: { address?: string; pool?: string },
): Promise<Candle[] | null> {
  const [gtTf, agg] = GT_TF[tf];
  let pool = opts.pool ?? null;
  if (!pool && opts.address) {
    pool = await getGtTopPool(network, opts.address).catch(() => null);
  }
  if (!pool) return null;
  const gt = await getGtCandles(network, pool, gtTf, 300, agg).catch(() => []);
  if (gt.length === 0) return null;
  return gt.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
}

/**
 * Options carrying the coin's real on-chain identity so the OHLCV lookup can
 * prefer a volume-bearing source. Populated by the terminal page from the
 * CoinGecko detail payload (contract `platforms` / DexScreener pair) for coins
 * that would otherwise chart via a volume-less CoinGecko slug.
 */
export interface OhlcvSource {
  /** GeckoTerminal-supported network slug (ethereum, solana, base, …). */
  network?: string;
  /** Token contract address (deepest pool resolved automatically). */
  address?: string;
  /** Pool/pair address (used directly when known). */
  pair?: string;
}

/**
 * Fetch OHLCV data with graceful fallback.
 * - If a real on-chain identity is supplied (`source.network` + pool/contract),
 *   prefer GeckoTerminal pool OHLCV so the volume pane fills with REAL volume.
 * - If `chain` is a CoinGecko id (e.g. "bitcoin") and `token` is that same id, use CoinGecko.
 * - If `chain` looks like an on-chain network and `token` looks like a pair address, use DexScreener.
 * - Otherwise try CoinGecko first, then DexScreener.
 * Volume is never synthesized — when a source returns no volume the bar stays
 * honestly empty.
 */
export async function fetchOhlcv(
  chain: string,
  token: string,
  tf: Timeframe,
  limit = 500,
  source?: OhlcvSource,
): Promise<Candle[]> {
  // Heuristic: short lowercase slug without 0x = CoinGecko id
  const looksLikeCgId = !/^0x|^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(token) && token.length < 40;
  let candles: Candle[] | null = null;

  // Volume-bearing source first. CoinGecko's /ohlc (below) returns candles
  // with NO volume, so any coin that has a known contract/pool + a supported
  // network is routed to GeckoTerminal's pool OHLCV, which carries real
  // per-bar volume. Falls through to CoinGecko candles when unavailable.
  if (source?.network && (source.pair || source.address)) {
    candles = await fetchGeckoterminalOhlcv(source.network, tf, {
      address: source.address,
      pool: source.pair,
    });
  }

  if ((!candles || candles.length === 0) && looksLikeCgId) {
    candles = await fetchCoingeckoOhlc(token, tf);
  }
  if (!candles || candles.length === 0) {
    candles = await fetchDexscreenerOhlc(chain, token, tf);
  }
  // GeckoTerminal fallback (keyless, Solana + 100+ EVM nets). The token here is
  // usually a TOKEN contract, but DexScreener's chart endpoint expects a PAIR
  // address and hardcodes "uniswap" — so it silently returns nothing for
  // Solana / non-uniswap memecoins. Resolve the token's deepest pool, then pull
  // real candles. This is what makes a big memecoin's chart actually render.
  if ((!candles || candles.length === 0) && /^0x|^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(token)) {
    const pool = await getGtTopPool(chain, token).catch(() => null);
    if (pool) {
      const [gtTf, agg] = GT_TF[tf];
      const gt = await getGtCandles(chain, pool, gtTf, 300, agg).catch(() => []);
      if (gt.length > 0) candles = gt.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
    }
  }
  if (!candles) candles = [];

  // Deduplicate + sort
  const byTime = new Map<number, Candle>();
  for (const c of candles) byTime.set(c.time, c);
  const out = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  return out.slice(-limit);
}
