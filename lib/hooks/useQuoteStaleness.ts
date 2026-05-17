'use client';

import { useEffect, useState } from 'react';

/**
 * useQuoteStaleness — tracks how old a fetched 0x / Jupiter quote
 * is and tells the swap UI when to re-fetch. Returns:
 *
 *   • ageSeconds   running counter
 *   • isStale      true once age >= staleAfter (default 10s)
 *   • isExpired    true once age >= expireAfter (default 30s) — swap
 *                  button must hard-block until re-fetch
 *   • reset(now?)  call from the parent after re-fetching the quote
 *
 * The audit found execute routes accepting quotes 30+ seconds old,
 * which on volatile tokens means the user signs at a price the
 * pool can't honor and the tx reverts. This hook surfaces the age
 * + drives the auto-refetch logic. Audit §5.2 trade-exec P1.
 */

export interface QuoteStalenessState {
  ageSeconds: number;
  isStale: boolean;
  isExpired: boolean;
  reset: (now?: number) => void;
}

export interface QuoteStalenessOpts {
  /** Seconds after which we mark the quote stale and refetch in background. */
  staleAfter?: number;
  /** Seconds after which the user is hard-blocked from submitting. */
  expireAfter?: number;
  /** Quote-issue timestamp (UNIX ms). null = no quote loaded. */
  quoteIssuedAt: number | null;
}

export function useQuoteStaleness(opts: QuoteStalenessOpts): QuoteStalenessState {
  const { staleAfter = 10, expireAfter = 30 } = opts;
  const [now, setNow] = useState<number>(() => Date.now());
  const [issuedAt, setIssuedAt] = useState<number | null>(opts.quoteIssuedAt);

  useEffect(() => {
    setIssuedAt(opts.quoteIssuedAt);
  }, [opts.quoteIssuedAt]);

  useEffect(() => {
    if (issuedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [issuedAt]);

  const ageSeconds = issuedAt === null ? 0 : Math.max(0, Math.floor((now - issuedAt) / 1000));
  return {
    ageSeconds,
    isStale: issuedAt !== null && ageSeconds >= staleAfter,
    isExpired: issuedAt !== null && ageSeconds >= expireAfter,
    reset: (override?: number) => {
      setIssuedAt(override ?? Date.now());
      setNow(Date.now());
    },
  };
}

/**
 * Compute whether a re-fetched quote has drifted enough vs the
 * previously-shown quote that we should abort and ask the user to
 * confirm again. Used by the swap-page submit handler:
 *
 *   if (driftExceedsTolerance(prev, next, slippageBps)) {
 *     toast.warning('Price moved — confirm new rate'); return;
 *   }
 */
export function driftExceedsTolerance(
  prevOutput: number,
  nextOutput: number,
  slippageBps: number,
): boolean {
  if (prevOutput <= 0) return false;
  const driftPct = ((prevOutput - nextOutput) / prevOutput) * 10_000;
  // Allow ~50% of slippage budget for natural price drift; anything
  // more deserves a re-confirmation.
  return driftPct > slippageBps * 0.5;
}
