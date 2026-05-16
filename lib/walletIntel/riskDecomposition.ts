/**
 * Decomposed risk score for a wallet. Returns a 0..100 overall score
 * plus the five contributing dimensions, so the UI can render a
 * stacked bar instead of a single opaque number. Pure function — no IO.
 *
 * Audit §5.8 B.8 — fresh lib called for in the wallet-intelligence
 * P1 upgrade. The existing flat risk score collapsed five very
 * different signals into one number; users couldn't tell whether
 * the wallet was risky because it ran one huge bet (concentration)
 * or because it traded illiquid scams.
 *
 * Dimensions:
 *
 *   • CONCENTRATION   Herfindahl-Hirschman Index of holdings. A
 *                     wallet with one token at 80% of value is
 *                     riskier than one with 20% across 5 tokens.
 *   • LIQUIDITY       Weighted average liquidity of held tokens.
 *                     Holding 10 illiquid memecoins is high-risk
 *                     even if no single position dominates.
 *   • ENTRY-TIMING    Average token age at entry. Buying on day 0
 *                     is sniper-tier risk; buying 30 days post-
 *                     deploy is much safer.
 *   • SMART-MONEY-    Negative weight: following smart-money or
 *     FOLLOWING       holding their picks REDUCES risk score.
 *   • SCAM-EXPOSURE   Share of holdings flagged by GoPlus / scam
 *                     labels. Hard penalty.
 */

export interface RiskHolding {
  /** Token symbol/identifier (for grouping). */
  symbol: string;
  /** Position value in USD. */
  valueUsd: number;
  /** DEX liquidity for the token (USD). */
  liquidityUsd?: number;
  /** Token age at the wallet's entry (seconds). */
  ageAtEntrySec?: number;
  /** True if a smart-money / whale wallet also holds this token. */
  smartMoneyAlso?: boolean;
  /** True if the token is flagged by GoPlus / Chainalysis / etc. */
  flaggedAsScam?: boolean;
}

export interface RiskDecomposition {
  overall: number; // 0..100, higher = riskier
  components: {
    concentration: number;
    liquidity: number;
    entryTiming: number;
    smartMoneyFollowing: number;
    scamExposure: number;
  };
  level: 'low' | 'medium' | 'high' | 'extreme';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function herfindahl(values: number[]): number {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  return values.reduce((s, v) => s + (v / total) ** 2, 0);
}

export function decomposeWalletRisk(holdings: RiskHolding[]): RiskDecomposition {
  const values = holdings.map((h) => h.valueUsd).filter((v) => v > 0);
  const total = values.reduce((s, v) => s + v, 0);

  // 1. Concentration — HHI ranges 0..1. >0.5 (e.g. one position at 70%)
  //    pegs the dimension to 100.
  const hhi = herfindahl(values);
  const concentration = Math.round(clamp01(hhi / 0.5) * 100);

  // 2. Liquidity — weighted average. Lower liquidity → higher risk.
  //    $1M liquidity → 0 risk, $10k → 1.
  let liquidityRisk = 0;
  if (total > 0) {
    for (const h of holdings) {
      const weight = h.valueUsd / total;
      const liq = h.liquidityUsd ?? 0;
      const norm = liq <= 0 ? 1 : clamp01((Math.log10(1_000_000) - Math.log10(Math.max(1, liq))) / 2);
      liquidityRisk += weight * norm;
    }
  }
  const liquidity = Math.round(clamp01(liquidityRisk) * 100);

  // 3. Entry timing — weighted by position. Day-0 entry → 1, 60+
  //    days → 0.
  let timingRisk = 0;
  if (total > 0) {
    for (const h of holdings) {
      const weight = h.valueUsd / total;
      if (typeof h.ageAtEntrySec !== 'number') continue;
      const days = h.ageAtEntrySec / 86_400;
      timingRisk += weight * clamp01((60 - days) / 60);
    }
  }
  const entryTiming = Math.round(clamp01(timingRisk) * 100);

  // 4. Smart-money following — NEGATIVE risk (caps at 30 reduction).
  //    Computed as a normalized risk-reducer first, inverted into
  //    a 0..100 score for the bar (lower bar == more smart-money
  //    overlap == less risk).
  let smartShare = 0;
  if (total > 0) {
    for (const h of holdings) {
      if (h.smartMoneyAlso) smartShare += h.valueUsd / total;
    }
  }
  const smartMoneyFollowing = Math.round(clamp01(1 - smartShare) * 100);

  // 5. Scam exposure — share of value in flagged tokens.
  let scamShare = 0;
  if (total > 0) {
    for (const h of holdings) {
      if (h.flaggedAsScam) scamShare += h.valueUsd / total;
    }
  }
  const scamExposure = Math.round(clamp01(scamShare) * 100);

  // Overall — weighted average. Scam exposure is a hard penalty
  // (it can saturate the score on its own); smart-money is a small
  // dampener.
  const overall = Math.round(
    clamp01(
      (concentration * 0.20 +
        liquidity * 0.25 +
        entryTiming * 0.15 +
        smartMoneyFollowing * 0.10 +
        scamExposure * 0.30) /
        100,
    ) * 100,
  );

  const level: RiskDecomposition['level'] =
    overall >= 80 ? 'extreme' : overall >= 60 ? 'high' : overall >= 35 ? 'medium' : 'low';

  return {
    overall,
    components: { concentration, liquidity, entryTiming, smartMoneyFollowing, scamExposure },
    level,
  };
}
