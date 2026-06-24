'use client';

/**
 * SwapBatchCard — Naka-branded multi-leg swap flow.
 *
 * Renders a batch of independent swaps (e.g. SOL→hSOL, SOL→BONK, SOL→2Z) one
 * leg at a time: a fresh quote is fetched per leg at sign time, each leg is
 * signed + broadcast separately through the shared `useSwapBroadcast` signer,
 * and completed legs collapse into green "✓ … View" rows while the step rail
 * fills. Nothing moves funds without a wallet signature, and success is set
 * only from a real on-chain tx hash.
 *
 * Built to NAKA BRANDING (not the reference images' teal): #0D1117 panel,
 * #1E2433 border, #0066FF electric-blue accent, tabular/monospace numerals.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownUp, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import SwapTokenGlyph from './SwapTokenGlyph';
import { TrustScoreBadge } from '@/components/trust/TrustScoreBadge';
import UnlockWalletModal from '@/components/wallet/UnlockWalletModal';
import { useSwapBroadcast, detectWalletKind } from '@/lib/hooks/useSwapBroadcast';

export interface SwapLeg {
  fromToken: string;
  toToken: string;
  /** Contract / mint addresses — when set, unknown-symbol tokens still resolve. */
  fromTokenAddress?: string;
  toTokenAddress?: string;
  chain: string;
  /** Human amount of `fromToken` to sell on this leg. */
  amount: string;
}

export interface SwapBatch {
  legs: SwapLeg[];
}

interface Props {
  batch: SwapBatch;
  walletAddress?: string;
  /** Connected wallet provider hint (e.g. 'metamask' / 'phantom'). */
  provider?: string | null;
  /** Slippage tolerance in basis points (default 50 = 0.5%). */
  slippageBps?: number;
  onAllComplete?: (hashes: string[]) => void;
  onCancel?: () => void;
}

type LegStatus = 'pending' | 'quoting' | 'ready' | 'signing' | 'done' | 'error';

interface LegQuote {
  toAmount?: number;
  minReceived?: number;
  rate?: string;
  priceImpactPct: number;
  slippageBps: number;
  quoteData?: Record<string, unknown>;
}

interface LegState {
  status: LegStatus;
  quote?: LegQuote;
  txHash?: string;
  error?: string;
}

function explorerUrl(chain: string, hash: string): string {
  switch (chain) {
    case 'solana': return `https://solscan.io/tx/${hash}`;
    case 'base': return `https://basescan.org/tx/${hash}`;
    case 'arbitrum': return `https://arbiscan.io/tx/${hash}`;
    case 'optimism': return `https://optimistic.etherscan.io/tx/${hash}`;
    case 'polygon': return `https://polygonscan.com/tx/${hash}`;
    case 'bsc': return `https://bscscan.com/tx/${hash}`;
    case 'avalanche': return `https://snowtrace.io/tx/${hash}`;
    default: return `https://etherscan.io/tx/${hash}`;
  }
}

function fmt(n: number | undefined, max = 6): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: max });
}

export default function SwapBatchCard({
  batch,
  walletAddress,
  provider = null,
  slippageBps = 50,
  onAllComplete,
  onCancel,
}: Props) {
  const { broadcast, unlockRequest, resolveUnlock, cancelUnlock } = useSwapBroadcast();
  const legs = batch.legs;
  const [states, setStates] = useState<LegState[]>(() => legs.map(() => ({ status: 'pending' as LegStatus })));

  // The active leg is the first one not yet completed.
  const activeIndex = states.findIndex((s) => s.status !== 'done');
  const allDone = activeIndex === -1;
  const completedHashes = useRef<string[]>([]);

  const patch = useCallback((i: number, next: Partial<LegState>) => {
    setStates((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...next } : s)));
  }, []);

  // ── Fetch a display quote for the active leg ─────────────────────────────
  const fetchQuote = useCallback(
    async (i: number) => {
      const leg = legs[i];
      if (!leg) return;
      patch(i, { status: 'quoting', error: undefined });
      try {
        const params = new URLSearchParams({
          chain: leg.chain,
          from: leg.fromTokenAddress || leg.fromToken,
          to: leg.toTokenAddress || leg.toToken,
          amount: leg.amount,
          slippageBps: String(slippageBps),
        });
        if (walletAddress) params.set('taker', walletAddress);
        const res = await fetch(`/api/swap/price?${params.toString()}`);
        if (!res.ok) {
          // No live quote — still allow signing; the fresh sign-time quote
          // will surface the real error if the pair truly has no route.
          patch(i, { status: 'ready' });
          return;
        }
        const data = await res.json();
        const quote: LegQuote = {
          toAmount: typeof data?.toAmount === 'number' ? data.toAmount : undefined,
          minReceived: typeof data?.minReceived === 'number' ? data.minReceived : undefined,
          rate: typeof data?.rate === 'number' ? fmt(data.rate) : undefined,
          priceImpactPct: typeof data?.priceImpactPct === 'string' ? parseFloat(data.priceImpactPct) || 0 : 0,
          slippageBps: typeof data?.slippageBps === 'number' ? data.slippageBps : slippageBps,
          quoteData: data?.quoteData,
        };
        patch(i, { status: 'ready', quote });
      } catch {
        patch(i, { status: 'ready' });
      }
    },
    [legs, patch, slippageBps, walletAddress],
  );

  // Auto-fetch the active leg's display quote when it becomes active.
  useEffect(() => {
    if (allDone) {
      onAllComplete?.(completedHashes.current);
      return;
    }
    const cur = states[activeIndex];
    if (cur && cur.status === 'pending') void fetchQuote(activeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, allDone]);

  // ── Sign + broadcast the active leg ──────────────────────────────────────
  const signLeg = async (i: number) => {
    const leg = legs[i];
    if (!leg) return;
    if (!walletAddress) {
      patch(i, { status: 'error', error: 'Connect a wallet to sign this swap.' });
      return;
    }
    patch(i, { status: 'signing', error: undefined });
    try {
      // Fresh executable quote AT SIGN TIME — the contract the card promises.
      const params = new URLSearchParams({
        chain: leg.chain,
        from: leg.fromTokenAddress || leg.fromToken,
        to: leg.toTokenAddress || leg.toToken,
        amount: leg.amount,
        taker: walletAddress,
        slippageBps: String(slippageBps),
      });
      const res = await fetch(`/api/swap/quote?${params.toString()}`);
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error(data?.error || 'Could not fetch a swap quote.');

      const walletKind = detectWalletKind(leg.chain, provider);
      const hash = await broadcast({ quote: data, chain: leg.chain, walletKind, address: walletAddress });
      completedHashes.current.push(hash);
      patch(i, { status: 'done', txHash: hash });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Swap failed. Please try again.';
      if (/unlock cancelled/i.test(msg)) {
        patch(i, { status: 'ready' });
      } else {
        patch(i, { status: 'error', error: msg });
      }
    }
  };

  const active = activeIndex >= 0 ? states[activeIndex] : undefined;
  const activeLeg = activeIndex >= 0 ? legs[activeIndex] : undefined;
  const impactColor = (p: number) => (p < 1 ? 'text-emerald-400' : p < 5 ? 'text-amber-400' : 'text-red-400');

  return (
    <div>
      {/* Note above the card */}
      <p className="text-[12px] leading-relaxed text-gray-400 mb-3 px-1">
        Confirm each swap separately — a fresh quote is fetched at sign time, so
        execution prices may shift slightly.
      </p>

      <div className="bg-[#0D1117] border border-[#1E2433] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 text-gray-300">
          <ArrowDownUp size={15} className="text-[#0066FF]" />
          <span className="text-sm font-semibold tabular-nums">
            {allDone ? `Batch complete · ${legs.length}/${legs.length}` : `Swap ${activeIndex + 1} of ${legs.length}`}
          </span>
        </div>

        {/* Step rail */}
        <div className="px-4 pb-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${legs.length}, minmax(0, 1fr))` }}>
            {legs.map((leg, i) => {
              const st = states[i].status;
              const done = st === 'done';
              const isActive = i === activeIndex;
              return (
                <div key={i} className="flex flex-col items-start gap-1.5 min-w-0">
                  <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        done
                          ? 'w-full bg-emerald-500'
                          : isActive
                            ? 'w-full bg-gradient-to-r from-[#0066FF] via-[#5566FF] to-[#0066FF] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]'
                            : 'w-0'
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] truncate w-full ${done ? 'text-emerald-400' : isActive ? 'text-white' : 'text-gray-500'}`}>
                    {leg.fromToken} → {leg.toToken}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completed legs — collapsed green rows */}
        {states.some((s) => s.status === 'done') && (
          <div className="px-4 pb-1 space-y-1.5">
            {states.map((s, i) =>
              s.status === 'done' ? (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-lg px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-[12px] text-emerald-300 font-medium truncate">
                    <CheckCircle size={13} className="shrink-0" />
                    <span className="truncate tabular-nums">
                      {legs[i].amount} {legs[i].fromToken} → {legs[i].toToken}
                    </span>
                  </span>
                  {s.txHash && (
                    <a
                      href={explorerUrl(legs[i].chain, s.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-[#7DA3FF] hover:text-white shrink-0"
                    >
                      View <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ) : null,
            )}
          </div>
        )}

        {/* Active leg detail */}
        {activeLeg && active && (
          <div className="px-4 pt-2 pb-4">
            {/* You pay */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-[#1E2433]">
              <SwapTokenGlyph symbol={activeLeg.fromToken} size={36} />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">You pay</div>
                <div className="text-lg font-bold text-white font-mono tabular-nums leading-tight">
                  {activeLeg.amount} {activeLeg.fromToken}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center py-1.5">
              <div className="w-8 h-8 rounded-full bg-[#141824] border border-[#1E2433] flex items-center justify-center">
                <ArrowDownUp size={14} className="text-gray-400" />
              </div>
            </div>

            {/* You receive */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-[#1E2433]">
              <SwapTokenGlyph symbol={activeLeg.toToken} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">You receive</div>
                  {activeLeg.toTokenAddress && (
                    <TrustScoreBadge chain={activeLeg.chain} address={activeLeg.toTokenAddress} size="sm" showLabel={false} />
                  )}
                </div>
                <div className="text-lg font-bold text-white font-mono tabular-nums leading-tight">
                  {active.status === 'quoting' ? (
                    <span className="inline-flex items-center gap-1.5 text-gray-500 text-base">
                      <RefreshCw size={13} className="animate-spin" /> fetching…
                    </span>
                  ) : (
                    <>~{fmt(active.quote?.toAmount)} {activeLeg.toToken}</>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">Minimum received</span>
                <span className="text-gray-200 font-mono tabular-nums">
                  {active.status === 'quoting' ? '—' : `${fmt(active.quote?.minReceived)} ${activeLeg.toToken}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">Slippage tolerance</span>
                <span className="text-gray-200 font-mono tabular-nums">{(slippageBps / 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-gray-500">Price impact</span>
                <span className={`font-semibold tabular-nums ${impactColor(active.quote?.priceImpactPct ?? 0)}`}>
                  {active.status === 'quoting' ? '—' : `${(active.quote?.priceImpactPct ?? 0).toFixed(2)}%`}
                </span>
              </div>
            </div>

            {/* Refresh + error */}
            <div className="flex items-center justify-end mt-2">
              <button
                onClick={() => fetchQuote(activeIndex)}
                disabled={active.status === 'quoting' || active.status === 'signing'}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-40"
                aria-label="Refresh quote"
              >
                <RefreshCw size={14} className={active.status === 'quoting' ? 'animate-spin' : ''} />
              </button>
            </div>

            {active.status === 'error' && active.error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-2">
                <AlertTriangle size={13} className="text-red-400 mt-0.5 shrink-0" />
                <span className="text-[12px] text-red-400 leading-relaxed">{active.error}</span>
              </div>
            )}

            {!walletAddress && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-2">
                <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                <span className="text-[12px] text-amber-300 leading-relaxed">Connect a wallet to sign this swap.</span>
              </div>
            )}

            {/* Primary action */}
            <div className={onCancel ? 'grid grid-cols-[1fr_auto] gap-2' : ''}>
              <button
                onClick={() => signLeg(activeIndex)}
                disabled={!walletAddress || active.status === 'quoting' || active.status === 'signing'}
                className="naka-button-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ paddingTop: 12, paddingBottom: 12 }}
              >
                {active.status === 'signing' ? (
                  <><Loader2 size={15} className="animate-spin" /> Confirm in your wallet…</>
                ) : active.status === 'error' ? (
                  <><ArrowDownUp size={15} /> Retry swap {activeIndex + 1}</>
                ) : (
                  <><ArrowDownUp size={15} /> Sign &amp; Swap</>
                )}
              </button>
              {onCancel && (
                <button
                  onClick={onCancel}
                  disabled={active.status === 'signing'}
                  className="px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-[#1E2433] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* All complete */}
        {allDone && (
          <div className="px-4 pt-2 pb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">
              All {legs.length} swap{legs.length > 1 ? 's' : ''} executed
            </span>
          </div>
        )}
      </div>

      {unlockRequest && (
        <UnlockWalletModal
          encryptedKey={unlockRequest.encryptedKey}
          addressShort={unlockRequest.addressShort}
          onUnlocked={resolveUnlock}
          onClose={cancelUnlock}
        />
      )}
    </div>
  );
}
