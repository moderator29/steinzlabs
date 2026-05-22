import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSimPortfolio, getSimRecentTrades, isSimConfigured } from '@/lib/services/sim';

/**
 * §5.10 — Sim by Dune live wallet endpoint.
 *
 * GET /api/sim/portfolio?wallet=0x...&trades=true
 *   Returns cross-chain portfolio aggregation (EVM + Solana) + optional
 *   recent trades feed. Sim is separately billed from Dune Analytics —
 *   SIM_API_KEY (LOCKED name) governs access.
 *
 * Returns 503 when not configured so the UI can render a clear
 * "live portfolio view requires Sim provisioning" state instead of
 * fabricating numbers.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isSimConfigured()) {
    return NextResponse.json({ error: 'Sim integration not configured (SIM_API_KEY missing)' }, { status: 503 });
  }
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim();
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  const wantTrades = req.nextUrl.searchParams.get('trades') === 'true';

  const [portfolio, trades] = await Promise.all([
    getSimPortfolio(wallet),
    wantTrades ? getSimRecentTrades(wallet, 50) : Promise.resolve([]),
  ]);
  if (!portfolio) {
    return NextResponse.json({ error: 'sim_unavailable' }, { status: 502 });
  }
  return NextResponse.json({ portfolio, trades: wantTrades ? trades : undefined });
}
