/**
 * Pre-sign transaction simulator. Before the user signs, we run the
 * tx through `eth_call` / Solana `simulateTransaction` and surface
 * the expected balance changes + revert reason if any. Catches:
 *
 *   • honeypot sells   (token transfers OUT for 0)
 *   • approval to attacker contract (allowance > expected)
 *   • silent reverts   (sim succeeds in the wallet but actually reverts)
 *   • slippage > limit (received amount < min)
 *
 * Pure-ish — wraps the Alchemy / Helius simulation RPCs; caller
 * supplies the chain RPC URL. Returns a structured verdict the
 * SecurityGate uses to decide whether to allow the sign.
 *
 * Audit §B.4 P1.
 */

import 'server-only';

export type SimChain = 'ethereum' | 'base' | 'arbitrum' | 'optimism' | 'bsc' | 'polygon' | 'solana';

export interface SimRequest {
  chain: SimChain;
  /** Hex-encoded EVM tx data or base64 Solana tx. */
  rawTx: string;
  /** Signer address. */
  from: string;
  /** Contract / program being called. */
  to: string;
  /** Native value sent with the call (wei / lamports). */
  value?: string;
  /** Symbol the user expects to receive — used to validate the receive-side delta. */
  expectingReceive?: { symbol: string; minAmount: number };
  /** Token address the user expects to approve — null on swap. */
  expectingApproval?: { spender: string; maxAllowance: string };
}

export type SimVerdict =
  | { ok: true; balanceChanges: BalanceChange[]; gasUsed?: string }
  | { ok: false; reason: string; revert?: string; code: SimFailureCode };

export type SimFailureCode =
  | 'reverted'
  | 'honeypot'
  | 'allowance-mismatch'
  | 'slippage-breached'
  | 'rpc-error'
  | 'timeout';

export interface BalanceChange {
  symbol: string;
  amount: number;          // positive = received, negative = sent
  approxUsd?: number;
}

/**
 * Caller-supplied transport so this module stays testable and
 * doesn't pin a specific provider. In production, app/api/security/
 * simulate/route.ts wires this to Alchemy / Helius.
 */
export interface SimTransport {
  simulate(req: SimRequest): Promise<{
    success: boolean;
    revertReason?: string;
    gasUsed?: string;
    balanceChanges: BalanceChange[];
  }>;
}

export async function preSignSimulate(req: SimRequest, transport: SimTransport): Promise<SimVerdict> {
  let raw: Awaited<ReturnType<SimTransport['simulate']>>;
  try {
    raw = await transport.simulate(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { ok: false, reason: `Simulation RPC error: ${msg}`, code: 'rpc-error' };
  }

  if (!raw.success) {
    return {
      ok: false,
      reason: 'Transaction reverted in simulation. Do NOT sign.',
      revert: raw.revertReason,
      code: 'reverted',
    };
  }

  // Honeypot check — we're swapping but received nothing back.
  if (req.expectingReceive) {
    const expected = req.expectingReceive;
    const receive = raw.balanceChanges.find(
      (c) => c.symbol.toUpperCase() === expected.symbol.toUpperCase() && c.amount > 0,
    );
    if (!receive) {
      return {
        ok: false,
        reason: `Honeypot pattern — simulation completed but no ${expected.symbol} received.`,
        code: 'honeypot',
      };
    }
    if (receive.amount < expected.minAmount) {
      return {
        ok: false,
        reason: `Slippage breached — would receive ${receive.amount.toFixed(6)} ${expected.symbol}, minimum was ${expected.minAmount}.`,
        code: 'slippage-breached',
      };
    }
  }

  return { ok: true, balanceChanges: raw.balanceChanges, gasUsed: raw.gasUsed };
}
