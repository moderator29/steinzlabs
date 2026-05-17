/**
 * Trade-style classifier. Given a wallet's closed-lot history,
 * categorize the wallet into one of four archetypes:
 *
 *   • sniper   median hold < 1 hour AND >= 60% of buys within 10 min of LP add
 *   • scalper  median hold < 24 hours AND > 25 trades / week
 *   • swing    median hold 1..30 days
 *   • hodler   median hold >= 30 days
 *
 * Returns the dominant archetype + a confidence (how dominant), so
 * the UI can render 'Sniper · 87% confidence' or downgrade to
 * 'Mixed' when the wallet shows multiple patterns. Audit §B.8.
 */

export interface TradeHistoryEvent {
  /** UNIX seconds of the trade. */
  timestamp: number;
  kind: 'buy' | 'sell';
  /** Seconds since the LP was added for this token, if known. */
  secondsAfterLpAdd?: number | null;
  /** Hold time in seconds when this was a sell that closed a position. null on buys. */
  holdSeconds?: number | null;
}

export type TradeArchetype = 'sniper' | 'scalper' | 'swing' | 'hodler' | 'mixed';

export interface TradeStyleVerdict {
  archetype: TradeArchetype;
  confidence: number; // 0..1
  medianHoldSeconds: number;
  tradesPerWeek: number;
  earlyBuyShare: number; // 0..1, fraction of buys within 10 min of LP add
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function classifyTradeStyle(events: TradeHistoryEvent[]): TradeStyleVerdict {
  if (events.length === 0) {
    return {
      archetype: 'mixed',
      confidence: 0,
      medianHoldSeconds: 0,
      tradesPerWeek: 0,
      earlyBuyShare: 0,
    };
  }
  const holds = events.map((e) => e.holdSeconds ?? 0).filter((h) => h > 0);
  const medianHold = median(holds);

  const buys = events.filter((e) => e.kind === 'buy');
  const earlyBuys = buys.filter((b) => (b.secondsAfterLpAdd ?? Infinity) <= 600);
  const earlyBuyShare = buys.length === 0 ? 0 : earlyBuys.length / buys.length;

  const sortedByTime = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const spanSeconds = Math.max(
    86_400,
    sortedByTime[sortedByTime.length - 1].timestamp - sortedByTime[0].timestamp,
  );
  const tradesPerWeek = (events.length * 7 * 86_400) / spanSeconds;

  // Scoring — each archetype gets a 0..1 fitness; max wins.
  const sniperFit = (medianHold > 0 && medianHold < 3600 ? 0.6 : 0) + Math.min(0.4, earlyBuyShare * 0.7);
  const scalperFit = (medianHold > 0 && medianHold < 86_400 ? 0.5 : 0) + Math.min(0.5, tradesPerWeek / 50);
  const swingFit =
    medianHold >= 86_400 && medianHold < 30 * 86_400
      ? 0.9
      : medianHold > 0 && medianHold < 86_400
        ? 0.2
        : 0.1;
  const hodlerFit = medianHold >= 30 * 86_400 ? 0.95 : medianHold >= 7 * 86_400 ? 0.4 : 0.05;

  const ranked: Array<[TradeArchetype, number]> = [
    ['sniper', sniperFit],
    ['scalper', scalperFit],
    ['swing', swingFit],
    ['hodler', hodlerFit],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  const [top, topFit] = ranked[0];
  const runnerFit = ranked[1][1];
  const dominance = topFit - runnerFit;
  const archetype: TradeArchetype = dominance < 0.15 ? 'mixed' : top;
  return {
    archetype,
    confidence: Math.max(0, Math.min(1, topFit)),
    medianHoldSeconds: medianHold,
    tradesPerWeek,
    earlyBuyShare,
  };
}
