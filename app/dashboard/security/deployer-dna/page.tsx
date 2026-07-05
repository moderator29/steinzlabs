'use client';

import { useState } from 'react';
import { Search, Loader2, Fingerprint, AlertTriangle, Skull, ShieldCheck } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

type Band = 'pristine' | 'clean' | 'caution' | 'dangerous' | 'serial-rugger';

interface Notable {
  tokenAddress: string;
  symbol: string;
  peakMcapUsd: number;
  currentMcapUsd: number;
  flaggedAsRug: boolean;
}
interface Dna {
  available: boolean;
  reason?: string;
  cached?: boolean;
  deployer?: string;
  trustScore?: number;
  band?: Band;
  totalDeployed?: number;
  rugged?: number;
  flagged?: number;
  fastDeaths?: number;
  active?: number;
  notable?: Notable[];
}

const CHAINS = [
  { slug: 'ethereum', label: 'Ethereum' },
  { slug: 'base', label: 'Base' },
  { slug: 'bsc', label: 'BSC' },
  { slug: 'arbitrum', label: 'Arbitrum' },
  { slug: 'polygon', label: 'Polygon' },
];

const BAND_META: Record<Band, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  pristine: { label: 'Pristine', color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: ShieldCheck },
  clean: { label: 'Clean', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: ShieldCheck },
  caution: { label: 'Caution', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: AlertTriangle },
  dangerous: { label: 'Dangerous', color: '#F97316', bg: 'rgba(249,115,22,0.12)', icon: AlertTriangle },
  'serial-rugger': { label: 'Serial Rugger', color: '#EF4444', bg: 'rgba(239,68,68,0.14)', icon: Skull },
};

function short(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function mcap(n: number): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

export default function DeployerDnaPage() {
  const [chain, setChain] = useState('ethereum');
  const [addr, setAddr] = useState('');
  const [data, setData] = useState<Dna | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    const a = addr.trim();
    if (a.length < 8) { setErr('Enter a deployer wallet or token address.'); return; }
    setLoading(true); setErr(null); setData(null);
    try {
      // A 0x…40 value could be either a wallet or a token; we send it as
      // `address` (wallet-first). If it's actually a token the API resolves it.
      const res = await fetch(`/api/security/deployer-dna?chain=${chain}&address=${encodeURIComponent(a)}`);
      if (!res.ok) { setErr('Lookup failed.'); return; }
      setData(await res.json());
    } catch { setErr('Network error.'); }
    finally { setLoading(false); }
  };

  const band = data?.band ? BAND_META[data.band] : null;
  const BandIcon = band?.icon ?? ShieldCheck;

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton />
        <h1 className="text-lg font-bold flex items-center gap-2"><Fingerprint className="w-5 h-5 text-[#0066FF]" /> Deployer DNA</h1>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        The rap sheet for a token creator. Paste a <span className="text-white">deployer wallet</span> (or a token — we resolve its creator) and see every token they&rsquo;ve shipped, how many died, and the fast-death pattern that fingerprints a serial rugger. Real on-chain history — no invented verdicts.
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
            placeholder="Deployer wallet or token address (0x…)" className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600" />
        </div>
        <button onClick={run} disabled={loading} className="px-4 rounded-xl bg-[#0066FF] text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan'}
        </button>
      </div>

      {err && <div className="nl-glass rounded-xl p-4 text-sm text-amber-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {data && !data.available && (
        <div className="nl-glass rounded-xl p-5 text-center text-sm text-slate-400">{data.reason || 'No deployer history available.'}</div>
      )}

      {data && data.available && band && (
        <div className="space-y-3">
          <div className="nl-glass rounded-xl p-5" style={{ background: band.bg }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Deployer verdict</div>
                <div className="flex items-center gap-2 text-2xl font-bold" style={{ color: band.color }}>
                  <BandIcon className="w-6 h-6" /> {band.label}
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1">{short(data.deployer || '')}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Trust</div>
                <div className="text-3xl font-bold" style={{ color: band.color }}>{data.trustScore ?? '—'}</div>
                <div className="text-[10px] text-slate-500">/ 100</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="nl-glass rounded-xl p-3 text-center"><div className="text-lg font-bold">{data.totalDeployed ?? 0}</div><div className="text-[10px] text-slate-500">Deployed</div></div>
            <div className="nl-glass rounded-xl p-3 text-center"><div className="text-lg font-bold text-[#EF4444]">{data.rugged ?? 0}</div><div className="text-[10px] text-slate-500">Dead</div></div>
            <div className="nl-glass rounded-xl p-3 text-center"><div className="text-lg font-bold text-[#F59E0B]">{data.fastDeaths ?? 0}</div><div className="text-[10px] text-slate-500">Fast deaths</div></div>
            <div className="nl-glass rounded-xl p-3 text-center"><div className="text-lg font-bold text-[#10B981]">{data.active ?? 0}</div><div className="text-[10px] text-slate-500">Alive</div></div>
          </div>

          {data.fastDeaths != null && data.fastDeaths >= 2 && (
            <div className="rounded-xl p-3 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center gap-2">
              <Skull className="w-4 h-4 shrink-0" /> {data.fastDeaths} of this deployer&rsquo;s tokens died within 7 days of launch — the canonical serial-rug signature.
            </div>
          )}

          {data.notable && data.notable.length > 0 ? (
            <div className="nl-glass rounded-xl p-4">
              <div className="text-xs font-semibold mb-2">Notable casualties</div>
              <div className="space-y-1.5">
                {data.notable.map((t) => (
                  <div key={t.tokenAddress} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{t.symbol || short(t.tokenAddress)}{t.flaggedAsRug && <span className="ml-1.5 text-[#EF4444]">⚑</span>}</span>
                    <span className="font-mono text-slate-500">peak {mcap(t.peakMcapUsd)} → {mcap(t.currentMcapUsd)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="nl-glass rounded-xl p-4 text-center text-xs text-slate-500">
              No dead or flagged tokens found in this deployer&rsquo;s history.
            </div>
          )}
          {data.cached && <p className="text-[10px] text-slate-600 text-center">Cached result (refreshes every 24h).</p>}
        </div>
      )}
    </div>
  );
}
