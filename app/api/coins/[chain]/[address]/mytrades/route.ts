import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getMyCoinTrades } from '@/lib/coins/social';

export const dynamic = 'force-dynamic';

/** The caller's own buys/sells on this coin (time + side), for chart markers. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ trades: [] });
  const trades = await getMyCoinTrades(user.id, chain, decodeURIComponent(address)).catch(() => []);
  return NextResponse.json({ trades });
}
