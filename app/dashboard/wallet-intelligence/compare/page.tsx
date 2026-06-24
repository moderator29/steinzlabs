'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeftRight, Wallet, Loader2, AlertCircle, ExternalLink, Copy, Check,
  TrendingUp, Activity, Clock,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * §9.3 — Wallet Intelligence: Compare tool.
 *
 * Side-by-side fetch of two wallet addresses against the same
 * /api/wallet-intelligence backend the single-wallet view uses, with
 * a third "diff" column that highlights where they overlap (shared
 * tokens) and where they diverge (one holds, the other doesn't).
 *
 * The two queries run in parallel via Promise.all so the panel resolves
 * in roughly the same wall-clock time as a single lookup. Each side
 * carries its own error and loading state so a slow / failing chain on
 * one wallet never blocks the other.
 */

interface Holding {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string | null;
  contractAddress: string | null;
  logoUrl?: string | null;
}

interface WalletPayload {
  chain: string;
  address: string;
  totalBalanceUsd: string;
  txCount: number;
  firstSeen?: string | null;
  lastActive?: string | null;
  tokenCount: number;
  holdings: Holding[];
  explorerUrl?: string;
}

type Slot = 'a' | 'b';

interface SideState {
  raw: string;
  loading: boolean;
  error: string | null;
  data: WalletPayload | null;
}

const EMPTY_SIDE: SideState = { raw: '', loading: false, error: null, data: null };

function shortAddr(a: string): string {
  if (!a) return '—';
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function fmtUsd(v: string | null | undefined): string {
  if (!v) return '$0';
  const n = Number(v);
  if (!Number.isFinite(n)) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          }).catch(() => {});
        }
      }}
      className="text-slate-500 hover:text-white transition-colors"
      aria-label="Copy address"
    >
      {done ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function SideHeader({ label, side, onChange, onClear }: {
  label: string;
  side: SideState;
  onChange: (next: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="whale-search">
      <Wallet className="w-4 h-4 text-slate-500" />
      <input
        value={side.raw}
        onChange={e => onChange(e.target.value)}
        placeholder={`Wallet ${label}`}
        spellCheck={false}
        autoComplete="off"
      />
      {side.raw && (
        <button
          type="button"
          onClick={onClear}
          className="text-slate-500 hover:text-white transition-colors text-[11px] font-semibold"
          aria-label={`Clear wallet ${label}`}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function StatRow({ label, a, b }: { label: string; a: string; b: string }) {
  const same = a === b;
  return (
    <tr className="border-b border-white/[0.04] last:border-0">
      <td className="py-3 text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</td>
      <td className={`py-3 text-sm font-mono ${same ? 'text-slate-300' : 'text-white'}`}>{a}</td>
      <td className={`py-3 text-sm font-mono ${same ? 'text-slate-300' : 'text-white'}`}>{b}</td>
    </tr>
  );
}

export default function WalletCompareePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [a, setA] = useState<SideState>({ ...EMPTY_SIDE, raw: params?.get('a') ?? '' });
  const [b, setB] = useState<SideState>({ ...EMPTY_SIDE, raw: params?.get('b') ?? '' });

  const updateUrl = (rawA: string, rawB: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    rawA ? url.searchParams.set('a', rawA) : url.searchParams.delete('a');
    rawB ? url.searchParams.set('b', rawB) : url.searchParams.delete('b');
    window.history.replaceState({}, '', url.toString());
  };

  // Auto-fetch when both inputs look like an address. Uses
  // addressNormalize so EVM gets lowered and Solana case is preserved
  // — never call .toLowerCase() directly here.
  useEffect(() => {
    const A = a.raw.trim();
    const B = b.raw.trim();
    updateUrl(A, B);
    if (A.length < 32 && B.length < 32) return;
    let cancelled = false;
    const run = async (raw: string, set: (s: SideState) => void) => {
      if (raw.length < 32) {
        set(EMPTY_SIDE);
        return;
      }
      set({ raw, loading: true, error: null, data: null });
      try {
        const norm = normalizeAddress(raw);
        const res = await fetch(`/api/wallet-intelligence?address=${encodeURIComponent(norm)}`, {
          signal: AbortSignal.timeout(15_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as WalletPayload;
        if (cancelled) return;
        set({ raw, loading: false, error: null, data: json });
      } catch (err) {
        if (cancelled) return;
        set({ raw, loading: false, error: err instanceof Error ? err.message : 'Failed to load', data: null });
      }
    };
    Promise.all([run(A, setA), run(B, setB)]);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.raw, b.raw]);

  const overlap = useMemo(() => {
    const ah = a.data?.holdings ?? [];
    const bh = b.data?.holdings ?? [];
    if (!ah.length || !bh.length) return [];
    const aSet = new Set(ah.map(h => (h.contractAddress ? h.contractAddress.toLowerCase() : h.symbol.toLowerCase())));
    return bh.filter(h => aSet.has((h.contractAddress ?? h.symbol).toLowerCase()))
      .map(h => h.symbol)
      .slice(0, 12);
  }, [a.data, b.data]);

  const onlyA = useMemo(() => {
    const ah = a.data?.holdings ?? [];
    const bh = b.data?.holdings ?? [];
    if (!ah.length) return [];
    const bSet = new Set(bh.map(h => (h.contractAddress ?? h.symbol).toLowerCase()));
    return ah.filter(h => !bSet.has((h.contractAddress ?? h.symbol).toLowerCase()))
      .map(h => h.symbol)
      .slice(0, 12);
  }, [a.data, b.data]);

  const onlyB = useMemo(() => {
    const ah = a.data?.holdings ?? [];
    const bh = b.data?.holdings ?? [];
    if (!bh.length) return [];
    const aSet = new Set(ah.map(h => (h.contractAddress ?? h.symbol).toLowerCase()));
    return bh.filter(h => !aSet.has((h.contractAddress ?? h.symbol).toLowerCase()))
      .map(h => h.symbol)
      .slice(0, 12);
  }, [a.data, b.data]);

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-20">
      <div className="sticky top-0 z-40 bg-[#060A12]/90 backdrop-blur-2xl border-b border-[#1a1f2e]">
        <div className="flex items-center gap-3 px-4 h-14 max-w-6xl mx-auto">
          <BackButton href="/dashboard/wallet-intelligence" label="Back" />
          <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF] to-[#00C8FF] rounded-xl flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <h1 className="text-sm font-heading font-bold">Compare Wallets</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SideHeader
            label="A"
            side={a}
            onChange={raw => setA(s => ({ ...s, raw }))}
            onClear={() => setA(EMPTY_SIDE)}
          />
          <SideHeader
            label="B"
            side={b}
            onChange={raw => setB(s => ({ ...s, raw }))}
            onClear={() => setB(EMPTY_SIDE)}
          />
        </div>

        {/* Side panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[{ side: a, label: 'A' }, { side: b, label: 'B' }].map(({ side, label }) => (
            <div key={label} className="whale-glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Wallet {label}</div>
                {side.data?.address && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    {shortAddr(side.data.address)}
                    <CopyBtn text={side.data.address} />
                    {side.data.explorerUrl && (
                      <a href={side.data.explorerUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in explorer" className="text-slate-500 hover:text-white">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              {side.loading && (
                <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin me-2" /> Loading…
                </div>
              )}
              {side.error && !side.loading && (
                <div className="flex items-center gap-2 py-3 text-[#FF6B6B] text-sm">
                  <AlertCircle className="w-4 h-4" /> {side.error}
                </div>
              )}
              {side.data && !side.loading && !side.error && (
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold tracking-tight">{fmtUsd(side.data.totalBalanceUsd)}</div>
                    <div className="text-[11px] text-slate-500">Total balance</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-white/[0.06] py-2">
                      <div className="text-sm font-semibold">{side.data.tokenCount}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Tokens</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] py-2">
                      <div className="text-sm font-semibold">{side.data.txCount.toLocaleString()}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Txs</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] py-2">
                      <div className="text-sm font-semibold">{side.data.chain}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Chain</div>
                    </div>
                  </div>
                </div>
              )}
              {!side.loading && !side.error && !side.data && (
                <div className="text-[12px] text-slate-500 text-center py-12">
                  Paste a wallet {label} above to load.
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Diff table */}
        {a.data && b.data && (
          <div className="whale-glass-card p-4 sm:p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-3">Side-by-side</div>
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-2 text-[10px] uppercase tracking-wide text-slate-500"></th>
                  <th className="py-2 text-[10px] uppercase tracking-wide text-slate-500">A</th>
                  <th className="py-2 text-[10px] uppercase tracking-wide text-slate-500">B</th>
                </tr>
              </thead>
              <tbody>
                <StatRow label="Total balance" a={fmtUsd(a.data.totalBalanceUsd)} b={fmtUsd(b.data.totalBalanceUsd)} />
                <StatRow label="Token count" a={String(a.data.tokenCount)} b={String(b.data.tokenCount)} />
                <StatRow label="Tx count" a={a.data.txCount.toLocaleString()} b={b.data.txCount.toLocaleString()} />
                <StatRow label="Chain" a={a.data.chain} b={b.data.chain} />
                <StatRow label="First seen" a={a.data.firstSeen ?? '—'} b={b.data.firstSeen ?? '—'} />
                <StatRow label="Last active" a={a.data.lastActive ?? '—'} b={b.data.lastActive ?? '—'} />
              </tbody>
            </table>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-emerald-300 font-semibold mb-2">
                  <TrendingUp className="w-3 h-3" /> Shared tokens ({overlap.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {overlap.length === 0 && <span className="text-[12px] text-slate-500">None overlap.</span>}
                  {overlap.map(s => <span key={s} className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-200 border border-emerald-500/20">{s}</span>)}
                </div>
              </div>
              <div className="rounded-xl border border-[#0066FF]/25 bg-[#0066FF]/[0.06] p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#8FA3FF] font-semibold mb-2">
                  <Wallet className="w-3 h-3" /> Only in A ({onlyA.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {onlyA.length === 0 && <span className="text-[12px] text-slate-500">None.</span>}
                  {onlyA.map(s => <span key={s} className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#0066FF]/10 text-[#8FA3FF] border border-[#0066FF]/20">{s}</span>)}
                </div>
              </div>
              <div className="rounded-xl border border-[#FF1744]/25 bg-[#FF1744]/[0.06] p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#FF8FA3] font-semibold mb-2">
                  <Wallet className="w-3 h-3" /> Only in B ({onlyB.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {onlyB.length === 0 && <span className="text-[12px] text-slate-500">None.</span>}
                  {onlyB.map(s => <span key={s} className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FF1744]/10 text-[#FF8FA3] border border-[#FF1744]/20">{s}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
