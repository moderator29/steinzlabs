import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { OHLCVCandle, VolumeBar } from '@/lib/market/types';

export const dynamic = 'force-dynamic';

const BASE = 'https://api.coingecko.com/api/v3';

function cgHeaders() {
  return process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : {};
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const days = req.nextUrl.searchParams.get('days') ?? '1';

  const url = new URL(`${BASE}/coins/${id}/ohlc`);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('days', days);

  try {
    const res = await fetch(url.toString(), {
      headers: cgHeaders(),
      next: { revalidate: 30 },
    } as RequestInit);

    if (!res.ok) {
      return NextResponse.json({ error: `CoinGecko ${res.status}` }, { status: res.status });
    }

    const raw = await res.json() as number[][];

    const candles: OHLCVCandle[] = raw.map(([t, o, h, l, c]) => ({
      time: Math.floor(t / 1000),
      open: o, high: h, low: l, close: c,
    }));

    const volume: VolumeBar[] = candles.map((c) => ({
      time: c.time,
      value: Math.abs(c.close - c.open) * 1000, // approximate volume
      color: c.close >= c.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
    }));

    return NextResponse.json({ candles, volume }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
