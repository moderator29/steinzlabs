import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
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

    // Edges where BOTH endpoints are cluster members.
    //
    // P0 audit fix — the previous single-shot `.or()` built a string
    // like `from_address.in.(addr1,addr2,...),to_address.in.(...)`
    // that could exceed PostgREST's URL/header length limits on large
    // clusters and silently truncate results (returning a partial
    // graph without erroring). We now CHUNK the address list into
    // batches of 50, run two `.in()` queries per chunk in parallel,
    // and de-dupe by edge identity. Cap kept at 500 total edges so a
    // pathological cluster can't fan out the response.
    const memberAddrs = new Set((members ?? []).map((m) => m.address.toLowerCase()));
    let edges: any[] = [];
    if (memberAddrs.size > 0) {
      const addrList = Array.from(memberAddrs);
      const CHUNK = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < addrList.length; i += CHUNK) chunks.push(addrList.slice(i, i + CHUNK));
      const seen = new Set<string>();
      const collected: any[] = [];
      const fetchChunk = async (col: 'from_address' | 'to_address', batch: string[]) => {
        const { data } = await supabase
          .from('wallet_edges')
          .select('from_address, to_address, edge_type, chain, weight, confidence, total_value_usd, transaction_count, first_seen_at, last_seen_at')
          .in(col, batch);
        return data ?? [];
      };
      for (const batch of chunks) {
        if (collected.length >= 500) break;
        const [fromRows, toRows] = await Promise.all([
          fetchChunk('from_address', batch),
          fetchChunk('to_address', batch),
        ]);
        for (const row of [...fromRows, ...toRows]) {
          if (!memberAddrs.has(row.from_address.toLowerCase())) continue;
          if (!memberAddrs.has(row.to_address.toLowerCase())) continue;
          const id = `${row.from_address}|${row.to_address}|${row.edge_type}|${row.chain}`;
          if (seen.has(id)) continue;
          seen.add(id);
          collected.push(row);
          if (collected.length >= 500) break;
        }
      }
      edges = collected;
    }

    return NextResponse.json({
      cluster,
      members: members ?? [],
      edges,
      labels: labels ?? [],
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'clusters/by-id' } });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
});
