import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getTopTrades, getTopTraders } from '@/lib/coins/social';

export const dynamic = 'force-dynamic';

/**
 * Coins leaderboard from real platform trades. `tab=traders` ranks accounts by
 * total realized-plus-unrealized PnL across all their coins; `tab=trades` ranks
 * the best single positions. `scope=friends` (traders only) needs auth and
 * restricts to the accounts the caller follows. `days` is the window (All maps
 * to a large value from the client). Positive results only.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') === 'trades' ? 'trades' : 'traders';
  const scope = url.searchParams.get('scope') === 'friends' ? 'friends' : 'global';
  const days = Math.min(3650, Math.max(1, Number(url.searchParams.get('days')) || 7));

  if (tab === 'trades') {
    const trades = await getTopTrades(days, 25).catch(() => []);
    return NextResponse.json({ tab, scope: 'global', days, trades });
  }

  let followingOf: string | undefined;
  if (scope === 'friends') {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to see the friends leaderboard' }, { status: 401 });
    followingOf = user.id;
  }
  const traders = await getTopTraders(days, 25, followingOf).catch(() => []);
  return NextResponse.json({ tab, scope, days, traders });
}
