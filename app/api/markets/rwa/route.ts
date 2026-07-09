import 'server-only';
import { NextResponse } from 'next/server';

/**
 * RWA / TradFi board data.
 * GET /api/markets/rwa
 *
 * Real world assets surface — major indices, big stocks and gold/oil, in an
 * iOS-Stocks style list. Data comes from Twelve Data (https://twelvedata.com),
 * whose free tier covers US equities, several indices and forex/commodity
 * pairs (XAU/USD gold, WTI/USD oil) through one keyed API.
 *
 * Env: set TWELVE_DATA_API_KEY. With no key the route returns an honest
 *   { available:false, reason:'market data key not set' } and NEVER a
 *   fabricated price. Same honest shape when every upstream fetch fails.
 *
 * Alternative provider (Finnhub, FINNHUB_API_KEY) is documented in
 * .env.example but Twelve Data is the one wired up here because it serves
 * quotes + a mini time series for the sparkline from a single provider and
 * supports gold/oil pairs on the free tier.
 */

export const dynamic = 'force-dynamic';

// ─── Curated universe ─────────────────────────────────────────────────────────
// td = the exact symbol Twelve Data expects. symbol = what we show. Rows whose
// upstream data is missing are dropped honestly rather than shown blank.

type Section = 'indices' | 'stocks' | 'commodities';

interface SymbolDef {
  section: Section;
  symbol: string; // display symbol
  td: string;     // Twelve Data symbol
  name: string;   // fallback name if provider omits one
}

const UNIVERSE: SymbolDef[] = [
  // Indices — availability on the free tier is provider-gated; missing ones
  // are dropped, never faked.
  { section: 'indices', symbol: 'DJI', td: 'DJI', name: 'Dow Jones Industrial Average' },
  { section: 'indices', symbol: 'SPX', td: 'SPX', name: 'S&P 500' },
  { section: 'indices', symbol: 'IXIC', td: 'IXIC', name: 'Nasdaq Composite' },
  // Stocks
  { section: 'stocks', symbol: 'AAPL', td: 'AAPL', name: 'Apple Inc' },
  { section: 'stocks', symbol: 'MSFT', td: 'MSFT', name: 'Microsoft Corp' },
  { section: 'stocks', symbol: 'NVDA', td: 'NVDA', name: 'NVIDIA Corp' },
  { section: 'stocks', symbol: 'TSLA', td: 'TSLA', name: 'Tesla Inc' },
  { section: 'stocks', symbol: 'BA', td: 'BA', name: 'Boeing Co' },
  { section: 'stocks', symbol: 'DIS', td: 'DIS', name: 'Walt Disney Co' },
  { section: 'stocks', symbol: 'GE', td: 'GE', name: 'GE Aerospace' },
  { section: 'stocks', symbol: 'HD', td: 'HD', name: 'Home Depot Inc' },
  { section: 'stocks', symbol: 'NKE', td: 'NKE', name: 'Nike Inc' },
  { section: 'stocks', symbol: 'BRK.B', td: 'BRK.B', name: 'Berkshire Hathaway B' },
  // Commodities (forex-style pairs on Twelve Data)
  { section: 'commodities', symbol: 'XAU/USD', td: 'XAU/USD', name: 'Gold Spot' },
  { section: 'commodities', symbol: 'WTI/USD', td: 'WTI/USD', name: 'Crude Oil WTI' },
];

// ─── Normalized row shape returned to the client ──────────────────────────────

export interface RwaRow {
  section: Section;
  symbol: string;
  name: string;
  price: number;
  changeAbs: number;
  changePct: number;
  spark: number[];
  asOf: string | null;
}

interface RwaPayload {
  available: true;
  asOf: string;
  rows: RwaRow[];
}

interface RwaUnavailable {
  available: false;
  reason: string;
}

// ─── Server-side cache (~45s) ─────────────────────────────────────────────────

const CACHE_TTL_MS = 45_000;
let cache: { at: number; payload: RwaPayload } | null = null;

// ─── Twelve Data helpers ──────────────────────────────────────────────────────

const TD_BASE = 'https://api.twelvedata.com';

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

interface TdQuote {
  symbol?: string;
  name?: string;
  close?: string;
  change?: string;
  percent_change?: string;
  datetime?: string;
  timestamp?: number;
  status?: string;
}

interface TdSeries {
  values?: Array<{ datetime?: string; close?: string }>;
  status?: string;
}

/**
 * Twelve Data returns a symbol-keyed object for multi-symbol batch requests,
 * but the bare object for a single symbol. Normalize both into a Map keyed by
 * the td symbol so the caller never has to branch.
 */
function keyBySymbol<T extends { symbol?: string; status?: string }>(
  raw: unknown,
  order: string[],
): Map<string, T> {
  const out = new Map<string, T>();
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  // Single-symbol responses carry `close`/`values` at the top level.
  if ('close' in obj || 'values' in obj) {
    if (order.length === 1) out.set(order[0], obj as T);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') out.set(k, v as T);
  }
  return out;
}

async function tdFetch(path: string, symbols: string[], apiKey: string): Promise<unknown> {
  const symbolParam = symbols.map((s) => encodeURIComponent(s)).join(',');
  const url = `${TD_BASE}/${path}&symbol=${symbolParam}&apikey=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`Twelve Data ${path.split('?')[0]} ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json<RwaUnavailable>(
      { available: false, reason: 'market data key not set' },
      { status: 200 },
    );
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload, { status: 200 });
  }

  const symbols = UNIVERSE.map((d) => d.td);

  let quoteMap = new Map<string, TdQuote>();
  let seriesMap = new Map<string, TdSeries>();
  try {
    const [rawQuote, rawSeries] = await Promise.all([
      tdFetch('quote?', symbols, apiKey),
      tdFetch('time_series?interval=1day&outputsize=30', symbols, apiKey),
    ]);
    quoteMap = keyBySymbol<TdQuote>(rawQuote, symbols);
    seriesMap = keyBySymbol<TdSeries>(rawSeries, symbols);
  } catch {
    // Total upstream failure — serve stale cache if we have it, else honest.
    if (cache) return NextResponse.json(cache.payload, { status: 200 });
    return NextResponse.json<RwaUnavailable>(
      { available: false, reason: 'market data temporarily unavailable' },
      { status: 200 },
    );
  }

  const rows: RwaRow[] = [];
  let latestAsOf: string | null = null;

  for (const def of UNIVERSE) {
    const q = quoteMap.get(def.td);
    if (!q || q.status === 'error') continue;
    const price = num(q.close);
    if (price == null) continue; // never show a row without a real price

    const changeAbs = num(q.change) ?? 0;
    const changePct = num(q.percent_change) ?? 0;

    // Sparkline: Twelve Data returns newest-first, so reverse to chronological.
    const s = seriesMap.get(def.td);
    const spark = (s?.values ?? [])
      .map((v) => num(v.close))
      .filter((n): n is number => n != null)
      .reverse();

    const asOf = q.datetime ?? null;
    if (asOf && (!latestAsOf || asOf > latestAsOf)) latestAsOf = asOf;

    rows.push({
      section: def.section,
      symbol: def.symbol,
      name: q.name && q.name.trim() ? q.name : def.name,
      price,
      changeAbs,
      changePct,
      spark,
      asOf,
    });
  }

  if (rows.length === 0) {
    if (cache) return NextResponse.json(cache.payload, { status: 200 });
    return NextResponse.json<RwaUnavailable>(
      { available: false, reason: 'market data temporarily unavailable' },
      { status: 200 },
    );
  }

  const payload: RwaPayload = {
    available: true,
    asOf: latestAsOf ?? new Date().toISOString(),
    rows,
  };
  cache = { at: Date.now(), payload };
  return NextResponse.json(payload, { status: 200 });
}
