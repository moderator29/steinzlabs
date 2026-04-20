import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

// Phase 8 — cluster detail endpoint.
// Returns cluster + members (roles) + edges + community labels with vote totals.

export const runtime = 'nodejs';

export const GET = withTierGate('pro', async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const { data: cluster } = await supabase
      .from('wallet_clusters')
      .select('*')
      .eq('cluster_id', id)
      .maybeSingle();

    if (!cluster) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [{ data: members }, { data: labels }] = await Promise.all([
      supabase
        .from('wallet_cluster_members')
        .select('address, role, created_at')
        .eq('cluster_id', id),
      supabase
        .from('cluster_labels')
        .select('id, label, description, upvotes, downvotes, status, ai_generated, created_at, submitted_by')
        .eq('cluster_key', id)
        .order('upvotes', { ascending: false }),
    ]);

    // Edges where BOTH endpoints are cluster members.
    const memberAddrs = new Set((members ?? []).map((m) => m.address.toLowerCase()));
    let edges: any[] = [];
    if (memberAddrs.size > 0) {
      const addrList = Array.from(memberAddrs);
      const { data: edgeRows } = await supabase
        .from('wallet_edges')
        .select('from_address, to_address, edge_type, chain, weight, confidence, total_value_usd, transaction_count, first_seen_at, last_seen_at')
        .or(`from_address.in.(${addrList.map((a) => `"${a}"`).join(',')}),to_address.in.(${addrList.map((a) => `"${a}"`).join(',')})`)
        .limit(500);
      edges = (edgeRows ?? []).filter(
        (e) => memberAddrs.has(e.from_address.toLowerCase()) && memberAddrs.has(e.to_address.toLowerCase()),
      );
    }

    return NextResponse.json({
      cluster,
      members: members ?? [],
      edges,
      labels: labels ?? [],
    });
  } catch (err) {
    console.error('[api/clusters/:id]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
});
