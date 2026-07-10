'use client';

// Launch Radar — the freshest token launches that clear a real quality bar
// (genuine liquidity + actual trading), so the shortlist worth watching rises
// out of thousands of new pairs. Real data from the sniper_feed_tokens feed;
// only populated fields shown (no fabricated safety score).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Rocket, Droplets, Activity, Flame, Clock, RefreshCw, ScanSearch, Globe } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { launchRadarHowItWorks } from '@/lib/howItWorks/content/launch-radar';

interface LaunchToken {
  chain: string; tokenAddress: string; pairAddress: string | null; symbol: string | null; name: string | null;
  logoUrl: string | null; launchpad: string | null; dex: string | null;
  priceUsd: number | null; marketCapUsd: number | null; liquidityUsd: number; volume24hUsd: number;
  txns24h: number; priceChange24h: number | null; turnover: number; hasSocial: boolean; firstSeenAt: string;
}
interface Result { window: string; chain: string; sort: string; tokens: LaunchToken[]; generatedAt: string }

const WINDOWS = [{ id: '6h', label: '6h' }, { id: '24h', label: '24h' }, { id: '3d', label: '3d' }];
const SORTS = [{ id: 'volume', label: 'Top volume' }, { id: 'newest', label: 'Newest' }, { id: 'liquidity', label: 'Most liquid' }];
const CHAINS = [
  { id: '', label: 'All chains' }, { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' }, { id: 'base', label: 'Base' }, { id: 'bsc', label: 'BSC' },
  { id: 'arbitrum', label: 'Arbitrum' }, { id: 'optimism', label: 'Optimism' }, { id: 'polygon', label: 'Polygon' }, { id: 'avalanche', label: 'Avalanche' },
];

function short(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(n: number | null): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${Math.round(abs)}`;
}
function ageOf(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export default function LaunchRadarPage() {
  const [win, setWin] = useState('24h');
  const [sort, setSort] = useState('volume');
  const [chain, setChain] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ window: win, sort });
      if (chain) params.set('chain', chain);
      const res = await fetch(`/api/sniper/launch-radar?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Radar unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, [win, sort, chain]);

  useEffect(() => { load(); }, [load]);

  const tokens = result?.tokens ?? [];

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/sniper" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Rocket className="w-4 h-4 text-[#00C8FF]" /> Launch Radar</span>
        <HowItWorksButton content={launchRadarHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">New launches worth watching</h1>
        <p className="text-slate-400 text-sm mt-1">The freshest tokens that clear a real liquidity + activity bar: the shortlist, not the noise.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 nl-glass rounded-lg p-1">
          {WINDOWS.map((w) => (
            <button key={w.id} onClick={() => setWin(w.id)} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${win === w.id ? 'bg-[#0066FF] text-white' : 'text-slate-400 hover:text-white'}`}>{w.label}</button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="nl-glass rounded-lg px-3 py-1.5 text-xs bg-transparent text-slate-300 focus:outline-none">
          {SORTS.map((s) => <option key={s.id} value={s.id} className="bg-[#0b1020]">{s.label}</option>)}
        </select>
        <select value={chain} onChange={(e) => setChain(e.target.value)} className="nl-glass rounded-lg px-3 py-1.5 text-xs bg-transparent text-slate-300 focus:outline-none">
          {CHAINS.map((c) => <option key={c.id} value={c.id} className="bg-[#0b1020]">{c.label}</option>)}
        </select>
        <button onClick={load} className="ms-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && !result && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}
      {!loading && tokens.length === 0 && <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No launches clear the quality bar in this window. Try a longer window or another chain.</div>}

      <div className="space-y-2">
        {tokens.map((t) => {
          const hot = t.turnover >= 1; // traded its whole liquidity in 24h+
          const up = (t.priceChange24h ?? 0) >= 0;
          return (
            <div key={`${t.tokenAddress}-${t.chain}`} className="nl-card rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <ChainLogo chain={t.chain} className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{t.symbol || short(t.tokenAddress)}</span>
                    {hot && <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF1744]/15 text-[#FF5A7A] font-semibold"><Flame className="w-2.5 h-2.5" />HOT</span>}
                    {t.hasSocial && <Globe className="w-3 h-3 text-[#00C8FF]" />}
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500"><Clock className="w-3 h-3" />{ageOf(t.firstSeenAt)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-2 mt-0.5">
                    <span className="inline-flex items-center gap-0.5"><Droplets className="w-3 h-3" />{fmtUsd(t.liquidityUsd)} liq</span>
                    <span className="inline-flex items-center gap-0.5"><Activity className="w-3 h-3" />{t.txns24h.toLocaleString()} txns</span>
                    {t.launchpad && <span>· {t.launchpad}</span>}
                    {t.dex && <span>· {t.dex}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">{fmtUsd(t.volume24hUsd)}</div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">vol 24h</div>
                  {t.priceChange24h != null && (
                    <div className={`text-[10px] font-semibold ${up ? 'text-[#10B981]' : 'text-[#FF1744]'}`}>{up ? '+' : ''}{t.priceChange24h.toFixed(1)}%</div>
                  )}
                </div>
                <Link href={`/dashboard/token-xray?q=${encodeURIComponent(t.tokenAddress)}`} title="Token X-Ray" className="p-1.5 rounded-lg text-slate-500 hover:text-[#00C8FF] hover:bg-white/[0.06] shrink-0"><ScanSearch className="w-4 h-4" /></Link>
              </div>
            </div>
          );
        })}
      </div>

      {result && tokens.length > 0 && (
        <p className="text-[10px] text-slate-600 text-center mt-4">Live new-pair feed · liquidity ≥ $5K + real trading · updated {new Date(result.generatedAt).toLocaleTimeString()}</p>
      )}
    </div>
  );
}
