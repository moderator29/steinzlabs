'use client';

// Whale Compare — put 2-4 tracked wallets side by side: reputation, PnL,
// archetype, hold time, and the tokens they're BOTH in (cross-wallet overlap).
// Real data from the curated whales table + whale_activity. Turns the directory
// into a decision tool — no competitor lets you diff whales head-to-head.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, X, GitCompareArrows, Trophy, Target, Clock, Layers } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { whaleDisplayName } from '@/lib/whales/naming';
import { whaleCompareHowItWorks } from '@/lib/howItWorks/content/whale-compare';

interface TopToken { symbol: string; valueUsd: number }
interface ComparedWallet {
  address: string; label: string | null; nakaNumber: number | null; entityType: string | null; chain: string;
  archetype: string | null; winRate: number | null; whaleScore: number | null;
  pnl30dUsd: number | null; pnl7dUsd: number | null; portfolioUsd: number | null;
  volume7dUsd: number | null; trades30d: number | null; avgHoldHours: number | null;
  verified: boolean; lastActive: string | null; logoUrl: string | null;
  topTokens: TopToken[];
}
interface OverlapRow { symbol: string; wallets: string[]; count: number }
interface CompareResult { wallets: ComparedWallet[]; overlap: OverlapRow[]; notFound?: string[] }
interface PickWhale { address: string; name: string; winRate: number | null }

function short(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function fmtUsd(n: number | null): string {
  if (n == null) return 'N/A';
  const s = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1_000) return `${s}$${(abs / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(abs)}`;
}
function fmtHold(h: number | null): string {
  if (h == null || h <= 0) return 'N/A';
  return h >= 24 ? `${Math.round(h / 24)}d` : `${Math.round(h)}h`;
}
function fmtAgo(iso: string | null): string {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  const h = diff / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Best value across the row gets a subtle gold highlight so the "winner" per
// metric is scannable. Returns the index of the best wallet, or -1 if tied/none.
function bestIndex(vals: (number | null)[], higherBetter = true): number {
  let best = -1, bestVal = higherBetter ? -Infinity : Infinity;
  vals.forEach((v, i) => {
    if (v == null) return;
    if (higherBetter ? v > bestVal : v < bestVal) { bestVal = v; best = i; }
  });
  // Don't highlight if everyone is null or all equal.
  const nonNull = vals.filter((v) => v != null);
  if (nonNull.length < 2 || nonNull.every((v) => v === nonNull[0])) return -1;
  return best;
}

export default function WhaleComparePage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<PickWhale[]>([]);

  const run = useCallback(async (addresses: string[]) => {
    if (addresses.length < 2) { setResult(null); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/whale-tracker/compare?addresses=${encodeURIComponent(addresses.join(','))}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Compare failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  // Seed from ?addresses= and load quick-pick whales.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('addresses');
      if (q) {
        const arr = Array.from(new Set(q.split(',').map((a) => a.trim()).filter(Boolean))).slice(0, 4);
        setSelected(arr);
        if (arr.length >= 2) run(arr);
      }
    } catch { /* ignore */ }
    fetch('/api/smart-money', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { wallets: [] }))
      .then((d: { wallets?: Array<{ address: string; name: string; winRate: number | null }> }) => {
        setPicks((d.wallets ?? []).slice(0, 10).map((w) => ({ address: w.address, name: w.name, winRate: w.winRate })));
      })
      .catch(() => { /* picker is optional */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (addr: string) => {
    const a = addr.trim();
    if (!a || selected.includes(a) || selected.length >= 4) return;
    setSelected((s) => [...s, a]);
    setInput('');
  };
  const remove = (addr: string) => setSelected((s) => s.filter((x) => x !== addr));

  const overlapFor = (addr: string): string[] =>
    (result?.overlap ?? []).filter((o) => o.wallets.includes(addr)).map((o) => o.symbol);

  return (
    <div className="min-h-screen text-white max-w-5xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/whale-tracker" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><GitCompareArrows className="w-4 h-4 text-[#00C8FF]" /> Whale Compare</span>
        <HowItWorksButton content={whaleCompareHowItWorks} className="ms-auto shrink-0" />
      </div>

      {/* Hero */}
      <div className="text-center mb-5">
        <h1 className="text-2xl font-bold">Put whales head to head</h1>
        <p className="text-slate-400 text-sm mt-1">Pick 2–4 tracked wallets to compare reputation, PnL, and what they’re both buying.</p>
      </div>

      {/* Selection */}
      <div className="nl-glass rounded-2xl p-3 mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((a) => (
            <span key={a} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0066FF]/10 border border-[#0066FF]/30 text-xs font-mono">
              {short(a)}
              <button onClick={() => remove(a)} aria-label="Remove" className="text-slate-400 hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {selected.length === 0 && <span className="text-xs text-slate-500 py-1">No wallets selected yet.</span>}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(input); }}
            placeholder="Paste a wallet address…"
            disabled={selected.length >= 4}
            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder-slate-500 border border-white/10 rounded-lg disabled:opacity-40"
            maxLength={120}
          />
          <button onClick={() => add(input)} disabled={!input.trim() || selected.length >= 4} className="px-3 py-2 rounded-lg nl-btn-neon text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
          <button onClick={() => run(selected)} disabled={selected.length < 2 || loading} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-40">Compare</button>
        </div>

        {picks.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Quick add: top tracked whales</div>
            <div className="flex flex-wrap gap-1.5">
              {picks.filter((p) => !selected.includes(p.address)).slice(0, 8).map((p) => (
                <button key={p.address} onClick={() => add(p.address)} disabled={selected.length >= 4}
                  className="px-2.5 py-1 rounded-full text-[11px] text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:border-[#0066FF]/40 hover:text-white transition-colors disabled:opacity-40">
                  {p.name}{p.winRate != null ? ` · ${p.winRate}%` : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && result && result.wallets.length >= 2 && (
        <>
          {/* Comparison grid */}
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="grid gap-3 min-w-[640px]" style={{ gridTemplateColumns: `repeat(${result.wallets.length}, minmax(0, 1fr))` }}>
              {result.wallets.map((w, i) => {
                const bestWin = bestIndex(result.wallets.map((x) => x.winRate));
                const bestPnl = bestIndex(result.wallets.map((x) => x.pnl30dUsd));
                const bestScore = bestIndex(result.wallets.map((x) => x.whaleScore));
                const bestVol = bestIndex(result.wallets.map((x) => x.volume7dUsd));
                const cellCls = (isBest: boolean) => isBest ? 'text-[#FFD86B] font-bold' : 'text-white font-semibold';
                return (
                  <div key={w.address} className="nl-card rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ChainLogo chain={w.chain} className="w-5 h-5" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{whaleDisplayName({ label: w.label, nakaNumber: w.nakaNumber, address: w.address, chain: w.chain })}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{short(w.address)}</div>
                      </div>
                    </div>
                    {w.archetype && <div className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 mb-3">{w.archetype}</div>}
                    <dl className="space-y-2 text-xs">
                      <Row icon={<Target className="w-3 h-3" />} label="Win rate" value={w.winRate == null ? 'N/A' : `${w.winRate}%`} cls={cellCls(i === bestWin)} />
                      <Row icon={<Trophy className="w-3 h-3" />} label="Whale score" value={w.whaleScore == null ? 'N/A' : String(w.whaleScore)} cls={cellCls(i === bestScore)} />
                      <Row label="PnL 30d" value={fmtUsd(w.pnl30dUsd)} cls={`${cellCls(i === bestPnl)} ${(w.pnl30dUsd ?? 0) < 0 ? 'text-[#FF1744]' : ''}`} />
                      <Row label="Volume 7d" value={fmtUsd(w.volume7dUsd)} cls={cellCls(i === bestVol)} />
                      <Row label="Portfolio" value={fmtUsd(w.portfolioUsd)} cls="text-white font-semibold" />
                      <Row label="Trades 30d" value={w.trades30d == null ? 'N/A' : w.trades30d.toLocaleString()} cls="text-white font-semibold" />
                      <Row icon={<Clock className="w-3 h-3" />} label="Avg hold" value={fmtHold(w.avgHoldHours)} cls="text-white font-semibold" />
                      <Row label="Last active" value={fmtAgo(w.lastActive)} cls="text-slate-300 font-medium" />
                    </dl>

                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Top buys</div>
                      <div className="flex flex-wrap gap-1">
                        {w.topTokens.length === 0 && <span className="text-[11px] text-slate-500">No recent buys</span>}
                        {w.topTokens.slice(0, 6).map((t) => {
                          const shared = overlapFor(w.address).includes(t.symbol);
                          return (
                            <span key={t.symbol} title={fmtUsd(t.valueUsd)}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${shared ? 'bg-[#00C8FF]/15 text-[#00C8FF] border border-[#00C8FF]/30' : 'bg-white/[0.05] text-slate-300'}`}>
                              {t.symbol}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overlap */}
          <div className="nl-glass rounded-2xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-[#00C8FF]" />
              <span className="text-sm font-semibold">Shared conviction</span>
              <span className="text-[11px] text-slate-500">tokens ≥2 of these wallets bought</span>
            </div>
            {result.overlap.length === 0 ? (
              <p className="text-sm text-slate-500">No overlapping tokens in the recent activity window. These wallets are trading different things.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.overlap.map((o) => (
                  <span key={o.symbol} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00C8FF]/10 border border-[#00C8FF]/25 text-xs">
                    <span className="font-semibold text-[#00C8FF]">{o.symbol}</span>
                    <span className="text-[10px] text-slate-400">{o.count} wallets</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {result.notFound && result.notFound.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-3">Not in the tracked directory: {result.notFound.map(short).join(', ')}</p>
          )}
        </>
      )}

      {!loading && !result && selected.length < 2 && (
        <div className="text-center text-slate-500 text-sm py-10">
          Add at least two tracked wallets to compare. Try the quick-add chips above, or{' '}
          <Link href="/dashboard/whale-tracker/directory" className="text-[#00C8FF] hover:underline">browse the directory</Link>.
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value, cls }: { icon?: React.ReactNode; label: string; value: string; cls: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500 inline-flex items-center gap-1">{icon}{label}</dt>
      <dd className={cls}>{value}</dd>
    </div>
  );
}
