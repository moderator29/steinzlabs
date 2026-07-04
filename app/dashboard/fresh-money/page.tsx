'use client';

// Fresh Money Detector — the wallet-age composition of each token's buyers. A
// token bought overwhelmingly by brand-new wallets is a farmed/sybil/hype
// signature; buying dominated by old wallets is seasoned conviction. Real data
// from dune_token_age_buyers. Nobody exposes buyer-age composition to retail.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sprout, TreePine, ShieldAlert, Users, RefreshCw } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { freshMoneyHowItWorks } from '@/lib/howItWorks/content/fresh-money';

type Grade = 'fresh' | 'mixed' | 'seasoned';
interface AgeToken {
  tokenAddress: string; chain: string; symbol: string | null; totalBuyers: number;
  ageMix: { under7d: number; d7to30: number; d30to90: number; over90d: number };
  freshPct: number; seasonedPct: number; grade: Grade;
}
interface Result { chain: string; sort: string; tokens: AgeToken[]; generatedAt: string }

const CHAINS = [
  { id: '', label: 'All chains' }, { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' }, { id: 'base', label: 'Base' }, { id: 'bsc', label: 'BSC' },
  { id: 'arbitrum', label: 'Arbitrum' }, { id: 'optimism', label: 'Optimism' }, { id: 'polygon', label: 'Polygon' }, { id: 'avalanche', label: 'Avalanche' },
];
const GRADE_META: Record<Grade, { label: string; color: string; Icon: typeof Sprout }> = {
  fresh: { label: 'Fresh-wallet heavy', color: '#FF1744', Icon: ShieldAlert },
  mixed: { label: 'Mixed ages', color: '#FFD86B', Icon: Sprout },
  seasoned: { label: 'Seasoned money', color: '#10B981', Icon: TreePine },
};
// Age band colors — fresh (risky) red → old (trusted) green.
const BAND = [
  { key: 'under7d' as const, color: '#FF1744', label: '<7d' },
  { key: 'd7to30' as const, color: '#FF8A65', label: '7–30d' },
  { key: 'd30to90' as const, color: '#FFD86B', label: '30–90d' },
  { key: 'over90d' as const, color: '#10B981', label: '90d+' },
];

function short(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }

export default function FreshMoneyPage() {
  const [chain, setChain] = useState('');
  const [sort, setSort] = useState<'fresh' | 'buyers'>('fresh');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ sort });
      if (chain) params.set('chain', chain);
      const res = await fetch(`/api/token-intel/buyer-age?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Detector unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, [chain, sort]);

  useEffect(() => { load(); }, [load]);

  const tokens = result?.tokens ?? [];

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Sprout className="w-4 h-4 text-[#00C8FF]" /> Fresh Money Detector</span>
        <HowItWorksButton content={freshMoneyHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Is this real demand — or farmed wallets?</h1>
        <p className="text-slate-400 text-sm mt-1">The wallet-age mix of each token’s buyers. Brand-new wallets buying = farm/hype risk.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 nl-glass rounded-lg p-1">
          <button onClick={() => setSort('fresh')} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${sort === 'fresh' ? 'bg-[#0066FF] text-white' : 'text-slate-400 hover:text-white'}`}>Most fresh</button>
          <button onClick={() => setSort('buyers')} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${sort === 'buyers' ? 'bg-[#0066FF] text-white' : 'text-slate-400 hover:text-white'}`}>Most buyers</button>
        </div>
        <select value={chain} onChange={(e) => setChain(e.target.value)} className="nl-glass rounded-lg px-3 py-1.5 text-xs bg-transparent text-slate-300 focus:outline-none">
          {CHAINS.map((c) => <option key={c.id} value={c.id} className="bg-[#0b1020]">{c.label}</option>)}
        </select>
        <button onClick={load} className="ms-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-slate-500 flex-wrap">
        {BAND.map((b) => (
          <span key={b.key} className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: b.color }} />{b.label} old</span>
        ))}
      </div>

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && !result && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}
      {!loading && tokens.length === 0 && <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No tokens with a readable buyer base in this view.</div>}

      <div className="space-y-2">
        {tokens.map((t) => {
          const g = GRADE_META[t.grade];
          return (
            <div key={`${t.tokenAddress}-${t.chain}`} className="nl-card rounded-xl p-3">
              <div className="flex items-center gap-3 mb-2">
                <ChainLogo chain={t.chain} className="w-5 h-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{t.symbol || short(t.tokenAddress)}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Users className="w-3 h-3" />{t.totalBuyers.toLocaleString()}</span>
                  </div>
                  <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px]" style={{ color: g.color }}>
                    <g.Icon className="w-3.5 h-3.5" />
                    <span className="font-semibold">{g.label}</span>
                    <span className="text-slate-500">· {Math.round(t.freshPct)}% new wallets</span>
                  </div>
                </div>
              </div>
              {/* Age composition bar */}
              <div className="h-2 rounded-full overflow-hidden flex bg-white/[0.04]">
                {BAND.map((b) => {
                  const pct = t.ageMix[b.key];
                  return pct > 0 ? <div key={b.key} className="h-full" style={{ width: `${pct}%`, background: b.color }} title={`${b.label}: ${Math.round(pct)}%`} /> : null;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {result && tokens.length > 0 && (
        <p className="text-[10px] text-slate-600 text-center mt-4">Dune token-age buyer composition · updated {new Date(result.generatedAt).toLocaleTimeString()}</p>
      )}
    </div>
  );
}
