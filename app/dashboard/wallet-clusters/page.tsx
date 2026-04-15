'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Link2, Search, RefreshCw, AlertTriangle, CheckCircle, Users, Shield, Activity, ArrowRight, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClusterSignal {
  signal: string; score: number; wallets: string[]; detail: string;
}

interface ClusterRow {
  id: string; name: string; member_count: number; coordination_score: number;
  risk_level: 'high' | 'medium' | 'low'; signals: ClusterSignal[];
  detected_at: string; token_address?: string | null;
}

interface MemberRow {
  cluster_id: string; wallet_address: string; role: string; coordination_score?: number;
}

interface TransferEdge {
  from: string; to: string; valueUsd: number; timestamp: number; txHash: string;
}

interface ClusterData {
  clusters: ClusterRow[]; members: MemberRow[];
  source: 'cache' | 'live'; transfers?: TransferEdge[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskColor(level: string) {
  if (level === 'high') return '#EF4444';
  if (level === 'medium') return '#F59E0B';
  return '#10B981';
}

function riskLabel(score: number) {
  if (score >= 60) return 'HIGH RISK';
  if (score >= 40) return 'MEDIUM';
  return 'LOW RISK';
}

function shortAddr(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── FundingTrace visualization ───────────────────────────────────────────────

function FundingTrace({ transfers, members }: { transfers: TransferEdge[]; members: MemberRow[] }) {
  const addrs = new Set(members.map(m => m.wallet_address));
  const relevant = transfers.filter(t => addrs.has(t.from) || addrs.has(t.to)).slice(0, 8);
  if (!relevant.length) return <p className="text-xs text-gray-600 py-2">No on-chain transfers detected between members.</p>;

  return (
    <div className="space-y-1.5">
      {relevant.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px]">
          <code className="text-gray-400 bg-white/[0.04] px-1.5 py-0.5 rounded font-mono">{shortAddr(t.from)}</code>
          <ArrowRight className="w-3 h-3 text-[#F59E0B] flex-shrink-0" />
          <code className="text-gray-400 bg-white/[0.04] px-1.5 py-0.5 rounded font-mono">{shortAddr(t.to)}</code>
          <span className="text-gray-600 ml-auto">${t.valueUsd.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Cluster Detail Panel ─────────────────────────────────────────────────────

function ClusterDetail({ cluster, members, transfers, onClose }: {
  cluster: ClusterRow; members: MemberRow[]; transfers: TransferEdge[]; onClose: () => void;
}) {
  const clusterMembers = members.filter(m => m.cluster_id === cluster.id);
  const color = riskColor(cluster.risk_level);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-lg bg-[#0a0e1a] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0a0e1a] flex items-center justify-between px-5 py-4 border-b border-white/[0.06] z-10">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm font-bold">{cluster.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: color + '20', color }}>{riskLabel(cluster.coordination_score)}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Members', value: cluster.member_count, color: '#0A1EFF' },
              { label: 'Score', value: `${cluster.coordination_score}/100`, color },
              { label: 'Signals', value: cluster.signals?.length ?? 0, color: '#8B5CF6' },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Coordination Timeline */}
          <div>
            <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">Coordination Signals</h4>
            <CoordinationTimeline signals={cluster.signals ?? []} />
          </div>

          {/* Funding Trace */}
          <div>
            <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">Funding Trace</h4>
            <FundingTrace transfers={transfers} members={clusterMembers} />
          </div>

          {/* Member wallets */}
          <div>
            <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">Member Wallets ({clusterMembers.length})</h4>
            <div className="space-y-1">
              {clusterMembers.slice(0, 15).map((m, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] py-1.5 border-b border-white/[0.03]">
                  <code className="text-gray-400 font-mono">{shortAddr(m.wallet_address)}</code>
                  {m.coordination_score !== undefined && (
                    <span className="text-gray-500">Score: {m.coordination_score}</span>
                  )}
                </div>
              ))}
              {clusterMembers.length > 15 && <p className="text-[10px] text-gray-600">+{clusterMembers.length - 15} more</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────

function CoordinationTimeline({ signals }: { signals: ClusterSignal[] }) {
  if (!signals.length) return <p className="text-xs text-gray-600 py-2">No signals recorded.</p>;
  return (
    <div className="space-y-2">
      {signals.map((s, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: s.score >= 25 ? '#EF4444' : s.score >= 15 ? '#F59E0B' : '#10B981' }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-200 font-medium">{s.signal.replace(/_/g, ' ')}</div>
            <div className="text-[10px] text-gray-500">{s.detail}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[9px] text-gray-600">Score: +{s.score}</span>
              <span className="text-[9px] text-gray-700">· {s.wallets.length} wallets</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WalletClustersPage() {
  const router = useRouter();
  const [data, setData] = useState<ClusterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchToken, setSearchToken] = useState('');
  const [query, setQuery] = useState('');  // wallet address search filter
  const [selected, setSelected] = useState<ClusterRow | null>(null);
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const fetchClusters = useCallback(async (token = searchToken, refresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (token.trim()) params.set('token', token.trim());
      if (refresh) params.set('refresh', '1');
      const res = await fetch(`/api/wallet-clusters?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json as ClusterData);
        if (json.message && json.clusters?.length === 0) {
          console.info('[Wallet Clusters]', json.message);
        }
      }
    } catch (err) {
      console.error('[Wallet Clusters] Fetch failed:', err);
    } finally { setLoading(false); }
  }, [searchToken]);

  useEffect(() => { fetchClusters(); }, []);  // load on mount

  const stats = {
    total: data?.clusters.length ?? 0,
    wallets: data?.members.length ?? 0,
    high: data?.clusters.filter(c => c.risk_level === 'high').length ?? 0,
  };

  const filteredClusters = (data?.clusters ?? []).filter(c => {
    if (riskFilter !== 'all' && c.risk_level !== riskFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      (data?.members ?? []).some(m => m.cluster_id === c.id && m.wallet_address.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-xl flex items-center justify-center">
            <Link2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Wallet Clusters</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-[#7C3AED]/20 text-[#7C3AED] border border-[#7C3AED]/30 rounded font-bold">LIVE</span>
            </div>
            <span className="text-[10px] text-gray-600">Multi-chain wallet relationship intelligence</span>
          </div>
          <button onClick={() => fetchClusters(searchToken, true)} disabled={loading}
            className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {/* Filter bar */}
        <div className="flex gap-2 px-4 pb-3 border-t border-white/[0.04] pt-2 overflow-x-auto scrollbar-hide">
          {(['all', 'high', 'medium', 'low'] as const).map(level => (
            <button key={level} onClick={() => setRiskFilter(level)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${riskFilter === level ? 'bg-[#7C3AED]/20 text-[#7C3AED] border border-[#7C3AED]/30' : 'bg-white/[0.04] text-gray-500 border border-white/[0.06]'}`}>
              {level === 'all' ? 'All Risk Levels' : level.charAt(0).toUpperCase() + level.slice(1) + ' Risk'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Token search */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 focus-within:border-[#7C3AED]/40 transition-colors">
            <Search className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <input value={searchToken} onChange={e => setSearchToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchClusters()}
              placeholder="Analyze token holders (address)…"
              className="flex-1 bg-transparent py-2.5 px-2 text-xs placeholder-gray-600 focus:outline-none font-mono" />
          </div>
          <button onClick={() => fetchClusters()} disabled={loading}
            className="px-4 h-10 bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl text-xs font-bold transition-colors disabled:opacity-40">
            Analyze
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Clusters', value: stats.total, color: '#7C3AED', icon: Link2 },
            { label: 'Wallets', value: stats.wallets, color: '#0A1EFF', icon: Users },
            { label: 'High Risk', value: stats.high, color: '#EF4444', icon: AlertTriangle },
          ].map(s => (
            <div key={s.label} className="bg-[#0f1320] border border-white/[0.06] rounded-xl p-3 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{loading ? '…' : s.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Wallet filter */}
        <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-3">
          <Search className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Filter by wallet address or cluster name…"
            className="flex-1 bg-transparent py-2 px-2 text-xs placeholder-gray-600 focus:outline-none" />
          {query && <button onClick={() => setQuery('')}><X className="w-3.5 h-3.5 text-gray-600" /></button>}
        </div>

        {/* Source badge */}
        {data && (
          <div className="flex items-center gap-2 text-[10px] text-gray-600">
            <Activity className="w-3 h-3" />
            {data.source === 'live' ? 'Live detection' : 'Cached results'} · {filteredClusters.length} cluster{filteredClusters.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Cluster cards */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filteredClusters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Shield className="w-8 h-8 text-gray-700" />
            <p className="text-sm text-gray-500">No clusters detected</p>
            <p className="text-xs text-gray-600">Enter a token address to analyze its top holders for coordinated behavior</p>
          </div>
        )}

        <div className="space-y-3">
          {filteredClusters.map(cluster => {
            const color = riskColor(cluster.risk_level);
            const clusterMembers = (data?.members ?? []).filter(m => m.cluster_id === cluster.id);
            return (
              <button key={cluster.id} onClick={() => setSelected(cluster)}
                className="w-full bg-[#0f1320] border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-4 text-left transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-bold text-white">{cluster.name}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: color + '20', color }}>
                    {riskLabel(cluster.coordination_score)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                  <div><div className="text-base font-bold" style={{ color }}>{cluster.coordination_score}</div><div className="text-[9px] text-gray-600">Score</div></div>
                  <div><div className="text-base font-bold text-[#0A1EFF]">{cluster.member_count}</div><div className="text-[9px] text-gray-600">Wallets</div></div>
                  <div><div className="text-base font-bold text-[#8B5CF6]">{cluster.signals?.length ?? 0}</div><div className="text-[9px] text-gray-600">Signals</div></div>
                </div>
                {/* Score bar */}
                <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full" style={{ width: `${cluster.coordination_score}%`, backgroundColor: color }} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(cluster.signals ?? []).slice(0, 3).map((s, i) => (
                      <span key={i} className="text-[9px] bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">
                        {s.signal.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-600">{fmtTime(cluster.detected_at)}</span>
                </div>
                {clusterMembers.length > 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    {clusterMembers.slice(0, 4).map((m, i) => (
                      <code key={i} className="text-[9px] text-gray-600 bg-white/[0.03] px-1 py-0.5 rounded font-mono">{shortAddr(m.wallet_address)}</code>
                    ))}
                    {clusterMembers.length > 4 && <span className="text-[9px] text-gray-600">+{clusterMembers.length - 4}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <ClusterDetail
          cluster={selected}
          members={data?.members ?? []}
          transfers={data?.transfers ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
