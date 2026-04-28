/**
 * Per-chain execution adapter contract for the sniper engine.
 *
 * Naka Labs is non-custodial: the platform never holds private keys, so the
 * server cannot sign trades. Adapters therefore split execution into two halves:
 *
 *   1. build()   — server-side. Quote + construct an unsigned transaction
 *                  (Jupiter swap tx for SOL, 0x calldata for EVM, Ston.fi
 *                  message for TON). Returns enough metadata for the relayer
 *                  to record a pending_trades row and notify the user.
 *
 *   2. submit()  — server-side, MEV-aware. Accepts a pre-signed raw transaction
 *                  (signed in the user's browser via their built-in or external
 *                  wallet) and broadcasts it through the chain's MEV-protected
 *                  route (Jito bundle, Flashbots Protect, BloxRoute, or default
 *                  RPC).  Returns the on-chain confirmation result.
 *
 * The split lets the auto-execute path (cron → pending_trades → user confirms)
 * use the same code as manual snipes without ever touching a private key on
 * the server. See lib/trading/builtinSigner.ts for the design rationale.
 */

import type { SniperChain } from "../chains";

export interface BuildParams {
  chain: SniperChain;
  /** Native or token mint/contract being spent. Use "native" for the chain's gas token. */
  fromToken: string;
  /** Token being acquired (mint for SOL, contract for EVM, jetton master for TON). */
  toToken: string;
  /** Amount in native units (decimal, NOT wei/lamports). e.g. 0.5 SOL, 0.05 ETH. */
  amountIn: number;
  /** Slippage in basis points (100 = 1%). */
  slippageBps: number;
  /** User's wallet address (will sign the returned unsigned tx client-side). */
  walletAddress: string;
  /** EVM/SOL priority fee override in native units. Optional. */
  priorityFeeNative?: number;
  /** Whether to route through MEV-protected channel on submit(). */
  mevProtect?: boolean;
  /** For cost logging. */
  userId?: string;
  criteriaId?: string;
}

export interface BuildResult {
  /** Base64 unsigned transaction payload the client will sign and submit. */
  unsignedTx: string;
  /** Encoding of unsignedTx — informs the client how to decode/sign. */
  encoding: "solana-versioned-tx-base64" | "evm-eip1559-json" | "ton-boc-base64";
  /** Estimated output in destination token (decimal, not wei). */
  expectedOut: number;
  /** Price impact percentage (0–100). */
  priceImpactPct: number;
  /** Route description for UI/logs (e.g. "Raydium → Orca via Jupiter"). */
  routeLabel: string;
  /** Quote validity window — after this, build() must be re-run. */
  validUntilMs: number;
  /** Provider that produced the quote — drives MEV-protect routing on submit(). */
  provider: "jupiter" | "0x" | "stonfi";
  /** Adapter-private metadata threaded through to submit() (e.g. quote id, gas). */
  meta: Record<string, unknown>;
}

export interface SubmitParams {
  chain: SniperChain;
  /** Raw signed transaction from the client. Format matches BuildResult.encoding. */
  signedTx: string;
  /** Whether to use MEV-protected route (Jito / Flashbots / BloxRoute). */
  mevProtect: boolean;
  /** Adapter-private metadata returned by build(). */
  meta?: Record<string, unknown>;
  userId?: string;
  criteriaId?: string;
}

export interface SubmitResult {
  txHash: string;
  /** Wall-clock submit → confirm latency. */
  executionTimeMs: number;
  /** Gas units consumed (EVM) / compute units (SOL) / fees (TON, in native). */
  gasUsed: number | null;
  /** Effective gas price in native units (gwei for EVM, lamports/cu for SOL). */
  gasPriceNative: number | null;
  /** Route actually used at submit time. */
  routeUsed: "jito-bundle" | "flashbots" | "bloxroute" | "public-rpc" | "ton-api";
  error?: string;
}

export interface EngineAdapter {
  chain: SniperChain;
  build(params: BuildParams): Promise<BuildResult>;
  submit(params: SubmitParams): Promise<SubmitResult>;
}
