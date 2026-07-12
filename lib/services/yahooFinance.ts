import 'server-only';

/**
 * Yahoo Finance data layer (keyless).
 *
 * Powers the Stocks tab exactly like the reference app: real prices, change %,
 * sparklines, timeframe charts, key stats and news — all from Yahoo's public
 * endpoints (no API key). Every call is defensive: on any failure it returns an
 * empty/neutral shape so the UI degrades to an honest state instead of throwing.
 *
 * Endpoints used (all keyless, server-side):
 *   /v8/finance/spark   — batched sparkline + prevClose for the list rows
 *   /v8/finance/chart   — per-symbol OHLC series + meta stats for the detail
 *   /v1/finance/search  — news for a symbol / query
 */

const BASES = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function yfetch(path: string, timeoutMs = 8000): Promise<any | null> {
  for (const base of BASES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${path}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (res.ok) return await res.json();
    } catch {
      /* try next base */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockRow {
  symbol: string;
  name: string;
  price: number;
  change: number | null;
  changePct: number | null;
  spark: number[];
  currency: string;
}

export interface StockStats {
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  peRatio: number | null;
  marketCap: number | null;
  week52High: number | null;
  week52Low: number | null;
  avgVolume: number | null;
}

export interface StockDetail {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string;
  price: number;
  change: number | null;
  changePct: number | null;
  postPrice: number | null;
  postChange: number | null;
  marketState: string | null;
  points: Array<{ t: number; c: number }>;
  prevClose: number | null;
  stats: StockStats;
}

export interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: number; // unix seconds
  thumbnail: string | null;
  relatedTickers: string[];
}

// ─── List rows (batched spark) ─────────────────────────────────────────────────

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Batched sparkline + change for a set of symbols. Yahoo caps a spark request's
 * URL, so we chunk. Newest data wins; missing symbols are simply dropped.
 */
export async function getStockRows(symbols: string[], nameMap: Record<string, string> = {}): Promise<StockRow[]> {
  const out: StockRow[] = [];
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 40) chunks.push(symbols.slice(i, i + 40));

  await Promise.all(
    chunks.map(async (group) => {
      const j = await yfetch(`/v8/finance/spark?symbols=${group.map(encodeURIComponent).join(',')}&range=1d&interval=15m`);
      if (!j || typeof j !== 'object') return;
      for (const sym of group) {
        const node = j[sym];
        // Two observed shapes: { symbol, close:[], previousClose } and
        // { response:[{ meta, timestamp, indicators:{quote:[{close}]} }] }.
        let closes: number[] = [];
        let prevClose: number | null = null;
        let price: number | null = null;
        let currency = 'USD';
        if (node?.close) {
          closes = (node.close as unknown[]).map(num).filter((n): n is number => n != null);
          prevClose = num(node.previousClose) ?? num(node.chartPreviousClose);
        } else if (Array.isArray(node?.response) && node.response[0]) {
          const r = node.response[0];
          closes = (r?.indicators?.quote?.[0]?.close ?? []).map(num).filter((n: number | null): n is number => n != null);
          prevClose = num(r?.meta?.previousClose) ?? num(r?.meta?.chartPreviousClose);
          price = num(r?.meta?.regularMarketPrice);
          currency = r?.meta?.currency ?? 'USD';
        }
        if (price == null) price = closes.length ? closes[closes.length - 1] : null;
        if (price == null) continue;
        const change = prevClose != null ? price - prevClose : null;
        const changePct = prevClose ? (change! / prevClose) * 100 : null;
        out.push({
          symbol: sym,
          name: nameMap[sym] || sym,
          price,
          change,
          changePct,
          spark: closes,
          currency,
        });
      }
    }),
  );
  // Preserve the caller's ordering.
  const order = new Map(symbols.map((s, i) => [s, i]));
  out.sort((a, b) => (order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0));
  return out;
}

// ─── Detail (per-symbol chart + stats) ─────────────────────────────────────────

const RANGE_INTERVAL: Record<string, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  YTD: { range: 'ytd', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
  '2Y': { range: '2y', interval: '1wk' },
};

export async function getStockDetail(symbol: string, tf = '1D'): Promise<StockDetail | null> {
  const ri = RANGE_INTERVAL[tf] ?? RANGE_INTERVAL['1D'];
  const j = await yfetch(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${ri.range}&interval=${ri.interval}&includePrePost=true`,
  );
  const result = j?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta ?? {};
  const ts: number[] = result.timestamp ?? [];
  const closes: Array<number | null> = result.indicators?.quote?.[0]?.close ?? [];
  const points: Array<{ t: number; c: number }> = [];
  for (let i = 0; i < ts.length; i++) {
    const c = num(closes[i]);
    if (c != null) points.push({ t: ts[i], c });
  }

  const price = num(meta.regularMarketPrice) ?? (points.length ? points[points.length - 1].c : null);
  if (price == null) return null;
  const prevClose = num(meta.chartPreviousClose) ?? num(meta.previousClose);
  const change = prevClose != null ? price - prevClose : null;
  const changePct = prevClose ? (change! / prevClose) * 100 : null;

  return {
    symbol,
    name: meta.shortName || meta.longName || symbol,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    currency: meta.currency || 'USD',
    price,
    change,
    changePct,
    postPrice: num(meta.postMarketPrice),
    postChange: num(meta.postMarketChange),
    marketState: meta.marketState ?? null,
    prevClose,
    points,
    stats: {
      open: num(meta.regularMarketOpen ?? meta.chartPreviousClose),
      high: num(meta.regularMarketDayHigh),
      low: num(meta.regularMarketDayLow),
      volume: num(meta.regularMarketVolume),
      peRatio: null, // not in chart meta; the quote endpoint is crumb-gated
      marketCap: null,
      week52High: num(meta.fiftyTwoWeekHigh),
      week52Low: num(meta.fiftyTwoWeekLow),
      avgVolume: null,
    },
  };
}

// ─── News (Yahoo search) ───────────────────────────────────────────────────────

export async function getStockNews(query: string, count = 12): Promise<NewsItem[]> {
  const j = await yfetch(
    `/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${count}&quotesCount=0&enableFuzzyQuery=false`,
  );
  const news = j?.news;
  if (!Array.isArray(news)) return [];
  return news
    .map((n: any): NewsItem | null => {
      if (!n?.title || !n?.link) return null;
      return {
        uuid: String(n.uuid ?? n.link),
        title: String(n.title),
        publisher: String(n.publisher ?? 'Yahoo Finance'),
        link: String(n.link),
        publishedAt: Number(n.providerPublishTime ?? 0),
        thumbnail: n?.thumbnail?.resolutions?.[0]?.url ?? null,
        relatedTickers: Array.isArray(n.relatedTickers) ? n.relatedTickers : [],
      };
    })
    .filter((n): n is NewsItem => n != null);
}
