import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

/**
 * Phase 8 — cluster detail endpoint.
 *
 * CLUSTER1: reads cluster_labels by cluster_id (peer-table convention).
 * The migration keeps cluster_key in sync via trigger so legacy writers
 * still work.
 *
 * CLUSTER2: edge cap raised from 500 → 5000 with cursor pagination.
 * Callers pass ?cursor=<offset>&limit=<n> to walk past the first page.
 */

export const runtime = 'nodejs';

const EDGES_HARD_CAP = 5000;
const DEFAULT_PAGE = 500;

export const GET = withTierGate('pro', async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const url = request.nextUrl;
  const cursor = Math.max(0, Number(url.searchParams.get('cursor') ?? '0') || 0);
  const limit = Math.max(1, Math.min(EDGES_HARD_CAP, Number(url.searchParams.get('limit') ?? DEFAULT_PAGE) || DEFAULT_PAGE));

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
        .eq('cluster_id', id)
        .order('upvotes', { ascending: false }),
    ]);

    const memberAddrs = new Set((members ?? []).map((m) => m.address.toLowerCase()));
    interface EdgeRow {
      from_address: string;
      to_address: string;
      edge_type: string;
      chain: string;
      weight: number | null;
      confidence: number | null;
      total_value_usd: number | null;
      transaction_count: number | null;
      first_seen_at: string | null;
      last_seen_at: string | null;
    }
    let edges: EdgeRow[] = [];
    let nextCursor: number | null = null;

    if (memberAddrs.size > 0) {
      // Same chunked .in() pattern as before (PostgREST URL-length safe);
      // collected.length now bounded by `cursor + limit` so each page
      // walks a contiguous window of edge identities, ordered by
      // last_seen_at desc so cursoring is deterministic.
      const addrList = Array.from(memberAddrs);
      const CHUNK = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < addrList.length; i += CHUNK) chunks.push(addrList.slice(i, i + CHUNK));
      const seen = new Set<string>();
      const collected: EdgeRow[] = [];
      const stopAt = cursor + limit + 1;       // +1 to detect more-available
      const fetchChunk = async (col: 'from_address' | 'to_address', batch: string[]) => {
        const { data } = await supabase
          .from('wallet_edges')
          .select('from_address, to_address, edge_type, chain, weight, confidence, total_value_usd, transaction_count, first_seen_at, last_seen_at')
          .in(col, batch)
          .order('last_seen_at', { ascending: false })
          .limit(stopAt);
        return (data ?? []) as EdgeRow[];
      };
      for (const batch of chunks) {
        if (collected.length >= stopAt) break;
        const [fromRows, toRows] = await Promise.all([
          fetchChunk('from_address', batch),
          fetchChunk('to_address', batch),
        ]);
        for (const row of [...fromRows, ...toRows]) {
          if (!memberAddrs.has(row.from_address.toLowerCase())) continue;
          if (!memberAddrs.has(row.to_address.toLowerCase())) continue;
          const edgeKey = `${row.from_address}|${row.to_address}|${row.edge_type}|${row.chain}`;
          if (seen.has(edgeKey)) continue;
          seen.add(edgeKey);
          collected.push(row);
          if (collected.length >= stopAt) break;
        }
      }
      // Slice the requested window. If we accumulated one extra row past
      // the window, that signals more pages exist.
      const window = collected.slice(cursor, cursor + limit);
      edges = window;
      if (collected.length > cursor + limit) nextCursor = cursor + limit;
    }

    return NextResponse.json({
      cluster,
      members: members ?? [],
      edges,
      labels: labels ?? [],
      pagination: { cursor, limit, nextCursor },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'clusters/by-id' } });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
});
