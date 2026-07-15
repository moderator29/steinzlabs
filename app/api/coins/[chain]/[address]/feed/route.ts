import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStats, getDexTrades } from '@/lib/coins/coinService';
import { getPlatformTrades, getThesisFeed } from '@/lib/coins/social';

export const dynamic = 'force-dynamic';

/**
 * The coin "Feed" tab: on-platform trades (our users), on-chain DEX trades, the
 * thesis feed, and the About-tab transaction split. ?pair= optional for speed.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const addr = decodeURIComponent(address);
  const url = new URL(req.url);
  const pair = url.searchParams.get('pair');

  const [platformTrades, dexTrades, stats, thesis] = await Promise.all([
    getPlatformTrades(chain, addr, 50).catch(() => []),
    getDexTrades(chain, addr, pair, 0).catch(() => []),
    getStats(chain, addr, pair).catch(() => null),
    getThesisFeed(chain, addr, 50).catch(() => []),
  ]);

  return NextResponse.json({ platformTrades, dexTrades, stats, thesis });
}
