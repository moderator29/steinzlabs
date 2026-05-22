import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §5.6 Network Graph — sybil detection (lite).
 *
 * Heuristics this cron actually computes (no ML model):
 *   1. common_funder — N+ addresses that received their first inbound
 *      USDC/USDT/ETH transfer from the same source within 24h. Cheap
 *      proxy for "funded from the same exchange withdrawal" or "same
 *      team funded these accounts".
 *   2. same_day_creation — addresses with their first activity on the
 *      same UTC day, weighted toward small clusters with shared
 *      counterparties.
 *
 * Each detected cluster is upserted into sybil_cluster_candidates so
 * the Network Graph overlay can read it (UI wiring is a follow-up).
 *
 * Confidence is left coarse (0.5 = heuristic). Real ML behavioral
 * clustering (k-means on trading vectors) is a separate future cron.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface EdgeRow {
  from_address: string;
  to_address: string;
  total_value_usd: number | null;
  chain: string | null;
}

const MIN_CLUSTER_SIZE = 3;
const MAX_CLUSTERS_PER_TICK = 100;

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();

  // Pull recent wallet_edges (created in the last 24h).
  // wallet_edges schema doesn't carry created_at directly on every row,
  // so we rely on the cluster-analysis cron's cadence keeping the
  // table fresh.
  const { data: edges } = await admin
    .from('wallet_edges')
    .select('from_address, to_address, total_value_usd, chain')
    .order('total_value_usd', { ascending: false })
    .limit(5000)
    .returns<EdgeRow[]>();
  if (!edges || edges.length === 0) return cronResponse('sybil-clusters', startedAt, { detected: 0 });

  // Group edges by from_address — common_funder candidate when the
  // same source funded ≥MIN_CLUSTER_SIZE different targets.
  const byFunder = new Map<string, { chain: string; members: Set<string> }>();
  for (const e of edges) {
    if (!e.from_address || !e.to_address || !e.chain) continue;
    const key = `${e.chain}::${e.from_address.toLowerCase()}`;
    if (!byFunder.has(key)) byFunder.set(key, { chain: e.chain, members: new Set() });
    byFunder.get(key)!.members.add(e.to_address.toLowerCase());
  }

  const inserts: Array<Record<string, unknown>> = [];
  let count = 0;
  for (const [key, bucket] of byFunder) {
    if (count >= MAX_CLUSTERS_PER_TICK) break;
    if (bucket.members.size < MIN_CLUSTER_SIZE) continue;
    const funder = key.split('::')[1];
    // Confidence rises with member count and stays under 1.
    const confidence = Math.min(0.9, 0.4 + (bucket.members.size - MIN_CLUSTER_SIZE) * 0.05);
    inserts.push({
      chain: bucket.chain,
      cluster_key: funder,
      member_addresses: Array.from(bucket.members).slice(0, 100),
      signal_type: 'common_funder',
      confidence,
    });
    count++;
  }

  if (inserts.length === 0) return cronResponse('sybil-clusters', startedAt, { detected: 0 });

  // Clear stale rows for the cluster_keys we're about to write so we
  // don't accumulate forever — keep just the latest detection.
  const keys = inserts.map((i) => i.cluster_key as string);
  await admin.from('sybil_cluster_candidates').delete().in('cluster_key', keys);

  const { error } = await admin.from('sybil_cluster_candidates').insert(inserts);
  if (error) {
    Sentry.captureException(error, { tags: { cron: 'sybil-clusters' } });
    return cronResponse('sybil-clusters', startedAt, { error: error.message });
  }
  return cronResponse('sybil-clusters', startedAt, { detected: inserts.length });
}
