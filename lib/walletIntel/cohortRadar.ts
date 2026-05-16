/**
 * Cohort comparison radar. Given a target wallet's metrics and a
 * cohort sample (top-N wallets of the same archetype), returns the
 * target's percentile rank on each axis so the UI can render a radar
 * chart with the target overlaid on the cohort median.
 *
 * Pure function — no IO. Audit §5.8 B.8 — fresh primitive for the
 * wallet-intelligence P1 upgrade.
 */

export type RadarAxis =
  | 'realizedPnl'
  | 'winRate'
  | 'avgHoldHours'
  | 'tradeCount'
  | 'concentration'  // lower = better diversification → invert
  | 'smartMoneyOverlap';

export interface CohortMember {
  realizedPnl?: number;
  winRate?: number;
  avgHoldHours?: number;
  tradeCount?: number;
  concentration?: number; // 0..1, lower = more diversified
  smartMoneyOverlap?: number; // 0..1
}

export interface CohortRadarResult {
  axes: Record<RadarAxis, {
    target: number;
    cohortMedian: number;
    cohortP25: number;
    cohortP75: number;
    /** 0..100 percentile of target vs cohort. Concentration is inverted
     *  so higher percentile == better diversification. */
    percentile: number;
  }>;
  /** Overall band — average percentile across axes with samples. */
  overallPercentile: number;
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function rankPercentile(target: number, sorted: number[]): number {
  if (sorted.length === 0) return 50;
  let count = 0;
  for (const v of sorted) {
    if (v <= target) count += 1;
  }
  return Math.round((count / sorted.length) * 100);
}

function extract(cohort: CohortMember[], axis: RadarAxis): number[] {
  return cohort
    .map((m) => m[axis])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
}

export function buildCohortRadar(target: CohortMember, cohort: CohortMember[]): CohortRadarResult {
  const axes: RadarAxis[] = ['realizedPnl', 'winRate', 'avgHoldHours', 'tradeCount', 'concentration', 'smartMoneyOverlap'];
  const result = {} as CohortRadarResult['axes'];
  const percentiles: number[] = [];

  for (const axis of axes) {
    const sample = extract(cohort, axis);
    const t = typeof target[axis] === 'number' && Number.isFinite(target[axis]!) ? target[axis]! : 0;
    let p = rankPercentile(t, sample);
    // Lower concentration is better → invert percentile so 1 == top.
    if (axis === 'concentration') p = 100 - p;
    result[axis] = {
      target: t,
      cohortMedian: percentile(sample, 0.5),
      cohortP25: percentile(sample, 0.25),
      cohortP75: percentile(sample, 0.75),
      percentile: p,
    };
    if (sample.length > 0) percentiles.push(p);
  }

  const overall = percentiles.length === 0
    ? 50
    : Math.round(percentiles.reduce((s, p) => s + p, 0) / percentiles.length);
  return { axes: result, overallPercentile: overall };
}
