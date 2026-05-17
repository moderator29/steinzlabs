/**
 * Cohort percentile calculator. Given a wallet's metric values and
 * the cohort's distribution for the same metrics, compute the
 * percentile rank for each metric. Feeds the radar chart that
 * compares the user's wallet against the top-N wallets in the same
 * archetype.
 *
 * Audit §5.6 / B.8 wallet intel cohort radar.
 */

export interface MetricSample {
  /** Numeric values from the cohort (sorted or unsorted). */
  cohort: number[];
  /** The single value for the wallet being scored. */
  walletValue: number;
}

/**
 * Compute percentile rank using the linear-interpolation method
 * (R-7 / Excel PERCENTILE). Returns 0..100.
 */
export function percentileRank(cohort: number[], walletValue: number): number {
  if (cohort.length === 0) return 0;
  const sorted = [...cohort].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < walletValue).length;
  const equal = sorted.filter((v) => v === walletValue).length;
  // Treat ties as half-below — matches the academic definition.
  return Math.round(((below + 0.5 * equal) / sorted.length) * 100);
}

export interface PercentileResult {
  metric: string;
  rank: number;       // 0..100
  walletValue: number;
  cohortMedian: number;
}

export function percentileMatrix(samples: Record<string, MetricSample>): PercentileResult[] {
  return Object.entries(samples).map(([metric, s]) => {
    const sorted = [...s.cohort].sort((a, b) => a - b);
    const median = sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    return {
      metric,
      rank: percentileRank(s.cohort, s.walletValue),
      walletValue: s.walletValue,
      cohortMedian: median,
    };
  });
}

/**
 * Verdict label for the radar chart — categorical bucket so the UI
 * can color the polygon edge differently for top performers.
 */
export function rankVerdict(rank: number): 'top-1' | 'top-10' | 'top-25' | 'median' | 'bottom-25' {
  if (rank >= 99) return 'top-1';
  if (rank >= 90) return 'top-10';
  if (rank >= 75) return 'top-25';
  if (rank >= 25) return 'median';
  return 'bottom-25';
}
