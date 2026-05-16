import 'server-only';

/**
 * Suspicious-cluster heuristic. Flags wallet clusters that look
 * algorithmically coordinated rather than organically related.
 * Audit §5.7 / B.7 — the existing 5 clustering algorithms produce
 * the groups; this pass scores them so the UI can surface a "⚠ likely
 * Sybil" or "⚠ same-day batch deploy" badge on the cluster card.
 *
 * Signals (each contributes 0..1 to the score; final is the max):
 *
 *   • SAME-DAY-CREATION    Wallets that received their first inbound
 *                          tx within a 24h window of each other.
 *                          5+ wallets clustered like this is the
 *                          classic airdrop-farm / Sybil pattern.
 *   • IDENTICAL-BALANCE    Members holding the same token amount to
 *                          within 0.1%. Organic clusters scatter;
 *                          batch-funded ones don't.
 *   • SHARED-FUNDING       Members traced to a single funding source
 *                          within 2 hops. Already a clustering rule,
 *                          but the strength of the link (how many
 *                          wallets per source) shifts confidence.
 *
 * This is a pure scorer with no IO so it can be unit-tested without
 * touching Supabase. The cluster-detection cron calls it per cluster
 * and writes the score back as wallet_clusters.suspicion_score.
 */

export interface ClusterMemberStat {
  /** Unix seconds of the wallet's first observed inbound tx. */
  firstSeenAt: number;
  /** Token holding of the wallet in the cluster context (any unit). */
  holding?: number;
  /** Wallet that funded this member in the cluster context. */
  fundingSource?: string;
}

export interface ClusterSuspicionResult {
  score: number; // 0..1
  level: 'low' | 'medium' | 'high';
  signals: string[];
}

const SAME_DAY_WINDOW_SEC = 24 * 60 * 60;
const HOLDING_TOLERANCE = 0.001; // 0.1%

function sameDayBatchScore(members: ClusterMemberStat[]): number {
  if (members.length < 3) return 0;
  const times = members.map((m) => m.firstSeenAt).sort((a, b) => a - b);
  let best = 0;
  for (let i = 0; i < times.length; i += 1) {
    let count = 1;
    for (let j = i + 1; j < times.length; j += 1) {
      if (times[j] - times[i] <= SAME_DAY_WINDOW_SEC) count += 1;
      else break;
    }
    best = Math.max(best, count);
  }
  if (best >= 8) return 1;
  if (best >= 5) return 0.7;
  if (best >= 3) return 0.4;
  return 0;
}

function identicalBalanceScore(members: ClusterMemberStat[]): number {
  const holdings = members.map((m) => m.holding).filter((h): h is number => typeof h === 'number' && h > 0);
  if (holdings.length < 3) return 0;
  const ref = holdings[0];
  const matching = holdings.filter((h) => Math.abs(h - ref) / ref <= HOLDING_TOLERANCE).length;
  if (matching === holdings.length && holdings.length >= 5) return 1;
  if (matching >= holdings.length * 0.8 && holdings.length >= 3) return 0.6;
  return 0;
}

function sharedFundingScore(members: ClusterMemberStat[]): number {
  const sources = members
    .map((m) => m.fundingSource)
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
  if (sources.length < 3) return 0;
  const counts = new Map<string, number>();
  for (const s of sources) counts.set(s, (counts.get(s) ?? 0) + 1);
  const max = Math.max(...counts.values());
  if (max >= 8) return 1;
  if (max >= 5) return 0.65;
  if (max >= 3) return 0.35;
  return 0;
}

export function scoreClusterSuspicion(members: ClusterMemberStat[]): ClusterSuspicionResult {
  const signals: string[] = [];
  const sameDay = sameDayBatchScore(members);
  if (sameDay > 0) signals.push('same-day creation');
  const sameBalance = identicalBalanceScore(members);
  if (sameBalance > 0) signals.push('identical balances');
  const sharedFunding = sharedFundingScore(members);
  if (sharedFunding > 0) signals.push('shared funding source');
  const score = Math.max(sameDay, sameBalance, sharedFunding);
  const level: ClusterSuspicionResult['level'] = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
  return { score, level, signals };
}
