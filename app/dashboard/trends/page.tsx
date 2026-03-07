'use client';

import { TrendingUp, ArrowLeft, ArrowUpRight, ArrowDownRight, Activity, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TrendsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');

  const trends = [
    { token: 'ETH', metric: 'Active Addresses', change: '+12.4%', direction: 'up', value: '1.2M', chain: 'Ethereum', hot: true },
    { token: 'SOL', metric: 'DEX Volume', change: '+45.2%', direction: 'up', value: '$890M', chain: 'Solana', hot: true },
    { token: 'BNB', metric: 'Gas Usage', change: '-8.1%', direction: 'down', value: '45 Gwei', chain: 'BSC', hot: false },
    { token: 'MATIC', metric: 'TVL Change', change: '+22.8%', direction: 'up', value: '$1.1B', chain: 'Polygon', hot: true },
    { token: 'ARB', metric: 'New Contracts', change: '+67.3%', direction: 'up', value: '2,340', chain: 'Arbitrum', hot: true },
    { token: 'AVAX', metric: 'Bridge Volume', change: '-3.2%', direction: 'down', value: '$34M', chain: 'Avalanche', hot: false },
    { token: 'OP', metric: 'Unique Users', change: '+28.9%', direction: 'up', value: '156K', chain: 'Optimism', hot: false },
    { token: 'BASE', metric: 'TX Count', change: '+89.1%', direction: 'up', value: '3.4M', chain: 'Base', hot: true },
  ];

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <TrendingUp className="w-5 h-5 text-[#00D4AA]" />
          <h1 className="text-sm font-heading font-bold">On-Chain Trends</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Ethereum', 'Solana', 'BSC', 'L2s'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#00D4AA] to-[#6366F1] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {trends.map((trend, i) => (
            <div key={i} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#00D4AA]/10 rounded-lg flex items-center justify-center text-[10px] font-bold text-[#00D4AA]">{trend.token}</div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1">
                      {trend.metric}
                      {trend.hot && <Zap className="w-3 h-3 text-[#F59E0B]" />}
                    </div>
                    <div className="text-[10px] text-gray-500">{trend.chain}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold">{trend.value}</div>
                  <div className={`text-[10px] font-semibold flex items-center gap-0.5 justify-end ${trend.direction === 'up' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {trend.direction === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend.change}
                  </div>
                </div>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1">
                <div className={`h-1 rounded-full ${trend.direction === 'up' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} style={{ width: `${Math.abs(parseFloat(trend.change))}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
