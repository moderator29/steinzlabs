import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

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

    // Edges where BOTH endpoints are cluster members. Normalize per chain so
    // Solana members (case-sensitive) aren't dropped by EVM lower-casing.
    const clusterChain = (cluster as { chain?: string } | null)?.chain;
    const memberAddrs = new Set(
      (members ?? []).map((m) => normalizeAddress(m.address, clusterChain)),
    );
    let edges: Array<Record<string, unknown>> = [];
    if (memberAddrs.size > 0) {
      const addrList = Array.from(memberAddrs);
      const CHUNK = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < addrList.length; i += CHUNK) {
        chunks.push(addrList.slice(i, i + CHUNK));
      }
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('wallet_edges')
            .select(
              'from_address, to_address, edge_type, chain, weight, confidence, total_value_usd, transaction_count, first_seen_at, last_seen_at',
            )
            .or(
              `from_address.in.(${chunk.map((a) => `"${a}"`).join(',')}),to_address.in.(${chunk.map((a) => `"${a}"`).join(',')})`,
            )
            .limit(500),
        ),
      );
      const seen = new Set<string>();
      for (const { data: edgeRows } of results) {
        for (const e of edgeRows ?? []) {
          const from = normalizeAddress(e.from_address, e.chain ?? clusterChain);
          const to = normalizeAddress(e.to_address, e.chain ?? clusterChain);
          if (!memberAddrs.has(from) || !memberAddrs.has(to)) continue;
          const key = `${from}|${to}|${e.edge_type}|${e.chain ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          edges.push(e);
          if (edges.length >= 500) break;
        }
        if (edges.length >= 500) break;
      }
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
