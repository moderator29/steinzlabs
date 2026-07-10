import 'server-only';
import { getTokenPriceDetailed, getCoinMarketChart } from '@/lib/services/coingecko';

/**
 * Naka Predict — live price feed.
 *
 * Reuses the platform's EXISTING CoinGecko service (`lib/services/coingecko.ts`)
 * as the single price source — no new paid feed is introduced. That service
 * already owns the one cache, rate-limit budget and usage counter for CoinGecko
 * across the whole app.
 *
 * Real prices only. `getSpot()` returns the live spot plus a short recent
 * `series` per symbol (used both for the honest volatility estimate and for the
 * UI mini-chart). The series is kept as a rolling in-memory last-N buffer that
 * is appended to on every fetch; on a cold buffer we seed it, once, from
 * CoinGecko's recent market chart so vol is estimable immediately. When a price
 * is genuinely unavailable we return null rather than inventing one.
 */

/** Tracked tokens. Symbol -> CoinGecko id. */
export const TRACKED: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
};

export const TRACKED_SYMBOLS = Object.keys(TRACKED);

export function coingeckoIdFor(symbol: string): string | null {
  return TRACKED[symbol.toUpperCase()] ?? null;
}

export function symbolForCoingeckoId(id: string): string | null {
  const found = Object.entries(TRACKED).find(([, cgId]) => cgId === id);
  return found ? found[0] : null;
}

/** Rolling sample buffer per symbol. Approx cadence is whatever the callers
 *  poll at; we timestamp every sample so vol can be scaled honestly by dt. */
const MAX_SAMPLES = 180;
interface Sample {
  t: number; // epoch ms
  price: number;
}
const buffers: Map<string, Sample[]> = new Map();
const seeded: Set<string> = new Set();

function push(symbol: string, price: number, t = Date.now()): void {
  if (!(price > 0)) return;
  const key = symbol.toUpperCase();
  const buf = buffers.get(key) ?? [];
  const last = buf[buf.length - 1];
  // De-dupe identical back-to-back samples inside the same second.
  if (last && last.price === price && t - last.t < 1000) return;
  buf.push({ t, price });
  if (buf.length > MAX_SAMPLES) buf.splice(0, buf.length - MAX_SAMPLES);
  buffers.set(key, buf);
}

/** One-time cold-start seed from CoinGecko's recent market chart so the vol
 *  estimate isn't a floor on the very first tick after a deploy. Best-effort. */
async function seedIfCold(symbol: string, cgId: string): Promise<void> {
  const key = symbol.toUpperCase();
  if (seeded.has(key)) return;
  seeded.add(key);
  const existing = buffers.get(key) ?? [];
  if (existing.length >= 8) return;
  try {
    const chart = await getCoinMarketChart(cgId, 1); // ~5-min granularity, last day
    const recent = chart.slice(-30);
    const buf = recent
      .filter((p) => Number.isFinite(p.price) && p.price > 0)
      .map((p) => ({ t: p.t, price: p.price }));
    if (buf.length) buffers.set(key, buf);
  } catch {
    /* honest degradation — vol falls back to its floor until live samples accrue */
  }
}

export interface Spot {
  symbol: string;
  coingeckoId: string;
  price: number | null; // null => genuinely unavailable, never fabricated
  series: number[]; // recent prices, oldest -> newest (for vol + chart)
  samples: { t: number; price: number }[]; // timestamped, for dt-aware vol
}

/**
 * Fetch live spot for the given symbols (defaults to all tracked tokens) and
 * return each with its rolling recent series. Prices come from the shared
 * CoinGecko service; unknown symbols and failed lookups yield price: null.
 */
export async function getSpot(symbols: string[] = TRACKED_SYMBOLS): Promise<Spot[]> {
  const wanted = symbols
    .map((s) => s.toUpperCase())
    .filter((s) => TRACKED[s]);

  const ids = wanted.map((s) => TRACKED[s]);

  // Seed any cold buffers, then fetch live prices from the shared service.
  await Promise.all(wanted.map((s) => seedIfCold(s, TRACKED[s])));

  let detailed: Record<string, { price: number; change24h: number }> = {};
  try {
    detailed = await getTokenPriceDetailed(ids);
  } catch {
    detailed = {};
  }

  const now = Date.now();
  return wanted.map((symbol) => {
    const cgId = TRACKED[symbol];
    const live = detailed[cgId]?.price;
    if (Number.isFinite(live) && (live as number) > 0) {
      push(symbol, live as number, now);
    }
    const buf = buffers.get(symbol) ?? [];
    const price =
      Number.isFinite(live) && (live as number) > 0
        ? (live as number)
        : buf.length
          ? buf[buf.length - 1].price
          : null;
    return {
      symbol,
      coingeckoId: cgId,
      price,
      series: buf.map((s) => s.price),
      samples: buf.map((s) => ({ t: s.t, price: s.price })),
    };
  });
}

/** Convenience: live spot for a single symbol, or null if unavailable. */
export async function getSpotOne(symbol: string): Promise<Spot | null> {
  const [s] = await getSpot([symbol]);
  return s ?? null;
}

/**
 * Median inter-sample spacing (seconds) of a timestamped buffer, used to scale
 * the per-sample vol into a per-second vol honestly. Falls back to 1s.
 */
export function sampleDtSeconds(samples: { t: number; price: number }[]): number {
  if (!samples || samples.length < 3) return 1;
  const gaps: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt > 0) gaps.push(dt);
  }
  if (!gaps.length) return 1;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return median > 0 ? median : 1;
}
