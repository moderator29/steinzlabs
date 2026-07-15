import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getLivePrice } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

/** Fast, ~5s-cached price snapshot for the per-second ticker on the coin page. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const price = await getLivePrice(chain, decodeURIComponent(address));
  if (!price) return NextResponse.json({ priceUsd: null, marketCapUsd: null, change24h: null });
  return NextResponse.json(price);
}
