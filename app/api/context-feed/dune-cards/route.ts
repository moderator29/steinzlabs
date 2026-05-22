import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getContextFeedDuneCards } from '@/lib/dune/useSurfaces';

/**
 * §5.6 Context Feed Dune cards endpoint. Returns up to 20 cards across
 * the 8 supported card types (bridge_flow, smart_money_rotation,
 * mev_sandwich, etc.) freshest-first. Empty array when the dune
 * tables aren't populated yet — UI renders an "intelligence feed
 * loading" placeholder instead of mock cards.
 */
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));
  const cards = await getContextFeedDuneCards(limit);
  return NextResponse.json({ cards });
}
