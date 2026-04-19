'use client';

// Phase 8 — cluster detail page (next-gen beyond Nansen/Arkham).
// Hero: AI name + narrative + archetype + scores.
// Interactive force-directed graph of members & edges.
// Member list with roles, edge table, community labels with voting,
// temporal stats, reputation-weighted curation.

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, ThumbsUp, ThumbsDown, CheckCircle2, Copy, Check, ExternalLink,
  Sparkles, Users, Network, Clock, ShieldAlert, TrendingUp, Crown, Bot, Brain, Activity, Layers,
} from 'lucide-react';
import ClusterGraph from '@/components/clusters/ClusterGraph';

interface Member { address: string; role: string | null; created_at?: string }
interface Edge {
  from_address: string; to_address: string; edge_type: string;
  chain: string; weight: number | null; confidence: number;
  total_value_usd: number | null; transaction_count: number | null;
  first_seen_at: string; last_seen_at: string;
}
interface Label {
  id: string; label: string; description: string | null;
  upvotes: number; downvotes: number; status: 'pending' | 'approved' | 'rejected';
  ai_generated: boolean; created_at: string; submitted_by: string | null;
}
interface Cluster {
  cluster_id: string; token_address: string | null; behavior_type: string | null;
  whale_score: number | null; created_at: string; updated_at: string;
}
interface DetailResponse { cluster: Cluster; members: Member[]; edges: Edge[]; labels: Label[] }

const ARCHETYPE_META: Record<string, { label: string; Icon: typeof Crown; tone: string; narrative: string }> = {
  alpha_hive:       { label: 'Alpha Hive',       Icon: Crown,       tone: 'from-amber-400 to-yellow-500',   narrative: 'Coordinated smart-money wallets acting in concert — they frequently trade the same tokens within minutes.' },
  sybil_farm:       { label: 'Sybil Farm',       Icon: ShieldAlert, tone: 'from-red-400 to-pink-500',       narrative: 'Mass-funded uniform wallets. Almost certainly airdrop-farming or sybil-attacking a protocol.' },
  insider_ring:     { label: 'Insider Ring',     Icon: Sparkles,    tone: 'from-purple-400 to-fuchsia-500', narrative: 'Tight pre-launch cluster with shared funding and coordinated accumulation.' },
  smart_money_pack: { label: 'Smart Money Pack', Icon: Brain,       tone: 'from-emerald-400 to-teal-500',   narrative: 'Independent wallets with a high overlap of profitable trades.' },
  bot_swarm:        { label: 'Bot Swarm',        Icon: Bot,         tone: 'from-sky-400 to-cyan-500',       narrative: 'Automated wallets firing coordinated transactions — MEV / sniping / arbitrage.' },
  institutional:    { label: 'Institutional',    Icon: Layers,      tone: 'from-slate-400 to-blue-500',     narrative: 'High-value internal transfers — exchange or fund operational wallets.' },
  whale_syndicate:  { label: 'Whale Syndicate',  Icon: TrendingUp,  tone: 'from-blue-400 to-indigo-500',    narrative: 'Large-balance wallets coordinating big moves. Market-moving collective.' },
  unknown:          { label: 'Unclassified',     Icon: Activity,    tone: 'from-slate-500 to-slate-700',    narrative: 'Cluster detected; archetype not yet determined.' },
};

function short(a: string): string { return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(v: number | null): string {
  if (!v || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
}

export default function ClusterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/clusters/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function submitLabel() {
    if (!newLabel.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clusters/${encodeURIComponent(id)}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      if (res.ok) { setNewLabel(''); await load(); }
    } finally {
      setSubmitting(false);
    }
  }

  async function voteLabel(labelId: string, vote: 1 | -1) {
    await fetch(`/api/clusters/${encodeURIComponent(id)}/labels`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label_id: labelId, vote }),
    });
    await load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05081E] flex items-center justify-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading cluster…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#05081E] flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="mb-2">{error || 'Cluster not found.'}</p>
          <Link href="/dashboard/wallet-clusters" className="text-xs text-[#8FA3FF] hover:underline">← Back to directory</Link>
        </div>
      </div>
    );
  }

  const { cluster, members, edges, labels } = data;
  const archetype = (cluster.behavior_type || 'unknown');
  const meta = ARCHETYPE_META[archetype] || ARCHETYPE_META.unknown;
  const Icon = meta.Icon;
  const approvedLabel = labels.find((l) => l.status === 'approved') || labels[0];
  const totalValue = edges.reduce((s, e) => s + (e.total_value_usd || 0), 0);
  const avgConf = edges.length > 0 ? edges.reduce((s, e) => s + e.confidence, 0) / edges.length : 0;
  const edgeTypeCount = edges.reduce<Record<string, number>>((m, e) => { m[e.edge_type] = (m[e.edge_type] || 0) + 1; return m; }, {});
  const hub = members.find((m) => m.role === 'hub')?.address || null;
  const firstSeen = edges.map((e) => e.first_seen_at).sort()[0];

  return (
    <div className="min-h-screen bg-[#05081E] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#05081E]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft className="w-4 h-4" /></button>
          <code className="text-[11px] font-mono text-slate-500 truncate flex-1">{cluster.cluster_id}</code>
          <Link href="/dashboard/wallet-clusters" className="text-[11px] text-[#8FA3FF] hover:underline">Directory</Link>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${meta.tone} flex items-center justify-center shrink-0`}>
              <Icon className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{approvedLabel?.label || meta.label}</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-300 uppercase">{archetype.replace('_', ' ')}</span>
                {approvedLabel?.status === 'approved' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
                {approvedLabel?.description || meta.narrative}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-5">
            <Metric label="Whale Score" value={cluster.whale_score ? `${Math.round(Number(cluster.whale_score))}/100` : '—'} color="text-emerald-400" />
            <Metric label="Members" value={members.length.toLocaleString()} />
            <Metric label="Edges" value={edges.length.toLocaleString()} />
            <Metric label="Edge Confidence" value={edges.length ? `${(avgConf * 100).toFixed(0)}%` : '—'} />
            <Metric label="Total Value" value={fmtUsd(totalValue)} />
          </div>

          {firstSeen && (
            <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="w-3 h-3" /> First observed {new Date(firstSeen).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Graph */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Network className="w-4 h-4 text-[#8FA3FF]" />
          <h2 className="text-sm font-bold">Interactive Cluster Graph</h2>
          <span className="text-[10px] text-slate-500">drag · zoom · click a node to view on explorer</span>
        </div>
        {members.length > 0 && edges.length > 0 ? (
          <ClusterGraph
            members={members}
            edges={edges}
            hub={hub}
            onNodeClick={(addr) => window.open(`https://etherscan.io/address/${addr}`, '_blank')}
          />
        ) : (
          <div className="p-10 text-center bg-white/[0.02] border border-white/10 rounded-xl text-slate-500 text-sm">
            Graph unavailable — no edges persisted yet for this cluster.
          </div>
        )}
      </div>

      {/* Detection signal breakdown */}
      {Object.keys(edgeTypeCount).length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-6">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-[#8FA3FF]" />
            <h2 className="text-sm font-bold">Detection Signals</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(edgeTypeCount).map(([type, count]) => (
              <div key={type} className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{type.replace('_', ' ')}</div>
                <div className="text-lg font-black font-mono mt-0.5">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-[#8FA3FF]" />
          <h2 className="text-sm font-bold">Members <span className="text-slate-500 text-xs">({members.length})</span></h2>
        </div>
        <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            {members.map((m) => (
              <div key={m.address} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]">
                <div className={`w-2 h-2 rounded-full ${m.role === 'hub' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <code className="flex-1 text-xs font-mono text-slate-300 truncate">{m.address}</code>
                <span className="text-[10px] text-slate-500 uppercase">{m.role || 'member'}</span>
                <a href={`https://etherscan.io/address/${m.address}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white">
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Community labels */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#8FA3FF]" />
          <h2 className="text-sm font-bold">Community Labels</h2>
          <span className="text-[10px] text-slate-500">submit a label → 5 net upvotes → approved + reputation points</span>
        </div>

        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Suggest a label (2–4 words)…"
              maxLength={60}
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0A1EFF]/50"
            />
            <button
              onClick={submitLabel}
              disabled={submitting || !newLabel.trim()}
              className="px-3 py-2 rounded-lg bg-[#0A1EFF] hover:bg-[#0918CC] text-xs font-bold disabled:opacity-60 flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Submit
            </button>
          </div>

          {labels.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-3">No labels yet — be the first to name this cluster.</p>
          ) : (
            <div className="space-y-2">
              {labels.map((l) => {
                const net = (l.upvotes || 0) - (l.downvotes || 0);
                return (
                  <div key={l.id} className="flex items-center gap-3 p-3 bg-black/20 border border-white/5 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">{l.label}</span>
                        {l.status === 'approved' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">APPROVED</span>}
                        {l.status === 'pending' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">PENDING</span>}
                        {l.ai_generated && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0A1EFF]/15 text-[#8FA3FF]">AI</span>}
                      </div>
                      {l.description && <p className="text-[11px] text-slate-400 mt-0.5">{l.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => voteLabel(l.id, 1)} className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px]">
                        <ThumbsUp className="w-3 h-3" /> {l.upvotes ?? 0}
                      </button>
                      <button onClick={() => voteLabel(l.id, -1)} className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px]">
                        <ThumbsDown className="w-3 h-3" /> {l.downvotes ?? 0}
                      </button>
                      <span className={`text-[10px] font-bold ${net >= 5 ? 'text-emerald-400' : net > 0 ? 'text-slate-300' : 'text-slate-500'}`}>net {net}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-black/20 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-base font-bold font-mono mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
