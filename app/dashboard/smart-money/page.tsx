'use client';

import { Trophy, ArrowLeft, Star, TrendingUp, Eye, Bell, Plus, Copy, Activity, DollarSign, Target, Clock, ChevronRight, Search, Users, Zap, Loader2, RefreshCw, TrendingDown, Flame, AlertTriangle, ArrowUpRight, SortAsc, Award, Fish, Building2, Settings2, X, Radio, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { addLocalNotification } from '@/lib/notifications';

type WalletArchetype = 'DIAMOND_HANDS' | 'SCALPER' | 'DEGEN' | 'WHALE_FOLLOWER' | 'HOLDER' | 'INACTIVE' | 'NEW_WALLET';

interface SmartTrade { action: string; token: string; amount: string; time: string; chain: string; wallet?: string }

interface SmartWallet {
  id: string; address: string; shortAddress: string; name: string;
  totalVolume: number; totalVolumeStr: string; recentTrades: SmartTrade[];
  chain: string; chains: string[]; lastActive: string; rank: number;
  tags: string[]; winRate: number; pnl: string; pnlChange: number;
  trades: number; avgHold: string; bestTrade: string;
  archetype?: WalletArchetype; weeklyPnlChange?: number; isRiser?: boolean;
}

interface ConvergenceSignal { token: string; symbol: string; walletCount: number; totalVolume: string; timeWindow: string }

const ARCHETYPE_COLORS: Record<WalletArchetype, string> = {
  DIAMOND_HANDS: '#60A5FA', SCALPER: '#F59E0B', DEGEN: '#EF4444',
  WHALE_FOLLOWER: '#8B5CF6', HOLDER: '#10B981', INACTIVE: '#6B7280', NEW_WALLET: '#06B6D4',
};
const ARCHETYPE_ICONS: Record<WalletArchetype, React.ElementType> = {
  DIAMOND_HANDS: Award, SCALPER: Zap, DEGEN: Target,
  WHALE_FOLLOWER: Fish, HOLDER: Building2, INACTIVE: Clock, NEW_WALLET: Plus,
};

const ARCHETYPE_LABELS: Record<WalletArchetype, string> = {
  DIAMOND_HANDS: 'Diamond Hands', SCALPER: 'Scalper', DEGEN: 'Degen',
  WHALE_FOLLOWER: 'Whale Follower', HOLDER: 'Holder', INACTIVE: 'Inactive', NEW_WALLET: 'New Wallet',
};

type SortKey = 'rank' | 'winRate' | 'pnlChange' | 'totalVolume' | 'trades';
type SmartTab = 'leaderboard' | 'history' | 'settings';

function ArchetypeBadge({ archetype }: { archetype: WalletArchetype }) {
  const color = ARCHETYPE_COLORS[archetype];
  const Icon = ARCHETYPE_ICONS[archetype];
  return (
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold border"
      style={{ color, borderColor: color + '40', background: color + '15' }}>
      <Icon className="w-2.5 h-2.5" style={{ color }} />{ARCHETYPE_LABELS[archetype]}
    </span>
  );
}

export default function SmartMoneyPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<SmartWallet[]>([]);
  const [recentMoves, setRecentMoves] = useState<SmartTrade[]>([]);
  const [convergence, setConvergence] = useState<ConvergenceSignal[]>([]);
  const [weeklyRisers, setWeeklyRisers] = useState<SmartWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [watching, setWatching] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'watching'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [paperTrade, setPaperTrade] = useState<SmartWallet | null>(null);
  const [activeTab, setActiveTab] = useState<SmartTab>('leaderboard');

  // Load watched wallets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('smart-money-watching');
      if (stored) setWatching(JSON.parse(stored));
    } catch {}
  }, []);

  const toggleWatch = (id: string) => {
    setWatching(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id];
      try { localStorage.setItem('smart-money-watching', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  // Track which convergence signals we've already notified about (by token+count key)
  const notifiedConvergenceRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/smart-money');
      if (!res.ok) throw new Error('Failed to fetch smart money data');
      const data = await res.json() as { wallets: SmartWallet[]; recentMoves: SmartTrade[]; convergence?: ConvergenceSignal[]; weeklyRisers?: SmartWallet[] };
      setWallets(data.wallets ?? []);
      setRecentMoves(data.recentMoves ?? []);
      setConvergence(data.convergence ?? []);
      setWeeklyRisers(data.weeklyRisers ?? []);
      setLastUpdated(new Date());

      // Fire in-page notifications for new convergence signals
      for (const signal of (data.convergence ?? [])) {
        const key = `${signal.token}-${signal.walletCount}`;
        if (!notifiedConvergenceRef.current.has(key)) {
          notifiedConvergenceRef.current.add(key);
          addLocalNotification({
            type: 'whale_alert',
            title: `Convergence Signal: ${signal.symbol || signal.token}`,
            message: `${signal.walletCount} smart-money wallets entered ${signal.symbol || signal.token} — ${signal.totalVolume} volume (${signal.timeWindow})`,
          });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredWallets = wallets
    .filter(w => {
      if (filter === 'watching' && !watching.includes(w.id)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return w.name.toLowerCase().includes(q) || w.address.toLowerCase().includes(q) || w.tags.some(t => t.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'winRate') return b.winRate - a.winRate;
      if (sortKey === 'pnlChange') return b.pnlChange - a.pnlChange;
      if (sortKey === 'totalVolume') return b.totalVolume - a.totalVolume;
      if (sortKey === 'trades') return b.trades - a.trades;
      return a.rank - b.rank;
    });

  const totalWatching = watching.length;
  const watchedWallets = wallets.filter(w => watching.includes(w.id));
  const avgWinRate = watchedWallets.length
    ? Math.round(watchedWallets.reduce((s, w) => s + w.winRate, 0) / watchedWallets.length)
    : 0;
  const totalVolumeAll = wallets.reduce((s, w) => s + w.totalVolume, 0);
  const formatVol = (v: number) =>
    v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`;
  const avgWin = wallets.length
    ? Math.round(wallets.reduce((s, w) => s + w.winRate, 0) / wallets.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#060A12]/95 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-[#F59E0B] to-[#F97316] rounded-xl flex items-center justify-center">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold tracking-tight">Smart Money Tracker</h1>
            <span className="text-[10px] text-gray-600">
              {totalWatching > 0
                ? `${totalWatching} watching · Avg ${avgWinRate}% win rate`
                : 'Live on-chain data'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-gray-500 hover:text-gray-300">
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => fetchData()} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-gray-500 hover:text-gray-300" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/[0.04]">
          {([['leaderboard', 'Leaderboard', Trophy], ['history', 'History', Radio], ['settings', 'Settings', Settings2]] as [SmartTab, string, React.ElementType][]).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${activeTab === t ? 'border-[#F59E0B] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {activeTab === 'leaderboard' && <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 focus-within:border-[#0A1EFF]/30 transition-colors">
            <Search className="w-3.5 h-3.5 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search wallets, tags..."
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder-gray-600"
            />
          </div>
        </div>}
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-3xl mx-auto">
        {lastUpdated && (
          <div className="text-[10px] text-gray-600 text-right flex items-center justify-end gap-1">
            <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
            Updated {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 60s
          </div>
        )}

        {activeTab === 'leaderboard' && <>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0D1117] rounded-xl p-3 border border-white/[0.04] text-center">
            <Users className="w-4 h-4 text-[#0A1EFF] mx-auto mb-1" />
            <div className="text-lg font-bold">{wallets.length}</div>
            <div className="text-[9px] text-gray-600 uppercase">Tracked</div>
          </div>
          <div className="bg-[#0D1117] rounded-xl p-3 border border-white/[0.04] text-center">
            <DollarSign className="w-4 h-4 text-[#10B981] mx-auto mb-1" />
            <div className="text-lg font-bold text-[#10B981]">
              {loading ? '...' : formatVol(totalVolumeAll)}
            </div>
            <div className="text-[9px] text-gray-600 uppercase">Total Vol</div>
          </div>
          <div className="bg-[#0D1117] rounded-xl p-3 border border-white/[0.04] text-center">
            <Activity className="w-4 h-4 text-[#F59E0B] mx-auto mb-1" />
            <div className="text-lg font-bold">{loading ? '...' : `${avgWin}%`}</div>
            <div className="text-[9px] text-gray-600 uppercase">Avg Win</div>
          </div>
        </div>

        {/* Convergence Banner */}
        {convergence.length > 0 && (
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-xs font-bold text-[#F59E0B]">Smart Money Convergence Detected</span>
            </div>
            <div className="space-y-1.5">
              {convergence.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-200 font-semibold">{c.symbol}</span>
                  <div className="flex items-center gap-3 text-gray-400">
                    <span><span className="text-[#F59E0B] font-bold">{c.walletCount}</span> wallets</span>
                    <span>{c.totalVolume} · {c.timeWindow}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top-3 Champion Cards */}
        {!loading && wallets.slice(0, 3).length === 3 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="text-xs font-bold text-gray-300">Top Performers</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {wallets.slice(0, 3).map((w, i) => {
                const RankIcons = [Trophy, Award, Award];
                const RankIcon = RankIcons[i];
                const colors = ['#F59E0B', '#9CA3AF', '#CD7F32'];
                return (
                  <div key={w.id} className="bg-[#0D1117] rounded-xl p-3 border text-center"
                    style={{ borderColor: colors[i] + '30' }}>
                    <div className="w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center" style={{ background: colors[i] + '20' }}>
                      <RankIcon className="w-4 h-4" style={{ color: colors[i] }} />
                    </div>
                    <div className="text-[10px] font-bold text-white truncate">{w.name}</div>
                    <div className="text-xs font-bold mt-1" style={{ color: colors[i] }}>{w.winRate}%</div>
                    <div className="text-[9px] text-gray-600">win rate</div>
                    {w.archetype && <div className="mt-1"><ArchetypeBadge archetype={w.archetype} /></div>}
                    <button onClick={() => setPaperTrade(w)}
                      className="mt-2 w-full text-[9px] py-1 rounded-lg font-bold transition-colors"
                      style={{ background: colors[i] + '20', color: colors[i] }}>
                      Paper Trade
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weekly Risers */}
        {weeklyRisers.length > 0 && (
          <div className="bg-[#0D1117] rounded-2xl border border-white/[0.04] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-[#EF4444]" />
              <span className="text-xs font-bold">Weekly Risers</span>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {weeklyRisers.map((w) => (
                <div key={w.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#EF4444]/10 rounded-lg flex items-center justify-center text-[10px] font-bold text-[#EF4444]">#{w.rank}</div>
                    <div>
                      <div className="text-[11px] font-semibold">{w.name}</div>
                      {w.archetype && <ArchetypeBadge archetype={w.archetype} />}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-[#10B981]">+{(w.weeklyPnlChange ?? 0).toFixed(1)}%</div>
                    <div className="text-[9px] text-gray-600">this week</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard Sort Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <SortAsc className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
          {(['rank', 'winRate', 'pnlChange', 'totalVolume', 'trades'] as SortKey[]).map(k => (
            <button key={k} onClick={() => setSortKey(k)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${sortKey === k ? 'bg-[#0A1EFF]/20 text-[#0A1EFF] border border-[#0A1EFF]/30' : 'bg-white/[0.03] text-gray-500 border border-white/[0.05]'}`}>
              {k === 'pnlChange' ? 'PnL%' : k === 'totalVolume' ? 'Volume' : k === 'winRate' ? 'Win Rate' : k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        {/* Recent Moves */}
        {(loading || recentMoves.length > 0) && (
          <div className="bg-[#0D1117] rounded-2xl border border-white/[0.04] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />Recent Moves
              </span>
              <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
            </div>
            {loading && recentMoves.length === 0 ? (
              <div className="flex items-center justify-center py-6 gap-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Loading moves...</span>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {recentMoves.map((move, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold ${
                      move.action === 'Bought' || move.action === 'Added LP' ? 'bg-[#10B981]/10 text-[#10B981]' :
                      move.action === 'Sold' ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                      'bg-[#0A1EFF]/10 text-[#0A1EFF]'
                    }`}>
                      {move.action === 'Bought' ? '↑' : move.action === 'Sold' ? '↓' : '↔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold font-mono truncate">{move.wallet || 'Whale'}</div>
                      <div className="text-[9px] text-gray-600">{move.action} {move.token}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-mono font-semibold">{move.amount}</div>
                      <div className="text-[9px] text-gray-600">{move.time}</div>
                    </div>
                    <span className="text-[8px] px-1.5 py-0.5 bg-white/[0.04] rounded text-gray-500 font-mono">{move.chain}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Wallet List */}
        {loading && wallets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-[#0A1EFF] animate-spin" />
            <p className="text-sm text-gray-400">Scanning on-chain activity...</p>
            <p className="text-xs text-gray-600">Fetching real wallet data from Alchemy &amp; DexScreener</p>
          </div>
        ) : error && wallets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Trophy className="w-10 h-10 text-gray-700" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => fetchData()} className="text-xs text-[#0A1EFF] hover:underline">Try again</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredWallets.map((wallet) => (
              <div
                key={wallet.id}
                className={`bg-[#0D1117] rounded-2xl border transition-all ${
                  watching.includes(wallet.id) ? 'border-[#0A1EFF]/15' : 'border-white/[0.04]'
                } hover:border-white/[0.08]`}
              >
                <div className="p-4 cursor-pointer" onClick={() => setExpandedWallet(expandedWallet === wallet.id ? null : wallet.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        wallet.rank <= 3
                          ? 'bg-gradient-to-br from-[#F59E0B]/20 to-[#F97316]/20 text-[#F59E0B]'
                          : 'bg-white/[0.04] text-gray-500'
                      }`}>
                        #{wallet.rank}
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          {wallet.name}
                          {wallet.rank <= 3 && <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyAddress(wallet.address); }}
                          className="text-[10px] text-gray-600 font-mono hover:text-gray-400 transition-colors flex items-center gap-1"
                        >
                          {wallet.shortAddress}
                          {copied === wallet.address
                            ? <span className="text-[#10B981] text-[8px]">copied</span>
                            : <Copy className="w-2.5 h-2.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWatch(wallet.id); }}
                        className={`p-2 rounded-lg transition-all ${watching.includes(wallet.id) ? 'bg-[#0A1EFF]/15 text-[#0A1EFF]' : 'text-gray-600 hover:bg-white/[0.04]'}`}
                        title={watching.includes(wallet.id) ? 'Unwatch' : 'Watch'}
                      >
                        {watching.includes(wallet.id) ? <Eye className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>
                      <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${expandedWallet === wallet.id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10B981]/[0.06]">
                      <Target className="w-3 h-3 text-[#10B981]" />
                      <span className="text-[10px] font-semibold text-[#10B981]">{wallet.winRate}% Win</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A1EFF]/[0.06]">
                      <DollarSign className="w-3 h-3 text-[#0A1EFF]" />
                      <span className="text-[10px] font-semibold text-[#0A1EFF]">{wallet.totalVolumeStr}</span>
                      <span className={`text-[8px] font-bold ${wallet.pnlChange >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {wallet.pnlChange >= 0 ? '+' : ''}{wallet.pnlChange}%
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-600">{wallet.trades.toLocaleString()} trades</span>
                    <span className="text-[10px] text-gray-600 ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />{wallet.lastActive}
                    </span>
                  </div>

                  <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                    {wallet.archetype && <ArchetypeBadge archetype={wallet.archetype} />}
                    {wallet.chains.map(c => (
                      <span key={c} className="text-[8px] px-1.5 py-0.5 bg-white/[0.04] rounded font-mono text-gray-500">{c}</span>
                    ))}
                    {wallet.tags.map(t => (
                      <span key={t} className="text-[8px] px-1.5 py-0.5 bg-[#0A1EFF]/[0.06] rounded text-[#0A1EFF]/70">{t}</span>
                    ))}
                    <button onClick={e => { e.stopPropagation(); setPaperTrade(wallet); }}
                      className="ml-auto text-[9px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded-lg font-semibold">
                      Paper Trade
                    </button>
                  </div>
                </div>

                {expandedWallet === wallet.id && (
                  <div className="px-4 pb-4 border-t border-white/[0.04] pt-3">
                    {wallet.recentTrades.length > 0 && (
                      <div className="mb-3 space-y-1">
                        <div className="text-[9px] text-gray-600 uppercase font-semibold mb-1.5">Recent Activity</div>
                        {wallet.recentTrades.map((trade, ti) => (
                          <div key={ti} className="flex items-center gap-2 bg-[#060A12] rounded-lg px-2.5 py-1.5">
                            <span className={`text-[9px] font-bold w-10 ${trade.action === 'Bought' ? 'text-[#10B981]' : trade.action === 'Sold' ? 'text-[#EF4444]' : 'text-[#0A1EFF]'}`}>
                              {trade.action}
                            </span>
                            <span className="text-[10px] font-semibold flex-1">{trade.token}</span>
                            <span className="text-[10px] font-mono text-gray-400">{trade.amount}</span>
                            <span className="text-[8px] text-gray-600 font-mono">{trade.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-[#060A12] rounded-lg p-2.5 text-center">
                        <div className="text-[8px] text-gray-600 uppercase mb-0.5">Avg Hold</div>
                        <div className="text-[11px] font-semibold">{wallet.avgHold}</div>
                      </div>
                      <div className="bg-[#060A12] rounded-lg p-2.5 text-center">
                        <div className="text-[8px] text-gray-600 uppercase mb-0.5">Best Trade</div>
                        <div className="text-[11px] font-semibold text-[#10B981]">{wallet.bestTrade}</div>
                      </div>
                      <div className="bg-[#060A12] rounded-lg p-2.5 text-center">
                        <div className="text-[8px] text-gray-600 uppercase mb-0.5">Win Rate</div>
                        <div className="text-[11px] font-semibold">{wallet.winRate}%</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/wallet-intelligence?address=${wallet.address}`)}
                        className="flex-1 py-2.5 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-xl text-[10px] font-semibold text-[#0A1EFF] hover:bg-[#0A1EFF]/15 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Shield className="w-3 h-3" /> Analyze
                      </button>
                      <button
                        onClick={() => toggleWatch(wallet.id)}
                        className="flex-1 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[10px] font-semibold text-gray-400 hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Bell className="w-3 h-3" /> {watching.includes(wallet.id) ? 'Unwatch' : 'Watch'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredWallets.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No wallets found</p>
                <p className="text-xs text-gray-700">Try a different search or filter</p>
              </div>
            )}
          </div>
        )}
        </>}

        {/* ── HISTORY TAB ─────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-xs font-bold text-gray-300">Recent Smart Money Moves</span>
              <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
            </div>
            {recentMoves.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <Activity className="w-8 h-8 text-gray-700 animate-pulse" />
                <p className="text-sm text-gray-500">Loading recent moves…</p>
              </div>
            ) : (
              <div className="bg-[#0D1117] border border-white/[0.04] rounded-2xl divide-y divide-white/[0.04]">
                {recentMoves.map((move, i) => {
                  const isUp = move.action === 'buy';
                  const color = isUp ? '#10B981' : '#EF4444';
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
                        {isUp ? <TrendingUp className="w-3.5 h-3.5" style={{ color }} /> : <TrendingDown className="w-3.5 h-3.5" style={{ color }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {move.wallet ?? 'Smart Wallet'} <span className="text-gray-500 font-normal">·</span> <span style={{ color }}>{move.action.toUpperCase()}</span> {move.token}
                        </div>
                        <div className="text-[10px] text-gray-500">{move.chain} · {move.time}</div>
                      </div>
                      <div className="text-xs font-bold text-white">{move.amount}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ─────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notification Settings</div>
            {[
              { label: 'New whale entry alerts', desc: 'Notify when a tracked wallet makes a new entry', key: 'entry' },
              { label: 'Large exit alerts', desc: 'Notify when a tracked wallet exits a large position', key: 'exit' },
              { label: 'Smart money convergence', desc: 'Multiple wallets buying same token', key: 'convergence' },
              { label: 'Weekly performance report', desc: 'Summary of tracked wallet performance', key: 'weekly' },
            ].map(({ label, desc, key }) => (
              <div key={key} className="flex items-center justify-between bg-[#0D1117] border border-white/[0.04] rounded-xl p-4">
                <div>
                  <div className="text-xs font-semibold text-white">{label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
                </div>
                <div className="w-10 h-5 rounded-full bg-[#0A1EFF] relative flex-shrink-0 ml-4 cursor-pointer">
                  <span className="absolute top-0.5 left-5 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            ))}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4">Display Settings</div>
            {[
              { label: 'Show archetype badges', desc: 'Display wallet behavior classification' },
              { label: 'Show convergence signals', desc: 'Alert when multiple smart wallets target same token' },
              { label: 'Show weekly risers', desc: 'Highlight wallets with improving recent performance' },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-center justify-between bg-[#0D1117] border border-white/[0.04] rounded-xl p-4">
                <div>
                  <div className="text-xs font-semibold text-white">{label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
                </div>
                <div className="w-10 h-5 rounded-full bg-[#0A1EFF] relative flex-shrink-0 ml-4 cursor-pointer">
                  <span className="absolute top-0.5 left-5 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paper Trading Modal */}
      {paperTrade && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setPaperTrade(null)}>
          <div className="w-full sm:max-w-sm bg-[#0D1117] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-white">Paper Trade — {paperTrade.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Simulate copying this wallet's strategy</div>
              </div>
              <button onClick={() => setPaperTrade(null)} className="p-1.5 hover:bg-white/[0.06] rounded-lg">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-[#060A12] rounded-xl p-3">
                  <div className="text-xs font-bold text-[#10B981]">{paperTrade.winRate}%</div>
                  <div className="text-[9px] text-gray-600">Win Rate</div>
                </div>
                <div className="bg-[#060A12] rounded-xl p-3">
                  <div className={`text-xs font-bold ${paperTrade.pnlChange >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {paperTrade.pnlChange >= 0 ? '+' : ''}{paperTrade.pnlChange}%
                  </div>
                  <div className="text-[9px] text-gray-600">PnL Change</div>
                </div>
              </div>
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl p-3 text-[11px] text-[#F59E0B]">
                <ArrowUpRight className="w-3.5 h-3.5 inline mr-1" />
                Paper trading simulates copying without real funds. Results are for educational purposes only.
              </div>
              <div className="space-y-1.5">
                <div className="text-[10px] text-gray-500 font-semibold uppercase">Simulated Allocation</div>
                {['$100', '$500', '$1,000'].map(amt => (
                  <button key={amt} className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-xs transition-colors">
                    <span className="text-gray-300">{amt} simulated capital</span>
                    <span className="text-[#10B981] font-semibold">
                      +{(parseFloat(amt.replace(/[^0-9]/g, '')) * (paperTrade.winRate / 100) * 0.05).toFixed(2)} est.
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => setPaperTrade(null)}
                className="w-full py-2.5 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-xl text-xs font-bold">
                Start Paper Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
