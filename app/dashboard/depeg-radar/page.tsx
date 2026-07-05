'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface Peg {
  symbol: string;
  name: string;
  price: number | null;
  deviationBps: number | null;
  change24hPct: number | null;
  status: 'stable' | 'watch' | 'depeg' | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  stable: { label: 'On peg', color: '#10B981' },
  watch: { label: 'Watch', color: '#F59E0B' },
  depeg: { label: 'Depeg', color: '#EF4444' },
};

function fmtDev(bps: number | null): string {
  if (bps == null) return '—';
  const pct = bps / 100;
  return `${bps > 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

export default function DepegRadarPage() {
  const [pegs, setPegs] = useState<Peg[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/market/depeg', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPegs(Array.isArray(d?.pegs) ? d.pegs : []))
      .catch(() => setPegs([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const worst = pegs?.[0];
  const anyDepeg = pegs?.some((p) => p.status === 'depeg');

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#0066FF]" /> Depeg Radar</h1>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-white/5"><RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <p className="text-xs text-slate-400 mb-4">Live peg-deviation monitor for major USD stablecoins, measured against $1.00. Real CoinGecko prices, refreshed each minute.</p>

      {!loading && pegs && (
        <div className={`nl-glass rounded-xl p-3 mb-3 text-sm ${anyDepeg ? 'text-red-300' : worst && worst.status === 'watch' ? 'text-amber-300' : 'text-emerald-300'}`}>
          {anyDepeg ? '⚠️ A stablecoin is off peg by more than 1% — review before using it as a base pair.'
            : worst && worst.status === 'watch' ? `Slight drift: ${worst.symbol} is ${fmtDev(worst.deviationBps)} off peg.`
            : 'All monitored stablecoins are on peg.'}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
      ) : pegs && pegs.length > 0 ? (
        <div className="space-y-2">
          {pegs.map((p) => {
            const meta = p.status ? STATUS_META[p.status] : null;
            return (
              <div key={p.symbol} className="nl-glass rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs shrink-0">{p.symbol.slice(0, 4)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{p.symbol}</div>
                  <div className="text-[11px] text-slate-500 truncate">{p.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">${p.price?.toFixed(4)}</div>
                  <div className="text-[11px]" style={{ color: meta?.color }}>{fmtDev(p.deviationBps)}</div>
                </div>
                {meta && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${meta.color}1F`, color: meta.color }}>{meta.label}</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500 py-12">Price source is unavailable right now — try again shortly.</p>
      )}
    </div>
  );
}
