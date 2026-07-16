import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { resolveCoin } from '@/lib/coins/coinService';
import { getWatchlistKeys } from '@/lib/coins/social';
import { tokenKeyFor } from '@/lib/coins/coinService';
import { getRealHolderCount, persistHolderCount } from '@/lib/coins/holders';

export const dynamic = 'force-dynamic';

/** Full coin object for the detail page, plus whether the caller watchlisted it. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const coin = await resolveCoin(chain, decodeURIComponent(address));
  if (!coin) return NextResponse.json({ error: 'Coin not found or not graduated on a DEX' }, { status: 404 });

  // Real holder count: the registry cache only carries it once the refresh cron
  // has filled it, so on the detail path we fetch it live (cached at the source)
  // when missing and persist it, so the terminal shows a real number, not "-".
  if (coin.holdersCount == null) {
    const hc = await getRealHolderCount(chain, coin.tokenAddress);
    if (hc != null) {
      coin.holdersCount = hc;
      void persistHolderCount(coin.chain, coin.tokenKey, hc);
    }
  }

  let watchlisted = false;
  const user = await getAuthenticatedUser(req);
  if (user) {
    const keys = await getWatchlistKeys(user.id);
    watchlisted = keys.has(`${chain}:${tokenKeyFor(chain, decodeURIComponent(address))}`);
  }
  return NextResponse.json({ coin, watchlisted });
}
