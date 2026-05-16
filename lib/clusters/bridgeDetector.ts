/**
 * Cross-chain bridge detector. Identifies when a wallet has bridged
 * funds between chains within a clustering window, so the cluster
 * pipeline can group the two sides of the bridge as the same
 * economic entity even though the addresses differ.
 *
 * Pure detector. Caller passes pre-fetched bridge transactions
 * (out-events on source chain + in-events on destination chain).
 * This file matches them up by (amount, time window, known bridge
 * contract address) and returns the inferred wallet-pair links.
 *
 * Audit §5.7 B.10 — fresh primitive.
 */

import { normalizeAddress } from '@/lib/utils/addressNormalize';

// Inline bridge-contract set. Once feat/clusters-entity-registry-seed
// merges, this resolves via categoryFor(addr, chain) === 'bridge' and
// the local set drops.
const KNOWN_BRIDGES: ReadonlySet<string> = new Set([
  '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf',
  '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
  '0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f',
  '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1',
]);

export interface BridgeOutEvent {
  txHash: string;
  fromWallet: string;
  toContract: string; // bridge contract on source
  amountUsd: number;
  chain: string;
  timestamp: number; // unix seconds
}

export interface BridgeInEvent {
  txHash: string;
  toWallet: string;
  fromContract: string; // bridge contract on destination
  amountUsd: number;
  chain: string;
  timestamp: number;
}

export interface BridgeLink {
  sourceWallet: string;
  sourceChain: string;
  destWallet: string;
  destChain: string;
  amountUsd: number;
  bridge: string;
  /** Seconds between out and in event. */
  latencySec: number;
  confidence: number;
}

const MAX_LATENCY_SEC = 30 * 60;       // 30-minute bridge window
const AMOUNT_TOLERANCE_PCT = 0.02;     // 2% — covers normal bridge fees

function isBridgeAddress(addr: string, chain: string): boolean {
  return KNOWN_BRIDGES.has(normalizeAddress(addr, chain));
}

function amountsMatch(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  const diff = Math.abs(a - b) / Math.max(a, b);
  return diff <= AMOUNT_TOLERANCE_PCT;
}

export function detectBridgeLinks(
  outs: BridgeOutEvent[],
  ins: BridgeInEvent[],
): BridgeLink[] {
  const links: BridgeLink[] = [];
  const used = new Set<string>();

  for (const o of outs) {
    if (!isBridgeAddress(o.toContract, o.chain)) continue;
    // Best match: smallest latency that satisfies amount tolerance.
    let best: BridgeInEvent | null = null;
    let bestLatency = Infinity;
    for (const i of ins) {
      if (used.has(i.txHash)) continue;
      if (i.timestamp < o.timestamp) continue;
      const latency = i.timestamp - o.timestamp;
      if (latency > MAX_LATENCY_SEC) continue;
      if (!isBridgeAddress(i.fromContract, i.chain)) continue;
      if (!amountsMatch(o.amountUsd, i.amountUsd)) continue;
      if (latency < bestLatency) {
        bestLatency = latency;
        best = i;
      }
    }
    if (best) {
      used.add(best.txHash);
      // Confidence: stronger when latency is short and amounts match
      // tightly. 0..1.
      const latencyScore = 1 - bestLatency / MAX_LATENCY_SEC;
      const amountScore = 1 - Math.abs(o.amountUsd - best.amountUsd) / Math.max(o.amountUsd, best.amountUsd);
      links.push({
        sourceWallet: normalizeAddress(o.fromWallet, o.chain),
        sourceChain: o.chain,
        destWallet: normalizeAddress(best.toWallet, best.chain),
        destChain: best.chain,
        amountUsd: o.amountUsd,
        bridge: o.toContract,
        latencySec: bestLatency,
        confidence: Math.max(0, Math.min(1, (latencyScore + amountScore) / 2)),
      });
    }
  }

  return links;
}
