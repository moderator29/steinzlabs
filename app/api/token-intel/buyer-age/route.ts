import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Fresh Money Detector — the wallet-age composition of a token's buyers. A
 * token bought overwhelmingly by wallets created in the last 7 days is a
 * classic farmed / sybil / manufactured-hype signature; buying dominated by
 * 90-day-plus wallets is seasoned conviction money.
 *
 * GET /api/token-intel/buyer-age?chain=&sort=fresh|buyers
 *
 * Real data: dune_token_age_buyers, symbols resolved from whale_activity where
 * possible (fresh/farmy tokens whales avoid fall back to a short address).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AgeRow {
  token_address: string; chain: string;
  age_under_7d_pct: number | null; age_7_30d_pct: number | null;
  age_30_90d_pct: number | null; age_over_90d_pct: number | null;
  total_buyers: number | null;
}

// Fresh-heavy = majority of buyers are wallets < 7 days old (farm/sybil risk).
function grade(freshPct: number): 'fresh' | 'mixed' | 'seasoned' {
  if (freshPct >= 50) return 'fresh';
  if (freshPct >= 20) return 'mixed';
  return 'seasoned';
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = sp.get('chain')?.trim() || null;
  const sort = sp.get('sort') === 'buyers' ? 'buyers' : 'fresh';

  const admin = getSupabaseAdmin();
  let q = admin
    .from('dune_token_age_buyers')
    .select('token_address, chain, age_under_7d_pct, age_7_30d_pct, age_30_90d_pct, age_over_90d_pct, total_buyers')
    .not('total_buyers', 'is', null)
    .gte('total_buyers', 50); // ignore dust — need a real buyer base to read the mix
  if (chain) q = q.eq('chain', chain);
  q = sort === 'buyers'
    ? q.order('total_buyers', { ascending: false, nullsFirst: false })
    : q.order('age_under_7d_pct', { ascending: false, nullsFirst: false });
  const { data, error } = await q.limit(80);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as AgeRow[];
  if (rows.length === 0) return NextResponse.json({ chain: chain ?? 'all', sort, tokens: [] });

  // Resolve symbols for the tokens whales have touched.
  const addresses = Array.from(new Set(rows.map((r) => r.token_address)));
  const symMap = new Map<string, string>();
  const { data: symData } = await admin
    .from('whale_activity')
    .select('token_address, token_symbol')
    .in('token_address', addresses)
    .not('token_symbol', 'is', null)
    .limit(3000);
  for (const s of (symData ?? []) as Array<{ token_address: string; token_symbol: string }>) {
    if (!symMap.has(s.token_address.toLowerCase())) symMap.set(s.token_address.toLowerCase(), s.token_symbol);
  }

  const tokens = rows.map((r) => {
    const u7 = Number(r.age_under_7d_pct ?? 0);
    const u30 = Number(r.age_7_30d_pct ?? 0);
    const u90 = Number(r.age_30_90d_pct ?? 0);
    const o90 = Number(r.age_over_90d_pct ?? 0);
    return {
      tokenAddress: r.token_address,
      chain: r.chain,
      symbol: symMap.get(r.token_address.toLowerCase()) ?? null,
      totalBuyers: r.total_buyers ?? 0,
      ageMix: { under7d: u7, d7to30: u30, d30to90: u90, over90d: o90 },
      freshPct: u7,
      seasonedPct: o90,
      grade: grade(u7),
    };
  });

  return NextResponse.json({
    chain: chain ?? 'all',
    sort,
    tokens,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
