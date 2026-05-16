import 'server-only';

/**
 * Canonical Trust Score formula. The Context Feed has three event
 * sources today and each one computed a different trust score:
 *
 *   • Alchemy webhook events     → scored against transfer value
 *   • Pump.fun events            → scored against mcap / volume
 *   • DexScreener events         → scored against liquidity + volume
 *
 * The result: a $500k whale transfer could land at 78 from one source
 * and 42 from another for the same on-chain event. This file is the
 * single source of truth — every event-classifier now imports
 * computeTrustScore() and feeds it whatever signals it has.
 *
 * Each signal contributes 0..1 weighted by its assigned weight. Missing
 * signals are skipped (the remaining weights renormalize). Output is
 * clamped to 0..100 and rounded to 1 decimal place so two events with
 * identical inputs always render the same score.
 */

export type TrustLevel = 'DANGER' | 'CAUTION' | 'TRUSTED';

export interface TrustSignals {
  /** USD value of the activity. Larger == more meaningful. */
  valueUsd?: number;
  /** Market cap of the involved token (USD). Smaller cap == higher risk. */
  marketCapUsd?: number;
  /** 24h trading volume of the involved token (USD). */
  volume24hUsd?: number;
  /** Total liquidity available in DEX pools (USD). */
  liquidityUsd?: number;
  /** Token age in seconds. Newer == more risk. */
  tokenAgeSec?: number;
  /** GoPlus safety score 0..100. Higher == safer. */
  goPlusScore?: number;
  /** Was the source wallet labeled as smart-money / whale? */
  sourceIsSmartMoney?: boolean;
}

interface Weighted {
  weight: number;
  value: number; // 0..1
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function logScore(value: number, low: number, high: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const lo = Math.log10(low);
  const hi = Math.log10(high);
  const v = Math.log10(value);
  return clamp01((v - lo) / (hi - lo));
}

export function computeTrustScore(signals: TrustSignals): { score: number; level: TrustLevel } {
  const components: Weighted[] = [];

  if (typeof signals.valueUsd === 'number') {
    // $1k → 0, $1M → 1 (log-scaled). Sub-$1k events score 0.
    components.push({ weight: 0.20, value: logScore(signals.valueUsd, 1_000, 1_000_000) });
  }
  if (typeof signals.marketCapUsd === 'number') {
    // $100k → 0, $1B → 1 — bigger mcap == more credible.
    components.push({ weight: 0.20, value: logScore(signals.marketCapUsd, 100_000, 1_000_000_000) });
  }
  if (typeof signals.volume24hUsd === 'number') {
    components.push({ weight: 0.15, value: logScore(signals.volume24hUsd, 10_000, 50_000_000) });
  }
  if (typeof signals.liquidityUsd === 'number') {
    components.push({ weight: 0.15, value: logScore(signals.liquidityUsd, 10_000, 5_000_000) });
  }
  if (typeof signals.tokenAgeSec === 'number') {
    // 1 day → 0, 90 days → 1.
    const days = signals.tokenAgeSec / 86_400;
    components.push({ weight: 0.10, value: clamp01((days - 1) / 89) });
  }
  if (typeof signals.goPlusScore === 'number') {
    components.push({ weight: 0.15, value: clamp01(signals.goPlusScore / 100) });
  }
  if (typeof signals.sourceIsSmartMoney === 'boolean') {
    components.push({ weight: 0.05, value: signals.sourceIsSmartMoney ? 1 : 0.4 });
  }

  if (components.length === 0) return { score: 0, level: 'DANGER' };

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weighted = components.reduce((s, c) => s + c.weight * c.value, 0);
  const score = Math.round((weighted / totalWeight) * 1000) / 10; // 0..100, 1dp

  const level: TrustLevel = score >= 70 ? 'TRUSTED' : score >= 40 ? 'CAUTION' : 'DANGER';
  return { score, level };
}
