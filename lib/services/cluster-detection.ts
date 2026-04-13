import 'server-only';
import type { WalletChain, WalletCluster, ClusterMember } from '@/lib/types/wallet';

/**
 * Wallet Cluster Detection Algorithm
 *
 * A cluster is identified when:
 *  1. 3 or more wallets exhibit 2 or more of the following coordination signals:
 *     - Shared token buys within the same block window (±5 blocks)
 *     - Sequential token purchases of the same asset within 24h
 *     - On-chain fund flows between the wallets (direct transfers)
 *     - Correlated entry/exit timing (> 0.7 Pearson correlation)
 *     - Same funding source (common ancestor wallet within 3 hops)
 *
 * Score is 0–100: >= 60 = confirmed cluster, 40–59 = likely, < 40 = weak
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransferEdge {
  from: string;
  to: string;
  valueUsd: number;
  timestamp: number;
  txHash: string;
}

export interface TokenTradeEvent {
  address: string;
  tokenAddress: string;
  side: 'buy' | 'sell';
  valueUsd: number;
  timestamp: number;
  blockNumber: number;
  txHash: string;
}

export interface ClusterInput {
  addresses: string[];
  chain: WalletChain;
  transfers: TransferEdge[];
  trades: TokenTradeEvent[];
  windowBlocks?: number;  // block window for coordinated buys (default 5)
  windowSeconds?: number; // time window for sequential buys (default 86400 = 24h)
}

export interface ClusterSignalResult {
  signal: string;
  score: number;       // contribution 0–30 per signal
  wallets: string[];   // wallets involved
  detail: string;
}

export interface ClusterDetectionResult {
  detected: boolean;
  score: number;           // 0–100
  confidence: 'confirmed' | 'likely' | 'weak' | 'none';
  signals: ClusterSignalResult[];
  members: ClusterMember[];
  cluster?: WalletCluster;
}

// ─── Signal weights ───────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS = {
  coordinated_buy_block:    28,   // same token, same ±5 block window
  sequential_buy:           22,   // same token, within 24h
  direct_fund_flow:         25,   // on-chain transfer between wallets
  timing_correlation:       20,   // correlated entry/exit across assets
  common_funding_source:    20,   // same ancestor wallet
  repeated_co_trading:      15,   // 3+ times trading same token on same side
} as const;

// ─── Signal Detectors ─────────────────────────────────────────────────────────

/** Signal 1: Coordinated buys in the same block window */
function detectCoordinatedBlockBuys(
  trades: TokenTradeEvent[],
  addresses: string[],
  windowBlocks: number,
): ClusterSignalResult[] {
  const results: ClusterSignalResult[] = [];
  const byToken = groupBy(trades, t => t.tokenAddress);

  for (const [token, tokenTrades] of Object.entries(byToken)) {
    const buys = tokenTrades.filter(t => t.side === 'buy' && addresses.includes(t.address));
    if (buys.length < 2) continue;

    // Find groups of buys within ±windowBlocks of each other
    const groups: TokenTradeEvent[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < buys.length; i++) {
      if (used.has(i)) continue;
      const group = [buys[i]];
      for (let j = i + 1; j < buys.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(buys[j].blockNumber - buys[i].blockNumber) <= windowBlocks) {
          group.push(buys[j]);
          used.add(j);
        }
      }
      if (group.length >= 2) groups.push(group);
      used.add(i);
    }

    for (const group of groups) {
      const uniqueWallets = [...new Set(group.map(t => t.address))];
      if (uniqueWallets.length >= 2) {
        results.push({
          signal: 'coordinated_buy_block',
          score: SIGNAL_WEIGHTS.coordinated_buy_block,
          wallets: uniqueWallets,
          detail: `${uniqueWallets.length} wallets bought ${token.slice(0, 8)}... within ${windowBlocks} blocks`,
        });
      }
    }
  }

  return results;
}

/** Signal 2: Sequential buys of the same token within time window */
function detectSequentialBuys(
  trades: TokenTradeEvent[],
  addresses: string[],
  windowSeconds: number,
): ClusterSignalResult[] {
  const results: ClusterSignalResult[] = [];
  const byToken = groupBy(trades, t => t.tokenAddress);

  for (const [token, tokenTrades] of Object.entries(byToken)) {
    const buys = tokenTrades
      .filter(t => t.side === 'buy' && addresses.includes(t.address))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (buys.length < 3) continue;

    // Rolling window: count buys from distinct wallets within windowSeconds
    let windowStart = 0;
    for (let i = 1; i < buys.length; i++) {
      while (buys[i].timestamp - buys[windowStart].timestamp > windowSeconds) {
        windowStart++;
      }
      const window = buys.slice(windowStart, i + 1);
      const uniqueWallets = [...new Set(window.map(t => t.address))];
      if (uniqueWallets.length >= 3) {
        results.push({
          signal: 'sequential_buy',
          score: SIGNAL_WEIGHTS.sequential_buy,
          wallets: uniqueWallets,
          detail: `${uniqueWallets.length} wallets sequentially bought ${token.slice(0, 8)}... within ${Math.round(windowSeconds / 3600)}h`,
        });
        break;  // only report once per token
      }
    }
  }

  return results;
}

/** Signal 3: Direct fund flows between wallet cluster members */
function detectDirectFundFlows(
  transfers: TransferEdge[],
  addresses: string[],
): ClusterSignalResult[] {
  const results: ClusterSignalResult[] = [];
  const addrSet = new Set(addresses.map(a => a.toLowerCase()));

  // Find transfers between addresses in the set
  const internalTransfers = transfers.filter(t =>
    addrSet.has(t.from.toLowerCase()) && addrSet.has(t.to.toLowerCase()),
  );

  if (internalTransfers.length === 0) return results;

  const involvedAddresses = [...new Set([
    ...internalTransfers.map(t => t.from.toLowerCase()),
    ...internalTransfers.map(t => t.to.toLowerCase()),
  ])];

  const totalFlowUsd = internalTransfers.reduce((s, t) => s + t.valueUsd, 0);

  results.push({
    signal: 'direct_fund_flow',
    score: SIGNAL_WEIGHTS.direct_fund_flow,
    wallets: involvedAddresses,
    detail: `${internalTransfers.length} direct transfers totalling $${totalFlowUsd.toFixed(0)} between ${involvedAddresses.length} wallets`,
  });

  return results;
}

/** Signal 4: Correlated entry/exit timing (Pearson correlation) */
function detectTimingCorrelation(
  trades: TokenTradeEvent[],
  addresses: string[],
): ClusterSignalResult[] {
  const results: ClusterSignalResult[] = [];
  if (addresses.length < 2) return results;

  // Build time series per wallet: 1-hour bins of trade activity
  const HOUR_BIN = 3600;
  const tradesByWallet: Record<string, Record<number, number>> = {};

  for (const addr of addresses) {
    tradesByWallet[addr] = {};
  }
  for (const trade of trades) {
    if (!addresses.includes(trade.address)) continue;
    const bin = Math.floor(trade.timestamp / HOUR_BIN);
    tradesByWallet[trade.address][bin] = (tradesByWallet[trade.address][bin] || 0) + 1;
  }

  // Find all unique bins
  const allBins = [...new Set(
    Object.values(tradesByWallet).flatMap(bins => Object.keys(bins).map(Number)),
  )].sort((a, b) => a - b);

  if (allBins.length < 10) return results; // not enough data

  // Check all pairs for high correlation
  const correlatedPairs: string[] = [];
  for (let i = 0; i < addresses.length; i++) {
    for (let j = i + 1; j < addresses.length; j++) {
      const a = addresses[i];
      const b = addresses[j];
      const vecA = allBins.map(bin => tradesByWallet[a][bin] ?? 0);
      const vecB = allBins.map(bin => tradesByWallet[b][bin] ?? 0);
      const corr = pearsonCorrelation(vecA, vecB);
      if (corr >= 0.7) {
        correlatedPairs.push(a, b);
      }
    }
  }

  if (correlatedPairs.length >= 4) {
    const unique = [...new Set(correlatedPairs)];
    results.push({
      signal: 'timing_correlation',
      score: SIGNAL_WEIGHTS.timing_correlation,
      wallets: unique,
      detail: `${unique.length} wallets show correlated trading timing (r ≥ 0.70)`,
    });
  }

  return results;
}

/** Signal 5: Repeated co-trading (same token, same side, 3+ occurrences) */
function detectRepeatedCoTrading(
  trades: TokenTradeEvent[],
  addresses: string[],
): ClusterSignalResult[] {
  const results: ClusterSignalResult[] = [];
  // Group by (token, side)
  const groups = groupBy(trades, t => `${t.tokenAddress}:${t.side}`);

  for (const [key, group] of Object.entries(groups)) {
    const wallets = group.map(t => t.address).filter(a => addresses.includes(a));
    const uniqueWallets = [...new Set(wallets)];
    if (uniqueWallets.length < 2) continue;

    // Count how many times each pair co-traded this token
    for (let i = 0; i < uniqueWallets.length; i++) {
      for (let j = i + 1; j < uniqueWallets.length; j++) {
        const countA = wallets.filter(w => w === uniqueWallets[i]).length;
        const countB = wallets.filter(w => w === uniqueWallets[j]).length;
        const coCount = Math.min(countA, countB);
        if (coCount >= 3) {
          results.push({
            signal: 'repeated_co_trading',
            score: SIGNAL_WEIGHTS.repeated_co_trading,
            wallets: [uniqueWallets[i], uniqueWallets[j]],
            detail: `Wallets co-traded ${key.split(':')[1]}s ${coCount}+ times on ${key.split(':')[0].slice(0, 8)}...`,
          });
        }
      }
    }
  }

  return deduplicateSignals(results);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : num / denom;
}

function deduplicateSignals(signals: ClusterSignalResult[]): ClusterSignalResult[] {
  const seen = new Set<string>();
  return signals.filter(s => {
    const key = s.signal + ':' + s.wallets.sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toConfidence(score: number): 'confirmed' | 'likely' | 'weak' | 'none' {
  if (score >= 60) return 'confirmed';
  if (score >= 40) return 'likely';
  if (score >= 20) return 'weak';
  return 'none';
}

// ─── Main Detection Function ──────────────────────────────────────────────────

export function detectCluster(input: ClusterInput): ClusterDetectionResult {
  const {
    addresses,
    chain,
    transfers,
    trades,
    windowBlocks = 5,
    windowSeconds = 86400,
  } = input;

  if (addresses.length < 3) {
    return {
      detected: false,
      score: 0,
      confidence: 'none',
      signals: [],
      members: [],
    };
  }

  // Run all signal detectors
  const allSignals: ClusterSignalResult[] = [
    ...detectCoordinatedBlockBuys(trades, addresses, windowBlocks),
    ...detectSequentialBuys(trades, addresses, windowSeconds),
    ...detectDirectFundFlows(transfers, addresses),
    ...detectTimingCorrelation(trades, addresses),
    ...detectRepeatedCoTrading(trades, addresses),
  ];

  // Only count at most 2 signals per type to prevent single-signal inflation
  const byType = groupBy(allSignals, s => s.signal);
  const dedupedSignals: ClusterSignalResult[] = Object.values(byType)
    .flatMap(sigs => sigs.slice(0, 2));

  // Total score (capped at 100)
  const rawScore = dedupedSignals.reduce((s, sig) => s + sig.score, 0);
  const score = Math.min(100, rawScore);

  const detected = score >= 40 && dedupedSignals.length >= 2;

  // Build per-member coordination scores
  const memberScoreMap: Record<string, { score: number; signals: Set<string> }> = {};
  for (const addr of addresses) {
    memberScoreMap[addr] = { score: 0, signals: new Set() };
  }
  for (const sig of dedupedSignals) {
    for (const wallet of sig.wallets) {
      if (memberScoreMap[wallet]) {
        memberScoreMap[wallet].score += sig.score;
        memberScoreMap[wallet].signals.add(sig.detail);
      }
    }
  }

  const members: ClusterMember[] = addresses.map(addr => ({
    address: addr,
    chain,
    coordinationScore: Math.min(100, memberScoreMap[addr]?.score ?? 0),
    signals: [...(memberScoreMap[addr]?.signals ?? [])],
    firstSeenTogether: new Date().toISOString(),
  }));

  // Identify the most commonly involved tokens
  const primaryTokens = [...new Set(
    trades
      .filter(t => addresses.includes(t.address))
      .map(t => t.tokenAddress),
  )].slice(0, 5);

  let cluster: WalletCluster | undefined;
  if (detected) {
    cluster = {
      clusterId: `cluster_${Date.now()}_${addresses[0].slice(2, 8)}`,
      memberCount: addresses.length,
      members,
      coordinationScore: score,
      totalValueUsd: 0,      // caller enriches with portfolio data
      dominantChain: chain,
      primaryTokens,
      detectedAt: new Date().toISOString(),
      isActive: true,
    };
  }

  return {
    detected,
    score,
    confidence: toConfidence(score),
    signals: dedupedSignals,
    members,
    cluster,
  };
}
