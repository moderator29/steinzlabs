'use client';

// Smart Money Rotation — where whale ATTENTION is accelerating. Compares each
// token's net whale flow this window vs the prior one; the delta reveals what's
// rotating IN (often flipping from selling to buying) and OUT before it's a big
// absolute number. Real data from whale_activity via the rotation RPC.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRightLeft, TrendingUp, TrendingDown, Repeat, Users, RefreshCw } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { rotationHowItWorks } from '@/lib/howItWorks/content/rotation';

interface RotToken {
  symbol: string; chain: string; tokenAddress: string | null;
  curNet: number; prevNet: number; delta: number; whales: number;
  flipped: boolean; direction: 'in' | 'out';
}
interface Result { window: string; chain: string; rotatingIn: RotToken[]; rotatingOut: RotToken[]; generatedAt: string }

const WINDOWS = [{ id: '24h', label: '24h' }, { id: '3d', label: '3d' }, { id: '7d', label: '7d' }];
const CHAINS = [
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
function fmtSigned(n: number): string { return `${n >= 0 ? '+' : ''}${fmtUsd(n)}`; }

function RotCard({ t, dir }: { t: RotToken; dir: 'in' | 'out' }) {
  const color = dir === 'in' ? '#10B981' : '#FF1744';
  return (
    <Link href={`/dashboard/whale-tracker/token?q=${encodeURIComponent(t.tokenAddress || t.symbol)}`} className="block nl-card rounded-xl p-3 hover:border-[#0066FF]/40 transition-colors">
      <div className="flex items-center gap-2.5">
        <ChainLogo chain={t.chain} className="w-5 h-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold truncate">{t.symbol}</span>
            {t.flipped && <span className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded-full font-bold" style={{ background: `${color}20`, color }}><Repeat className="w-2.5 h-2.5" />FLIP</span>}
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500"><Users className="w-2.5 h-2.5" />{t.whales}</span>
          </div>
          <div className="text-[10px] text-slate-500 tabular-nums">{fmtSigned(t.prevNet)} <span className="text-slate-600">→</span> {fmtSigned(t.curNet)}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums" style={{ color }}>{fmtSigned(t.delta)}</div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Δ flow</div>
        </div>
      </div>
    </Link>
  );
}

export default function RotationPage() {
  const [win, setWin] = useState('3d');
  const [chain, setChain] = useState('');
  const [includeNoise, setIncludeNoise] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ window: win });
      if (chain) params.set('chain', chain);
      if (includeNoise) params.set('includeNoise', '1');
      const res = await fetch(`/api/whale-tracker/rotation?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rotation unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, [win, chain, includeNoise]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen text-white max-w-4xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/whale-tracker" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-[#00C8FF]" /> Smart Money Rotation</span>
        <HowItWorksButton content={rotationHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Where attention is rotating</h1>
        <p className="text-slate-400 text-sm mt-1">Not where smart money IS, but where it’s moving TO. Net-flow change vs the prior window.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 nl-glass rounded-lg p-1">
          {WINDOWS.map((w) => (
            <button key={w.id} onClick={() => setWin(w.id)} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${win === w.id ? 'bg-[#0066FF] text-white' : 'text-slate-400 hover:text-white'}`}>{w.label}</button>
          ))}
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

      {!loading && result && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#10B981]"><TrendingUp className="w-4 h-4" /><span className="text-sm font-semibold">Rotating in</span><span className="text-[11px] text-slate-500">accelerating buys</span></div>
            <div className="space-y-2">
              {result.rotatingIn.length === 0 && <div className="nl-glass rounded-xl p-4 text-center text-slate-500 text-xs">Nothing rotating in this window.</div>}
              {result.rotatingIn.map((t) => <RotCard key={`${t.symbol}-${t.chain}`} t={t} dir="in" />)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#FF1744]"><TrendingDown className="w-4 h-4" /><span className="text-sm font-semibold">Rotating out</span><span className="text-[11px] text-slate-500">accelerating sells</span></div>
            <div className="space-y-2">
              {result.rotatingOut.length === 0 && <div className="nl-glass rounded-xl p-4 text-center text-slate-500 text-xs">Nothing rotating out this window.</div>}
              {result.rotatingOut.map((t) => <RotCard key={`${t.symbol}-${t.chain}`} t={t} dir="out" />)}
            </div>
          </div>
        </div>
      )}

      {result && (
        <p className="text-[10px] text-slate-600 text-center mt-4">Net-flow change vs prior {result.window} · real whale activity · updated {new Date(result.generatedAt).toLocaleTimeString()}</p>
      )}
    </div>
  );
}
