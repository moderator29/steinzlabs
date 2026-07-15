import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { resolveCoin } from '@/lib/coins/coinService';
import { getWatchlistKeys } from '@/lib/coins/social';
import { tokenKeyFor } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

/** Full coin object for the detail page, plus whether the caller watchlisted it. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const coin = await resolveCoin(chain, decodeURIComponent(address));
  if (!coin) return NextResponse.json({ error: 'Coin not found or not graduated on a DEX' }, { status: 404 });

  let watchlisted = false;
  const user = await getAuthenticatedUser(req);
  if (user) {
    const keys = await getWatchlistKeys(user.id);
    watchlisted = keys.has(`${chain}:${tokenKeyFor(chain, decodeURIComponent(address))}`);
  }
  return NextResponse.json({ coin, watchlisted });
}
