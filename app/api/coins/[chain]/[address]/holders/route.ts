import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { resolveCoin } from '@/lib/coins/coinService';
import { getPlatformHolders } from '@/lib/coins/social';

export const dynamic = 'force-dynamic';

/**
 * Holders that bought via Naka, with real avg hold-time + PnL. We resolve the
 * live price first so usdValue and PnL reflect the current market.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const addr = decodeURIComponent(address);
  const coin = await resolveCoin(chain, addr).catch(() => null);
  const holders = await getPlatformHolders(chain, addr, coin?.priceUsd ?? null, 100).catch(() => []);
  return NextResponse.json({ holders });
}
