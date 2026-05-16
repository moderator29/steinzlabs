/**
 * Cluster edge time-decay. wallet_edges accumulate confidence over
 * time as more co-funded / coordinated activity is observed, but a
 * 3-year-old common-funding event should weigh less than yesterday's.
 * This file applies an exponential decay to edge confidence so the
 * cluster graph reflects current behavior, not history.
 *
 * Pure function — caller passes raw edge confidence + age; output is
 * the time-discounted weight ready for the force-graph rendering.
 *
 * Audit §5.7 B.10 — fresh primitive.
 */

const SECONDS_PER_DAY = 86_400;

export type DecayProfile = 'fast' | 'standard' | 'slow';

/**
 * Half-life in days per profile. fast = 30 days (coordinated trading
 * windows), standard = 180 days (common-funding generations), slow =
 * 730 days (Sybil signatures that don't lose relevance).
 */
const HALF_LIFE_DAYS: Record<DecayProfile, number> = {
  fast: 30,
  standard: 180,
  slow: 730,
};

export interface DecayInput {
  confidence: number;
  lastSeenAtSec: number;
  profile?: DecayProfile;
}

export function decayedConfidence(input: DecayInput, nowSec: number = Math.floor(Date.now() / 1000)): number {
  if (!Number.isFinite(input.confidence) || input.confidence <= 0) return 0;
  const ageSec = Math.max(0, nowSec - input.lastSeenAtSec);
  const halfLifeSec = HALF_LIFE_DAYS[input.profile ?? 'standard'] * SECONDS_PER_DAY;
  const halflives = ageSec / halfLifeSec;
  const decay = Math.pow(0.5, halflives);
  return input.confidence * decay;
}

export interface DecayEdge {
  fromAddress: string;
  toAddress: string;
  edgeType: string;
  confidence: number;
  lastSeenAtSec: number;
}

export interface DecayedEdge extends DecayEdge {
  effectiveConfidence: number;
  /** True when the decayed weight falls below 0.05 — edge should be
   *  hidden from the graph but kept in the DB for historical audit. */
  isStale: boolean;
}

const EDGE_TYPE_PROFILE: Record<string, DecayProfile> = {
  direct_transfer: 'fast',
  coordinated_trading: 'fast',
  common_funding: 'standard',
  behavioral_fingerprint: 'slow',
  sybil_pattern: 'slow',
  bridge: 'standard',
};

export function decayEdges(edges: DecayEdge[], nowSec: number = Math.floor(Date.now() / 1000)): DecayedEdge[] {
  return edges.map((e) => {
    const profile = EDGE_TYPE_PROFILE[e.edgeType] ?? 'standard';
    const effective = decayedConfidence(
      { confidence: e.confidence, lastSeenAtSec: e.lastSeenAtSec, profile },
      nowSec,
    );
    return { ...e, effectiveConfidence: effective, isStale: effective < 0.05 };
  });
}
