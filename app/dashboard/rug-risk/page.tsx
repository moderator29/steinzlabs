'use client';

import { useState } from 'react';
import { Search, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

type Band = 'low' | 'elevated' | 'high' | 'severe';
interface Factor { key: string; label: string; score: number; band: Band; detail: string }
interface Result {
  available: boolean;
  reason?: string;
  symbol?: string | null;
  composite?: number;
  band?: Band;
  confidence?: 'low' | 'medium' | 'high';
  factorsUsed?: number;
  factors?: Factor[];
  note?: string;
}

const CHAINS = [
  { slug: 'ethereum', label: 'Ethereum' },
  { slug: 'solana', label: 'Solana' },
  { slug: 'base', label: 'Base' },
  { slug: 'bsc', label: 'BSC' },
  { slug: 'arbitrum', label: 'Arbitrum' },
];

const BAND_META: Record<Band, { label: string; color: string }> = {
  low: { label: 'Low', color: '#10B981' },
  elevated: { label: 'Elevated', color: '#F59E0B' },
  high: { label: 'High', color: '#F97316' },
  severe: { label: 'Severe', color: '#EF4444' },
};

export default function RugRiskPage() {
  const [chain, setChain] = useState('ethereum');
  const [token, setToken] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    const t = token.trim();
    if (t.length < 8) { setErr('Enter a token contract address.'); return; }
    setLoading(true); setErr(null); setData(null);
    try {
      const res = await fetch(`/api/security/rug-risk?chain=${chain}&token=${encodeURIComponent(t)}`);
      if (!res.ok) { setErr('Lookup failed.'); return; }
      setData(await res.json());
    } catch { setErr('Network error.'); }
    finally { setLoading(false); }
  };

  const meta = data?.band ? BAND_META[data.band] : null;

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton />
        <h1 className="text-lg font-bold flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-[#0066FF]" /> Rug-Risk Composite</h1>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        One honest read of a token&rsquo;s live rug-<span className="text-white">enabling</span> conditions: liquidity fragility, how much real liquidity backs the FDV, and the deployer&rsquo;s track record. Not a timing prediction: we score present, measurable conditions and show every factor. Unavailable factors show, and lower the confidence.
      </p>

      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {CHAINS.map((c) => (
          <button key={c.slug} onClick={() => setChain(c.slug)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${chain === c.slug ? 'bg-[#0066FF]/20 text-[#8FA3FF] border border-[#0066FF]/40' : 'bg-white/[0.04] text-slate-400 border border-white/10'}`}>{c.label}</button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-[#0A0E27] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0066FF]/40">
          <Search className="w-4 h-4 text-gray-600 shrink-0" />
          <input value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Token contract address" className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600" />
        </div>
        <button onClick={run} disabled={loading} className="px-4 rounded-xl bg-[#0066FF] text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan'}
        </button>
      </div>

      {err && <div className="nl-glass rounded-xl p-4 text-sm text-amber-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {data && !data.available && (
        <div className="nl-glass rounded-xl p-5 text-center text-sm text-slate-400">{data.reason || 'No rug-risk data available.'}</div>
      )}

      {data && data.available && meta && (
        <div className="space-y-3">
          <div className="nl-glass rounded-xl p-5 text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Rug-risk composite {data.symbol ? `· ${data.symbol}` : ''}</div>
            <div className="text-5xl font-bold" style={{ color: meta.color }}>{data.composite}</div>
            <div className="text-sm font-semibold mt-1" style={{ color: meta.color }}>{meta.label} risk</div>
            <div className="text-[10px] text-slate-500 mt-1">{data.confidence} confidence · {data.factorsUsed}/3 factors</div>
          </div>

          <div className="space-y-2">
            {(data.factors ?? []).map((f) => {
              const fm = BAND_META[f.band];
              return (
                <div key={f.key} className="nl-glass rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold">{f.label}</span>
                    <span className="text-xs font-bold" style={{ color: fm.color }}>{f.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
                    <div className="h-full rounded-full" style={{ width: `${f.score}%`, background: fm.color }} />
                  </div>
                  <div className="text-[10px] text-slate-500">{f.detail}</div>
                </div>
              );
            })}
          </div>
          {data.note && <p className="text-[10px] text-slate-600">{data.note}</p>}
        </div>
      )}
    </div>
  );
}
