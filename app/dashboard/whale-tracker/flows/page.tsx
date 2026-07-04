'use client';

// Smart Money Flows — the accumulation/distribution board: which tokens the
// tracked whale directory is net-buying vs net-selling right now, ranked by the
// size of the move. Real aggregation over whale_activity; stables/majors
// demoted as noise by default. Nansen's flagship "Smart Money" signal, but with
// per-token buy/sell split and honest data.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp, TrendingDown, Users, RefreshCw, Waves } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { smartMoneyFlowsHowItWorks } from '@/lib/howItWorks/content/smart-money-flows';

interface Flow {
  symbol: string; tokenAddress: string | null; chain: string;
  inflow: number; outflow: number; net: number; whales: number;
  buyCount: number; sellCount: number; buyShare: number;
  direction: 'accumulating' | 'distributing';
}
interface FlowResult { window: string; chain: string; includeNoise: boolean; flows: Flow[]; generatedAt: string }

const WINDOWS: Array<{ id: string; label: string }> = [
  { id: '24h', label: '24h' }, { id: '7d', label: '7d' }, { id: '30d', label: '30d' },
];
const CHAINS: Array<{ id: string; label: string }> = [
  { id: '', label: 'All chains' }, { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' }, { id: 'base', label: 'Base' }, { id: 'bsc', label: 'BSC' },
  { id: 'arbitrum', label: 'Arbitrum' }, { id: 'optimism', label: 'Optimism' }, { id: 'polygon', label: 'Polygon' }, { id: 'avalanche', label: 'Avalanche' },
];

function fmtUsd(n: number): string {
  const s = n < 0 ? '-' : ''; const abs = Math.abs(n);
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(abs)}`;
}

export default function SmartMoneyFlowsPage() {
  const [win, setWin] = useState('7d');
  const [chain, setChain] = useState('');
  const [includeNoise, setIncludeNoise] = useState(false);
  const [result, setResult] = useState<FlowResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ window: win });
      if (chain) params.set('chain', chain);
      if (includeNoise) params.set('includeNoise', '1');
      const res = await fetch(`/api/whale-tracker/flows?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Flows unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, [win, chain, includeNoise]);

  useEffect(() => { load(); }, [load]);

  const flows = result?.flows ?? [];
  const maxNet = Math.max(1, ...flows.map((f) => Math.abs(f.net)));

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/whale-tracker" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Waves className="w-4 h-4 text-[#00C8FF]" /> Smart Money Flows</span>
        <HowItWorksButton content={smartMoneyFlowsHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">What smart money is accumulating</h1>
        <p className="text-slate-400 text-sm mt-1">Net buying vs selling across the tracked whale directory — ranked by size.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 nl-glass rounded-lg p-1">
          {WINDOWS.map((w) => (
            <button key={w.id} onClick={() => setWin(w.id)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${win === w.id ? 'bg-[#0066FF] text-white' : 'text-slate-400 hover:text-white'}`}>{w.label}</button>
          ))}
        </div>
        <select value={chain} onChange={(e) => setChain(e.target.value)}
          className="nl-glass rounded-lg px-3 py-1.5 text-xs bg-transparent text-slate-300 focus:outline-none">
          {CHAINS.map((c) => <option key={c.id} value={c.id} className="bg-[#0b1020]">{c.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={includeNoise} onChange={(e) => setIncludeNoise(e.target.checked)} className="accent-[#0066FF]" />
          Show stables/majors
        </label>
        <button onClick={load} className="ms-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && !result && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && flows.length === 0 && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No qualifying flows in this window. Try a longer window or include stables/majors.</div>
      )}

      <div className="space-y-2">
        {flows.map((f) => {
          const acc = f.direction === 'accumulating';
          const barPct = Math.max(4, Math.round((Math.abs(f.net) / maxNet) * 100));
          return (
            <Link key={`${f.symbol}-${f.chain}`} href={`/dashboard/whale-tracker/token?q=${encodeURIComponent(f.tokenAddress || f.symbol)}`} className="block nl-card rounded-xl p-3 hover:border-[#0066FF]/40 transition-colors">
              <div className="flex items-center gap-3">
                <ChainLogo chain={f.chain} className="w-5 h-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{f.symbol}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Users className="w-3 h-3" />{f.whales}</span>
                  </div>
                  {/* Buy/sell split bar */}
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden bg-[#FF1744]/30 flex">
                    <div className="h-full bg-[#10B981]" style={{ width: `${Math.round(f.buyShare * 100)}%` }} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                    <span className="text-[#10B981]">▲ {fmtUsd(f.inflow)} in</span>
                    <span className="text-[#FF1744]">▼ {fmtUsd(f.outflow)} out</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold inline-flex items-center gap-1 ${acc ? 'text-[#10B981]' : 'text-[#FF1744]'}`}>
                    {acc ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {fmtUsd(f.net)}
                  </div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">{acc ? 'net in' : 'net out'}</div>
                </div>
              </div>
              {/* Rank bar */}
              <div className="mt-2 h-0.5 rounded-full bg-white/[0.04]">
                <div className={`h-full rounded-full ${acc ? 'bg-[#10B981]/60' : 'bg-[#FF1744]/60'}`} style={{ width: `${barPct}%` }} />
              </div>
            </Link>
          );
        })}
      </div>

      {result && flows.length > 0 && (
        <p className="text-[10px] text-slate-600 text-center mt-4">Aggregated from real whale activity · {result.window} window · updated {new Date(result.generatedAt).toLocaleTimeString()}</p>
      )}
    </div>
  );
}
