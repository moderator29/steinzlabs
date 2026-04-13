import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { OHLCVCandle } from '@/lib/market/types';

export const dynamic = 'force-dynamic';

const BASE = 'https://api.coingecko.com/api/v3';

function cgHeaders(): Record<string, string> {
  return process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : {};
}

// Group raw price points into OHLC candles at `intervalSec` resolution
function synthesizeOHLC(
  prices: [number, number][],
  intervalSec: number
): OHLCVCandle[] {
  const groups = new Map<number, number[]>();
  for (const [ms, price] of prices) {
    const bucket = Math.floor(ms / 1000 / intervalSec) * intervalSec;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(price);
  }
  const candles: OHLCVCandle[] = [];
  for (const [time, pts] of [...groups.entries()].sort(([a], [b]) => a - b)) {
    candles.push({
      time,
      open:  pts[0],
      high:  Math.max(...pts),
      low:   Math.min(...pts),
      close: pts[pts.length - 1],
    });
  }
  return candles;
}

// How many seconds per candle for each days param
function intervalFor(days: string): number {
  if (days === '1')   return 1800;   // 30-min → 48 candles/day
  if (days === '7')   return 7200;   // 2-hour  → 84 candles/week
  if (days === '30')  return 21600;  // 6-hour  → 120 candles/month
  if (days === '365') return 86400;  // 1-day   → 365 candles/year
  return 604800;                      // 1-week  → for 'max'
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const days = req.nextUrl.searchParams.get('days') ?? '1';

  // market_chart gives dense price + real volume (unlike sparse /ohlc)
  const url = new URL(`${BASE}/coins/${id}/market_chart`);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('days', days);
  if (days === '1') url.searchParams.set('interval', 'minutely');

  try {
    const res = await fetch(url.toString(), {
      headers: cgHeaders(),
      next: { revalidate: 30 },
    } as RequestInit);

    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko ${res.status}` },
        { status: res.status }
      );
    }

    const raw = await res.json() as {
      prices: [number, number][];
      total_volumes: [number, number][];
    };

    const intervalSec = intervalFor(days);
    const candles = synthesizeOHLC(raw.prices ?? [], intervalSec);

    return NextResponse.json(
      { candles, volume: [] },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}
