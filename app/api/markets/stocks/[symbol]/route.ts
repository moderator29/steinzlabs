import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStockDetail } from '@/lib/services/yahooFinance';

/**
 * Stock detail — timeframe chart + key stats.
 * GET /api/markets/stocks/[symbol]?tf=1D|1W|1M|3M|6M|YTD|1Y|2Y
 * Real Yahoo Finance data (keyless). Honest 404 when the symbol has no data.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; body: unknown }>();

export async function GET(req: NextRequest, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  const tf = req.nextUrl.searchParams.get('tf') || '1D';
  const key = `${symbol}:${tf}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.body, { status: 200 });
  }

  const detail = await getStockDetail(symbol, tf);
  if (!detail) {
    return NextResponse.json({ available: false, symbol }, { status: 200 });
  }
  const body = { available: true, ...detail };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body, { status: 200 });
}
