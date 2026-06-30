import { fifoMatch, summarize, type TradeEvent, type RealizedPnlSummary } from './realizedPnl';

/**
 * Wallet realized-PnL adapter. Turns real DEX trades (Bitquery DEXTrades, where
 * each trade carries AmountInUSD = the USD value AT TRADE TIME) into FIFO
 * realized PnL per token. This is the honest path to cost basis: priceUsd is
 * derived from real trade-time USD, never fabricated from current prices.
 *
 * Pure (no I/O) so it's unit-testable; the server wrapper (walletPnl.ts) fetches
 * the trades and calls computeWalletPnl().
 */

export interface WalletTrade {
  token: string;             // token mint / contract address (the grouping key)
  tokenSymbol: string | null;
  side: 'buy' | 'sell';
  amount: number;            // token quantity (positive)
  valueUsd: number;          // USD value at trade time
  timestamp: number;         // unix seconds
}

export interface TokenPnl extends RealizedPnlSummary {
  token: string;
  tokenSymbol: string | null;
  winRate: number;           // % of closed lots that were profitable
}

export interface WalletPnlResult {
  byToken: TokenPnl[];
  totalRealizedUsd: number;
  totalProceedsUsd: number;
  totalCostBasisUsd: number;
  closedLots: number;
  winRate: number;           // overall, across all closed lots
  averageHoldDays: number;
}

const EMPTY: WalletPnlResult = {
  byToken: [], totalRealizedUsd: 0, totalProceedsUsd: 0, totalCostBasisUsd: 0,
  closedLots: 0, winRate: 0, averageHoldDays: 0,
};

/** Compute realized PnL per token (+ aggregate) from a flat list of trades. */
export function computeWalletPnl(trades: WalletTrade[]): WalletPnlResult {
  if (!Array.isArray(trades) || trades.length === 0) return EMPTY;

  const byToken = new Map<string, WalletTrade[]>();
  for (const t of trades) {
    if (!t || !t.token || !(t.amount > 0) || !(t.valueUsd >= 0) || !Number.isFinite(t.timestamp)) continue;
    const arr = byToken.get(t.token) ?? [];
    arr.push(t);
    byToken.set(t.token, arr);
  }

  const tokenResults: TokenPnl[] = [];
  let totalRealized = 0, totalProceeds = 0, totalCost = 0, totalLots = 0, totalWins = 0, holdDaysWeighted = 0;

  for (const [token, ts] of byToken) {
    const events: TradeEvent[] = ts.map(t => ({
      timestamp: t.timestamp,
      kind: t.side,
      amount: t.amount,
      priceUsd: t.amount > 0 ? t.valueUsd / t.amount : 0,
    }));
    const lots = fifoMatch(events);
    if (lots.length === 0) continue;
    const summary = summarize(lots);
    const wins = lots.filter(l => l.pnlUsd > 0).length;
    tokenResults.push({
      ...summary,
      token,
      tokenSymbol: ts[0].tokenSymbol ?? null,
      winRate: Math.round((wins / lots.length) * 100),
    });
    totalRealized += summary.totalRealizedUsd;
    totalProceeds += summary.totalProceedsUsd;
    totalCost += summary.totalCostBasisUsd;
    totalLots += summary.lots;
    totalWins += wins;
    holdDaysWeighted += summary.averageHoldDays * summary.lots;
  }

  tokenResults.sort((a, b) => b.totalRealizedUsd - a.totalRealizedUsd);

  return {
    byToken: tokenResults,
    totalRealizedUsd: totalRealized,
    totalProceedsUsd: totalProceeds,
    totalCostBasisUsd: totalCost,
    closedLots: totalLots,
    winRate: totalLots > 0 ? Math.round((totalWins / totalLots) * 100) : 0,
    averageHoldDays: totalLots > 0 ? holdDaysWeighted / totalLots : 0,
  };
}
