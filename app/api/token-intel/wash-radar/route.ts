import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Wash Trade Radar — fuses Dune's independent smart-money token flow with its
 * wash-trade authenticity score, so you can see whether the tokens smart money
 * is buying have REAL volume or faked (wash-traded) volume.
 *
 * GET /api/token-intel/wash-radar?chain=&sort=inflow|risk&includeNoise=1
 *
 * Real data only: dune_smart_money_token_flow + dune_wash_trade_score, joined
 * on (token_address, chain), symbols resolved from whale_activity. Both Dune
 * tables are small (~hundreds of rows) so the join is done in the route.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Higher wash score = cleaner (less wash-trading). Grade bands from the live
// distribution (min 21, max 100, avg ~64).
function grade(score: number | null): 'clean' | 'caution' | 'wash' | 'unknown' {
  if (score == null) return 'unknown';
  if (score >= 80) return 'clean';
  if (score >= 50) return 'caution';
  return 'wash';
}

const NOISE = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDE', 'USDS', 'RLUSD', 'USDD', 'GUSD', 'LUSD', 'PYUSD', 'USDP', 'CRVUSD',
  'WETH', 'ETH', 'WBTC', 'BTC', 'WBNB', 'BNB', 'WSOL', 'SOL', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'PAXG',
]);

interface FlowRow { token_address: string; chain: string; net_inflow_usd_24h: number | null; unique_wallets_24h: number | null }
interface WashRow { token_address: string; chain: string; score: number | null; flagged_pairs: number | null }

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = sp.get('chain')?.trim() || null;
  const sort = sp.get('sort') === 'risk' ? 'risk' : 'inflow';
  const includeNoise = sp.get('includeNoise') === '1';

  const admin = getSupabaseAdmin();

  let flowQ = admin.from('dune_smart_money_token_flow').select('token_address, chain, net_inflow_usd_24h, unique_wallets_24h');
  if (chain) flowQ = flowQ.eq('chain', chain);
  const { data: flowData, error: flowErr } = await flowQ.limit(400);
  if (flowErr) return NextResponse.json({ error: flowErr.message }, { status: 500 });
  const flows = (flowData ?? []) as FlowRow[];
  if (flows.length === 0) return NextResponse.json({ chain: chain ?? 'all', sort, tokens: [] });

  const addresses = Array.from(new Set(flows.map((f) => f.token_address)));

  // Wash scores + symbols for exactly these tokens.
  const [{ data: washData }, { data: symData }] = await Promise.all([
    admin.from('dune_wash_trade_score').select('token_address, chain, score, flagged_pairs').in('token_address', addresses),
    admin.from('whale_activity').select('token_address, token_symbol').in('token_address', addresses).not('token_symbol', 'is', null).limit(3000),
  ]);
  const washMap = new Map<string, WashRow>();
  for (const w of (washData ?? []) as WashRow[]) washMap.set(`${w.token_address.toLowerCase()}:${w.chain}`, w);
  const symMap = new Map<string, string>();
  for (const s of (symData ?? []) as Array<{ token_address: string; token_symbol: string }>) {
    if (!symMap.has(s.token_address.toLowerCase())) symMap.set(s.token_address.toLowerCase(), s.token_symbol);
  }

  let tokens = flows.map((f) => {
    const wash = washMap.get(`${f.token_address.toLowerCase()}:${f.chain}`);
    const symbol = symMap.get(f.token_address.toLowerCase()) ?? null;
    const score = wash?.score != null ? Number(wash.score) : null;
    return {
      tokenAddress: f.token_address,
      chain: f.chain,
      symbol,
      netInflowUsd: f.net_inflow_usd_24h != null ? Number(f.net_inflow_usd_24h) : 0,
      uniqueWallets: f.unique_wallets_24h ?? 0,
      washScore: score,
      flaggedPairs: wash?.flagged_pairs ?? null,
      grade: grade(score),
    };
  });

  if (!includeNoise) tokens = tokens.filter((t) => !t.symbol || !NOISE.has(t.symbol.toUpperCase()));

  tokens.sort((a, b) => {
    if (sort === 'risk') {
      // Worst authenticity first (known wash scores before unknown), tie-break by inflow.
      const as = a.washScore ?? 200, bs = b.washScore ?? 200;
      return as - bs || Math.abs(b.netInflowUsd) - Math.abs(a.netInflowUsd);
    }
    return Math.abs(b.netInflowUsd) - Math.abs(a.netInflowUsd);
  });

  return NextResponse.json({
    chain: chain ?? 'all',
    sort,
    includeNoise,
    tokens: tokens.slice(0, 60),
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
