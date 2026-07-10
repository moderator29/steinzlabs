'use client';

import { useState } from 'react';
import { Search, Loader2, Receipt, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface TokenRow {
  token: string;
  symbol: string | null;
  realizedUsd: number;
  costBasisUsd: number;
  proceedsUsd: number;
  winRate: number;
  closedLots: number;
  avgHoldDays: number;
  openAmount: number;
  openCostBasisUsd: number;
  avgEntryUsd: number | null;
  currentPriceUsd: number | null;
  currentValueUsd: number | null;
  unrealizedUsd: number | null;
}
interface Result {
  available: boolean;
  reason?: string;
  windowDays?: number;
  totalRealizedUsd?: number;
  totalCostBasisUsd?: number;
  totalProceedsUsd?: number;
  closedLots?: number;
  winRate?: number;
  averageHoldDays?: number;
  totalUnrealizedUsd?: number | null;
  tokens?: TokenRow[];
}

const CHAINS = [
  { slug: 'solana', label: 'Solana' },
  { slug: 'ethereum', label: 'Ethereum' },
  { slug: 'base', label: 'Base' },
  { slug: 'bsc', label: 'BSC' },
  { slug: 'arbitrum', label: 'Arbitrum' },
];

function signedUsd(n: number | null): string {
  if (n == null) return '—';
  const s = n < 0 ? '-' : '+';
  const a = Math.abs(n);
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(a)}`;
}
function usd(n: number | null | undefined): string {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(a / 1e3).toFixed(1)}K`;
  return `$${Math.round(a)}`;
}
function short(a: string): string { return a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-3)}` : a; }
function pnlColor(n: number | null): string { return n == null ? 'text-slate-400' : n > 0 ? 'text-[#10B981]' : n < 0 ? 'text-[#EF4444]' : 'text-slate-300'; }

export default function CostBasisPage() {
  const [chain, setChain] = useState('solana');
  const [addr, setAddr] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    const a = addr.trim();
    if (a.length < 8) { setErr('Enter a wallet address.'); return; }
    setLoading(true); setErr(null); setData(null);
    try {
      const res = await fetch(`/api/portfolio/cost-basis?chain=${chain}&address=${encodeURIComponent(a)}`);
      if (!res.ok) { setErr('Lookup failed.'); return; }
      setData(await res.json());
    } catch { setErr('Network error.'); }
    finally { setLoading(false); }
  };

  const realized = data?.totalRealizedUsd ?? 0;

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton />
        <h1 className="text-lg font-bold flex items-center gap-2"><Receipt className="w-5 h-5 text-[#0066FF]" /> Cost Basis &amp; PnL</h1>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        The honest tax-style ledger for any wallet. Realized PnL is FIFO-matched from <span className="text-white">real DEX trades priced at trade time</span>, never guessed from today&rsquo;s price. Open positions show your real average entry and unrealized PnL where a live price exists.
      </p>

      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {CHAINS.map((c) => (
          <button key={c.slug} onClick={() => setChain(c.slug)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${chain === c.slug ? 'bg-[#0066FF]/20 text-[#8FA3FF] border border-[#0066FF]/40' : 'bg-white/[0.04] text-slate-400 border border-white/10'}`}>{c.label}</button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-[#0A0E27] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0066FF]/40">
          <Search className="w-4 h-4 text-gray-600 shrink-0" />
          <input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Wallet address" className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600" />
        </div>
        <button onClick={run} disabled={loading} className="px-4 rounded-xl bg-[#0066FF] text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
        </button>
      </div>

      {err && <div className="nl-glass rounded-xl p-4 text-sm text-amber-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {data && !data.available && (
        <div className="nl-glass rounded-xl p-5 text-center text-sm text-slate-400">{data.reason || 'No cost-basis data available.'}</div>
      )}

      {data && data.available && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="nl-glass rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Realized PnL ({data.windowDays}d)</div>
              <div className={`text-2xl font-bold flex items-center gap-1 ${pnlColor(realized)}`}>
                {realized > 0 ? <TrendingUp className="w-5 h-5" /> : realized < 0 ? <TrendingDown className="w-5 h-5" /> : null}
                {signedUsd(realized)}
              </div>
            </div>
            <div className="nl-glass rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Unrealized (open)</div>
              <div className={`text-2xl font-bold ${pnlColor(data.totalUnrealizedUsd ?? null)}`}>{signedUsd(data.totalUnrealizedUsd ?? null)}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="nl-glass rounded-xl p-3 text-center"><div className="text-base font-bold">{data.winRate}%</div><div className="text-[10px] text-slate-500">Win rate</div></div>
            <div className="nl-glass rounded-xl p-3 text-center"><div className="text-base font-bold">{data.closedLots}</div><div className="text-[10px] text-slate-500">Closed lots</div></div>
            <div className="nl-glass rounded-xl p-3 text-center"><div className="text-base font-bold">{data.averageHoldDays}d</div><div className="text-[10px] text-slate-500">Avg hold</div></div>
          </div>

          <div className="nl-glass rounded-xl p-4">
            <div className="text-xs font-semibold mb-2">Per-token ledger</div>
            <div className="space-y-2">
              {(data.tokens ?? []).slice(0, 30).map((t) => (
                <div key={t.token} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t.symbol || short(t.token)}</span>
                    <span className={`text-sm font-bold ${pnlColor(t.realizedUsd)}`}>{signedUsd(t.realizedUsd)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>cost {usd(t.costBasisUsd)} · out {usd(t.proceedsUsd)}{t.closedLots > 0 ? ` · ${t.winRate}% win` : ''}</span>
                    {t.openAmount > 0 && (
                      <span className={pnlColor(t.unrealizedUsd)}>
                        holding {usd(t.openCostBasisUsd)}{t.unrealizedUsd != null ? ` · unreal ${signedUsd(t.unrealizedUsd)}` : ' · unreal —'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-600">FIFO cost-basis (the IRS/Koinly default). Realized from real trade-time USD. Unrealized shown only for open tokens with a live price; others show —.</p>
        </div>
      )}
    </div>
  );
}
