/**
 * Cluster confidence decay. Wallet-cluster edges (funded-by /
 * transferred-to / co-deployment) are time-relative — a 'funded by
 * X' edge from 2024 is much weaker evidence today than the same
 * edge from yesterday. Apply a half-life decay so old clusters
 * gracefully lose confidence instead of being trusted forever.
 *
 * Default half-life 180 days = a cluster that hasn't seen new
 * supporting evidence in 6 months keeps 50% of its original score.
 *
 * Audit §B.7 cluster P1 decay.
 */

export interface ClusterEdge {
  /** UNIX seconds of the most recent evidence supporting this edge. */
  lastSeenAt: number;
  /** Raw confidence at lastSeenAt (0..1). */
  rawConfidence: number;
}

export interface DecayOpts {
  /** Half-life in days. Default 180. */
  halfLifeDays?: number;
  /** Optional 'now' override for deterministic tests. */
  now?: number; // unix seconds
  /** Floor confidence — edges never fall below this. */
  floor?: number;
}

/**
 * Compute the decayed confidence for one edge. confidence(t) =
 * raw * 0.5^((now - lastSeenAt) / halfLife). Clamped to [floor, 1].
 */
export function decayConfidence(edge: ClusterEdge, opts: DecayOpts = {}): number {
  const halfLifeDays = opts.halfLifeDays ?? 180;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const floor = opts.floor ?? 0;
  const ageDays = Math.max(0, (now - edge.lastSeenAt) / 86_400);
  const factor = Math.pow(0.5, ageDays / halfLifeDays);
  const decayed = edge.rawConfidence * factor;
  return Math.max(floor, Math.min(1, decayed));
}

/**
 * Cluster-level decay — aggregate the per-edge decay into a single
 * cluster confidence score. We use the max edge confidence (NOT the
 * mean) so adding low-confidence noise edges can't dilute a strong
 * cluster.
 */
export function clusterConfidence(edges: ClusterEdge[], opts: DecayOpts = {}): number {
  if (edges.length === 0) return 0;
  let best = 0;
  for (const e of edges) {
    const v = decayConfidence(e, opts);
    if (v > best) best = v;
  }
  return best;
}

/**
 * Convenience — partition a cluster's edges into 'fresh' (< 30 days)
 * and 'stale' (> 30 days) so the UI can dim the stale ones.
 */
export interface PartitionedEdges<T extends ClusterEdge> {
  fresh: T[];
  stale: T[];
}

export function partitionByFreshness<T extends ClusterEdge>(
  edges: T[],
  thresholdDays = 30,
  now = Math.floor(Date.now() / 1000),
): PartitionedEdges<T> {
  const fresh: T[] = [];
  const stale: T[] = [];
  const cutoff = now - thresholdDays * 86_400;
  for (const e of edges) {
    if (e.lastSeenAt >= cutoff) fresh.push(e);
    else stale.push(e);
  }
  return { fresh, stale };
}
