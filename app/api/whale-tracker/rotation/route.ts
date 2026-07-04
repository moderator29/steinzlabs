import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Smart Money Rotation — where smart-money ATTENTION is accelerating. For each
 * token it compares net whale flow in the current window against the prior
 * window; the delta reveals what's rotating IN (flipping from selling to buying)
 * and OUT before it shows up as a big absolute number on the Flows board.
 *
 * GET /api/whale-tracker/rotation?window=24h|3d|7d&chain=&includeNoise=1
 *
 * Real aggregation over whale_activity via the smart_money_rotation RPC.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_HOURS: Record<string, number> = { '24h': 24, '3d': 72, '7d': 168 };

const NOISE = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDE', 'USDS', 'SUSDS', 'RLUSD', 'USDD', 'GUSD', 'LUSD', 'PYUSD', 'USDP', 'CRVUSD',
  'WETH', 'ETH', 'WBTC', 'BTC', 'WBNB', 'BNB', 'WSOL', 'SOL', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'PAXG',
]);

interface RotRow {
  token_symbol: string; chain: string; token_address: string | null;
  cur_net: number | null; prev_net: number | null; delta: number | null; whales: number;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const window = WINDOW_HOURS[sp.get('window') || '3d'] ? (sp.get('window') || '3d') : '3d';
  const chain = sp.get('chain')?.trim() || null;
  const includeNoise = sp.get('includeNoise') === '1';

  const hrs = WINDOW_HOURS[window];
  const now = Date.now();
  const curSince = new Date(now - hrs * 3_600_000).toISOString();
  const prevSince = new Date(now - 2 * hrs * 3_600_000).toISOString();
  const prevUntil = curSince;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('smart_money_rotation', {
    p_cur_since: curSince, p_prev_since: prevSince, p_prev_until: prevUntil, p_chain: chain, p_limit: 120,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as RotRow[];
  if (!includeNoise) rows = rows.filter((r) => !NOISE.has((r.token_symbol || '').toUpperCase()));

  const mapped = rows.map((r) => {
    const curNet = Number(r.cur_net ?? 0);
    const prevNet = Number(r.prev_net ?? 0);
    const delta = Number(r.delta ?? curNet - prevNet);
    return {
      symbol: r.token_symbol,
      chain: r.chain,
      tokenAddress: r.token_address,
      curNet, prevNet, delta,
      whales: r.whales,
      // A "flip" is the strongest rotation: sign changed between windows.
      flipped: (prevNet < 0 && curNet > 0) || (prevNet > 0 && curNet < 0),
      direction: delta >= 0 ? 'in' as const : 'out' as const,
    };
  });

  const rotatingIn = mapped.filter((m) => m.direction === 'in').sort((a, b) => b.delta - a.delta).slice(0, 20);
  const rotatingOut = mapped.filter((m) => m.direction === 'out').sort((a, b) => a.delta - b.delta).slice(0, 20);

  return NextResponse.json({
    window, chain: chain ?? 'all', includeNoise,
    rotatingIn, rotatingOut,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300' } });
}
