import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Coordinated Cluster Radar — the largest coordinated wallet clusters by 24h
 * volume, from Dune's cluster aggregates. Each cluster is identified by its
 * seed address (labelled when it's a tracked whale) and its member count.
 *
 * GET /api/clusters/radar?chain=
 *
 * Real data: dune_cluster_aggregates. Note net_flow_usd_24h is identical to
 * total_volume_usd_24h in this dataset, so we surface volume only rather than
 * present the same number twice.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AggRow {
  cluster_id: string; chain: string; member_count: number | null; total_volume_usd_24h: number | null;
}

export async function GET(req: NextRequest) {
  const chain = req.nextUrl.searchParams.get('chain')?.trim() || null;
  const admin = getSupabaseAdmin();

  let q = admin
    .from('dune_cluster_aggregates')
    .select('cluster_id, chain, member_count, total_volume_usd_24h')
    .order('total_volume_usd_24h', { ascending: false, nullsFirst: false })
    .limit(60);
  if (chain) q = q.eq('chain', chain);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as AggRow[];

  // FREE FALLBACK — when Dune has no cluster rows for this view, derive real
  // convergence clusters from our own multi-chain whale_activity (a "cluster" =
  // a token 3+ tracked whales are trading together in 24h). Multi-chain, no
  // Dune needed. Same output shape.
  if (rows.length === 0) {
    const { data: conv } = await admin.rpc('whale_convergence_clusters', { p_chain: chain, p_hours: 24 });
    const cRows = (conv ?? []) as Array<{ chain: string; token_address: string; token_symbol: string | null; member_count: number; total_volume_usd_24h: number; net_flow_usd_24h: number }>;
    const clusters = cRows.map((r) => ({
      seed: r.token_address,
      chain: r.chain,
      memberCount: r.member_count ?? 0,
      volume24hUsd: Number(r.total_volume_usd_24h ?? 0),
      netFlow24hUsd: Number(r.net_flow_usd_24h ?? 0),
      label: r.token_symbol ? `$${r.token_symbol} convergence` : null,
      archetype: 'token_convergence',
      verified: false,
    }));
    return NextResponse.json({
      chain: chain ?? 'all', clusters, source: 'whale_activity',
      generatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  }

  // Label the seed address when it's a tracked whale.
  const seeds = rows.map((r) => r.cluster_id);
  const labels = new Map<string, { label: string | null; archetype: string | null; verified: boolean | null }>();
  const { data: wl } = await admin.from('whales').select('address, label, archetype, verified').in('address', seeds);
  for (const w of (wl ?? []) as Array<{ address: string; label: string | null; archetype: string | null; verified: boolean | null }>) {
    labels.set(w.address.toLowerCase(), w);
  }

  const clusters = rows.map((r) => {
    const m = labels.get(r.cluster_id.toLowerCase());
    return {
      seed: r.cluster_id,
      chain: r.chain,
      memberCount: r.member_count ?? 0,
      volume24hUsd: r.total_volume_usd_24h != null ? Number(r.total_volume_usd_24h) : 0,
      label: m?.label ?? null,
      archetype: m?.archetype ?? null,
      verified: !!m?.verified,
    };
  });

  return NextResponse.json({
    chain: chain ?? 'all',
    clusters,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
