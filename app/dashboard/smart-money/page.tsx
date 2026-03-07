'use client';

import { Trophy, ArrowLeft, Star, TrendingUp, Eye, Bell, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SmartMoneyPage() {
  const router = useRouter();
  const [watching, setWatching] = useState<string[]>(['w1', 'w3']);

  const wallets = [
    { id: 'w1', name: 'Whale Alpha', address: '0x742d...3a7f', winRate: '89%', pnl: '+$2.4M', trades: 342, lastActive: '12m ago', rank: 1 },
    { id: 'w2', name: 'DeFi Master', address: '0x9f3a...b21c', winRate: '84%', pnl: '+$1.8M', trades: 567, lastActive: '1h ago', rank: 2 },
    { id: 'w3', name: 'SOL Sniper', address: '0x3e7b...f4d8', winRate: '82%', pnl: '+$1.2M', trades: 891, lastActive: '5m ago', rank: 3 },
    { id: 'w4', name: 'NFT Flipper Pro', address: '0xa1b2...c3d4', winRate: '78%', pnl: '+$890K', trades: 234, lastActive: '3h ago', rank: 4 },
    { id: 'w5', name: 'Arbitrage Bot #7', address: '0xd5e6...f7a8', winRate: '92%', pnl: '+$3.1M', trades: 12450, lastActive: '1m ago', rank: 5 },
    { id: 'w6', name: 'VC Deployer', address: '0xb9c0...d1e2', winRate: '71%', pnl: '+$15.2M', trades: 89, lastActive: '2d ago', rank: 6 },
  ];

  const toggleWatch = (id: string) => {
    setWatching(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Trophy className="w-5 h-5 text-[#F59E0B]" />
          <h1 className="text-sm font-heading font-bold">Smart Money Watchlist</h1>
          <span className="ml-auto text-[10px] text-gray-500">{watching.length} watching</span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {wallets.map((wallet) => (
          <div key={wallet.id} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#F59E0B]/20 to-[#00D4AA]/20 rounded-full flex items-center justify-center text-sm font-bold text-[#F59E0B]">
                  #{wallet.rank}
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1">
                    {wallet.name}
                    {wallet.rank <= 3 && <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">{wallet.address}</div>
                </div>
              </div>
              <button
                onClick={() => toggleWatch(wallet.id)}
                className={`p-1.5 rounded-lg transition-colors ${watching.includes(wallet.id) ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'text-gray-500 hover:bg-white/10'}`}
              >
                {watching.includes(wallet.id) ? <Eye className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="text-[#10B981] font-semibold">Win: {wallet.winRate}</span>
              <span className="text-[#00D4AA] font-semibold">P&L: {wallet.pnl}</span>
              <span className="text-gray-500">{wallet.trades} trades</span>
              <span className="text-gray-500 ml-auto">{wallet.lastActive}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
