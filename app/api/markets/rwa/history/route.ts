import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

/**
 * RWA / stock price history (keyless charts for ANY ticker).
 * GET /api/markets/rwa/history?feed=Equity.US.AAPL/USD
 *
 * The Stocks board fetches this lazily when a row is expanded so every ticker in
 * the (dynamically built) universe gets a REAL daily chart, not just the handful
 * Twelve Data covers. Series comes from Pyth's public benchmarks TradingView
 * shim, which serves genuine daily OHLC for equities/metals/commodities with NO
 * API key. If the feed has no series (or the endpoint is down) we return an
 * honest { available:false } — never synthetic candles.
 */

export const dynamic = 'force-dynamic';

const BENCH_BASE = 'https://benchmarks.pyth.network';
const DAY = 86_400;

interface TvHistory {
  s?: string; // "ok" | "no_data" | "error"
  t?: number[];
  c?: number[];
}

interface HistoryPayload {
  available: true;
  feed: string;
  closes: number[];
  changeAbs: number | null;
  changePct: number | null;
}

// Small in-memory cache so repeated expands of the same ticker don't re-hit Pyth.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; payload: HistoryPayload }>();

export async function GET(req: NextRequest) {
  const feed = req.nextUrl.searchParams.get('feed');
  if (!feed) {
    return NextResponse.json({ available: false, reason: 'missing feed' }, { status: 200 });
  }

  const hit = cache.get(feed);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.payload, { status: 200 });
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - 150 * DAY; // ~150 calendar days → ~100 trading sessions
  const url =
    `${BENCH_BASE}/v1/shims/tradingview/history` +
    `?symbol=${encodeURIComponent(feed)}&resolution=D&from=${from}&to=${to}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let json: TvHistory;
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ available: false, reason: `upstream ${res.status}` }, { status: 200 });
    json = (await res.json()) as TvHistory;
  } catch {
    return NextResponse.json({ available: false, reason: 'upstream error' }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }

  if (json.s !== 'ok' || !Array.isArray(json.c) || json.c.length < 2) {
    return NextResponse.json({ available: false, reason: 'no series' }, { status: 200 });
  }

  const closes = json.c.filter((n) => Number.isFinite(n) && n > 0);
  if (closes.length < 2) {
    return NextResponse.json({ available: false, reason: 'no series' }, { status: 200 });
  }

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const changeAbs = last - prev;
  const changePct = prev !== 0 ? (changeAbs / prev) * 100 : null;

  const payload: HistoryPayload = {
    available: true,
    feed,
    closes,
    changeAbs,
    changePct,
  };
  cache.set(feed, { at: Date.now(), payload });
  return NextResponse.json(payload, { status: 200 });
}
