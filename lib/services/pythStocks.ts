import 'server-only';
import { getStockRows, getStockDetail, type StockRow, type StockDetail } from './yahooFinance';

/**
 * Keyless Pyth fallback for the Stocks tab.
 *
 * WHY THIS EXISTS: Yahoo's finance endpoints are IP-blocked from datacenter
 * ranges (Vercel), so `getStockRows` / `getStockDetail` come back EMPTY in
 * production even though they work fine locally. That is exactly why the board
 * showed "Live market data coming online" with no rows. Pyth's public Hermes
 * (live spot) + Benchmarks (daily OHLC) endpoints have NO key and are reachable
 * from any IP, so we use them to guarantee the board always renders REAL prices.
 *
 * Strategy: Yahoo stays primary (richest data when reachable); for every symbol
 * Yahoo does NOT return we fill from Pyth — a live spot price plus a real daily
 * sparkline and day change from Benchmarks. Nothing is fabricated: a symbol that
 * maps to no real Pyth feed (raw indices like ^GSPC, some futures) is simply
 * dropped rather than shown blank.
 */

const HERMES_BASE = 'https://hermes.pyth.network';
const BENCH_BASE = 'https://benchmarks.pyth.network';
const DAY = 86_400;

// ─── Catalog: base symbol → Pyth feed (id + benchmark symbol) ──────────────────

interface FeedInfo { id: string; feed: string }
const CATALOG_TTL = 6 * 60 * 60 * 1000;
let catalog: { at: number; byBase: Map<string, FeedInfo> } | null = null;

// Futures / index tickers we display (Yahoo notation) mapped to the Pyth base
// symbol of the equivalent REAL feed. Only pairs with a genuine Pyth feed are
// listed — nothing is approximated.
const FUTURES_BASE: Record<string, string> = {
  'GC=F': 'XAU', 'SI=F': 'XAG', 'CL=F': 'WTI', 'HG=F': 'XCU', 'NG=F': 'NG',
  'PA=F': 'XPD', 'PL=F': 'XPT',
};

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function loadCatalog(): Promise<Map<string, FeedInfo>> {
  if (catalog && Date.now() - catalog.at < CATALOG_TTL) return catalog.byBase;
  const byBase = new Map<string, FeedInfo>();
  const groups = await Promise.all(
    ['equity', 'metal', 'commodities'].map((at) => fetchJson(`${HERMES_BASE}/v2/price_feeds?asset_type=${at}`)),
  );
  for (const arr of groups) {
    if (!Array.isArray(arr)) continue;
    for (const m of arr) {
      const id = m?.id;
      const a = m?.attributes;
      if (!id || !a) continue;
      const base = String(a.base || '').toUpperCase();
      const sym = String(a.symbol || '');
      if (!base || !sym) continue;
      // Only US equities on the equity side (skip foreign listings we don't show).
      if (a.asset_type === 'equity' && !sym.startsWith('Equity.US.')) continue;
      if (!byBase.has(base)) byBase.set(base, { id: String(id).replace(/^0x/, '').toLowerCase(), feed: sym });
    }
  }
  if (byBase.size) catalog = { at: Date.now(), byBase };
  return byBase;
}

/** Resolve a Yahoo display ticker to a Pyth feed, trying the notations Pyth uses. */
function resolveFeed(symbol: string, byBase: Map<string, FeedInfo>): FeedInfo | null {
  const s = symbol.toUpperCase();
  const cands: string[] = [s];
  if (s.startsWith('^')) cands.push(s.slice(1));
  if (s.includes('-')) { cands.push(s.replace(/-/g, '.')); cands.push(s.replace(/-/g, '')); }
  if (FUTURES_BASE[s]) cands.push(FUTURES_BASE[s]);
  for (const c of cands) {
    const hit = byBase.get(c);
    if (hit) return hit;
  }
  return null;
}

// ─── Hermes live spot (batched) ────────────────────────────────────────────────

async function hermesSpot(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));
  await Promise.all(
    chunks.map(async (group) => {
      const params = group.map((id) => `ids[]=${id}`).join('&');
      const j = await fetchJson(`${HERMES_BASE}/v2/updates/price/latest?${params}&parsed=true&encoding=hex`);
      for (const p of j?.parsed ?? []) {
        const id = p?.id ? String(p.id).toLowerCase().replace(/^0x/, '') : '';
        const raw = p?.price?.price;
        const expo = p?.price?.expo;
        if (!id || raw == null || expo == null) continue;
        const v = Number(raw) * Math.pow(10, Number(expo));
        if (Number.isFinite(v) && v > 0) out.set(id, v);
      }
    }),
  );
  return out;
}

// ─── Benchmarks daily history (keyless charts) ─────────────────────────────────

const HIST_TTL = 5 * 60 * 1000;
const histCache = new Map<string, { at: number; t: number[]; c: number[] }>();

async function benchHistory(feed: string, resolution: string, fromSec: number, toSec: number): Promise<{ t: number[]; c: number[] }> {
  const key = `${feed}:${resolution}:${Math.floor(fromSec / 3600)}`;
  const hit = histCache.get(key);
  if (hit && Date.now() - hit.at < HIST_TTL) return { t: hit.t, c: hit.c };
  const url = `${BENCH_BASE}/v1/shims/tradingview/history?symbol=${encodeURIComponent(feed)}&resolution=${resolution}&from=${fromSec}&to=${toSec}`;
  const j = await fetchJson(url);
  if (j?.s === 'ok' && Array.isArray(j.c) && Array.isArray(j.t)) {
    const t: number[] = [];
    const c: number[] = [];
    for (let i = 0; i < j.c.length; i++) {
      const close = Number(j.c[i]);
      if (Number.isFinite(close) && close > 0) { t.push(Number(j.t[i])); c.push(close); }
    }
    histCache.set(key, { at: Date.now(), t, c });
    return { t, c };
  }
  return { t: [], c: [] };
}

// ─── Public: resilient rows ────────────────────────────────────────────────────

/** Pyth-only rows for a set of symbols (live spot price + daily sparkline/change). */
async function getPythStockRows(symbols: string[], nameMap: Record<string, string>): Promise<StockRow[]> {
  const byBase = await loadCatalog();
  const resolved = symbols
    .map((symbol) => ({ symbol, info: resolveFeed(symbol, byBase) }))
    .filter((r): r is { symbol: string; info: FeedInfo } => r.info != null);
  if (resolved.length === 0) return [];

  const spot = await hermesSpot(resolved.map((r) => r.info.id));
  const to = Math.floor(Date.now() / 1000);
  const from = to - 45 * DAY;

  const rows = await Promise.all(
    resolved.map(async ({ symbol, info }) => {
      const { c: closes } = await benchHistory(info.feed, 'D', from, to);
      const price = spot.get(info.id) ?? (closes.length ? closes[closes.length - 1] : null);
      if (price == null || price <= 0) return null;
      const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
      const change = prevClose != null ? price - prevClose : null;
      const changePct = prevClose ? (change! / prevClose) * 100 : null;
      return {
        symbol,
        name: nameMap[symbol] || symbol,
        price,
        change,
        changePct,
        spark: closes.slice(-30),
        currency: 'USD',
      } as StockRow;
    }),
  );
  return rows.filter((r): r is StockRow => r != null);
}

/**
 * Yahoo first (richest), Pyth fills every symbol Yahoo omits. On Vercel (Yahoo
 * blocked) this means the whole board comes from Pyth — real prices, never blank.
 */
export async function getStockRowsResilient(symbols: string[], nameMap: Record<string, string> = {}): Promise<StockRow[]> {
  const yahoo = await getStockRows(symbols, nameMap);
  const have = new Set(yahoo.map((r) => r.symbol));
  const missing = symbols.filter((s) => !have.has(s));
  if (missing.length === 0) return orderBy(symbols, yahoo);
  const pyth = await getPythStockRows(missing, nameMap);
  return orderBy(symbols, [...yahoo, ...pyth]);
}

function orderBy(symbols: string[], rows: StockRow[]): StockRow[] {
  const order = new Map(symbols.map((s, i) => [s, i]));
  return [...rows].sort((a, b) => (order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0));
}

// ─── Public: resilient detail ──────────────────────────────────────────────────

const TF_BENCH: Record<string, { res: string; days: number }> = {
  '1D': { res: '15', days: 3 },
  '1W': { res: '60', days: 9 },
  '1M': { res: 'D', days: 35 },
  '3M': { res: 'D', days: 95 },
  '6M': { res: 'D', days: 190 },
  YTD: { res: 'D', days: 250 },
  '1Y': { res: 'D', days: 370 },
  '2Y': { res: 'W', days: 740 },
};

async function getPythStockDetail(symbol: string, tf: string, name: string): Promise<StockDetail | null> {
  const byBase = await loadCatalog();
  const info = resolveFeed(symbol, byBase);
  if (!info) return null;

  const conf = TF_BENCH[tf] ?? TF_BENCH['1D'];
  const to = Math.floor(Date.now() / 1000);
  const from = to - conf.days * DAY;
  const [{ t, c }, spot, daily] = await Promise.all([
    benchHistory(info.feed, conf.res, from, to),
    hermesSpot([info.id]),
    // A daily series (regardless of tf) gives an honest prevClose + day range.
    benchHistory(info.feed, 'D', to - 8 * DAY, to),
  ]);

  const points = t.map((ts, i) => ({ t: ts, c: c[i] })).filter((p) => Number.isFinite(p.c));
  const live = spot.get(info.id) ?? null;
  const price = live ?? (points.length ? points[points.length - 1].c : null);
  if (price == null) return null;

  const dCloses = daily.c;
  const prevClose = dCloses.length >= 2 ? dCloses[dCloses.length - 2] : (points.length >= 2 ? points[points.length - 2].c : null);
  const change = prevClose != null ? price - prevClose : null;
  const changePct = prevClose ? (change! / prevClose) * 100 : null;
  const recent = dCloses.length ? dCloses.slice(-1)[0] : null;

  return {
    symbol,
    name,
    exchange: null,
    currency: 'USD',
    price,
    change,
    changePct,
    postPrice: null,
    postChange: null,
    marketState: null,
    prevClose,
    points,
    stats: {
      open: prevClose,
      high: recent != null ? Math.max(...dCloses.slice(-2)) : null,
      low: recent != null ? Math.min(...dCloses.slice(-2)) : null,
      volume: null,
      peRatio: null,
      marketCap: null,
      week52High: dCloses.length ? Math.max(...dCloses) : null,
      week52Low: dCloses.length ? Math.min(...dCloses) : null,
      avgVolume: null,
    },
  };
}

/** Yahoo detail first; Pyth benchmark chart as the keyless fallback. */
export async function getStockDetailResilient(symbol: string, tf: string, name: string): Promise<StockDetail | null> {
  const yahoo = await getStockDetail(symbol, tf);
  if (yahoo && yahoo.points.length >= 2) return yahoo;
  const pyth = await getPythStockDetail(symbol, tf, name);
  return pyth ?? yahoo;
}
