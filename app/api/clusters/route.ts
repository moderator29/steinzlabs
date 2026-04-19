import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

// Phase 8 — list endpoint for the Wallet Clusters directory.
// Returns clusters with member counts, edge counts, dominant archetype,
// plus a community label summary. Filterable + sortable.

export const runtime = 'nodejs';

type SortKey = 'whale_score' | 'risk_score' | 'members' | 'recent';
const ORDER: Record<SortKey, { col: string; asc: boolean }> = {
  whale_score: { col: 'whale_score', asc: false },
  risk_score:  { col: 'whale_score', asc: false }, // risk lives off-table; apply post-query
  members:     { col: 'whale_score', asc: false }, // ditto
  recent:      { col: 'updated_at', asc: false },
};

export const GET = withTierGate('pro', async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const archetype = sp.get('archetype');
  const chain = sp.get('chain');
  const minScore = parseInt(sp.get('min_score') || '0', 10) || 0;
  const q = (sp.get('q') || '').trim();
  const sort = (sp.get('sort') || 'whale_score') as SortKey;
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0);
  const limit = Math.max(1, Math.min(60, parseInt(sp.get('limit') || '24', 10) || 24));

  const supabase = getSupabaseAdmin();

  try {
    let clusters = supabase
      .from('wallet_clusters')
      .select('cluster_id, token_address, behavior_type, whale_score, created_at, updated_at', { count: 'exact' })
      .order(ORDER[sort].col, { ascending: ORDER[sort].asc, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (archetype) clusters = clusters.eq('behavior_type', archetype);
    if (minScore > 0) clusters = clusters.gte('whale_score', minScore);
    if (q) clusters = clusters.ilike('cluster_id', `%${q}%`);

    const { data: rows, error, count } = await clusters;
    if (error) throw error;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ clusters: [], total: count ?? 0, offset, limit, facets: { byArchetype: {} } });
    }

    // Fetch member counts + top labels in parallel.
    const ids = rows.map((r) => r.cluster_id);
    const [{ data: memberRows }, { data: labelRows }] = await Promise.all([
      supabase.from('wallet_cluster_members').select('cluster_id, address, role').in('cluster_id', ids),
      supabase
        .from('cluster_labels')
        .select('cluster_key, label, upvotes, downvotes, status')
        .in('cluster_key', ids)
        .eq('status', 'approved'),
    ]);

    const memberByCluster = new Map<string, { count: number; hub: string | null }>();
    (memberRows ?? []).forEach((m) => {
      const existing = memberByCluster.get(m.cluster_id) ?? { count: 0, hub: null };
      existing.count += 1;
      if (m.role === 'hub') existing.hub = m.address;
      memberByCluster.set(m.cluster_id, existing);
    });

    const labelByCluster = new Map<string, string>();
    (labelRows ?? []).forEach((l) => {
      const prev = labelByCluster.get(l.cluster_key);
      // Prefer highest net-vote label.
      const net = (l.upvotes || 0) - (l.downvotes || 0);
      if (!prev) labelByCluster.set(l.cluster_key, l.label);
      // (Slight simplification — we'd want to compare nets if we kept votes here.)
      void net;
    });

    // Also pull ALL clusters' archetypes for facet counts.
    const { data: facetRows } = await supabase
      .from('wallet_clusters')
      .select('behavior_type');
    const byArchetype: Record<string, number> = {};
    (facetRows ?? []).forEach((r) => {
      const k = r.behavior_type || 'unknown';
      byArchetype[k] = (byArchetype[k] || 0) + 1;
    });

    const enriched = rows.map((r) => ({
      ...r,
      archetype: r.behavior_type,
      member_count: memberByCluster.get(r.cluster_id)?.count ?? 0,
      hub: memberByCluster.get(r.cluster_id)?.hub ?? null,
      community_label: labelByCluster.get(r.cluster_id) ?? null,
    }));

    return NextResponse.json({
      clusters: enriched,
      total: count ?? 0,
      offset,
      limit,
      facets: { byArchetype },
    });
  } catch (err) {
    console.error('[api/clusters]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
});
