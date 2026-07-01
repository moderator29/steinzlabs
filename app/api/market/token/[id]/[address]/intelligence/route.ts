import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenIntelligenceStrip } from '@/lib/dune/useSurfaces';

// freshnessHeader inlined because the failureLadder module lands on the
// Dune-foundation branch; once that merges this can move back to import.
function freshnessHeader(tier: 'live' | 'cached' | 'stale' | 'fallback' | 'unavailable'): Record<string, string> {
  return { 'X-Data-Freshness': tier };
}

/**
 * §5.6 Trading Terminal strip — Dune-derived intelligence for a token.
 *
 * GET /api/market/token/[id]/[address]/intelligence
 *   → TokenIntelligenceStrip
 *
 * The first segment carries the chain. It shares the `[id]` slug name used by
 * the sibling token routes because Next.js requires one consistent slug name
 * per path position; the URL is unchanged, so callers pass the chain as before.
 *
 * Stamps `X-Data-Freshness` header so widgets can label stale data.
 */
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; address: string }> },
) {
  const { id: chain, address } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(chain)) return NextResponse.json({ error: 'bad chain' }, { status: 400 });
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const strip = await getTokenIntelligenceStrip(address, chain);
  const anyData = Boolean(strip.holder_concentration || strip.wash_trade_score !== null);
  return NextResponse.json(strip, {
    headers: freshnessHeader(anyData ? 'cached' : 'unavailable'),
  });
}
