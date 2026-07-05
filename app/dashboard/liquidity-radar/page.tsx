'use client';

import { useState } from 'react';
import { Search, Loader2, Droplets, AlertTriangle, ExternalLink } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface Depth {
  token: string;
  chain: string | null;
  symbol: string | null;
  priceUsd: number | null;
  totalLiquidityUsd: number;
  deepestPool: { dex: string; liquidityUsd: number; url: string | null } | null;
  poolCount: number;
  impact: Array<{ sizeUsd: number; impactPct: number }>;
  safeSizeUsd: number | null;
  model: string;
}

const CHAINS = ['', 'ethereum', 'solana', 'bsc', 'base', 'arbitrum', 'polygon', 'avalanche'];

function usd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function impactColor(pct: number): string {
  if (pct < 1) return '#10B981';
  if (pct < 3) return '#F59E0B';
  if (pct < 8) return '#F97316';
  return '#EF4444';
}

export default function LiquidityRadarPage() {
  const [token, setToken] = useState('');
  const [chain, setChain] = useState('');
  const [data, setData] = useState<Depth | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    const t = token.trim();
    if (!t) return;
    setLoading(true); setErr(null); setData(null);
    try {
      const res = await fetch(`/api/swap/liquidity-depth?token=${encodeURIComponent(t)}&chain=${encodeURIComponent(chain)}`);
      if (!res.ok) { setErr(res.status === 404 ? 'No liquidity found for this token on that chain.' : 'Lookup failed.'); return; }
      setData(await res.json());
    } catch { setErr('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton />
        <h1 className="text-lg font-bold flex items-center gap-2"><Droplets className="w-5 h-5 text-[#0066FF]" /> Liquidity-Cliff Radar</h1>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Real pool depth from DexScreener + an estimated slippage curve (constant-product model). Tells you the biggest size you can trade before price impact bites — before you swap.
      </p>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-[#0A0E27] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0066FF]/40">
          <Search className="w-4 h-4 text-gray-600 shrink-0" />
          <input value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Paste a token contract address" className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600" />
        </div>
        <select value={chain} onChange={(e) => setChain(e.target.value)} className="bg-[#0A0E27] border border-white/[0.06] rounded-xl px-2 text-xs text-slate-300">
          {CHAINS.map((c) => <option key={c} value={c}>{c || 'auto'}</option>)}
        </select>
        <button onClick={run} disabled={loading} className="px-4 rounded-xl bg-[#0066FF] text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan'}
        </button>
      </div>

      {err && <div className="nl-glass rounded-xl p-4 text-sm text-amber-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="nl-glass rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Total liquidity</div>
              <div className="text-lg font-bold">{usd(data.totalLiquidityUsd)}</div>
              <div className="text-[10px] text-slate-500">{data.poolCount} pool{data.poolCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="nl-glass rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Deepest pool</div>
              <div className="text-lg font-bold">{usd(data.deepestPool?.liquidityUsd ?? null)}</div>
              <div className="text-[10px] text-slate-500 uppercase">{data.deepestPool?.dex ?? '—'}</div>
            </div>
            <div className="nl-glass rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Safe size (&lt;1%)</div>
              <div className="text-lg font-bold text-[#10B981]">{usd(data.safeSizeUsd)}</div>
              <div className="text-[10px] text-slate-500">per trade, deepest pool</div>
            </div>
          </div>

          <div className="nl-glass rounded-xl p-4">
            <div className="text-xs font-semibold mb-3">Estimated slippage by trade size <span className="text-slate-500 font-normal">(deepest pool, constant-product model)</span></div>
            <div className="space-y-2">
              {data.impact.map((row) => (
                <div key={row.sizeUsd} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-16 text-right">{usd(row.sizeUsd)}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.impactPct)}%`, background: impactColor(row.impactPct) }} />
                  </div>
                  <span className="text-xs font-mono w-14 text-right" style={{ color: impactColor(row.impactPct) }}>{row.impactPct}%</span>
                </div>
              ))}
            </div>
          </div>

          {data.deepestPool?.url && (
            <a href={data.deepestPool.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#0066FF]">
              View deepest pool on DexScreener <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <p className="text-[10px] text-slate-600">Slippage figures are a depth-based estimate, not a live quote. Your actual swap uses the 0x / Jupiter route for the exact fill.</p>
        </div>
      )}
    </div>
  );
}
