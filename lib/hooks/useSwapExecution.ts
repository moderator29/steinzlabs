'use client';

import { useState, useCallback } from 'react';
import { SwapQuote } from '@/lib/market/types';

interface SwapExecutionParams {
  chain: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  inputDecimals: number;
  userAddress: string;
  slippageBps: number;
}

interface MevRisk {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  warning?: string;
}

interface UseSwapExecutionReturn {
  quote: SwapQuote | null;
  loading: boolean;
  executing: boolean;
  error: string | null;
  txHash: string | null;
  mevRisk: MevRisk | null;
  getQuote: (params: SwapExecutionParams) => Promise<void>;
  executeSwap: (params: SwapExecutionParams) => Promise<void>;
  reset: () => void;
}

export function useSwapExecution(): UseSwapExecutionReturn {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [mevRisk, setMevRisk] = useState<MevRisk | null>(null);

  const reset = useCallback(() => {
    setQuote(null);
    setLoading(false);
    setExecuting(false);
    setError(null);
    setTxHash(null);
    setMevRisk(null);
  }, []);

  const getQuote = useCallback(async (params: SwapExecutionParams) => {
    setLoading(true);
    setError(null);
    setQuote(null);

    try {
      const amountUsd =
        parseFloat(params.inputAmount) > 0
          ? parseFloat(params.inputAmount)
          : 0;

      const [quoteRes, mevRes] = await Promise.allSettled([
        fetch('/api/swap/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chain: params.chain,
            inputToken: params.inputToken,
            outputToken: params.outputToken,
            inputAmount: params.inputAmount,
            inputDecimals: params.inputDecimals,
            userAddress: params.userAddress,
            slippageBps: params.slippageBps,
          }),
          signal: AbortSignal.timeout(15_000),
        }),
        fetch(
          `/api/mev-protection?token=${encodeURIComponent(params.outputToken)}&chain=${encodeURIComponent(params.chain)}&amount=${amountUsd}`,
          { signal: AbortSignal.timeout(10_000) },
        ),
      ]);

      if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
        const data = (await quoteRes.value.json()) as SwapQuote;
        setQuote(data);
      } else {
        const errMsg =
          quoteRes.status === 'rejected'
            ? quoteRes.reason instanceof Error
              ? quoteRes.reason.message
              : 'Quote request failed'
            : quoteRes.value.ok
            ? 'Unknown error'
            : `Quote failed (${quoteRes.value.status})`;
        setError(errMsg);
      }

      if (mevRes.status === 'fulfilled' && mevRes.value.ok) {
        const mevData = await mevRes.value.json();
        setMevRisk({
          level: mevData.level ?? 'low',
          score: mevData.score ?? 0,
          warning: mevData.warning,
        });
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
      const res = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: params.chain,
          inputToken: params.inputToken,
          outputToken: params.outputToken,
          inputAmount: params.inputAmount,
          inputDecimals: params.inputDecimals,
          userAddress: params.userAddress,
          slippageBps: params.slippageBps,
          quote,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error ?? `Execute failed (${res.status})`);
      }

      const data = await res.json();
      if (data.success === false) {
        throw new Error(data.error ?? data.blockReason ?? 'Swap failed');
      }

      setTxHash(data.txHash ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap execution failed');
    } finally {
      setExecuting(false);
    }
  }, [quote]);

  return { quote, loading, executing, error, txHash, mevRisk, getQuote, executeSwap, reset };
}
