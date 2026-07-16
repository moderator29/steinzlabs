import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getCandles } from '@/lib/coins/coinService';
import type { CoinTimeframe } from '@/lib/coins/types';

export const dynamic = 'force-dynamic';

const VALID_TF = new Set<CoinTimeframe>(['1H', '4H', '1D', '7D', '3M', 'ALL']);

/** OHLC candles for the chart. ?tf=1H|4H|1D|7D|3M|ALL, optional &pair= for speed. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const url = new URL(req.url);
  const tfParam = (url.searchParams.get('tf') || '1H') as CoinTimeframe;
  const tf = VALID_TF.has(tfParam) ? tfParam : '1H';
  const pair = url.searchParams.get('pair');
  const candles = await getCandles(chain, decodeURIComponent(address), tf, pair);
  return NextResponse.json({ candles });
}
