'use client';

// Convergence Radar — the flagship "smart money is buying the same thing"
// board. Reputation-weighted, stablecoin-demoted, earliness-aware, with a
// one-tap Claude thesis per convergence (AiInsightCard). Real data from the
// upsert-fixed smart_money_convergence pipeline + whales reputation.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Radar, TrendingUp, Users, Clock, Sparkles, RefreshCw } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { AiInsightCard } from '@/components/ai/AiInsightCard';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { convergenceHowItWorks } from '@/lib/howItWorks/content/convergence';

interface NamedWhale {
  address: string;
  label: string | null;
  winRate: number | null;
  archetype: string | null;
}
interface Convergence {
  id: string;
  tokenSymbol: string | null;
  tokenAddress: string;
  chain: string;
  walletCount: number;
  totalValueUsd: number;
  firstSeen: string;
  ageHours: number;
  avgWinRate: number | null;
  avgWhaleScore: number | null;
  topArchetype: string | null;
  namedWhales: NamedWhale[];
  isNoise: boolean;
  alphaScore: number;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
function fmtAge(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const ARCH_STYLE: Record<string, { label: string; color: string }> = {
  accumulator: { label: 'Accumulators', color: '#10B981' },
  sniper: { label: 'Snipers', color: '#00C8FF' },
  swing: { label: 'Swing traders', color: '#FFD86B' },
  distributor: { label: 'Distributors', color: '#FF1744' },
};

export default function ConvergenceRadarPage() {
  const [items, setItems] = useState<Convergence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [chain, setChain] = useState<string>('all');
  const [includeNoise, setIncludeNoise] = useState(false);
  const [selected, setSelected] = useState<Convergence | null>(null);
  const [thesis, setThesis] = useState<{ text: string; confidence?: number } | null>(null);
  const [thesisLoading, setThesisLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (chain !== 'all') params.set('chain', chain);
      if (includeNoise) params.set('includeNoise', '1');
      const res = await fetch(`/api/whale-tracker/convergence?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.convergences ?? []);
      setRefreshedAt(data.refreshedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load convergences');
    } finally {
      setLoading(false);
    }
  }, [chain, includeNoise]);

  useEffect(() => { load(); }, [load]);

  const openThesis = async (c: Convergence) => {
    setSelected(c);
    setThesis(null);
    setThesisLoading(true);
    try {
      const res = await fetch('/api/whale-tracker/convergence/thesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tokenAddress: c.tokenAddress, chain: c.chain }),
      });
      const data = await res.json();
      if (res.ok && data.thesis) setThesis({ text: data.thesis, confidence: data.confidence });
      else setThesis({ text: data.error === 'Unauthorized' ? 'Sign in to read the AI thesis.' : 'Thesis unavailable for this convergence right now.' });
    } catch {
      setThesis({ text: 'Could not reach the analyst. Try again in a moment.' });
    } finally {
      setThesisLoading(false);
    }
  };

  const chains = ['all', 'ethereum', 'solana', 'base', 'arbitrum', 'bsc', 'polygon'];

  return (
    <div className="min-h-screen text-white max-w-4xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-4">
        <BackButton href="/dashboard/whale-tracker" compact />
        {/* whale-tracker tab strip for continuity */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <Link href="/dashboard/whale-tracker" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 transition-colors">Live Feed</Link>
          <span className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-white bg-[#0066FF]/15 border border-[#0066FF]/40">Convergence</span>
          <Link href="/dashboard/whale-tracker/directory" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 transition-colors">Directory</Link>
        </div>
        <HowItWorksButton content={convergenceHowItWorks} className="ms-auto shrink-0" />
      </div>

      {/* Hero */}
      <div className="nl-glass rounded-2xl p-5 mb-4 relative overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 26px rgba(0,102,255,.18)' }}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0066FF]/15 border border-[#0066FF]/30 flex items-center justify-center shrink-0">
            <Radar className="w-6 h-6 text-[#00C8FF]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">Convergence Radar</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Tokens where multiple tracked smart-money wallets are buying together — ranked by wallet reputation and how early it is, stablecoins and wrapped majors demoted so you see real accumulation.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {chains.map((c) => (
          <button
            key={c}
            onClick={() => setChain(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors capitalize ${
              chain === c ? 'bg-[#0066FF]/15 text-blue-300 border-[#0066FF]/40' : 'bg-slate-950/60 text-slate-400 border-slate-800/60 hover:text-slate-200'
            }`}
          >
            {c === 'all' ? 'All chains' : c}
          </button>
        ))}
        <button
          onClick={() => setIncludeNoise((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ms-auto ${
            includeNoise ? 'bg-slate-700/40 text-slate-200 border-slate-600' : 'bg-slate-950/60 text-slate-500 border-slate-800/60 hover:text-slate-300'
          }`}
          title="Show stablecoin & wrapped-major convergences too"
        >
          {includeNoise ? 'Hiding stables ✕' : 'Show stables'}
        </button>
        <button onClick={load} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-slate-400 hover:text-white transition-colors" aria-label="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="nl-glass rounded-2xl p-8 text-center text-slate-400">{error}</div>
      ) : items.length === 0 ? (
        <div className="nl-glass rounded-2xl p-10 text-center">
          <Radar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold">No active convergence right now</p>
          <p className="text-slate-500 text-sm mt-1">When two or more tracked whales buy the same token within 24h, it lands here. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c, i) => {
            const arch = c.topArchetype ? ARCH_STYLE[c.topArchetype.toLowerCase()] : null;
            return (
              <button
                key={c.id}
                onClick={() => openThesis(c)}
                className="w-full text-start nl-glass rounded-2xl p-4 hover:-translate-y-px transition-transform group"
                style={{ boxShadow: selected?.id === c.id ? '0 0 0 1px rgba(0,200,255,.5), 0 0 20px rgba(0,102,255,.22)' : undefined }}
              >
                <div className="flex items-center gap-3">
                  {/* rank + alpha */}
                  <div className="shrink-0 flex flex-col items-center justify-center w-11">
                    <span className="text-[10px] text-slate-500 font-mono">#{i + 1}</span>
                    <span className="text-lg font-black tabular-nums" style={{ color: c.alphaScore >= 30 ? '#00C8FF' : c.alphaScore >= 15 ? '#FFD86B' : '#B4C0E0' }}>
                      {c.alphaScore.toFixed(0)}
                    </span>
                    <span className="text-[8px] text-slate-600 uppercase tracking-wide">alpha</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white truncate">{c.tokenSymbol || `${c.tokenAddress.slice(0, 6)}…`}</span>
                      <ChainLogo chain={c.chain} size={14} />
                      {c.isNoise && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 uppercase">stable</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Users className="w-3 h-3 text-[#00C8FF]" /> {c.walletCount} whales</span>
                      <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-400" /> {fmtUsd(c.totalValueUsd)}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-slate-500" /> {fmtAge(c.ageHours)}</span>
                      {c.avgWinRate != null && <span className="text-slate-300">avg win {c.avgWinRate}%</span>}
                      {arch && <span className="font-semibold" style={{ color: arch.color }}>{arch.label}</span>}
                    </div>
                    {c.namedWhales.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {c.namedWhales.map((w) => (
                          <span key={w.address} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-slate-300">
                            {w.label}{w.winRate != null ? ` · ${Math.round(w.winRate)}%` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#00C8FF] opacity-70 group-hover:opacity-100 transition-opacity">
                    <Sparkles className="w-3.5 h-3.5" /> Thesis
                  </div>
                </div>
              </button>
            );
          })}
          {refreshedAt && (
            <p className="text-center text-[10px] text-slate-600 pt-2">
              Live from the smart-money convergence pipeline · refreshed {new Date(refreshedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* AI Thesis drawer */}
      {selected && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-[460px] p-4">
            <AiInsightCard
              title={`Why ${selected.tokenSymbol || 'this token'} — VTX thesis`}
              text={thesis?.text ?? ''}
              streaming={!!thesis?.text}
              loading={thesisLoading}
              confidence={thesis?.confidence}
              citations={[
                { label: `${selected.walletCount} whales`, },
                { label: `${fmtUsd(selected.totalValueUsd)} combined` },
                { label: `first seen ${fmtAge(selected.ageHours)}` },
              ]}
              footer={
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/market/${selected.chain}/${selected.tokenAddress}`}
                    className="flex-1 text-center py-2 rounded-lg text-xs font-semibold nl-btn-neon"
                  >
                    View token
                  </Link>
                  <button onClick={() => setSelected(null)} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 border border-white/10 hover:bg-white/5">
                    Close
                  </button>
                </div>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
