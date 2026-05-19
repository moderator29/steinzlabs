/**
 * Behavior-shift detector. Given a chronological series of wallet
 * snapshots (one per week, ideally), identifies meaningful pivots in
 * archetype / risk profile so the wallet-intel UI can render a
 * "HODLER → DEGEN on 2026-03-15" timeline marker.
 *
 * Pure detector — caller provides already-computed snapshots. Audit
 * §5.8 B.8 — fresh primitive.
 */

export interface BehaviorSnapshot {
  /** Unix seconds at the snapshot time. */
  timestamp: number;
  /** Trade style (matches tradeClassifier's output). */
  style: 'sniper' | 'swing' | 'hodler' | 'arbitrage' | 'farmer' | 'degen' | 'unknown';
  /** Wallet risk score 0..100. Higher == riskier. */
  riskScore: number;
  /** Total realized PnL up to this snapshot (USD). */
  realizedPnl: number;
}

export type ShiftKind = 'style' | 'risk' | 'pnl';

export interface BehaviorShift {
  at: number; // unix seconds
  kind: ShiftKind;
  /** Human-readable description for the timeline marker. */
  summary: string;
  /** Magnitude in axis-specific units (style: 0, risk: delta, pnl: delta USD). */
  magnitude: number;
}

const STYLE_RISK_LEVEL: Record<BehaviorSnapshot['style'], number> = {
  hodler: 1,
  swing: 2,
  unknown: 3,
  farmer: 4,
  sniper: 5,
  arbitrage: 5,
  degen: 6,
};

const RISK_SHIFT_THRESHOLD = 20;     // 20-point swing in risk score
const PNL_SHIFT_THRESHOLD = 5_000;   // $5k swing in realized PnL between snapshots

function styleSummary(prev: BehaviorSnapshot['style'], next: BehaviorSnapshot['style']): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const direction = STYLE_RISK_LEVEL[next] > STYLE_RISK_LEVEL[prev] ? '↑' : '↓';
  return `${cap(prev)} ${direction} ${cap(next)}`;
}

export function detectBehaviorShifts(snapshots: BehaviorSnapshot[]): BehaviorShift[] {
  if (snapshots.length < 2) return [];
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const shifts: BehaviorShift[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (prev.style !== curr.style && prev.style !== 'unknown' && curr.style !== 'unknown') {
      shifts.push({
        at: curr.timestamp,
        kind: 'style',
        summary: styleSummary(prev.style, curr.style),
        magnitude: STYLE_RISK_LEVEL[curr.style] - STYLE_RISK_LEVEL[prev.style],
      });
    }

    const riskDelta = curr.riskScore - prev.riskScore;
    if (Math.abs(riskDelta) >= RISK_SHIFT_THRESHOLD) {
      shifts.push({
        at: curr.timestamp,
        kind: 'risk',
        summary: `Risk ${riskDelta > 0 ? '+' : ''}${Math.round(riskDelta)} pts`,
        magnitude: riskDelta,
      });
    }

    const pnlDelta = curr.realizedPnl - prev.realizedPnl;
    if (Math.abs(pnlDelta) >= PNL_SHIFT_THRESHOLD) {
      shifts.push({
        at: curr.timestamp,
        kind: 'pnl',
        summary: `Realized ${pnlDelta > 0 ? '+' : '-'}$${Math.abs(Math.round(pnlDelta)).toLocaleString(undefined)}`,
        magnitude: pnlDelta,
      });
    }
  }

  return shifts;
}
