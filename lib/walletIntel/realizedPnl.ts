/**
 * Realized PnL calculator using FIFO lot matching. Walks a chrono-
 * logical list of buy/sell events for a single (token, chain) pair
 * and emits closed-lot rows with cost-basis, exit, and per-lot PnL.
 *
 * FIFO (first-in-first-out) matches the IRS default cost-basis
 * method for crypto in the US — also the most common method in
 * tax software like Koinly. Pure — caller supplies the trade
 * events.
 *
 * Audit §B.8 wallet intel realized PnL.
 */

export interface TradeEvent {
  /** UNIX seconds. */
  timestamp: number;
  /** 'buy' increases the lot stack; 'sell' consumes from the FIFO front. */
  kind: 'buy' | 'sell';
  /** Token amount transacted (positive). */
  amount: number;
  /** USD price per token at trade time. */
  priceUsd: number;
  /** Optional fee in USD — added to cost basis on buys, subtracted from proceeds on sells. */
  feeUsd?: number;
}

export interface ClosedLot {
  openedAt: number;
  closedAt: number;
  amount: number;
  costBasisUsd: number;
  proceedsUsd: number;
  pnlUsd: number;
  /** Hold time in seconds. */
  holdSeconds: number;
}

interface OpenLot {
  openedAt: number;
  amountRemaining: number;
  costBasisPerUnit: number;
}

/** Remaining un-sold position after FIFO matching — the basis for unrealized PnL. */
export interface OpenPosition {
  amount: number;
  costBasisUsd: number;
  /** Weighted average cost per unit still held. */
  avgCostPerUnit: number;
  /** Timestamp (unix sec) of the earliest still-open lot. */
  openedAt: number;
}

export function fifoMatch(events: TradeEvent[]): ClosedLot[] {
  return fifoMatchWithOpen(events).closed;
}

/**
 * Same FIFO matching as fifoMatch, but also returns the still-open position
 * (buys not yet consumed by a sell) so callers can compute UNREALIZED PnL
 * against a current price. The open cost basis is real trade-time USD, never
 * fabricated. Returns null open when nothing is held.
 */
export function fifoMatchWithOpen(events: TradeEvent[]): { closed: ClosedLot[]; open: OpenPosition | null } {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const openLots: OpenLot[] = [];
  const closed: ClosedLot[] = [];

  for (const ev of sorted) {
    const fee = ev.feeUsd ?? 0;
    if (ev.kind === 'buy') {
      // cost basis = price + fee/amount
      openLots.push({
        openedAt: ev.timestamp,
        amountRemaining: ev.amount,
        costBasisPerUnit: ev.priceUsd + (ev.amount > 0 ? fee / ev.amount : 0),
      });
      continue;
    }
    // sell — consume from openLots[0] forward.
    let remaining = ev.amount;
    const sellPricePerUnit = ev.priceUsd - (ev.amount > 0 ? fee / ev.amount : 0);
    while (remaining > 0 && openLots.length > 0) {
      const lot = openLots[0];
      const consumed = Math.min(lot.amountRemaining, remaining);
      const costBasis = lot.costBasisPerUnit * consumed;
      const proceeds = sellPricePerUnit * consumed;
      closed.push({
        openedAt: lot.openedAt,
        closedAt: ev.timestamp,
        amount: consumed,
        costBasisUsd: costBasis,
        proceedsUsd: proceeds,
        pnlUsd: proceeds - costBasis,
        holdSeconds: Math.max(0, ev.timestamp - lot.openedAt),
      });
      lot.amountRemaining -= consumed;
      remaining -= consumed;
      if (lot.amountRemaining <= 0) openLots.shift();
    }
    // If `remaining > 0` here, the wallet sold more than it had in
    // FIFO — usually because we're missing buy data. We silently
    // drop the unmatched portion rather than fabricate a 0-cost
    // basis lot; the caller can detect via sum mismatch if needed.
  }

  let open: OpenPosition | null = null;
  if (openLots.length > 0) {
    let amount = 0, cost = 0, openedAt = Infinity;
    for (const lot of openLots) {
      amount += lot.amountRemaining;
      cost += lot.amountRemaining * lot.costBasisPerUnit;
      if (lot.openedAt < openedAt) openedAt = lot.openedAt;
    }
    if (amount > 0) {
      open = { amount, costBasisUsd: cost, avgCostPerUnit: cost / amount, openedAt };
    }
  }

  return { closed, open };
}

export interface RealizedPnlSummary {
  totalRealizedUsd: number;
  totalCostBasisUsd: number;
  totalProceedsUsd: number;
  lots: number;
  averageHoldDays: number;
}

export function summarize(lots: ClosedLot[]): RealizedPnlSummary {
  if (lots.length === 0) {
    return {
      totalRealizedUsd: 0,
      totalCostBasisUsd: 0,
      totalProceedsUsd: 0,
      lots: 0,
      averageHoldDays: 0,
    };
  }
  let cost = 0;
  let proceeds = 0;
  let holdSec = 0;
  for (const l of lots) {
    cost += l.costBasisUsd;
    proceeds += l.proceedsUsd;
    holdSec += l.holdSeconds;
  }
  return {
    totalRealizedUsd: proceeds - cost,
    totalCostBasisUsd: cost,
    totalProceedsUsd: proceeds,
    lots: lots.length,
    averageHoldDays: holdSec / lots.length / 86_400,
  };
}
