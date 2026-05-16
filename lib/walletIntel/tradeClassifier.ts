/**
 * Trade-style classifier. Takes a wallet's chronological buy/sell
 * history and assigns one of six archetypes based on hold duration +
 * trade frequency + price-velocity-at-entry. Pure function — no IO.
 *
 * Audit §5.8 B.8 — fresh lib called for in the wallet-intelligence
 * P1 upgrade. The existing classifier used 3-bucket logic (HODLer /
 * Active / Inactive) which collapsed snipers and swing traders into
 * the same bucket and missed the most actionable signal: how fast
 * does this wallet enter a new launch.
 *
 * Output is intentionally a single label + confidence so the UI
 * doesn't have to render a probability distribution. If the data is
 * too thin to decide, returns 'unknown'.
 */

export type TradeStyle =
  | 'sniper'        // buys within minutes of token deploy / new pair
  | 'swing'         // medium hold (hours-to-days), moderate freq
  | 'hodler'        // long hold (weeks+), low trade freq
  | 'arbitrage'     // very high freq, very short hold (minutes)
  | 'farmer'        // many small trades, often same-day cycle
  | 'degen'         // high freq, high count, mixed hold, lots of new launches
  | 'unknown';

export interface ClassifierInput {
  side: 'buy' | 'sell';
  /** Unix seconds of the trade. */
  timestamp: number;
  /** Token age at entry, in seconds (only meaningful for buys). */
  tokenAgeAtEntrySec?: number;
}

export interface TradeStyleResult {
  style: TradeStyle;
  /** 0..1 confidence in the assigned label. Below 0.5 → treat as soft signal. */
  confidence: number;
  /** Helpful summary stats. */
  stats: {
    totalTrades: number;
    avgHoldHours: number | null;
    medianHoldHours: number | null;
    snipeRatio: number; // share of buys where tokenAgeAtEntrySec < 1h
    tradesPerWeek: number;
  };
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function classifyTradeStyle(trades: ClassifierInput[]): TradeStyleResult {
  if (trades.length < 4) {
    return {
      style: 'unknown',
      confidence: 0,
      stats: { totalTrades: trades.length, avgHoldHours: null, medianHoldHours: null, snipeRatio: 0, tradesPerWeek: 0 },
    };
  }
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  // Pair off buys → first subsequent sell to estimate hold duration.
  const holdHours: number[] = [];
  const buyQueue: ClassifierInput[] = [];
  let snipeBuys = 0;
  let totalBuys = 0;
  for (const t of sorted) {
    if (t.side === 'buy') {
      buyQueue.push(t);
      totalBuys += 1;
      if (typeof t.tokenAgeAtEntrySec === 'number' && t.tokenAgeAtEntrySec < 60 * 60) {
        snipeBuys += 1;
      }
    } else if (buyQueue.length > 0) {
      const buy = buyQueue.shift()!;
      holdHours.push(Math.max(0, (t.timestamp - buy.timestamp) / 3600));
    }
  }

  const avgHoldHours =
    holdHours.length === 0 ? null : holdHours.reduce((s, h) => s + h, 0) / holdHours.length;
  const medianHoldHours = median(holdHours);

  const spanSec = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
  const weeks = Math.max(1 / 7, spanSec / (7 * 24 * 3600));
  const tradesPerWeek = sorted.length / weeks;
  const snipeRatio = totalBuys > 0 ? snipeBuys / totalBuys : 0;

  let style: TradeStyle = 'unknown';
  let confidence = 0.5;

  if (snipeRatio >= 0.6 && (medianHoldHours ?? 24) < 24) {
    style = 'sniper';
    confidence = 0.85;
  } else if (tradesPerWeek >= 100 && (medianHoldHours ?? 1) < 0.5) {
    style = 'arbitrage';
    confidence = 0.9;
  } else if (tradesPerWeek >= 40 && snipeRatio < 0.3 && (medianHoldHours ?? 0) < 12) {
    style = 'farmer';
    confidence = 0.7;
  } else if (tradesPerWeek >= 30 && snipeRatio >= 0.2) {
    style = 'degen';
    confidence = 0.7;
  } else if ((medianHoldHours ?? 0) >= 24 * 14) {
    style = 'hodler';
    confidence = 0.8;
  } else if ((medianHoldHours ?? 0) >= 6) {
    style = 'swing';
    confidence = 0.7;
  }

  return {
    style,
    confidence,
    stats: { totalTrades: sorted.length, avgHoldHours, medianHoldHours, snipeRatio, tradesPerWeek },
  };
}
