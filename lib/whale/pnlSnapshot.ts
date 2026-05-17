/**
 * Whale PnL snapshot aggregator. Given a flat list of closed-lot
 * trades for one wallet, compute the realized PnL, win rate, average
 * hold time, and per-bucket distribution. The whale-tracker route
 * already pulls the trade rows; this lib turns them into the
 * summary stats the WhaleAlphaCard renders.
 *
 * Pure — no IO. Audit §B.10 whale tracker P1.
 */

export interface ClosedLot {
  /** UNIX seconds of the close. */
  closedAt: number;
  /** UNIX seconds of the original open. */
  openedAt: number;
  /** Profit in USD on this lot (positive = win). */
  pnlUsd: number;
  /** Size in USD at entry. */
  entryUsd: number;
}

export interface PnlSnapshot {
  trades: number;
  wins: number;
  losses: number;
  /** wins / (wins + losses), 0..1. */
  winRate: number;
  realizedPnlUsd: number;
  averageWinUsd: number;
  averageLossUsd: number;
  /** Average hold time in hours. */
  averageHoldHours: number;
  /** Max consecutive winning lots. */
  maxStreakWins: number;
  /** Max consecutive losing lots. */
  maxStreakLosses: number;
}

export function aggregatePnl(lots: ClosedLot[]): PnlSnapshot {
  if (lots.length === 0) {
    return {
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      realizedPnlUsd: 0,
      averageWinUsd: 0,
      averageLossUsd: 0,
      averageHoldHours: 0,
      maxStreakWins: 0,
      maxStreakLosses: 0,
    };
  }

  // Walk chronologically for streak math.
  const sorted = [...lots].sort((a, b) => a.closedAt - b.closedAt);

  let wins = 0;
  let losses = 0;
  let winPnl = 0;
  let lossPnl = 0;
  let realized = 0;
  let holdSum = 0;
  let streakWins = 0;
  let streakLosses = 0;
  let maxStreakWins = 0;
  let maxStreakLosses = 0;

  for (const l of sorted) {
    realized += l.pnlUsd;
    holdSum += Math.max(0, (l.closedAt - l.openedAt) / 3600);
    if (l.pnlUsd > 0) {
      wins += 1;
      winPnl += l.pnlUsd;
      streakWins += 1;
      streakLosses = 0;
      if (streakWins > maxStreakWins) maxStreakWins = streakWins;
    } else if (l.pnlUsd < 0) {
      losses += 1;
      lossPnl += l.pnlUsd;
      streakLosses += 1;
      streakWins = 0;
      if (streakLosses > maxStreakLosses) maxStreakLosses = streakLosses;
    } else {
      // pnl exactly 0 — counted in trades only; doesn't extend either streak.
      streakWins = 0;
      streakLosses = 0;
    }
  }

  const decided = wins + losses;
  return {
    trades: sorted.length,
    wins,
    losses,
    winRate: decided === 0 ? 0 : wins / decided,
    realizedPnlUsd: realized,
    averageWinUsd: wins === 0 ? 0 : winPnl / wins,
    averageLossUsd: losses === 0 ? 0 : lossPnl / losses,
    averageHoldHours: holdSum / sorted.length,
    maxStreakWins,
    maxStreakLosses,
  };
}
