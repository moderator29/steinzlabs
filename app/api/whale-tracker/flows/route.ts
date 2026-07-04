import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Smart Money Flows — which tokens the tracked whale directory is net
 * ACCUMULATING vs DISTRIBUTING over a rolling window.
 *
 * GET /api/whale-tracker/flows?window=24h|7d|30d&chain=&includeNoise=1
 *
 * Real aggregation over whale_activity via the smart_money_flows RPC
 * (inflow = buy/transfer_in, outflow = sell/transfer_out). Stablecoins and
 * wrapped/native majors are demoted by default (whales rotating cash/majors is
 * housekeeping, not a trade signal) — toggle them back with includeNoise=1.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_HOURS: Record<string, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

// Stables + wrapped/native majors — demoted as flow "noise" (same policy as the
// Convergence Radar).
const NOISE = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDE', 'RLUSD', 'USDD', 'GUSD', 'LUSD', 'PYUSD', 'USDP',
  'WETH', 'ETH', 'WBTC', 'BTC', 'WBNB', 'BNB', 'WSOL', 'SOL', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'PAXG',
]);

interface FlowRow {
  token_symbol: string; token_address: string | null; chain: string;
  inflow: number | null; outflow: number | null; net: number | null;
  whales: number; buy_count: number; sell_count: number;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const window = WINDOW_HOURS[sp.get('window') || '7d'] ? (sp.get('window') || '7d') : '7d';
  const chain = sp.get('chain')?.trim() || null;
  const includeNoise = sp.get('includeNoise') === '1';

  const sinceIso = new Date(Date.now() - WINDOW_HOURS[window] * 3_600_000).toISOString();

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('smart_money_flows', { p_since: sinceIso, p_chain: chain, p_limit: 80 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as FlowRow[];
  if (!includeNoise) rows = rows.filter((r) => !NOISE.has((r.token_symbol || '').toUpperCase()));

  const flows = rows.map((r) => {
    const inflow = Number(r.inflow ?? 0);
    const outflow = Number(r.outflow ?? 0);
    const net = Number(r.net ?? inflow - outflow);
    const gross = inflow + outflow;
    return {
      symbol: r.token_symbol,
      tokenAddress: r.token_address,
      chain: r.chain,
      inflow,
      outflow,
      net,
      whales: r.whales,
      buyCount: r.buy_count,
      sellCount: r.sell_count,
      // Share of gross flow that is buying (0..1) for the split bar.
      buyShare: gross > 0 ? inflow / gross : 0.5,
      direction: net >= 0 ? 'accumulating' as const : 'distributing' as const,
    };
  });

  return NextResponse.json({
    window,
    chain: chain ?? 'all',
    includeNoise,
    flows,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=180' } });
}
