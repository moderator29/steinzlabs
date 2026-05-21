import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSocialVelocity } from '@/lib/services/lunarcrush';

/**
 * GET /api/social/velocity?token=BTC
 *
 * Returns 6h social velocity vs the prior 24h baseline, derived from the
 * LunarCrush hourly time-series we already pull. Powers the "🔥 +420%
 * Twitter (6h)" pill on token detail pages and the VTX context-feed signal
 * for sentiment acceleration.
 *
 * Response: { symbol, tweets_6h, tweets_24h, velocity_pct, sentiment_shift }
 *           or { error } / { unavailable: true } when not enough series.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get('token') || searchParams.get('symbol') || '').trim();
  if (!token) {
    return NextResponse.json({ error: 'token query param required' }, { status: 400 });
  }

  const velocity = await getSocialVelocity(token);
  if (!velocity) {
    return NextResponse.json({ unavailable: true, reason: 'insufficient_series' }, { status: 200 });
  }
  return NextResponse.json(velocity);
}
