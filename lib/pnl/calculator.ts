/**
 * Realized P&L calculator for a wallet's transaction history.
 *
 * Algorithm: FIFO cost-basis matching, per (wallet, chain, symbol).
 *   • A buy adds a "lot" with (qty, costUsd, timestamp).
 *   • A sell pops earliest lot(s) until the sell qty is satisfied; the
 *     realized P&L for each pop = (sellPricePerUnit - lotPricePerUnit)
 *     × consumedQty.
 *   • Partial lots remain on the queue for the next sell.
 *
 * Inputs are intentionally chain-agnostic — the caller hands us
 * normalized buy/sell events. This file does not touch Supabase /
 * Alchemy / Helius so it's pure and unit-testable.
 *
 * Audit §5.8 B.8 — fresh lib called for in the wallet-intelligence
 * realized-P&L upgrade. Replaces the back-of-napkin
 * "now - first observed price" estimate that was sometimes negative
 * for profitable wallets just because the price had dipped.
 */

export interface TradeEvent {
  side: 'buy' | 'sell';
  chain: string;
  symbol: string;
  /** Token quantity moved. Always positive. */
  quantity: number;
  /** USD value of the trade at execution time. */
  usdValue: number;
  /** Unix seconds. */
  timestamp: number;
}

export interface RealizedPnlRow {
  symbol: string;
  chain: string;
  realizedUsd: number;
  buyCount: number;
  sellCount: number;
  matchedQty: number;
  unmatchedBuyQty: number;
  avgHoldHours: number | null;
}

export interface RealizedPnlResult {
  totalUsd: number;
  bySymbol: RealizedPnlRow[];
  /** Round-trip count where at least one sell consumed a buy lot. */
  closedTrades: number;
}

interface Lot {
  qty: number;
  costPerUnit: number;
  openedAt: number;
}

function keyOf(e: Pick<TradeEvent, 'chain' | 'symbol'>): string {
  return `${e.chain.toLowerCase()}|${e.symbol.toUpperCase()}`;
}

export function computeRealizedPnl(events: TradeEvent[]): RealizedPnlResult {
  // Stable chronological sort. Caller may already have sorted, but we
  // re-sort defensively because off-order events flip lot ordering.
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  const lots = new Map<string, Lot[]>();
  const stats = new Map<string, RealizedPnlRow & { holdHoursTotal: number; holdHoursCount: number }>();

  const init = (e: TradeEvent): RealizedPnlRow & { holdHoursTotal: number; holdHoursCount: number } => ({
    symbol: e.symbol.toUpperCase(),
    chain: e.chain.toLowerCase(),
    realizedUsd: 0,
    buyCount: 0,
    sellCount: 0,
    matchedQty: 0,
    unmatchedBuyQty: 0,
    avgHoldHours: null,
    holdHoursTotal: 0,
    holdHoursCount: 0,
  });

  let closedTrades = 0;

  for (const e of sorted) {
    if (!Number.isFinite(e.quantity) || e.quantity <= 0) continue;
    if (!Number.isFinite(e.usdValue) || e.usdValue < 0) continue;
    const k = keyOf(e);
    if (!stats.has(k)) stats.set(k, init(e));
    if (!lots.has(k)) lots.set(k, []);
    const row = stats.get(k)!;
    const queue = lots.get(k)!;
    const pricePerUnit = e.usdValue / e.quantity;

    if (e.side === 'buy') {
      queue.push({ qty: e.quantity, costPerUnit: pricePerUnit, openedAt: e.timestamp });
      row.buyCount += 1;
      continue;
    }

    // sell
    row.sellCount += 1;
    let remaining = e.quantity;
    let consumedAny = false;
    while (remaining > 0 && queue.length > 0) {
      const lot = queue[0];
      const take = Math.min(lot.qty, remaining);
      const realized = (pricePerUnit - lot.costPerUnit) * take;
      row.realizedUsd += realized;
      row.matchedQty += take;
      const holdHours = Math.max(0, (e.timestamp - lot.openedAt) / 3600);
      row.holdHoursTotal += holdHours * take;
      row.holdHoursCount += take;
      lot.qty -= take;
      remaining -= take;
      consumedAny = true;
      if (lot.qty <= 1e-12) queue.shift();
    }
    if (consumedAny) closedTrades += 1;
    // sells without matching lots (received airdrop, transferred in)
    // contribute realized = sellUsd because we have zero cost basis. We
    // intentionally do NOT do that — it would inflate PnL on dust.
  }

  // Finalize unmatched-buy + avg-hold
  for (const [k, row] of stats) {
    const queue = lots.get(k) ?? [];
    row.unmatchedBuyQty = queue.reduce((s, lot) => s + lot.qty, 0);
    row.avgHoldHours = row.holdHoursCount > 0 ? row.holdHoursTotal / row.holdHoursCount : null;
  }

  const bySymbol: RealizedPnlRow[] = Array.from(stats.values())
    .map(({ holdHoursTotal: _h, holdHoursCount: _c, ...r }) => r)
    .sort((a, b) => b.realizedUsd - a.realizedUsd);
  const totalUsd = bySymbol.reduce((s, r) => s + r.realizedUsd, 0);

  return { totalUsd, bySymbol, closedTrades };
}
