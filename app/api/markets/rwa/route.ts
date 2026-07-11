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
  /**
   * Pyth Hermes price-feed id (hex, no 0x) for the keyless fallback. Only set
   * for instruments that map to a REAL, verified Pyth feed. Sourced from Pyth's
   * published feed catalog (verified against live Hermes responses + Pyth's
   * feed-id list on GitHub):
   *   XAU/USD  Metal.XAU/USD          765d2ba9…4ee34bb2
   *   WTI/USD  Commodities.USOILSPOT  925ca92f…4887b3e6  (WTI light-sweet crude spot)
   *   AAPL     Equity.US.AAPL/USD     49f6b65c…5ad55688
   *   MSFT     Equity.US.MSFT/USD     d0ca23c1…12ded4d1
   *   NVDA     Equity.US.NVDA/USD     b1073854…8860a593
   *   TSLA     Equity.US.TSLA/USD     16dad506…bc0632f1
   * Instruments with no verified Pyth equity/index feed (the DJI/SPX/IXIC raw
   * indices, and BA/DIS/GE/HD/NKE/BRK.B) intentionally have no `pyth` id and
   * therefore only appear when Twelve Data is available — never guessed.
   */
  pyth?: string;
  /** Pyth benchmark symbol (e.g. "Equity.US.AAPL/USD") for the keyless history/chart endpoint. */
  feed?: string;
}

const UNIVERSE: SymbolDef[] = [
  // Indices — availability on the free tier is provider-gated; missing ones
  // are dropped, never faked. Pyth publishes tracking ETFs, not the raw index
  // level, so these have no keyless fallback (mapping DJI→an ETF would be a
  // different instrument) and only show when Twelve Data is available.
  { section: 'indices', symbol: 'DJI', td: 'DJI', name: 'Dow Jones Industrial Average' },
  { section: 'indices', symbol: 'SPX', td: 'SPX', name: 'S&P 500' },
  { section: 'indices', symbol: 'IXIC', td: 'IXIC', name: 'Nasdaq Composite' },
  // Stocks
  { section: 'stocks', symbol: 'AAPL', td: 'AAPL', name: 'Apple Inc', pyth: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688', feed: 'Equity.US.AAPL/USD' },
  { section: 'stocks', symbol: 'MSFT', td: 'MSFT', name: 'Microsoft Corp', pyth: 'd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1', feed: 'Equity.US.MSFT/USD' },
  { section: 'stocks', symbol: 'NVDA', td: 'NVDA', name: 'NVIDIA Corp', pyth: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593', feed: 'Equity.US.NVDA/USD' },
  { section: 'stocks', symbol: 'TSLA', td: 'TSLA', name: 'Tesla Inc', pyth: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1', feed: 'Equity.US.TSLA/USD' },
  { section: 'stocks', symbol: 'BA', td: 'BA', name: 'Boeing Co' },
  { section: 'stocks', symbol: 'DIS', td: 'DIS', name: 'Walt Disney Co' },
  { section: 'stocks', symbol: 'GE', td: 'GE', name: 'GE Aerospace' },
  { section: 'stocks', symbol: 'HD', td: 'HD', name: 'Home Depot Inc' },
  { section: 'stocks', symbol: 'NKE', td: 'NKE', name: 'Nike Inc' },
  { section: 'stocks', symbol: 'BRK.B', td: 'BRK.B', name: 'Berkshire Hathaway B' },
  // Commodities (forex-style pairs on Twelve Data; keyless Pyth spot fallback)
  { section: 'commodities', symbol: 'XAU/USD', td: 'XAU/USD', name: 'Gold Spot', pyth: '765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2', feed: 'Metal.XAU/USD' },
  { section: 'commodities', symbol: 'WTI/USD', td: 'WTI/USD', name: 'Crude Oil WTI', pyth: '925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6', feed: 'Commodities.USOILSPOT' },
];

// ─── Normalized row shape returned to the client ──────────────────────────────

export interface RwaRow {
  section: Section;
  symbol: string;
  name: string;
  price: number;
  // Nullable: the keyless Pyth spot fallback provides a real price but no daily
  // change, so we return null rather than a fabricated 0.00% "flat" reading.
  changeAbs: number | null;
  changePct: number | null;
  spark: number[];
  asOf: string | null;
  /** Pyth benchmark symbol for the lazy chart endpoint; null when unknown. */
  feed: string | null;
}

type RwaSource = 'twelvedata' | 'pyth';

interface RwaPayload {
  available: true;
  source: RwaSource;
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

// ─── Pyth Hermes (keyless fallback) ───────────────────────────────────────────
//
// When Twelve Data is unavailable (no key, or upstream failure) we fall back to
// Pyth's public Hermes endpoint, which serves real prices for equities, metals,
// FX and commodities with NO API key. Hermes gives a spot price + publish time
// but no daily change and no time series, so those fields stay honest: change is
// null (never a fabricated 0.00%) and the sparkline is empty (no synthetic
// candles). Only instruments mapped to a verified feed id (SymbolDef.pyth) are
// requested.

const HERMES_BASE = 'https://hermes.pyth.network';

interface HermesParsedPrice {
  id?: string;
  price?: { price?: string; expo?: number; publish_time?: number };
}

interface HermesResponse {
  parsed?: HermesParsedPrice[];
}

/** Apply a Pyth integer price + exponent (e.g. price 4058725, expo -3 → 4058.725). */
function applyExpo(priceInt: string | undefined, expo: number | undefined): number | null {
  if (priceInt == null || expo == null) return null;
  const n = Number(priceInt);
  if (!Number.isFinite(n) || !Number.isFinite(expo)) return null;
  const v = n * Math.pow(10, expo);
  return Number.isFinite(v) ? v : null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Dynamic Pyth catalog → full equity + commodity universe ──────────────────
// Instead of a hand-written 15-row list, we pull Pyth's published feed catalog
// (`/v2/price_feeds?asset_type=…`) and build the universe from EVERY real feed
// it advertises — hundreds of US equities plus metals/commodities — so Stocks,
// AI stocks and RWA render the true market breadth, not a token sample. Every
// row still carries a REAL, verified Pyth feed id; nothing is invented. Cached
// 6h because the catalog itself changes rarely (only the prices move).

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
let catalogCache: { at: number; defs: Array<SymbolDef & { pyth: string }> } | null = null;

interface PythFeedMeta {
  id?: string;
  attributes?: {
    asset_type?: string;
    base?: string;
    description?: string;
    symbol?: string;
    display_symbol?: string;
  };
}

async function fetchCatalog(assetType: string): Promise<PythFeedMeta[]> {
  const url = `${HERMES_BASE}/v2/price_feeds?asset_type=${encodeURIComponent(assetType)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? (j as PythFeedMeta[]) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function metaToDef(m: PythFeedMeta): (SymbolDef & { pyth: string }) | null {
  const a = m.attributes;
  const id = m.id;
  if (!a || !id) return null;
  const sym = a.symbol ?? '';
  const at = (a.asset_type ?? '').toLowerCase();
  let section: Section | null = null;
  let display = a.base || a.display_symbol || '';
  if (at === 'equity' && sym.startsWith('Equity.US.')) {
    section = 'stocks';
    display = a.base || display;
  } else if (at === 'metal' || at === 'commodities') {
    section = 'commodities';
    display = a.display_symbol || a.base || display;
  }
  if (!section || !display) return null;
  return {
    section,
    symbol: display,
    td: display,
    name: a.description || display,
    pyth: id.replace(/^0x/, '').toLowerCase(),
    feed: sym || undefined,
  };
}

async function buildPythUniverse(): Promise<Array<SymbolDef & { pyth: string }>> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.defs;

  const [eq, metal, comm] = await Promise.all([
    fetchCatalog('equity'),
    fetchCatalog('metal'),
    fetchCatalog('commodities'),
  ]);

  const defs: Array<SymbolDef & { pyth: string }> = [];
  const seen = new Set<string>();
  for (const m of [...eq, ...metal, ...comm]) {
    const d = metaToDef(m);
    if (!d) continue;
    if (seen.has(d.symbol)) continue;
    seen.add(d.symbol);
    defs.push(d);
  }
  // Union the curated core so the marquee names are guaranteed present even if
  // the catalog shape shifts, and so they line up with the Twelve Data overlay.
  for (const c of UNIVERSE) {
    if (c.pyth && !seen.has(c.symbol)) {
      seen.add(c.symbol);
      defs.push(c as SymbolDef & { pyth: string });
    }
  }

  if (defs.length === 0) {
    // Catalog unreachable — fall back to the curated feed ids so Stocks never
    // goes blank. No cache write, so we retry the full catalog next request.
    return UNIVERSE.filter((d): d is SymbolDef & { pyth: string } => !!d.pyth);
  }
  catalogCache = { at: Date.now(), defs };
  return defs;
}

/** Batched Hermes spot fetch — chunks ids so the GET URL never overflows. */
async function hermesSpot(ids: string[]): Promise<Map<string, HermesParsedPrice>> {
  const byId = new Map<string, HermesParsedPrice>();
  await Promise.all(
    chunk(ids, 60).map(async (group) => {
      const params = group.map((id) => `ids[]=${id}`).join('&');
      const url = `${HERMES_BASE}/v2/updates/price/latest?${params}&parsed=true&encoding=hex`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) return;
        const j = (await res.json()) as HermesResponse;
        for (const p of j.parsed ?? []) {
          if (p?.id) byId.set(p.id.toLowerCase().replace(/^0x/, ''), p);
        }
      } catch {
        /* one chunk failing just drops its rows, never the whole board */
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return byId;
}

async function fetchPyth(): Promise<RwaPayload | null> {
  const defs = await buildPythUniverse();
  if (defs.length === 0) return null;

  const spot = await hermesSpot(defs.map((d) => d.pyth));

  const rows: RwaRow[] = [];
  let latestTs = 0;
  for (const def of defs) {
    const parsed = spot.get(def.pyth.toLowerCase());
    if (!parsed?.price) continue;
    const price = applyExpo(parsed.price.price, parsed.price.expo);
    if (price == null || price <= 0) continue; // never show a row without a real price

    const ts = parsed.price.publish_time ?? 0;
    if (ts > latestTs) latestTs = ts;

    rows.push({
      section: def.section,
      symbol: def.symbol,
      name: def.name,
      price,
      changeAbs: null, // Hermes spot has no daily change — stay honest.
      changePct: null,
      spark: [],       // list stays flat; the real series loads on expand.
      asOf: ts > 0 ? new Date(ts * 1000).toISOString() : null,
      feed: def.feed ?? null,
    });
  }

  if (rows.length === 0) return null;
  rows.sort((a, b) => (a.section === b.section ? a.symbol.localeCompare(b.symbol) : a.section.localeCompare(b.section)));
  return {
    available: true,
    source: 'pyth',
    asOf: latestTs > 0 ? new Date(latestTs * 1000).toISOString() : new Date().toISOString(),
    rows,
  };
}

// ── Twelve Data overlay: real daily change + sparkline for the curated core ──
// Twelve Data's free tier is rate-limited, so we only enrich the small curated
// set (marquee names) with change + a 30-point series, then paint that onto the
// matching Pyth rows. The long tail keeps its honest spot price.

interface TdOverlay {
  price: number | null;
  changeAbs: number;
  changePct: number;
  spark: number[];
  asOf: string | null;
}

async function fetchTwelveOverlay(apiKey: string): Promise<Map<string, TdOverlay>> {
  const curated = UNIVERSE.filter((d) => d.td);
  const symbols = curated.map((d) => d.td);
  const out = new Map<string, TdOverlay>();
  let rawQuote: unknown;
  let rawSeries: unknown;
  try {
    [rawQuote, rawSeries] = await Promise.all([
      tdFetch('quote?', symbols, apiKey),
      tdFetch('time_series?interval=1day&outputsize=30', symbols, apiKey),
    ]);
  } catch {
    return out;
  }
  const quoteMap = keyBySymbol<TdQuote>(rawQuote, symbols);
  const seriesMap = keyBySymbol<TdSeries>(rawSeries, symbols);
  for (const def of curated) {
    const q = quoteMap.get(def.td);
    if (!q || q.status === 'error') continue;
    const price = num(q.close);
    if (price == null) continue;
    const spark = (seriesMap.get(def.td)?.values ?? [])
      .map((v) => num(v.close))
      .filter((n): n is number => n != null)
      .reverse();
    out.set(def.symbol, {
      price,
      changeAbs: num(q.change) ?? 0,
      changePct: num(q.percent_change) ?? 0,
      spark,
      asOf: q.datetime ?? null,
    });
  }
  return out;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload, { status: 200 });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  // ── Backbone: the full keyless Pyth universe (hundreds of real tickers) ──
  const payload = await fetchPyth();

  if (payload) {
    // ── Overlay: Twelve Data change + sparkline for the curated core ──
    if (apiKey) {
      const overlay = await fetchTwelveOverlay(apiKey);
      if (overlay.size > 0) {
        payload.rows = payload.rows.map((r) => {
          const o = overlay.get(r.symbol);
          if (!o) return r;
          return {
            ...r,
            price: o.price ?? r.price,
            changeAbs: o.changeAbs,
            changePct: o.changePct,
            spark: o.spark,
            asOf: o.asOf ?? r.asOf,
          };
        });
      }
    }
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload, { status: 200 });
  }

  // ── Pyth unreachable — serve stale cache if any, else the honest state ──
  if (cache) return NextResponse.json(cache.payload, { status: 200 });
  return NextResponse.json<RwaUnavailable>(
    {
      available: false,
      reason: 'market data temporarily unavailable',
    },
    { status: 200 },
  );
}
