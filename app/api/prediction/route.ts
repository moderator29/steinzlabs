import 'server-only';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Prediction Markets API — KEYLESS Polymarket Gamma aggregator.
 *
 * Source (public, no API key required):
 *   GET https://gamma-api.polymarket.com/markets
 *     ?active=true&closed=false&archived=false
 *     &order=volumeNum&ascending=false&limit=<N>
 *
 * The Gamma `/markets` endpoint returns an ARRAY of market objects. The fields
 * this route relies on (all observed on the live endpoint / documented schema):
 *   - question          string   e.g. "Will BTC close above $150k in 2026?"
 *   - slug              string   market slug
 *   - outcomes          string   JSON-encoded array e.g. "[\"Yes\",\"No\"]"
 *   - outcomePrices     string   JSON-encoded array e.g. "[\"0.62\",\"0.38\"]"
 *                                (prices are implied probabilities in 0..1)
 *   - volumeNum         number   total USDC volume  (fallback: volume string)
 *   - liquidityNum      number   book liquidity     (fallback: liquidity string)
 *   - endDate           string   ISO 8601 close time
 *   - category          string   OPTIONAL — surfaced only when present
 *   - events            array    OPTIONAL — events[0].slug builds the canonical
 *                                polymarket.com/event/<slug> link
 *   - active / closed   boolean
 *
 * We NEVER fabricate odds: a market is dropped unless it has a question and at
 * least two outcomes with parseable prices. Every field is guarded because the
 * upstream shape can drift (some fields arrive as JSON strings, some absent).
 * On upstream failure we serve the last good cache if we have one, else an
 * honest empty list — the board renders a real "markets unavailable" state.
 */

const GAMMA_URL =
  'https://gamma-api.polymarket.com/markets' +
  '?active=true&closed=false&archived=false&order=volumeNum&ascending=false&limit=60';

const CACHE_TTL = 60_000; // 60s
const FETCH_TIMEOUT = 8_000; // 8s
const MAX_MARKETS = 48;
const UA = 'SteinzLabs-Prediction/1.0 (+https://steinzlabs.com)';

export interface PredictionOutcome {
  label: string;
  /** implied probability, 0..1 */
  price: number;
  /** implied probability as a whole-number percentage, 0..100 */
  pct: number;
}

export interface PredictionMarket {
  id: string;
  question: string;
  category: string | null;
  outcomes: PredictionOutcome[];
  volume: number | null;
  liquidity: number | null;
  endDate: string | null; // ISO 8601, or null when absent/unparseable
  url: string;
}

interface PredictionResponse {
  markets: PredictionMarket[];
  count: number;
  updatedAt: string; // ISO
  stale: boolean;
  error: string | null;
}

// ── Raw upstream shape (only the fields we read; everything optional) ─────────
interface RawEvent {
  slug?: string;
  title?: string;
}
interface RawMarket {
  id?: string | number;
  conditionId?: string;
  question?: string;
  slug?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  volumeNum?: number;
  volume?: string | number;
  liquidityNum?: number;
  liquidity?: string | number;
  endDate?: string;
  category?: string;
  events?: RawEvent[];
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
}

let cache: { data: PredictionMarket[]; ts: number } | null = null;

/** Parse a field that may be a JSON-encoded string array OR a real array. */
function parseStringArray(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((x) => String(x));
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      /* not JSON — ignore */
    }
  }
  return [];
}

function toNumber(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (typeof c === 'string' && c.trim()) {
      const n = Number(c);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function normalizeIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function buildUrl(m: RawMarket): string {
  const eventSlug = m.events?.find((e) => e?.slug)?.slug;
  const slug = eventSlug || m.slug;
  return slug ? `https://polymarket.com/event/${slug}` : 'https://polymarket.com';
}

function mapMarket(m: RawMarket): PredictionMarket | null {
  const question = typeof m.question === 'string' ? m.question.trim() : '';
  if (!question) return null;

  const labels = parseStringArray(m.outcomes);
  const prices = parseStringArray(m.outcomePrices);
  if (labels.length < 2 || prices.length < 2) return null;

  const outcomes: PredictionOutcome[] = [];
  const n = Math.min(labels.length, prices.length);
  for (let i = 0; i < n; i++) {
    const price = Number(prices[i]);
    if (!Number.isFinite(price) || price < 0 || price > 1) continue;
    outcomes.push({
      label: labels[i],
      price,
      pct: Math.round(price * 100),
    });
  }
  if (outcomes.length < 2) return null;

  // Show the strongest outcomes first — never reorder odds, just sort by prob.
  outcomes.sort((a, b) => b.price - a.price);

  const id = String(m.id ?? m.conditionId ?? m.slug ?? question);
  const category =
    typeof m.category === 'string' && m.category.trim() ? m.category.trim() : null;

  return {
    id,
    question,
    category,
    outcomes,
    volume: toNumber(m.volumeNum, m.volume),
    liquidity: toNumber(m.liquidityNum, m.liquidity),
    endDate: normalizeIso(m.endDate),
    url: buildUrl(m),
  };
}

async function fetchMarkets(): Promise<PredictionMarket[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(GAMMA_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': UA },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`gamma ${res.status}`);
    const json: unknown = await res.json();
    // Gamma returns a bare array; tolerate a { data: [] } wrapper too.
    const rows: RawMarket[] = Array.isArray(json)
      ? (json as RawMarket[])
      : Array.isArray((json as { data?: unknown })?.data)
        ? ((json as { data: RawMarket[] }).data)
        : [];
    const mapped = rows
      .filter((m) => m && m.active !== false && m.closed !== true && m.archived !== true)
      .map(mapMarket)
      .filter((m): m is PredictionMarket => m !== null)
      // strongest liquidity/volume first for a scannable board
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, MAX_MARKETS);
    return mapped;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL) {
    const body: PredictionResponse = {
      markets: cache.data,
      count: cache.data.length,
      updatedAt: new Date(cache.ts).toISOString(),
      stale: false,
      error: null,
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  }

  try {
    const markets = await fetchMarkets();
    cache = { data: markets, ts: now };
    const body: PredictionResponse = {
      markets,
      count: markets.length,
      updatedAt: new Date(now).toISOString(),
      stale: false,
      error: null,
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upstream unavailable';
    // Serve last good data if we have any — honest `stale` flag; never fake it.
    if (cache) {
      const body: PredictionResponse = {
        markets: cache.data,
        count: cache.data.length,
        updatedAt: new Date(cache.ts).toISOString(),
        stale: true,
        error: message,
      };
      return NextResponse.json(body, {
        headers: { 'Cache-Control': 'public, max-age=30' },
      });
    }
    const body: PredictionResponse = {
      markets: [],
      count: 0,
      updatedAt: new Date(now).toISOString(),
      stale: false,
      error: message,
    };
    return NextResponse.json(body, { status: 502 });
  }
}
