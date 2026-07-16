'use client';

/**
 * useSwapExecution — quote + execute for the OrderForm / TradeTerminal stack.
 *
 * Rewired to the platform's REAL swap architecture. It used to POST to
 * `/api/swap/quote` (a GET route → 405) and `/api/swap/execute` (never
 * existed → 404) and expected a server-returned txHash — none of which
 * matched how swaps actually settle (the client signs + broadcasts). It now:
 *   - getQuote → GET /api/swap/price (normalised display quote)
 *   - executeSwap → GET /api/swap/quote (executable blob) → broadcast via the
 *     shared useSwapBroadcast signer → REAL on-chain tx hash.
 * Built-in (Naka) wallets surface the unlock modal through the re-exposed
 * unlockRequest/resolveUnlock/cancelUnlock.
 */

import { useState, useCallback } from 'react';
import { SwapQuote } from '@/lib/market/types';
import { useSwapBroadcast, detectWalletKind, type WalletKind } from '@/lib/hooks/useSwapBroadcast';

// Client-safe mirror of the platform fee (same single source of truth,
// NEXT_PUBLIC_STEINZ_FEE_BPS). Read directly here rather than importing from
// the server-only swap-logging module so this hook stays client-buildable.
const PLATFORM_FEE_BPS = Number(process.env.NEXT_PUBLIC_STEINZ_FEE_BPS) || 50;

interface SwapExecutionParams {
  chain: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  inputDecimals: number;
  /** Output-token decimals when the caller already knows them (e.g. a coin
   *  page that resolved them). Lets the quote route skip an on-chain lookup
   *  and never reject a real coin for "unknown decimals". */
  outputDecimals?: number;
  userAddress: string;
  slippageBps: number;
  // Explicit wallet kind so a built-in Naka wallet is not misrouted to an
  // external wallet when one is also present in the browser.
  walletKind?: WalletKind;
}

interface MevRisk {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  warning?: string;
}

export function useSwapExecution() {
  const { broadcast, unlockRequest, resolveUnlock, cancelUnlock } = useSwapBroadcast();
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [mevRisk, setMevRisk] = useState<MevRisk | null>(null);
  // Raw base-unit output amount of the EXECUTED quote (not the display quote),
  // so callers can record what actually settled rather than an estimate.
  const [executedOutRaw, setExecutedOutRaw] = useState<string | null>(null);

  const reset = useCallback(() => {
    setQuote(null);
    setLoading(false);
    setExecuting(false);
    setError(null);
    setTxHash(null);
    setMevRisk(null);
    setExecutedOutRaw(null);
  }, []);

  const getQuote = useCallback(async (params: SwapExecutionParams) => {
    setLoading(true);
    setError(null);
    setQuote(null);

    const amountUsd = parseFloat(params.inputAmount) > 0 ? parseFloat(params.inputAmount) : 0;
    const priceParams = new URLSearchParams({
      chain: params.chain,
      from: params.inputToken,
      to: params.outputToken,
      amount: params.inputAmount,
      taker: params.userAddress,
      slippageBps: String(params.slippageBps),
      fromDecimals: String(params.inputDecimals),
    });
    if (params.outputDecimals != null) priceParams.set('toDecimals', String(params.outputDecimals));

    try {
      const [quoteRes, mevRes] = await Promise.allSettled([
        fetch(`/api/swap/price?${priceParams.toString()}`, { signal: AbortSignal.timeout(15_000) }),
        fetch(
          `/api/mev-protection?token=${encodeURIComponent(params.outputToken)}&chain=${encodeURIComponent(params.chain)}&amount=${amountUsd}`,
          { signal: AbortSignal.timeout(10_000) },
        ),
      ]);

      if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
        const data = await quoteRes.value.json();
        setQuote({
          amountOut: typeof data?.toAmount === 'number' ? String(data.toAmount) : '0',
          priceImpact: typeof data?.priceImpactPct === 'string' ? parseFloat(data.priceImpactPct) || 0 : 0,
          route: data?.provider === 'jupiter' ? 'Jupiter' : '0x',
          // Platform fee on the trade USD, from the single source of truth
          // (NEXT_PUBLIC_STEINZ_FEE_BPS via PLATFORM_FEE_BPS) so the displayed
          // fee always matches what 0x actually collects.
          feeUSD: amountUsd * (PLATFORM_FEE_BPS / 10000),
        });
      } else {
        const errMsg =
          quoteRes.status === 'rejected'
            ? quoteRes.reason instanceof Error ? quoteRes.reason.message : 'Quote request failed'
            : await quoteRes.value.json().then((b) => b.error).catch(() => `Quote failed (${quoteRes.value.status})`);
        setError(errMsg);
      }

      if (mevRes.status === 'fulfilled' && mevRes.value.ok) {
        const mevData = await mevRes.value.json();
        setMevRisk({ level: mevData.level ?? 'low', score: mevData.score ?? 0, warning: mevData.warning });
      } else {
        setMevRisk({ level: 'low', score: 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  }, []);

  const executeSwap = useCallback(async (params: SwapExecutionParams) => {
    setExecuting(true);
    setError(null);
    setTxHash(null);

    try {
      // Fresh executable quote, then sign + broadcast through the wallet.
      const qp = new URLSearchParams({
        chain: params.chain,
        from: params.inputToken,
        to: params.outputToken,
        amount: params.inputAmount,
        taker: params.userAddress,
        slippageBps: String(params.slippageBps),
        fromDecimals: String(params.inputDecimals),
      });
      if (params.outputDecimals != null) qp.set('toDecimals', String(params.outputDecimals));
      const res = await fetch(`/api/swap/quote?${qp.toString()}`, { signal: AbortSignal.timeout(20_000) });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Quote failed (${res.status})`);
      // Capture the executable quote's output (base units) for accurate recording.
      const outRaw = (data as { buyAmount?: string | number }).buyAmount;
      if (outRaw != null) setExecutedOutRaw(String(outRaw));

      const walletKind = params.walletKind ?? detectWalletKind(params.chain, null);
      const hash = await broadcast({ quote: data, chain: params.chain, walletKind, address: params.userAddress });
      setTxHash(hash);

      // A settled on-chain swap must always write a history row + fee record,
      // exactly like the main swap page. Signing without recording would leave
      // the fee uncollected in our ledger and the trade invisible in Activity.
      // Fire-and-forget: never block the success UI on logging.
      void fetch('/api/swap/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: params.userAddress,
          txHash: hash,
          chain: params.chain,
          fromToken: params.inputToken,
          toToken: params.outputToken,
          fromAmount: parseFloat(params.inputAmount) || 0,
          toAmount: quote ? parseFloat(quote.amountOut) || 0 : 0,
          status: 'confirmed',
          source: 'order-form',
        }),
      }).catch(() => { /* logging is best-effort */ });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Swap execution failed';
      if (!/unlock cancelled/i.test(msg)) setError(msg);
    } finally {
      setExecuting(false);
    }
  }, [broadcast, quote]);

  return {
    quote, loading, executing, error, txHash, mevRisk, executedOutRaw,
    getQuote, executeSwap, reset,
    unlockRequest, resolveUnlock, cancelUnlock,
  };
}
