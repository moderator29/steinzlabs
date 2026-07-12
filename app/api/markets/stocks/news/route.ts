import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStockNews } from '@/lib/services/yahooFinance';

/**
 * Stock news (Yahoo Finance).
 * GET /api/markets/stocks/news?symbol=AAPL   → news for a symbol
 * GET /api/markets/stocks/news               → general business/markets news
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 90_000;
const cache = new Map<string, { at: number; body: unknown }>();

export async function GET(req: NextRequest) {
  // Bound the query (and therefore the cache key): a ticker is short and
  // uppercase, so cap length and normalize. Prevents unbounded cache growth
  // from a flood of unique ?symbol= values.
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase().slice(0, 16) || undefined;
  const query = symbol || 'stock market';
  const key = `news:${query}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.body, { status: 200 });
  }

  const news = await getStockNews(query, symbol ? 12 : 20);
  const body = { available: news.length > 0, symbol: symbol ?? null, news };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body, { status: 200 });
}
