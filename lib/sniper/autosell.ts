/**
 * Auto-sell decision engine.
 *
 * For each open sniper_executions row (status='confirmed', realized_at NULL),
 * the cron calls evaluatePosition() with the criteria's TP/SL/trailing config
 * and the current price. We return a Decision describing whether to sell, why,
 * and whether the peak_price_usd column should be bumped.
 *
 * Non-custodial: this module never signs. The cron writes a pending_trades
 * row when Decision.action='sell', and the existing pending-trade pipeline
 * (browser-confirm) runs the actual swap. realized_at + pnl_usd are filled
 * when the resulting trade lands.
 */

export interface AutoSellInputs {
  entryPriceUsd: number;
  currentPriceUsd: number;
  /** Highest price observed since entry, if previously recorded. */
  peakPriceUsd: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  trailingStopPct: number | null;
}

export interface Decision {
  action: "hold" | "sell";
  reason: string | null;
  /**
   * If non-null, the cron should UPDATE peak_price_usd to this value.
   * Set whenever the current price exceeds the previously recorded peak.
   */
  newPeakUsd: number | null;
  /** Realized return as a fraction of entry (e.g. 1.5 = +150%). */
  pnlPct: number;
}

export function evaluatePosition(i: AutoSellInputs): Decision {
  if (!Number.isFinite(i.entryPriceUsd) || i.entryPriceUsd <= 0) {
    return { action: "hold", reason: "no entry price", newPeakUsd: null, pnlPct: 0 };
  }
  const pnlPct = (i.currentPriceUsd - i.entryPriceUsd) / i.entryPriceUsd;

  // Bump peak if current is higher than previously recorded peak (or entry).
  const priorPeak = i.peakPriceUsd ?? i.entryPriceUsd;
  const newPeakUsd = i.currentPriceUsd > priorPeak ? i.currentPriceUsd : null;
  const effectivePeak = newPeakUsd ?? priorPeak;

  if (i.takeProfitPct != null && pnlPct >= i.takeProfitPct / 100) {
    return { action: "sell", reason: `take_profit ${(pnlPct * 100).toFixed(2)}%`, newPeakUsd, pnlPct };
  }
  if (i.stopLossPct != null && pnlPct <= -Math.abs(i.stopLossPct) / 100) {
    return { action: "sell", reason: `stop_loss ${(pnlPct * 100).toFixed(2)}%`, newPeakUsd, pnlPct };
  }
  if (i.trailingStopPct != null && effectivePeak > i.entryPriceUsd) {
    // Trailing stop only arms after price has moved above entry.
    const drawdownFromPeak = (effectivePeak - i.currentPriceUsd) / effectivePeak;
    if (drawdownFromPeak >= i.trailingStopPct / 100) {
      return {
        action: "sell",
        reason: `trailing_stop ${(drawdownFromPeak * 100).toFixed(2)}% off peak`,
        newPeakUsd,
        pnlPct,
      };
    }
  }
  return { action: "hold", reason: null, newPeakUsd, pnlPct };
}
