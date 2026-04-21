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

function intervalFor(days: string): number {
  if (days === '1')   return 1800;
  if (days === '7')   return 7200;
  if (days === '30')  return 21600;
  if (days === '365') return 86400;
  return 604800;
}

// Same symbol→slug normalization the token detail route uses, so
// wallet links like /coin/arbitrum/eth resolve to CoinGecko's
// "ethereum" slug instead of a 404.
const SYMBOL_TO_SLUG: Record<string, string> = {
  eth: 'ethereum', weth: 'weth', btc: 'bitcoin', wbtc: 'wrapped-bitcoin',
  sol: 'solana', bnb: 'binancecoin', wbnb: 'wbnb', matic: 'matic-network',
  pol: 'polygon-ecosystem-token', avax: 'avalanche-2', arb: 'arbitrum',
  op: 'optimism', usdc: 'usd-coin', usdt: 'tether', dai: 'dai',
  link: 'chainlink', uni: 'uniswap', ltc: 'litecoin', trx: 'tron',
  doge: 'dogecoin', shib: 'shiba-inu',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  const id = SYMBOL_TO_SLUG[rawId.toLowerCase()] ?? rawId;
  const days = req.nextUrl.searchParams.get('days') ?? '1';

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