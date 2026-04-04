'use client';

import { Trophy, ArrowLeft, Star, TrendingUp, Eye, Bell, Plus, Copy, ExternalLink, Activity, DollarSign, Target, Shield, Clock, ChevronRight, Search, Filter, Users, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const WALLETS = [
  { id: 'w1', name: 'Whale Alpha', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3a7f1', winRate: 89, pnl: '+$2.4M', pnlChange: 12.3, trades: 342, lastActive: '12m ago', rank: 1, avgHold: '4.2d', bestTrade: '+$340K', chains: ['ETH', 'ARB'], tags: ['DeFi', 'MEV'] },
  { id: 'w2', name: 'DeFi Master', address: '0x9f3a21c6b4e8f3a5d7b2c9e1f4d6a8b3c5e7f9a1', winRate: 84, pnl: '+$1.8M', pnlChange: 8.7, trades: 567, lastActive: '1h ago', rank: 2, avgHold: '2.1d', bestTrade: '+$220K', chains: ['ETH', 'BASE'], tags: ['Yield', 'LP'] },
  { id: 'w3', name: 'SOL Sniper', address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK', winRate: 82, pnl: '+$1.2M', pnlChange: -2.1, trades: 891, lastActive: '5m ago', rank: 3, avgHold: '6h', bestTrade: '+$180K', chains: ['SOL'], tags: ['Meme', 'Snipe'] },
  { id: 'w4', name: 'NFT Flipper Pro', address: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0', winRate: 78, pnl: '+$890K', pnlChange: 5.4, trades: 234, lastActive: '3h ago', rank: 4, avgHold: '12h', bestTrade: '+$95K', chains: ['ETH'], tags: ['NFT', 'Blue Chip'] },
  { id: 'w5', name: 'Arbitrage Bot #7', address: '0xd5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4', winRate: 92, pnl: '+$3.1M', pnlChange: 15.8, trades: 12450, lastActive: '1m ago', rank: 5, avgHold: '2m', bestTrade: '+$45K', chains: ['ETH', 'ARB', 'BASE'], tags: ['Bot', 'Arb'] },
  { id: 'w6', name: 'VC Deployer', address: '0xb9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8', winRate: 71, pnl: '+$15.2M', pnlChange: 0.3, trades: 89, lastActive: '2d ago', rank: 6, avgHold: '180d', bestTrade: '+$4.2M', chains: ['ETH', 'SOL'], tags: ['VC', 'Seed'] },
  { id: 'w7', name: 'Gas Optimizer', address: '0x1234567890abcdef1234567890abcdef12345678', winRate: 86, pnl: '+$670K', pnlChange: 6.2, trades: 3200, lastActive: '30m ago', rank: 7, avgHold: '1d', bestTrade: '+$28K', chains: ['ETH', 'POLY'], tags: ['Gas', 'MEV'] },
  { id: 'w8', name: 'Degen Whale', address: '0xfedcba0987654321fedcba0987654321fedcba09', winRate: 65, pnl: '+$2.8M', pnlChange: -8.5, trades: 1567, lastActive: '45m ago', rank: 8, avgHold: '3h', bestTrade: '+$520K', chains: ['SOL', 'BASE'], tags: ['Meme', 'Degen'] },
];

const RECENT_MOVES = [
  { wallet: 'Whale Alpha', action: 'Bought', token: 'PEPE', amount: '$340K', time: '12m ago', chain: 'ETH' },
  { wallet: 'SOL Sniper', action: 'Sold', token: 'WIF', amount: '$120K', time: '18m ago', chain: 'SOL' },
  { wallet: 'Arbitrage Bot #7', action: 'Swap', token: 'ETH→USDC', amount: '$890K', time: '1m ago', chain: 'ARB' },
  { wallet: 'DeFi Master', action: 'Added LP', token: 'ETH/USDC', amount: '$450K', time: '1h ago', chain: 'BASE' },
  { wallet: 'VC Deployer', action: 'Transferred', token: 'ETH', amount: '$2.1M', time: '2h ago', chain: 'ETH' },
];

export default function SmartMoneyPage() {
  const router = useRouter();
  const [watching, setWatching] = useState<string[]>(['w1', 'w3']);
  const [filter, setFilter] = useState<'all' | 'watching'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const toggleWatch = (id: string) => {
    setWatching(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredWallets = WALLETS.filter(w => {
    if (filter === 'watching' && !watching.includes(w.id)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return w.name.toLowerCase().includes(q) || w.address.toLowerCase().includes(q) || w.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const totalWatching = watching.length;
  const avgWinRate = Math.round(WALLETS.filter(w => watching.includes(w.id)).reduce((s, w) => s + w.winRate, 0) / (totalWatching || 1));

  return (
    <div className="min-h-screen bg-[#060A12] text-white pb-24">
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
            <span className="text-[10px] text-gray-600">{totalWatching} watching &middot; Avg {avgWinRate}% win rate</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setFilter(filter === 'all' ? 'watching' : 'all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${filter === 'watching' ? 'bg-[#0A1EFF]/15 text-[#0A1EFF] border border-[#0A1EFF]/20' : 'text-gray-500 hover:text-gray-300'}`}>
              <Eye className="w-3 h-3 inline mr-1" />{filter === 'watching' ? 'Watched' : 'All'}
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 focus-within:border-[#0A1EFF]/30 transition-colors">
            <Search className="w-3.5 h-3.5 text-gray-600" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search wallets, tags..." className="flex-1 bg-transparent text-xs focus:outline-none placeholder-gray-600" />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-3xl mx-auto">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0D1117] rounded-xl p-3 border border-white/[0.04] text-center">
            <Users className="w-4 h-4 text-[#0A1EFF] mx-auto mb-1" />
            <div className="text-lg font-bold">{WALLETS.length}</div>
            <div className="text-[9px] text-gray-600 uppercase">Tracked</div>
          </div>
          <div className="bg-[#0D1117] rounded-xl p-3 border border-white/[0.04] text-center">
            <DollarSign className="w-4 h-4 text-[#10B981] mx-auto mb-1" />
            <div className="text-lg font-bold text-[#10B981]">$27.1M</div>
            <div className="text-[9px] text-gray-600 uppercase">Total P&L</div>
          </div>
          <div className="bg-[#0D1117] rounded-xl p-3 border border-white/[0.04] text-center">
            <Activity className="w-4 h-4 text-[#F59E0B] mx-auto mb-1" />
            <div className="text-lg font-bold">83%</div>
            <div className="text-[9px] text-gray-600 uppercase">Avg Win</div>
          </div>
        </div>

        <div className="bg-[#0D1117] rounded-2xl border border-white/[0.04] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />Recent Moves
            </span>
            <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
          </div>
          <div className="divide-y divide-white/[0.03]">
            {RECENT_MOVES.map((move, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold ${
                  move.action === 'Bought' || move.action === 'Added LP' ? 'bg-[#10B981]/10 text-[#10B981]' :
                  move.action === 'Sold' ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                  'bg-[#0A1EFF]/10 text-[#0A1EFF]'
                }`}>
                  {move.action === 'Bought' ? '↑' : move.action === 'Sold' ? '↓' : '↔'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold">{move.wallet}</div>
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
        </div>

        <div className="space-y-2">
          {filteredWallets.map((wallet) => (
            <div key={wallet.id} className={`bg-[#0D1117] rounded-2xl border transition-all ${
              watching.includes(wallet.id) ? 'border-[#0A1EFF]/15' : 'border-white/[0.04]'
            } hover:border-white/[0.08]`}>
              <div className="p-4 cursor-pointer" onClick={() => setExpandedWallet(expandedWallet === wallet.id ? null : wallet.id)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      wallet.rank <= 3 ? 'bg-gradient-to-br from-[#F59E0B]/20 to-[#F97316]/20 text-[#F59E0B]' :
                      'bg-white/[0.04] text-gray-500'
                    }`}>
                      #{wallet.rank}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        {wallet.name}
                        {wallet.rank <= 3 && <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); copyAddress(wallet.address); }} className="text-[10px] text-gray-600 font-mono hover:text-gray-400 transition-colors flex items-center gap-1">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                        {copied === wallet.address ? <span className="text-[#10B981] text-[8px]">copied</span> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWatch(wallet.id); }}
                      className={`p-2 rounded-lg transition-all ${watching.includes(wallet.id) ? 'bg-[#0A1EFF]/15 text-[#0A1EFF]' : 'text-gray-600 hover:bg-white/[0.04]'}`}
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
                    <span className="text-[10px] font-semibold text-[#0A1EFF]">{wallet.pnl}</span>
                    <span className={`text-[8px] font-bold ${wallet.pnlChange >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {wallet.pnlChange >= 0 ? '+' : ''}{wallet.pnlChange}%
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-600">{wallet.trades.toLocaleString()} trades</span>
                  <span className="text-[10px] text-gray-600 ml-auto flex items-center gap-1"><Clock className="w-3 h-3" />{wallet.lastActive}</span>
                </div>

                <div className="flex gap-1.5 mt-2">
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
                    <button onClick={() => router.push(`/dashboard/wallet-intelligence?address=${wallet.address}`)} className="flex-1 py-2.5 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-xl text-[10px] font-semibold text-[#0A1EFF] hover:bg-[#0A1EFF]/15 transition-colors flex items-center justify-center gap-1.5">
                      <Shield className="w-3 h-3" /> Analyze
                    </button>
                    <button className="flex-1 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[10px] font-semibold text-gray-400 hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1.5">
                      <Bell className="w-3 h-3" /> Set Alert
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredWallets.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No wallets found</p>
              <p className="text-xs text-gray-700">Try a different search or filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
