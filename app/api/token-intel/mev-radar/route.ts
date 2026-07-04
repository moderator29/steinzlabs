import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * MEV Radar — how much wallets are bleeding to MEV (sandwich attacks +
 * frontrunning) over the last 30 days. A leaderboard of the biggest victims,
 * plus a per-wallet lookup. No retail platform surfaces per-wallet MEV loss.
 *
 * GET /api/token-intel/mev-radar            → top victims board
 * GET /api/token-intel/mev-radar?address=0x → that wallet's MEV toll
 *
 * Real data: dune_mev_loss_aggregate, enriched with whale labels.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MevRow {
  wallet_address: string; chain: string;
  total_loss_usd_30d: number | null; sandwich_count: number | null; frontrun_count: number | null;
}

async function enrich(admin: ReturnType<typeof getSupabaseAdmin>, rows: MevRow[]) {
  const addresses = rows.map((r) => r.wallet_address);
  const labels = new Map<string, { label: string | null; archetype: string | null; verified: boolean | null }>();
  if (addresses.length) {
    const { data } = await admin.from('whales').select('address, label, archetype, verified').in('address', addresses);
    for (const w of (data ?? []) as Array<{ address: string; label: string | null; archetype: string | null; verified: boolean | null }>) {
      labels.set(w.address, w);
    }
  }
  return rows.map((r) => {
    const m = labels.get(r.wallet_address);
    return {
      address: r.wallet_address,
      chain: r.chain,
      lossUsd: r.total_loss_usd_30d != null ? Number(r.total_loss_usd_30d) : 0,
      sandwichCount: r.sandwich_count ?? 0,
      frontrunCount: r.frontrun_count ?? 0,
      label: m?.label ?? null,
      archetype: m?.archetype ?? null,
      verified: !!m?.verified,
    };
  });
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim() || null;
  const chain = req.nextUrl.searchParams.get('chain')?.trim() || null;
  const admin = getSupabaseAdmin();

  // Single-wallet lookup.
  if (address) {
    const { data } = await admin
      .from('dune_mev_loss_aggregate')
      .select('wallet_address, chain, total_loss_usd_30d, sandwich_count, frontrun_count')
      .ilike('wallet_address', address);
    const rows = (data ?? []) as MevRow[];
    if (rows.length === 0) return NextResponse.json({ mode: 'lookup', address, found: false });
    const enriched = await enrich(admin, rows);
    // Sum across chains for the headline, keep per-chain breakdown.
    const totalLoss = enriched.reduce((s, r) => s + r.lossUsd, 0);
    const totalSandwich = enriched.reduce((s, r) => s + r.sandwichCount, 0);
    const totalFrontrun = enriched.reduce((s, r) => s + r.frontrunCount, 0);
    return NextResponse.json({ mode: 'lookup', address, found: true, totalLoss, totalSandwich, totalFrontrun, breakdown: enriched });
  }

  // Leaderboard of biggest victims.
  let q = admin
    .from('dune_mev_loss_aggregate')
    .select('wallet_address, chain, total_loss_usd_30d, sandwich_count, frontrun_count')
    .order('total_loss_usd_30d', { ascending: false, nullsFirst: false })
    .limit(50);
  if (chain) q = q.eq('chain', chain);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const victims = await enrich(admin, (data ?? []) as MevRow[]);
  const totalTracked = victims.reduce((s, v) => s + v.lossUsd, 0);
  return NextResponse.json({
    mode: 'board',
    chain: chain ?? 'all',
    totalTrackedLoss: totalTracked,
    victims,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
