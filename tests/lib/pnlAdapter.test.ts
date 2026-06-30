/**
 * Unit tests for lib/walletIntel/pnlAdapter — realized PnL from real DEX trades.
 * Verifies FIFO cost-basis matching, win rate, and aggregation. node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeWalletPnl, type WalletTrade } from '../../lib/walletIntel/pnlAdapter';

const DAY = 86_400;

describe('computeWalletPnl', () => {
  it('returns empty for no trades', () => {
    const r = computeWalletPnl([]);
    assert.equal(r.totalRealizedUsd, 0);
    assert.equal(r.closedLots, 0);
    assert.deepEqual(r.byToken, []);
  });

  it('computes a simple profitable round-trip (buy 100@$1, sell 100@$2)', () => {
    const trades: WalletTrade[] = [
      { token: 'TKN', tokenSymbol: 'TKN', side: 'buy', amount: 100, valueUsd: 100, timestamp: 1_000 },
      { token: 'TKN', tokenSymbol: 'TKN', side: 'sell', amount: 100, valueUsd: 200, timestamp: 1_000 + DAY },
    ];
    const r = computeWalletPnl(trades);
    assert.equal(r.totalRealizedUsd, 100);     // $200 proceeds - $100 cost
    assert.equal(r.totalCostBasisUsd, 100);
    assert.equal(r.totalProceedsUsd, 200);
    assert.equal(r.closedLots, 1);
    assert.equal(r.winRate, 100);              // the one closed lot is a win
    assert.equal(r.byToken.length, 1);
    assert.equal(r.byToken[0].token, 'TKN');
  });

  it('computes a loss and reports 0% win rate', () => {
    const trades: WalletTrade[] = [
      { token: 'X', tokenSymbol: 'X', side: 'buy', amount: 10, valueUsd: 1000, timestamp: 1 },
      { token: 'X', tokenSymbol: 'X', side: 'sell', amount: 10, valueUsd: 400, timestamp: 2 },
    ];
    const r = computeWalletPnl(trades);
    assert.equal(r.totalRealizedUsd, -600);
    assert.equal(r.winRate, 0);
  });

  it('uses FIFO order across multiple buys', () => {
    // buy 10@$1, buy 10@$3, sell 10@$2 → first lot (cost $10) sold for $20 = +$10
    const trades: WalletTrade[] = [
      { token: 'F', tokenSymbol: 'F', side: 'buy', amount: 10, valueUsd: 10, timestamp: 1 },
      { token: 'F', tokenSymbol: 'F', side: 'buy', amount: 10, valueUsd: 30, timestamp: 2 },
      { token: 'F', tokenSymbol: 'F', side: 'sell', amount: 10, valueUsd: 20, timestamp: 3 },
    ];
    const r = computeWalletPnl(trades);
    assert.equal(r.totalRealizedUsd, 10);   // FIFO consumes the $1 lot, not the $3 lot
    assert.equal(r.closedLots, 1);
  });

  it('aggregates across tokens and ranks by realized PnL', () => {
    const trades: WalletTrade[] = [
      { token: 'WIN', tokenSymbol: 'WIN', side: 'buy', amount: 1, valueUsd: 100, timestamp: 1 },
      { token: 'WIN', tokenSymbol: 'WIN', side: 'sell', amount: 1, valueUsd: 300, timestamp: 2 },
      { token: 'LOSS', tokenSymbol: 'LOSS', side: 'buy', amount: 1, valueUsd: 100, timestamp: 1 },
      { token: 'LOSS', tokenSymbol: 'LOSS', side: 'sell', amount: 1, valueUsd: 50, timestamp: 2 },
    ];
    const r = computeWalletPnl(trades);
    assert.equal(r.totalRealizedUsd, 150);   // +200 and -50
    assert.equal(r.byToken.length, 2);
    assert.equal(r.byToken[0].token, 'WIN'); // ranked best-first
    assert.equal(r.winRate, 50);             // 1 win / 2 lots
  });

  it('skips malformed trades without throwing', () => {
    const trades = [
      { token: '', tokenSymbol: null, side: 'buy', amount: 1, valueUsd: 1, timestamp: 1 },
      { token: 'A', tokenSymbol: null, side: 'buy', amount: 0, valueUsd: 1, timestamp: 1 },
      { token: 'A', tokenSymbol: null, side: 'buy', amount: 1, valueUsd: 1, timestamp: NaN },
    ] as WalletTrade[];
    const r = computeWalletPnl(trades);
    assert.equal(r.closedLots, 0);
  });
});
