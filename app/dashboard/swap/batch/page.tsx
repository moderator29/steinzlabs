'use client';

/**
 * Batch Swap — execute several swaps in one sitting, each signed separately.
 *
 * This is the reference multi-leg flow: queue N legs (e.g. SOL→hSOL, SOL→BONK,
 * SOL→2Z), then run them through SwapBatchCard, which fetches a fresh quote per
 * leg at sign time and broadcasts each through the shared `useSwapBroadcast`
 * signer. Built on Naka branding (#0D1117 / #1E2433 / #0066FF).
 */

import { useState } from 'react';
import { Plus, Trash2, ArrowDownUp, Wallet } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { useWallet } from '@/lib/hooks/useWallet';
import SwapBatchCard, { type SwapLeg } from '@/components/swap/SwapBatchCard';
import SwapTokenGlyph from '@/components/swap/SwapTokenGlyph';

const CHAINS = [
  { id: 'solana', label: 'Solana' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'bsc', label: 'BSC' },
  { id: 'optimism', label: 'Optimism' },
];

interface DraftLeg {
  chain: string;
  fromToken: string;
  toToken: string;
  amount: string;
}

const EMPTY_DRAFT: DraftLeg = { chain: 'solana', fromToken: 'SOL', toToken: '', amount: '' };

export default function BatchSwapPage() {
  const { address, provider } = useWallet();
  const [legs, setLegs] = useState<SwapLeg[]>([]);
  const [draft, setDraft] = useState<DraftLeg>(EMPTY_DRAFT);
  const [executing, setExecuting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const addLeg = () => {
    const from = draft.fromToken.trim();
    const to = draft.toToken.trim();
    const amt = parseFloat(draft.amount);
    if (!from || !to) { setDraftError('Enter both tokens (symbol or contract address).'); return; }
    if (from.toUpperCase() === to.toUpperCase()) { setDraftError('From and to tokens must differ.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setDraftError('Enter a positive amount.'); return; }
    setDraftError(null);
    setLegs((prev) => [...prev, { chain: draft.chain, fromToken: from, toToken: to, amount: draft.amount.trim() }]);
    setDraft((d) => ({ ...EMPTY_DRAFT, chain: d.chain, fromToken: d.fromToken }));
  };

  const removeLeg = (i: number) => setLegs((prev) => prev.filter((_, idx) => idx !== i));

  const field = 'w-full bg-[#060A12] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0066FF]/50 transition-colors';

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="relative z-10 flex flex-col items-center px-4 pt-6 sm:pt-12 pb-20">
        <div className="w-full max-w-[480px]">
          <div className="flex items-center justify-between mb-6">
            <BackButton href="/dashboard/swap" />
            <h1 className="text-lg font-heading font-bold text-white">Batch Swap</h1>
            <div className="w-9" aria-hidden="true" />
          </div>

          {!address && (
            <div className="mb-4 rounded-2xl p-4 nl-glass flex items-center gap-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <Wallet className="w-5 h-5 text-gray-500 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-300">No wallet connected</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Connect a wallet to sign each swap.</p>
              </div>
            </div>
          )}

          {!executing ? (
            <>
              {/* Leg builder */}
              <div className="nl-glass rounded-2xl p-4 mb-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                <div className="flex items-center gap-2 mb-3 text-gray-300">
                  <Plus size={15} className="text-[#0066FF]" />
                  <span className="text-sm font-semibold">Add a swap</span>
                </div>
                <div className="space-y-2.5">
                  <select
                    value={draft.chain}
                    onChange={(e) => setDraft((d) => ({ ...d, chain: e.target.value }))}
                    className={field}
                    aria-label="Chain"
                  >
                    {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input
                      value={draft.fromToken}
                      onChange={(e) => setDraft((d) => ({ ...d, fromToken: e.target.value }))}
                      placeholder="From (e.g. SOL)"
                      className={field}
                      aria-label="From token"
                    />
                    <ArrowDownUp size={16} className="text-gray-500 rotate-90" />
                    <input
                      value={draft.toToken}
                      onChange={(e) => setDraft((d) => ({ ...d, toToken: e.target.value }))}
                      placeholder="To (symbol / address)"
                      className={field}
                      aria-label="To token"
                    />
                  </div>
                  <input
                    value={draft.amount}
                    onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                    inputMode="decimal"
                    placeholder={`Amount of ${draft.fromToken || 'token'} to swap`}
                    className={`${field} font-mono tabular-nums`}
                    aria-label="Amount"
                  />
                  {draftError && <p className="text-[11px] text-red-400">{draftError}</p>}
                  <button
                    onClick={addLeg}
                    className="nl-button--ghost w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold"
                  >
                    <Plus size={15} /> Add to batch
                  </button>
                </div>
              </div>

              {/* Queued legs */}
              {legs.length > 0 && (
                <div className="nl-glass rounded-2xl p-4 mb-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2.5">
                    {legs.length} swap{legs.length > 1 ? 's' : ''} queued
                  </div>
                  <div className="space-y-2">
                    {legs.map((leg, i) => (
                      <div key={i} className="nl-card flex items-center gap-2.5 rounded-lg px-3 py-2">
                        <SwapTokenGlyph symbol={leg.fromToken} size={26} />
                        <span className="text-[13px] font-mono tabular-nums text-white truncate flex-1">
                          {leg.amount} {leg.fromToken} <span className="text-gray-500">→</span> {leg.toToken}
                        </span>
                        <span className="text-[10px] uppercase text-gray-600">{leg.chain}</span>
                        <button
                          onClick={() => removeLeg(i)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label={`Remove swap ${i + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setExecuting(true)}
                    disabled={!address}
                    className="nl-button w-full justify-center mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ paddingTop: 12, paddingBottom: 12 }}
                  >
                    <ArrowDownUp size={15} /> Review &amp; execute {legs.length} swap{legs.length > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </>
          ) : (
            <SwapBatchCard
              batch={{ legs }}
              walletAddress={address || undefined}
              provider={provider}
              onCancel={() => setExecuting(false)}
              onAllComplete={() => { /* legs stay shown as completed rows in the card */ }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
