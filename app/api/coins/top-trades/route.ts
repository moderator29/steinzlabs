import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTopTrades } from '@/lib/coins/social';

export const dynamic = 'force-dynamic';

/** Our weekly Top Trades leaderboard from real platform trades. */
export async function GET(req: NextRequest) {
  const days = Number(new URL(req.url).searchParams.get('days')) || 7;
  const trades = await getTopTrades(Math.min(30, Math.max(1, days)), 12).catch(() => []);
  return NextResponse.json({ trades });
}
