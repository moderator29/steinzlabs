import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * §3 P2-C.4 — BFS path-finding between two wallet addresses over the
 * wallet_edges table (populated by /api/cron/cluster-analysis). Returns
 * the shortest path as a list of addresses + edge metadata, or null if
 * no path exists within `max_hops`.
 *
 * GET /api/network-graph/path?from=0xA&to=0xB&max_hops=6
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EdgeRow {
  from_address: string;
  to_address: string;
  total_value_usd: number | null;
  tx_count: number | null;
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from')?.trim();
  const to = req.nextUrl.searchParams.get('to')?.trim();
  const maxHops = Math.min(8, Math.max(2, Number(req.nextUrl.searchParams.get('max_hops')) || 6));
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 });
  // normalizeAddress lowercases EVM (case-insensitive) but preserves Solana
  // base58 case, so distinct Solana addresses never collide.
  const fromKey = normalizeAddress(from);
  const toKey = normalizeAddress(to);
  if (fromKey === toKey) return NextResponse.json({ path: [from] });

  const admin = getSupabaseAdmin();

  // BFS frontier expansion. Connectivity is UNDIRECTED: at each hop we pull
  // edges that touch the frontier from EITHER side (from_address OR to_address)
  // and expand to the opposite endpoint. The old traversal only followed
  // from_address, so a real connection stored solely as B->A returned "no path".
  const parent = new Map<string, { prev: string; edge: EdgeRow }>();
  const visited = new Set<string>([fromKey]);
  let frontier: string[] = [fromKey];

  for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
    const [outRes, inRes] = await Promise.all([
      admin.from('wallet_edges').select('from_address, to_address, total_value_usd, tx_count').in('from_address', frontier).limit(5000).returns<EdgeRow[]>(),
      admin.from('wallet_edges').select('from_address, to_address, total_value_usd, tx_count').in('to_address', frontier).limit(5000).returns<EdgeRow[]>(),
    ]);
    if (outRes.error) return NextResponse.json({ error: outRes.error.message }, { status: 500 });
    if (inRes.error) return NextResponse.json({ error: inRes.error.message }, { status: 500 });
    const frontierSet = new Set(frontier);
    const nextFrontier: string[] = [];
    for (const e of [...(outRes.data ?? []), ...(inRes.data ?? [])]) {
      const a = normalizeAddress(e.from_address);
      const b = normalizeAddress(e.to_address);
      // The frontier side is the endpoint we came from; the other is the neighbor.
      let src: string, target: string;
      if (frontierSet.has(a)) { src = a; target = b; }
      else if (frontierSet.has(b)) { src = b; target = a; }
      else continue;
      if (visited.has(target)) continue;
      visited.add(target);
      parent.set(target, { prev: src, edge: e });
      if (target === toKey) {
        // Reconstruct path
        const pathAddrs: string[] = [target];
        const pathEdges: EdgeRow[] = [];
        let cur = target;
        while (parent.has(cur)) {
          const step = parent.get(cur)!;
          pathAddrs.unshift(step.prev);
          pathEdges.unshift(step.edge);
          cur = step.prev;
        }
        return NextResponse.json({
          path: pathAddrs,
          edges: pathEdges,
          hops: pathAddrs.length - 1,
        });
      }
      nextFrontier.push(target);
    }
    frontier = nextFrontier;
  }

  return NextResponse.json({ path: null, reason: `No path within ${maxHops} hops` });
}
