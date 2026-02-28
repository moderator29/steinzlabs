'use client';

import { useState } from 'react';
import { Users, ArrowLeft, CheckCircle, TrendingUp, Copy, Star } from 'lucide-react';
import Link from 'next/link';

interface Trader {
  id: number;
  name: string;
  verified: boolean;
  bio: string;
  winRate: number;
  totalProfit: string;
  followers: number;
  avgReturn: string;
  recentTrades: { pair: string; result: string; profit: string }[];
}

const TRADERS: Trader[] = [
  { id: 1, name: 'SolanaWhale', verified: true, bio: 'Full-time crypto trader since 2019', winRate: 87, totalProfit: '+$45.2K', followers: 1247, avgReturn: '+156%', recentTrades: [{ pair: 'SOL/USDC', result: '+12%', profit: '$1.2K' }, { pair: 'ETH/USDC', result: '+8%', profit: '$890' }, { pair: 'BTC/USDC', result: '+15%', profit: '$2.1K' }] },
  { id: 2, name: 'DeFiMaster', verified: true, bio: 'DeFi degen. Yield farming expert.', winRate: 82, totalProfit: '+$38.9K', followers: 892, avgReturn: '+142%', recentTrades: [{ pair: 'LINK/USDC', result: '+22%', profit: '$1.8K' }, { pair: 'UNI/USDC', result: '+9%', profit: '$670' }, { pair: 'AAVE/USDC', result: '+18%', profit: '$1.4K' }] },
  { id: 3, name: 'CryptoNinja', verified: false, bio: 'Swing trader. Long-term holds only.', winRate: 79, totalProfit: '+$29.4K', followers: 634, avgReturn: '+118%', recentTrades: [{ pair: 'MATIC/USDC', result: '+14%', profit: '$980' }, { pair: 'AVAX/USDC', result: '+11%', profit: '$720' }, { pair: 'DOT/USDC', result: '+7%', profit: '$450' }] },
  { id: 4, name: 'WhaleTracker', verified: true, bio: 'I follow the whales. They follow me.', winRate: 91, totalProfit: '+$67.8K', followers: 2103, avgReturn: '+189%', recentTrades: [{ pair: 'BNB/USDC', result: '+19%', profit: '$2.8K' }, { pair: 'ADA/USDC', result: '+13%', profit: '$1.1K' }, { pair: 'SOL/USDC', result: '+21%', profit: '$3.2K' }] },
  { id: 5, name: 'AlphaSeeker', verified: false, bio: 'Finding alpha in low caps.', winRate: 76, totalProfit: '+$22.1K', followers: 445, avgReturn: '+98%', recentTrades: [{ pair: 'FTM/USDC', result: '+16%', profit: '$890' }, { pair: 'NEAR/USDC', result: '+10%', profit: '$520' }, { pair: 'ATOM/USDC', result: '+8%', profit: '$380' }] },
  { id: 6, name: 'MoonHunter', verified: false, bio: 'Meme coin specialist. DYOR.', winRate: 85, totalProfit: '+$41.6K', followers: 978, avgReturn: '+210%', recentTrades: [{ pair: 'PEPE/USDC', result: '+45%', profit: '$4.2K' }, { pair: 'BONK/USDC', result: '+32%', profit: '$2.8K' }, { pair: 'WIF/USDC', result: '+28%', profit: '$2.1K' }] },
];

const TABS = ['Top Traders', 'Following', 'My Trades', 'Leaderboard'];

export default function SocialTradingPage() {
  const [activeTab, setActiveTab] = useState('Top Traders');
  const [copying, setCopying] = useState<Set<number>>(new Set());
  const [leaderboardFilter, setLeaderboardFilter] = useState('All Time');

  const toggleCopy = (id: number) => {
    setCopying((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="px-4 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Users className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-xl font-heading font-bold">Social Trading</h1>
        </div>
        <p className="text-gray-400 text-xs mb-4">Follow top traders, share insights, and copy winning strategies</p>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Top Traders' && (
          <div className="space-y-3">
            {TRADERS.map((trader) => (
              <div key={trader.id} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">{trader.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold">{trader.name}</span>
                      {trader.verified && <CheckCircle className="w-3.5 h-3.5 text-[#00E5FF]" />}
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{trader.bio}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="text-center">
                    <div className="text-xs font-bold text-[#10B981]">{trader.winRate}%</div>
                    <div className="text-[9px] text-gray-500">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-[#10B981]">{trader.totalProfit}</div>
                    <div className="text-[9px] text-gray-500">Profit</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold">{trader.followers.toLocaleString()}</div>
                    <div className="text-[9px] text-gray-500">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-[#10B981]">{trader.avgReturn}</div>
                    <div className="text-[9px] text-gray-500">Avg Return</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Recent Trades</div>
                  <div className="space-y-1">
                    {trader.recentTrades.map((trade, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-300">{trade.pair}</span>
                        <span className="text-[#10B981] font-semibold">{trade.result} ({trade.profit})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => toggleCopy(trader.id)}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                    copying.has(trader.id)
                      ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                      : 'border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#00E5FF]/10'
                  }`}
                >
                  {copying.has(trader.id) ? (
                    <span className="flex items-center justify-center gap-1"><Copy className="w-3 h-3" /> Copying Trades</span>
                  ) : (
                    <span className="flex items-center justify-center gap-1"><Copy className="w-3 h-3" /> Copy Trades</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Following' && (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">Not following anyone yet</p>
            <p className="text-gray-600 text-xs">Start copying top traders to see them here</p>
          </div>
        )}

        {activeTab === 'My Trades' && (
          <div className="text-center py-12">
            <TrendingUp className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">No trades yet</p>
            <p className="text-gray-600 text-xs">Connect your wallet to start trading</p>
          </div>
        )}

        {activeTab === 'Leaderboard' && (
          <div>
            <div className="flex gap-2 mb-4">
              {['All Time', 'This Month', 'This Week'].map((f) => (
                <button
                  key={f}
                  onClick={() => setLeaderboardFilter(f)}
                  className={`px-3 py-1 rounded text-[10px] font-semibold ${leaderboardFilter === f ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#111827] text-gray-500'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b border-white/10 text-[10px] text-gray-500 font-semibold">
                <span>#</span><span>Trader</span><span>Win Rate</span><span>Profit</span><span>Followers</span>
              </div>
              {TRADERS.sort((a, b) => b.winRate - a.winRate).map((trader, i) => (
                <div key={trader.id} className="grid grid-cols-5 gap-2 px-3 py-2.5 border-b border-white/5 text-[11px] hover:bg-white/5 transition-colors items-center">
                  <span className={`font-bold ${i < 3 ? 'text-[#F59E0B]' : 'text-gray-500'}`}>{i + 1}</span>
                  <span className="font-semibold flex items-center gap-1 truncate">
                    {trader.name}
                    {trader.verified && <CheckCircle className="w-3 h-3 text-[#00E5FF] flex-shrink-0" />}
                  </span>
                  <span className="text-[#10B981] font-semibold">{trader.winRate}%</span>
                  <span className="text-[#10B981]">{trader.totalProfit}</span>
                  <span className="text-gray-400">{trader.followers.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
