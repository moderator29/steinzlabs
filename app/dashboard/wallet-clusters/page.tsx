'use client';

// Wallet Clusters directory — multi-signal on-chain entity detection.
// Five detection algorithms fuse into a single confidence graph.
// Every cluster gets: AI-generated name + narrative, archetype, whale score,
// risk score, dominant edge types, member count, community labels.
// Paste any wallet to run live detection.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, Search, ArrowLeft, Zap, ShieldAlert, Sparkles, Users, TrendingUp,
  Brain, Bot, Activity, Crown, Cpu, Layers, ChevronRight, X,
} from 'lucide-react';

type Archetype =
  | 'alpha_hive' | 'sybil_farm' | 'insider_ring' | 'smart_money_pack'
  | 'bot_swarm' | 'institutional' | 'whale_syndicate' | 'unknown';

interface ClusterRow {
  cluster_id: string;
  token_address: string | null;
  archetype: Archetype | string | null;
  whale_score: number | null;
  member_count: number;
  hub: string | null;
  community_label: string | null;
  updated_at: string | null;
}

interface ListResponse {
  clusters: ClusterRow[];
  total: number;
  offset: number;
  limit: number;
  facets: { byArchetype: Record<string, number> };
}

const ARCHETYPE_META: Record<Archetype, { label: string; Icon: typeof Zap; tone: string }> = {
  alpha_hive:       { label: 'Alpha Hive',        Icon: Crown,       tone: 'from-amber-400 to-yellow-500' },
  sybil_farm:       { label: 'Sybil Farm',        Icon: ShieldAlert, tone: 'from-red-400 to-pink-500' },
  insider_ring:     { label: 'Insider Ring',      Icon: Sparkles,    tone: 'from-purple-400 to-fuchsia-500' },
  smart_money_pack: { label: 'Smart Money Pack',  Icon: Brain,       tone: 'from-emerald-400 to-teal-500' },
  bot_swarm:        { label: 'Bot Swarm',         Icon: Bot,         tone: 'from-sky-400 to-cyan-500' },
  institutional:    { label: 'Institutional',     Icon: Layers,      tone: 'from-slate-400 to-blue-500' },
  whale_syndicate:  { label: 'Whale Syndicate',   Icon: TrendingUp,  tone: 'from-blue-400 to-indigo-500' },
  unknown:          { label: 'Unclassified',      Icon: Activity,    tone: 'from-slate-500 to-slate-700' },
};

const ARCHETYPE_PILLS: Archetype[] = [
  'alpha_hive', 'smart_money_pack', 'insider_ring', 'whale_syndicate',
  'bot_swarm', 'sybil_farm', 'institutional', 'unknown',
];

function short(a: string): string { return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }

export default function WalletClustersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ClusterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [archetype, setArchetype] = useState<string>('');
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState('whale_score');
  const [offset, setOffset] = useState(0);
  const [analyzeAddr, setAnalyzeAddr] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ clusters: any[]; note?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ limit: '24', offset: String(offset), sort });
      if (archetype) p.set('archetype', archetype);
      if (minScore > 0) p.set('min_score', String(minScore));
      if (q.trim()) p.set('q', q.trim());
      const res = await fetch(`/api/clusters?${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: ListResponse = await res.json();
      setRows(d.clusters || []);
      setTotal(d.total || 0);
      setFacets(d.facets?.byArchetype || {});
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, [archetype, minScore, q, sort, offset]);

  useEffect(() => { void load(); }, [load]);

  async function runAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!analyzeAddr.trim()) return;
    setAnalyzing(true); setAnalyzeResult(null);
    try {
      const res = await fetch('/api/clusters/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: analyzeAddr.trim(), chain: 'ethereum', persist: true }),
      });
      const data = await res.json();
      setAnalyzeResult(data);
    } catch (err: any) {
      setAnalyzeResult({ clusters: [], note: err?.message || 'Failed' });
    } finally {
      setAnalyzing(false);
    }
  }

  const totalMembers = useMemo(() => rows.reduce((s, r) => s + r.member_count, 0), [rows]);

  return (
    <div className="min-h-screen bg-[#05081E] text-white pb-24">
      {/* Hero */}
      <div className="sticky top-0 z-30 bg-[#05081E]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-start gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Wallet Clusters</h1>
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#0A1EFF]/15 text-[#6F7EFF] border border-[#0A1EFF]/30">NEXT-GEN</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">PRO</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              5-signal on-chain intelligence · AI-named archetypes · community reputation
            </p>
          </div>
        </div>

        {/* Search + sort + min-score */}
        <div className="max-w-7xl mx-auto px-4 pb-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setOffset(0); }}
                placeholder="Search cluster id…"
                className="flex-1 bg-transparent outline-none text-sm placeholder-slate-500"
              />
              {q && <button onClick={() => setQ('')} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setOffset(0); }} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none">
              <option value="whale_score" className="bg-[#05081E]">Whale Score</option>
              <option value="recent" className="bg-[#05081E]">Recently Updated</option>
              <option value="members" className="bg-[#05081E]">Member Count</option>
            </select>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs">
              <label className="text-slate-400">Min score</label>
              <input type="number" min={0} max={100} value={minScore || ''} onChange={(e) => { setMinScore(parseInt(e.target.value || '0', 10) || 0); setOffset(0); }} className="w-12 bg-transparent outline-none text-sm" />
            </div>
          </div>

          {/* Archetype pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => { setArchetype(''); setOffset(0); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${!archetype ? 'bg-[#0A1EFF]/15 text-[#8FA3FF] border border-[#0A1EFF]/40' : 'bg-white/5 text-slate-400 border border-transparent hover:text-white'}`}
            >
              All <span className="text-slate-500 text-[10px]">{total}</span>
            </button>
            {ARCHETYPE_PILLS.map((a) => {
              const meta = ARCHETYPE_META[a];
              const active = archetype === a;
              const count = facets[a] || 0;
              const Icon = meta.Icon;
              return (
                <button
                  key={a}
                  onClick={() => { setArchetype(active ? '' : a); setOffset(0); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${active ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-slate-400 border border-transparent hover:text-white'}`}
                >
                  <Icon className="w-3 h-3" />
                  {meta.label}
                  {count > 0 && <span className="text-slate-500 text-[10px]">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Paste-wallet analyzer */}
      <div className="max-w-7xl mx-auto px-4 mt-5">
        <form onSubmit={runAnalysis} className="bg-gradient-to-br from-[#0A1EFF]/10 via-[#7C3AED]/5 to-transparent border border-[#0A1EFF]/30 rounded-xl p-4 flex items-start gap-3 flex-wrap">
          <Cpu className="w-5 h-5 text-[#8FA3FF] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-bold">Analyze any wallet</div>
            <div className="text-[11px] text-slate-400">Paste an address → we run 5 detectors live + AI-name the cluster.</div>
          </div>
          <input
            value={analyzeAddr}
            onChange={(e) => setAnalyzeAddr(e.target.value)}
            placeholder="0x… or Solana address"
            className="flex-1 min-w-[240px] bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#0A1EFF]/50"
          />
          <button
            type="submit"
            disabled={analyzing || !analyzeAddr.trim()}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] font-bold text-sm disabled:opacity-60 flex items-center gap-2"
          >
            {analyzing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</> : <><Sparkles className="w-3.5 h-3.5" /> Analyze</>}
          </button>
        </form>

        {analyzeResult && (
          <div className="mt-3 p-4 bg-white/[0.02] border border-white/10 rounded-xl">
            {analyzeResult.note && <p className="text-xs text-slate-400 mb-2">{analyzeResult.note}</p>}
            {analyzeResult.clusters && analyzeResult.clusters.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {analyzeResult.clusters.slice(0, 4).map((c: any, i: number) => (
                  <Link
                    key={c.cluster_id || i}
                    href={`/dashboard/wallet-clusters/cluster/${c.cluster_id}`}
                    className="p-3 bg-black/30 hover:bg-black/50 rounded-lg border border-white/5 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{c.ai_name || 'Cluster'}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 uppercase">{c.archetype}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">score {c.whale_score}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">risk {c.risk_score}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">{c.ai_narrative}</p>
                    <div className="text-[10px] text-slate-500 mt-1">{c.member_count} members · {c.edge_count} edges · {c.chain}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No clusters found for that address.</p>
            )}
          </div>
        )}
      </div>

      {/* Aggregate stats */}
      <div className="max-w-7xl mx-auto px-4 mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatTile label="Clusters tracked" value={total.toLocaleString()} />
        <StatTile label="Wallets indexed (page)" value={totalMembers.toLocaleString()} />
        <StatTile label="Archetypes" value={String(Object.keys(facets).length)} />
        <StatTile label="Detection signals" value="5" />
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm mb-4">{error}</div>}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading clusters…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-300 font-semibold mb-1">No clusters yet.</p>
            <p className="text-slate-500 text-sm">Paste a wallet above to run live detection, or wait for the cluster cron to ingest fresh whale activity.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((r) => <ClusterCard key={r.cluster_id} row={r} />)}
          </div>
        )}

        {!loading && total > rows.length && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 24))} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs disabled:opacity-40">Prev</button>
            <span className="text-xs text-slate-500">{offset + 1}–{Math.min(offset + 24, total)} of {total}</span>
            <button disabled={offset + 24 >= total} onClick={() => setOffset(offset + 24)} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-base font-bold font-mono mt-0.5">{value}</div>
    </div>
  );
}

function ClusterCard({ row }: { row: ClusterRow }) {
  const arch = (row.archetype || 'unknown') as Archetype;
  const meta = ARCHETYPE_META[arch] ?? ARCHETYPE_META.unknown;
  const Icon = meta.Icon;
  const score = row.whale_score ?? 0;

  return (
    <Link
      href={`/dashboard/wallet-clusters/cluster/${row.cluster_id}`}
      className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.tone} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-white text-sm">{row.community_label || meta.label}</span>
            {row.community_label && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">COMMUNITY</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 uppercase">{arch.replace('_', ' ')}</span>
            <span className="text-[10px] text-slate-500">·</span>
            <span className="text-[10px] text-slate-500 flex items-center gap-0.5"><Users className="w-2.5 h-2.5" /> {row.member_count}</span>
          </div>
          <code className="text-[10px] font-mono text-slate-600 truncate block mt-1">{row.cluster_id}</code>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Score</div>
          <div className={`text-xl font-black font-mono ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-[#8FA3FF]' : 'text-slate-400'}`}>{score}</div>
        </div>
      </div>
      {row.hub && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px]">
          <span className="text-slate-500">Hub: <code className="font-mono text-slate-400">{short(row.hub)}</code></span>
          <span className="flex items-center gap-0.5 text-slate-500 group-hover:text-white">Explore <ChevronRight className="w-3 h-3" /></span>
        </div>
      )}
    </Link>
  );
}
