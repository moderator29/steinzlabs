import 'server-only';
import { getQuote, buildSwapTransaction, SOL_MINT, JupiterQuote } from './jupiter';
import { getUniswapV3Quote, buildUniswapV3SwapTx } from './uniswap';
import { isHighRisk } from './goplus';
import { getSupabaseAdmin } from '../supabaseAdmin';

/**
 * Unified Swap Router
 * - Solana: Jupiter Aggregator
 * - EVM: Alchemy tx builder (Uniswap-compatible)
 * Platform fee: 0.15% applied to all swaps
 * Security pre-check: blocks swaps on high-risk tokens (risk > 70)
 * Logs: swap_logs + fee_revenue tables
 */

// Platform fee: 0.15%
export const PLATFORM_FEE_BPS = 15; // 15 / 10000 = 0.0015

export interface SwapRequest {
  chain: 'solana' | string;     // 'solana' or EVM chain name
  inputToken: string;            // mint address (Solana) or contract address (EVM)
  outputToken: string;
  inputAmount: number;           // human-readable amount (e.g. 1.5 SOL)
  inputDecimals: number;
  userAddress: string;
  slippageBps?: number;          // default 50
  userId?: string;               // for logging
}

export interface SwapQuoteResult {
  ok: true;
  quote: JupiterQuote | { to: string; value: string; data: string; chainId: number; gasLimit?: string };
  chain: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  estimatedOutput?: number;
  priceImpact?: number;
  platformFeeBps: number;
  securityWarning?: string;
}

export interface SwapError {
  ok: false;
  error: string;
  code?: string;
}

export type SwapResult = SwapQuoteResult | SwapError;

export interface SwapExecuteRequest {
  chain: 'solana' | string;
  quote: JupiterQuote;
  userPublicKey: string;
  userId?: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
}

/**
 * Get a swap quote with security pre-check.
 * Does NOT execute — returns quote for client-side signing.
 */
export async function getSwapQuote(req: SwapRequest): Promise<SwapResult> {
  const { chain, inputToken, outputToken, inputAmount, inputDecimals, userAddress, userId } = req;
  const slippageBps = req.slippageBps ?? 50;

  // ── Security Pre-Check ──────────────────────────────────────────────────────
  // Only check EVM tokens — Solana tokens use separate GoPlus endpoint
  let securityWarning: string | undefined;
  if (chain !== 'solana') {
    try {
      const highRisk = await isHighRisk(outputToken, chain);
      if (highRisk) {
        return {
          ok: false,
          error: 'Output token flagged as high risk by security scanner. Swap blocked.',
          code: 'HIGH_RISK_TOKEN',
        };
      }
    } catch {
      // Non-blocking: proceed with warning if security check fails
      securityWarning = 'Security check unavailable — proceed with caution';
    }
  }

  // ── Solana — Jupiter ────────────────────────────────────────────────────────
  if (chain === 'solana') {
    const amountLamports = Math.floor(inputAmount * Math.pow(10, inputDecimals));
    const quote = await getQuote(inputToken, outputToken, amountLamports, slippageBps);
    if (!quote) {
      return { ok: false, error: 'Jupiter: no route found for this pair', code: 'NO_ROUTE' };
    }

    return {
      ok: true,
      quote,
      chain,
      inputToken,
      outputToken,
      inputAmount,
      estimatedOutput: parseInt(quote.outAmount),
      priceImpact: parseFloat(quote.priceImpactPct),
      platformFeeBps: PLATFORM_FEE_BPS,
      securityWarning,
    };
  }

  // ── EVM — Uniswap v3 ────────────────────────────────────────────────────────
  const amountInWei = BigInt(Math.floor(inputAmount * Math.pow(10, inputDecimals)));
  const uniQuote = await getUniswapV3Quote({
    tokenIn: inputToken,
    tokenOut: outputToken,
    amountIn: amountInWei,
    chain,
  });

  if (!uniQuote) {
    return { ok: false, error: 'Uniswap v3: no route found for this pair', code: 'NO_ROUTE' };
  }

  const swapTx = buildUniswapV3SwapTx({
    quote: uniQuote,
    recipient: userAddress,
    slippageBps: slippageBps,
  });

  if (!swapTx) {
    return { ok: false, error: 'Failed to build Uniswap v3 swap transaction', code: 'TX_BUILD_FAILED' };
  }

  return {
    ok: true,
    quote: swapTx,
    chain,
    inputToken,
    outputToken,
    inputAmount,
    estimatedOutput: Number(uniQuote.amountOut),
    priceImpact: uniQuote.priceImpact,
    platformFeeBps: PLATFORM_FEE_BPS,
    securityWarning,
  };
}

/**
 * Build a Solana swap transaction from an existing Jupiter quote.
 * Returns base64 transaction for client-side signing.
 * Logs swap attempt to swap_logs.
 */
export async function buildSolanaSwapTx(req: SwapExecuteRequest): Promise<{
  ok: true;
  swapTransaction: string;
  lastValidBlockHeight: number;
} | SwapError> {
  const { quote, userPublicKey, userId, inputToken, outputToken, inputAmount, outputAmount } = req;

  if (req.chain !== 'solana') {
    return { ok: false, error: 'buildSolanaSwapTx is for Solana swaps only' };
  }

  const jupiterQuote = quote as JupiterQuote;

  // Build the swap transaction
  const txResult = await buildSwapTransaction(jupiterQuote, userPublicKey);
  if (!txResult) {
    return { ok: false, error: 'Failed to build swap transaction', code: 'TX_BUILD_FAILED' };
  }

  // Log to swap_logs (fire-and-forget)
  logSwap({
    userId,
    chain: 'solana',
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    status: 'pending',
    txHash: null,
  }).catch(() => {});

  return {
    ok: true,
    swapTransaction: txResult.swapTransaction,
    lastValidBlockHeight: txResult.lastValidBlockHeight,
  };
}

/**
 * Record a completed swap and calculate platform fee revenue.
 */
export async function recordSwapCompletion(params: {
  userId?: string;
  chain: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  txHash: string;
  inputValueUsd: number;
}): Promise<void> {
  const feeUsd = params.inputValueUsd * (PLATFORM_FEE_BPS / 10_000);

  await Promise.allSettled([
    logSwap({
      userId: params.userId,
      chain: params.chain,
      inputToken: params.inputToken,
      outputToken: params.outputToken,
      inputAmount: params.inputAmount,
      outputAmount: params.outputAmount,
      status: 'completed',
      txHash: params.txHash,
    }),
    logFeeRevenue({
      userId: params.userId,
      txHash: params.txHash,
      chain: params.chain,
      feeUsd,
      inputToken: params.inputToken,
      outputToken: params.outputToken,
      inputValueUsd: params.inputValueUsd,
    }),
  ]);
}

// ── Internal logging helpers ──────────────────────────────────────────────────

async function logSwap(params: {
  userId?: string;
  chain: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  status: 'pending' | 'completed' | 'failed';
  txHash: string | null;
}): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    await db.from('swap_logs').insert({
      user_id: params.userId ?? null,
      chain: params.chain,
      input_token: params.inputToken,
      output_token: params.outputToken,
      input_amount: params.inputAmount,
      output_amount: params.outputAmount,
      status: params.status,
      tx_hash: params.txHash,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-blocking
  }
}

async function logFeeRevenue(params: {
  userId?: string;
  txHash: string;
  chain: string;
  feeUsd: number;
  inputToken: string;
  outputToken: string;
  inputValueUsd: number;
}): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    await db.from('fee_revenue').insert({
      user_id: params.userId ?? null,
      tx_hash: params.txHash,
      chain: params.chain,
      fee_usd: params.feeUsd,
      fee_bps: PLATFORM_FEE_BPS,
      input_token: params.inputToken,
      output_token: params.outputToken,
      input_value_usd: params.inputValueUsd,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-blocking
  }
}
