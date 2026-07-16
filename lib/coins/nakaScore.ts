/**
 * Naka Score - one honest 0-100 coin health read.
 *
 * A pure, IO-free scorer. Every component contributes to a running total AND a
 * running max ONLY when its real signal is present, so a coin is never punished
 * for a signal we could not measure. The final score is total / max scaled to
 * 100. When no component has data at all, the score is null and the grade is
 * null (an honest "not enough data yet"), never a fabricated number.
 *
 * Real signals only. No component is invented; each maps to data the coin
 * surfaces already gather (liquidity, on-platform holders, 24h buy/sell flow,
 * rug-risk, pool age).
 */

import { compactUsd, compactNum } from './format';

export type NakaRiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type NakaGrade = 'strong' | 'fair' | 'weak';

export interface NakaScoreInput {
  /** Deepest-pool USD liquidity. */
  liquidityUsd?: number | null;
  /** Count of holders that bought via Naka (honest on-platform floor). Pass the
   *  platform-holders array length; 0 is a real, low signal, null means unknown. */
  platformHolders?: number | null;
  /** 24h buy count. */
  buys24h?: number | null;
  /** 24h sell count. */
  sells24h?: number | null;
  /** Rug-risk level from the security read. 'unknown' is excluded from scoring. */
  riskLevel?: NakaRiskLevel | null;
  /** Pool/pair creation time, unix ms. */
  pairCreatedAt?: number | null;
  /** Age in ms, an alternative to pairCreatedAt when a direct age is known. */
  ageMs?: number | null;
}

export interface NakaScoreRow {
  key: string;
  label: string;
  points: number;
  max: number;
  note: string;
}

export interface NakaScoreResult {
  score: number | null;
  grade: NakaGrade | null;
  breakdown: NakaScoreRow[];
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Points for a value using descending (value, points) bands; first hit wins. */
function band(value: number, bands: Array<[min: number, points: number]>): number {
  for (const [min, points] of bands) {
    if (value >= min) return points;
  }
  return 0;
}

function isNum(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Compute the Naka Score from whatever real signals are available. Missing
 * signals are excluded from both the earned points and the possible max, so the
 * ratio stays fair. Returns a null score when nothing could be measured.
 */
export function computeNakaScore(input: NakaScoreInput): NakaScoreResult {
  const rows: NakaScoreRow[] = [];

  // Liquidity: deeper pools are harder to drain and easier to exit. Max 25.
  if (isNum(input.liquidityUsd) && input.liquidityUsd >= 0) {
    const max = 25;
    const points = band(input.liquidityUsd, [
      [250_000, 25],
      [100_000, 21],
      [50_000, 17],
      [20_000, 12],
      [5_000, 7],
      [1_000, 4],
      [0, 1],
    ]);
    rows.push({
      key: 'liquidity',
      label: 'Liquidity',
      points,
      max,
      note: `${compactUsd(input.liquidityUsd)} in the deepest pool`,
    });
  }

  // On-platform holders: real Naka buyers holding the coin. Max 15.
  if (isNum(input.platformHolders) && input.platformHolders >= 0) {
    const max = 15;
    const points = band(input.platformHolders, [
      [500, 15],
      [200, 12],
      [100, 10],
      [50, 7],
      [20, 5],
      [5, 3],
      [1, 1],
      [0, 0],
    ]);
    const n = input.platformHolders;
    rows.push({
      key: 'holders',
      label: 'On-platform holders',
      points,
      max,
      note: n === 0 ? 'No Naka holders yet' : `${compactNum(n)} holding via Naka`,
    });
  }

  // 24h buy/sell balance: balanced two-way flow beats one-sided pressure. Max 20.
  if (isNum(input.buys24h) && isNum(input.sells24h) && input.buys24h + input.sells24h > 0) {
    const max = 20;
    const total = input.buys24h + input.sells24h;
    const buyShare = input.buys24h / total;
    // Reward a slight buy lean (~0.55); penalise heavy sell pressure or a
    // one-sided buy-only spike symmetrically.
    const distance = Math.min(1, Math.abs(buyShare - 0.55) / 0.45);
    const points = Math.round(max * (1 - distance));
    const pct = Math.round(buyShare * 100);
    rows.push({
      key: 'flow',
      label: '24h buy/sell balance',
      points,
      max,
      note: `${pct}% of ${compactNum(total)} trades were buys`,
    });
  }

  // Rug-risk: from the real security read. 'unknown' is excluded, not guessed. Max 25.
  if (input.riskLevel && input.riskLevel !== 'unknown') {
    const max = 25;
    const points = input.riskLevel === 'low' ? 25 : input.riskLevel === 'medium' ? 13 : 0;
    const note =
      input.riskLevel === 'low'
        ? 'Security checks passed'
        : input.riskLevel === 'medium'
          ? 'Some security cautions'
          : 'High rug-risk flags';
    rows.push({ key: 'risk', label: 'Rug-risk', points, max, note });
  }

  // Age: a pool that has survived longer has cleared more exit windows. Max 15.
  const ageMs = isNum(input.ageMs)
    ? input.ageMs
    : isNum(input.pairCreatedAt) && input.pairCreatedAt > 0
      ? Date.now() - input.pairCreatedAt
      : null;
  if (isNum(ageMs) && ageMs >= 0) {
    const max = 15;
    const points = band(ageMs, [
      [90 * DAY, 15],
      [30 * DAY, 12],
      [14 * DAY, 10],
      [7 * DAY, 8],
      [3 * DAY, 6],
      [1 * DAY, 4],
      [6 * HOUR, 2],
      [0, 1],
    ]);
    rows.push({
      key: 'age',
      label: 'Pool age',
      points,
      max,
      note: ageLabel(ageMs),
    });
  }

  const totalMax = rows.reduce((s, r) => s + r.max, 0);
  if (totalMax === 0) {
    return { score: null, grade: null, breakdown: rows };
  }

  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const score = Math.round((100 * totalPoints) / totalMax);
  const grade: NakaGrade = score >= 70 ? 'strong' : score >= 45 ? 'fair' : 'weak';

  return { score, grade, breakdown: rows };
}

/** Human pool-age note: "5d old", "3h old", "new". */
function ageLabel(ms: number): string {
  if (ms < HOUR) return 'Under an hour old';
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h old`;
  const days = Math.floor(ms / DAY);
  if (days < 30) return `${days}d old`;
  const months = Math.floor(days / 30);
  return `${months}mo old`;
}
