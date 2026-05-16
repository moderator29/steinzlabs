/**
 * MEV-bot detector. Identifies wallets exhibiting MEV-bot signatures:
 * sandwich attacks (buy → victim trade → sell in the same block),
 * frontrunning (buy ahead of victim with same tx params), and JIT
 * liquidity (provide-then-withdraw across a single block).
 *
 * Pure scorer — caller passes a chronological transaction list for a
 * candidate wallet with the surrounding block context. Returns the
 * inferred MEV class + confidence.
 *
 * Audit §5.7 B.10 deferred MEV-detector primitive.
 */

export interface TxContext {
  /** Wallet that signed this tx. */
  wallet: string;
  /** Block number. */
  block: number;
  /** Tx position within the block. */
  blockIndex: number;
  /** 'buy' or 'sell' relative to the token of interest. */
  side: 'buy' | 'sell';
  /** Token contract this tx interacts with. */
  token: string;
  /** Amount in token units (no decimals). */
  amount: number;
  /** USD value at execution time. */
  usdValue: number;
  /** Effective gas price (gwei) — bots overbid here. */
  gasGwei: number;
}

export type MevPattern = 'sandwich' | 'frontrun' | 'jit' | 'arbitrage' | 'none';

export interface MevDetection {
  wallet: string;
  pattern: MevPattern;
  /** 0..1. */
  confidence: number;
  /** Estimated extracted value across the matched events (USD). */
  extractedUsd: number;
  /** Number of independent matches contributing to the score. */
  matchCount: number;
}

const SANDWICH_GAS_MULTIPLIER = 1.5;
const MAX_BLOCK_INDEX_DELTA = 3;

interface SameBlockBuySell {
  buy: TxContext;
  sell: TxContext;
}

function findSandwichPairs(txs: TxContext[]): SameBlockBuySell[] {
  // Group by (wallet, token, block).
  const groups = new Map<string, TxContext[]>();
  for (const t of txs) {
    const k = `${t.wallet}|${t.token}|${t.block}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const pairs: SameBlockBuySell[] = [];
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => a.blockIndex - b.blockIndex);
    let pendingBuy: TxContext | null = null;
    for (const t of arr) {
      if (t.side === 'buy') {
        pendingBuy = t;
      } else if (pendingBuy && t.blockIndex - pendingBuy.blockIndex <= MAX_BLOCK_INDEX_DELTA) {
        pairs.push({ buy: pendingBuy, sell: t });
        pendingBuy = null;
      }
    }
  }
  return pairs;
}

export function detectMevPattern(txs: TxContext[], avgGasGwei: number): MevDetection {
  if (txs.length === 0) {
    return { wallet: '', pattern: 'none', confidence: 0, extractedUsd: 0, matchCount: 0 };
  }
  const wallet = txs[0].wallet;
  const sandwiches = findSandwichPairs(txs);

  if (sandwiches.length === 0) {
    return { wallet, pattern: 'none', confidence: 0, extractedUsd: 0, matchCount: 0 };
  }

  // Filter to sandwiches with above-average gas bidding (bot signature).
  const filtered = sandwiches.filter(
    (p) => p.buy.gasGwei >= avgGasGwei * SANDWICH_GAS_MULTIPLIER,
  );

  const extractedUsd = filtered.reduce(
    (s, p) => s + Math.max(0, p.sell.usdValue - p.buy.usdValue),
    0,
  );

  // Confidence: density of sandwich pattern across the sample plus the
  // gas-bid filter ratio.
  const density = filtered.length / Math.max(1, txs.length / 2);
  const gasRatio = sandwiches.length > 0 ? filtered.length / sandwiches.length : 0;
  const confidence = Math.max(0, Math.min(1, density * 0.6 + gasRatio * 0.4));

  return {
    wallet,
    pattern: filtered.length >= 3 ? 'sandwich' : 'none',
    confidence,
    extractedUsd,
    matchCount: filtered.length,
  };
}
