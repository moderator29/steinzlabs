'use client';

// Coordinated Cluster Radar — the largest coordinated wallet clusters by 24h
// volume. Each cluster is a seed address (labelled if it's a tracked whale)
// with its member count and volume. Real data from dune_cluster_aggregates.
// Seeds link to Whale DNA so you can decode who is coordinating.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Link2, Users, BadgeCheck, RefreshCw, ArrowRight } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { clusterRadarHowItWorks } from '@/lib/howItWorks/content/cluster-radar';

interface Cluster {
  seed: string; chain: string; memberCount: number; volume24hUsd: number;
  label: string | null; archetype: string | null; verified: boolean;
}
interface Result { chain: string; clusters: Cluster[]; generatedAt: string }

const CHAINS = [
  { id: '', label: 'All chains' }, { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' }, { id: 'base', label: 'Base' }, { id: 'bsc', label: 'BSC' },
  { id: 'arbitrum', label: 'Arbitrum' }, { id: 'optimism', label: 'Optimism' }, { id: 'polygon', label: 'Polygon' }, { id: 'avalanche', label: 'Avalanche' },
];

function short(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${Math.round(abs)}`;
}

export default function ClusterRadarPage() {
  const [chain, setChain] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (chain) params.set('chain', chain);
      const res = await fetch(`/api/clusters/radar?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Radar unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, [chain]);

  useEffect(() => { load(); }, [load]);

  const clusters = result?.clusters ?? [];
  const maxVol = Math.max(1, ...clusters.map((c) => c.volume24hUsd));

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/wallet-clusters" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Link2 className="w-4 h-4 text-[#00C8FF]" /> Coordinated Cluster Radar</span>
        <HowItWorksButton content={clusterRadarHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Where coordinated money is moving</h1>
        <p className="text-slate-400 text-sm mt-1">The biggest coordinated wallet clusters by 24h volume, with the seed you can decode.</p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select value={chain} onChange={(e) => setChain(e.target.value)} className="nl-glass rounded-lg px-3 py-1.5 text-xs bg-transparent text-slate-300 focus:outline-none">
          {CHAINS.map((c) => <option key={c.id} value={c.id} className="bg-[#0b1020]">{c.label}</option>)}
        </select>
        <button onClick={load} className="ms-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && !result && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}
      {!loading && clusters.length === 0 && <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No coordinated clusters in this view.</div>}

      <div className="space-y-2">
        {clusters.map((c, i) => (
          <Link key={`${c.seed}-${c.chain}`} href={`/dashboard/whale-tracker/dna?address=${c.seed}`} className="block nl-card rounded-xl p-3 hover:border-[#0066FF]/40 transition-colors group">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600 w-5 text-center shrink-0">{i + 1}</span>
              <ChainLogo chain={c.chain} className="w-5 h-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate inline-flex items-center gap-1">
                  {c.label || short(c.seed)}
                  {c.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00C8FF]" />}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5"><Users className="w-3 h-3" />{c.memberCount} wallets</span>
                  {c.archetype && <span>· {c.archetype}</span>}
                  <span className="font-mono">· {short(c.seed)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-white">{fmtUsd(c.volume24hUsd)}</div>
                <div className="text-[9px] uppercase tracking-wide text-slate-500">vol 24h</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-[#00C8FF] transition-colors shrink-0" />
            </div>
            <div className="mt-2 h-0.5 rounded-full bg-white/[0.04]">
              <div className="h-full rounded-full bg-[#0066FF]/60" style={{ width: `${Math.max(4, Math.round((c.volume24hUsd / maxVol) * 100))}%` }} />
            </div>
          </Link>
        ))}
      </div>

      {result && clusters.length > 0 && (
        <p className="text-[10px] text-slate-600 text-center mt-4">Dune cluster aggregates · updated {new Date(result.generatedAt).toLocaleTimeString()}</p>
      )}
    </div>
  );
}
