'use client';

import { useEffect, useState } from 'react';
import { Loader2, Fuel, RefreshCw } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface GasData {
  chain: string;
  currentGwei: number | null;
  hourly: Array<{ hourUtc: number; avgGwei: number | null; samples: number }>;
  cheapestHoursUtc: number[];
  recommendation: 'now-is-good' | 'wait' | 'collecting';
  sampleCount: number;
}

const CHAINS = ['ethereum', 'base', 'arbitrum', 'polygon'];

function hourLabel(h: number): string {
  // Convert UTC hour to the viewer's local hour for the label.
  const local = new Date(Date.UTC(2020, 0, 1, h)).getHours();
  return `${String(local).padStart(2, '0')}:00`;
}

export default function GasTimingPage() {
  const [chain, setChain] = useState('ethereum');
  const [data, setData] = useState<GasData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (c: string) => {
    setLoading(true);
    fetch(`/api/tools/gas-timing?chain=${c}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(chain); }, [chain]);

  const maxAvg = data ? Math.max(...data.hourly.map((h) => h.avgGwei ?? 0), 1) : 1;

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-lg font-bold flex items-center gap-2"><Fuel className="w-5 h-5 text-[#0066FF]" /> Smart Gas Timing</h1>
        </div>
        <button onClick={() => load(chain)} className="p-2 rounded-lg hover:bg-white/5"><RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <p className="text-xs text-slate-400 mb-3">Cheapest times to transact, learned from real sampled gas prices. Times shown in your local timezone.</p>

      <div className="flex gap-1.5 mb-4">
        {CHAINS.map((c) => (
          <button key={c} onClick={() => setChain(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${chain === c ? 'bg-[#0066FF]/20 text-[#8FA3FF] border border-[#0066FF]/40' : 'bg-white/[0.04] text-slate-400 border border-white/10'}`}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
      ) : data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="nl-glass rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Gas now</div>
              <div className="text-2xl font-bold">{data.currentGwei != null ? `${data.currentGwei} gwei` : '—'}</div>
            </div>
            <div className="nl-glass rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Right now</div>
              <div className={`text-lg font-bold ${data.recommendation === 'now-is-good' ? 'text-[#10B981]' : data.recommendation === 'wait' ? 'text-[#F59E0B]' : 'text-slate-400'}`}>
                {data.recommendation === 'now-is-good' ? 'Good time ✓' : data.recommendation === 'wait' ? 'Above average' : 'Collecting…'}
              </div>
            </div>
          </div>

          {data.recommendation === 'collecting' ? (
            <div className="nl-glass rounded-xl p-5 text-center text-sm text-slate-400">
              Building the gas-price history. Cheap-hour patterns appear once enough real samples are collected (about a day of sampling). {data.sampleCount} samples so far.
            </div>
          ) : (
            <>
              <div className="nl-glass rounded-xl p-4">
                <div className="text-xs font-semibold mb-1">Cheapest hours (your time)</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.cheapestHoursUtc.map((h) => (
                    <span key={h} className="px-2 py-1 rounded-lg bg-[#10B981]/15 text-[#10B981] text-xs font-semibold">{hourLabel(h)}</span>
                  ))}
                </div>
              </div>
              <div className="nl-glass rounded-xl p-4">
                <div className="text-xs font-semibold mb-3">Average gas by hour</div>
                <div className="space-y-1">
                  {data.hourly.map((h) => (
                    <div key={h.hourUtc} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-10 text-right">{hourLabel(h.hourUtc)}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        {h.avgGwei != null && <div className="h-full rounded-full bg-[#0066FF]" style={{ width: `${(h.avgGwei / maxAvg) * 100}%` }} />}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 w-12 text-right">{h.avgGwei != null ? `${h.avgGwei}` : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500 py-12">Gas data unavailable.</p>
      )}
    </div>
  );
}
