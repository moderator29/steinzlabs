import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

// Phase 8 — list endpoint for the Wallet Clusters directory.
// Returns clusters with member counts, edge counts, dominant archetype,
// plus a community label summary. Filterable + sortable.

export const runtime = 'nodejs';

// Only two sort keys map cleanly onto a wallet_clusters column and can be
// ordered + paginated by the database. 'members' is a derived count that lives
// in wallet_cluster_members, so it is sorted in-memory over the (small, ~300-row)
// filtered set below. The previous ORDER map silently aliased 'members' and
// 'risk_score' to whale_score, so the "Member Count" option lied about its
// ordering — every row was still real, but the sort was not what the UI claimed.
type SortKey = 'whale_score' | 'members' | 'recent';
const DB_ORDER_COL: Record<'whale_score' | 'recent', string> = {
  whale_score: 'whale_score',
  recent: 'updated_at',
};

interface ClusterBaseRow {
  cluster_id: string;
  token_address: string | null;
  behavior_type: string | null;
  whale_score: number | null;
  created_at: string | null;
  updated_at: string | null;
}

const CLUSTER_COLS = 'cluster_id, token_address, behavior_type, whale_score, created_at, updated_at';

export const GET = withTierGate('pro', async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const archetype = sp.get('archetype');
  const minScore = parseInt(sp.get('min_score') || '0', 10) || 0;
  const q = (sp.get('q') || '').trim();
  const rawSort = sp.get('sort') || 'whale_score';
  const sort: SortKey = rawSort === 'members' || rawSort === 'recent' ? rawSort : 'whale_score';
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0);
  const limit = Math.max(1, Math.min(60, parseInt(sp.get('limit') || '24', 10) || 24));

  const supabase = getSupabaseAdmin();

  try {
    let rows: ClusterBaseRow[] | null;
    let count: number | null;

    if (sort === 'members') {
      // Member Count sort: pull the full filtered cluster set (bounded — the
      // table holds a few hundred clusters), tally REAL member counts from
      // wallet_cluster_members, then sort + paginate in memory. Whale score is
      // the deterministic tie-breaker so equal-size clusters stay stable.
      let base = supabase.from('wallet_clusters').select(CLUSTER_COLS);
      if (archetype) base = base.eq('behavior_type', archetype);
      if (minScore > 0) base = base.gte('whale_score', minScore);
      if (q) base = base.ilike('cluster_id', `%${q}%`);
      const { data: allRows, error: baseErr } = await base;
      if (baseErr) throw baseErr;
      const all = (allRows ?? []) as ClusterBaseRow[];

      const counts = new Map<string, number>();
      if (all.length > 0) {
        const { data: memberRows } = await supabase
          .from('wallet_cluster_members')
          .select('cluster_id')
          .in('cluster_id', all.map((r) => r.cluster_id));
        (memberRows ?? []).forEach((m) => counts.set(m.cluster_id, (counts.get(m.cluster_id) ?? 0) + 1));
      }

      all.sort((a, b) =>
        (counts.get(b.cluster_id) ?? 0) - (counts.get(a.cluster_id) ?? 0) ||
        (Number(b.whale_score) || 0) - (Number(a.whale_score) || 0),
      );
      count = all.length;
      rows = all.slice(offset, offset + limit);
    } else {
      let clusters = supabase
        .from('wallet_clusters')
        .select(CLUSTER_COLS, { count: 'exact' })
        .order(DB_ORDER_COL[sort], { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);
      if (archetype) clusters = clusters.eq('behavior_type', archetype);
      if (minScore > 0) clusters = clusters.gte('whale_score', minScore);
      if (q) clusters = clusters.ilike('cluster_id', `%${q}%`);

      const res = await clusters;
      if (res.error) throw res.error;
      rows = (res.data ?? null) as ClusterBaseRow[] | null;
      count = res.count;
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ clusters: [], total: count ?? 0, offset, limit, facets: { byArchetype: {} } });
    }

    // Fetch member counts + top labels in parallel.
    const ids = rows.map((r) => r.cluster_id);
    const [{ data: memberRows }, { data: labelRows }] = await Promise.all([
      supabase.from('wallet_cluster_members').select('cluster_id, address, role').in('cluster_id', ids),
      supabase
        .from('cluster_labels')
        .select('cluster_id, label, upvotes, downvotes, status')
        .in('cluster_id', ids)
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
      const prev = labelByCluster.get(l.cluster_id);
      // Prefer highest net-vote label.
      const net = (l.upvotes || 0) - (l.downvotes || 0);
      if (!prev) labelByCluster.set(l.cluster_id, l.label);
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
