'use client';

import { Trophy, ArrowLeft, Star, TrendingUp, Eye, Bell, Plus, Copy, ExternalLink, Activity, DollarSign, Target, Shield, Clock, ChevronRight, Search, Filter, Users, Zap, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface SmartTrade {
  action: string;
  token: string;
  amount: string;
  time: string;
  chain: string;
  wallet?: string;
}

interface SmartWallet {
  id: string;
  address: string;
  shortAddress: string;
  name: string;
  totalVolume: number;
  totalVolumeStr: string;
  recentTrades: SmartTrade[];
  chain: string;
  chains: string[];
  lastActive: string;
  rank: number;
  tags: string[];
  winRate: number;
  pnl: string;
  pnlChange: number;
  trades: number;
  avgHold: string;
  bestTrade: string;
}

export default function SmartMoneyPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<SmartWallet[]>([]);
  const [recentMoves, setRecentMoves] = useState<SmartTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [watching, setWatching] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'watching'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/smart-money');
      if (!res.ok) throw new Error('Failed to fetch smart money data');
      const data = await res.json();
      setWallets(data.wallets || []);
      setRecentMoves(data.recentMoves || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredWallets = wallets.filter(w => {
    if (filter === 'watching' && !watching.includes(w.id)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        w.address.toLowerCase().includes(q) ||
        w.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
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
            <button
              onClick={() => fetchData()}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-gray-500 hover:text-gray-300"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setFilter(filter === 'all' ? 'watching' : 'all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${filter === 'watching' ? 'bg-[#0A1EFF]/15 text-[#0A1EFF] border border-[#0A1EFF]/20' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Eye className="w-3 h-3 inline mr-1" />{filter === 'watching' ? 'Watched' : 'All'}
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
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
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-3xl mx-auto">
        {lastUpdated && (
          <div className="text-[10px] text-gray-600 text-right flex items-center justify-end gap-1">
            <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
            Updated {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 60s
          </div>
        )}

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

                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {wallet.chains.map(c => (
                      <span key={c} className="text-[8px] px-1.5 py-0.5 bg-white/[0.04] rounded font-mono text-gray-500">{c}</span>
                    ))}
                    {wallet.tags.map(t => (
                      <span key={t} className="text-[8px] px-1.5 py-0.5 bg-[#0A1EFF]/[0.06] rounded text-[#0A1EFF]/70">{t}</span>
                    ))}
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
      </div>
    </div>
  );
}
