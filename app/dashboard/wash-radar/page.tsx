'use client';

// Wash Trade Radar — fuses Dune's independent smart-money token flow with its
// wash-trade authenticity score. Answers a question no retail platform does:
// is the token smart money is buying REAL, or is its volume wash-traded? Real
// data from dune_smart_money_token_flow + dune_wash_trade_score.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldAlert, ShieldQuestion, Users, RefreshCw, Radar } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { washRadarHowItWorks } from '@/lib/howItWorks/content/wash-radar';

type Grade = 'clean' | 'caution' | 'wash' | 'unknown';
interface RadarToken {
  tokenAddress: string; chain: string; symbol: string | null;
  netInflowUsd: number; uniqueWallets: number;
  washScore: number | null; flaggedPairs: number | null; grade: Grade;
}
interface RadarResult { chain: string; sort: string; includeNoise: boolean; tokens: RadarToken[]; generatedAt: string }

const CHAINS = [
  { id: '', label: 'All chains' }, { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' }, { id: 'base', label: 'Base' }, { id: 'bsc', label: 'BSC' },
];

const GRADE_META: Record<Grade, { label: string; color: string; Icon: typeof ShieldCheck }> = {
  clean: { label: 'Real volume', color: '#10B981', Icon: ShieldCheck },
  caution: { label: 'Some wash', color: '#FFD86B', Icon: ShieldAlert },
  wash: { label: 'Wash risk', color: '#FF1744', Icon: ShieldAlert },
  unknown: { label: 'Unrated', color: '#64748b', Icon: ShieldQuestion },
};

function short(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(n: number): string {
  const s = n < 0 ? '-' : ''; const abs = Math.abs(n);
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(abs)}`;
}

export default function WashRadarPage() {
  const [chain, setChain] = useState('');
  const [sort, setSort] = useState<'inflow' | 'risk'>('inflow');
  const [includeNoise, setIncludeNoise] = useState(false);
  const [result, setResult] = useState<RadarResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ sort });
      if (chain) params.set('chain', chain);
      if (includeNoise) params.set('includeNoise', '1');
      const res = await fetch(`/api/token-intel/wash-radar?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Radar unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, [chain, sort, includeNoise]);

  useEffect(() => { load(); }, [load]);

  const tokens = result?.tokens ?? [];

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Radar className="w-4 h-4 text-[#00C8FF]" /> Wash Trade Radar</span>
        <HowItWorksButton content={washRadarHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Is smart money buying real volume?</h1>
        <p className="text-slate-400 text-sm mt-1">Where smart money is flowing — graded for wash-traded (fake) volume.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 nl-glass rounded-lg p-1">
          <button onClick={() => setSort('inflow')} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${sort === 'inflow' ? 'bg-[#0066FF] text-white' : 'text-slate-400 hover:text-white'}`}>Top inflow</button>
          <button onClick={() => setSort('risk')} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${sort === 'risk' ? 'bg-[#0066FF] text-white' : 'text-slate-400 hover:text-white'}`}>Wash risk</button>
        </div>
        <select value={chain} onChange={(e) => setChain(e.target.value)} className="nl-glass rounded-lg px-3 py-1.5 text-xs bg-transparent text-slate-300 focus:outline-none">
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
      {!loading && tokens.length === 0 && <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No tokens in this view. Try another chain or include stables/majors.</div>}

      <div className="space-y-2">
        {tokens.map((t) => {
          const g = GRADE_META[t.grade];
          const acc = t.netInflowUsd >= 0;
          return (
            <div key={`${t.tokenAddress}-${t.chain}`} className="nl-card rounded-xl p-3 flex items-center gap-3">
              <ChainLogo chain={t.chain} className="w-5 h-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold truncate">{t.symbol || short(t.tokenAddress)}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Users className="w-3 h-3" />{t.uniqueWallets}</span>
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px]" style={{ color: g.color }}>
                  <g.Icon className="w-3.5 h-3.5" />
                  <span className="font-semibold">{g.label}</span>
                  {t.washScore != null && <span className="text-slate-500">· {t.washScore}/100{t.flaggedPairs ? ` · ${t.flaggedPairs} flagged pairs` : ''}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${acc ? 'text-[#10B981]' : 'text-[#FF1744]'}`}>{fmtUsd(t.netInflowUsd)}</div>
                <div className="text-[9px] uppercase tracking-wide text-slate-500">smart money {acc ? 'in' : 'out'} 24h</div>
              </div>
            </div>
          );
        })}
      </div>

      {result && tokens.length > 0 && (
        <p className="text-[10px] text-slate-600 text-center mt-4">Dune smart-money flow + wash-trade score · updated {new Date(result.generatedAt).toLocaleTimeString()}</p>
      )}
    </div>
  );
}
