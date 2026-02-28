'use client';

import { Search, ArrowLeft, Wallet, TrendingUp, Clock, DollarSign, Activity, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function WalletIntelligencePage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    if (address.trim()) setSearched(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Search className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Wallet Intelligence</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="glass rounded-xl p-4 border border-white/10">
          <h2 className="font-bold text-sm mb-2">Analyze Any Wallet</h2>
          <p className="text-[10px] text-gray-500 mb-3">Get AI-powered insights on any wallet address across chains</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter wallet address (0x...)"
              className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#00E5FF]/30"
            />
            <button onClick={handleSearch} className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-4 py-2.5 rounded-lg text-xs font-semibold">
              Scan
            </button>
          </div>
        </div>

        {searched && (
          <>
            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[#00E5FF]" />
                </div>
                <div>
                  <div className="text-xs font-mono font-semibold">{address.slice(0, 8)}...{address.slice(-6)}</div>
                  <div className="text-[10px] text-gray-500">Active since Jan 2023 · Ethereum</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Total Balance', value: '$284,520', icon: DollarSign, color: '#10B981' },
                  { label: 'Win Rate', value: '78%', icon: TrendingUp, color: '#00E5FF' },
                  { label: 'Avg Hold Time', value: '14.2d', icon: Clock, color: '#F59E0B' },
                  { label: 'TX Count', value: '1,247', icon: Activity, color: '#7C3AED' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#111827] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <stat.icon className="w-3 h-3" style={{ color: stat.color }} />
                      <span className="text-[10px] text-gray-500">{stat.label}</span>
                    </div>
                    <div className="text-sm font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <h3 className="font-bold text-sm mb-3">Top Holdings</h3>
              <div className="space-y-2">
                {[
                  { token: 'ETH', amount: '45.2', usd: '$156,892', pct: 55 },
                  { token: 'USDC', amount: '52,400', usd: '$52,400', pct: 18 },
                  { token: 'SOL', amount: '320', usd: '$38,240', pct: 13 },
                  { token: 'LINK', amount: '2,100', usd: '$25,620', pct: 9 },
                  { token: 'ARB', amount: '8,500', usd: '$11,368', pct: 5 },
                ].map((h) => (
                  <div key={h.token} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-[#00E5FF]/10 rounded-full flex items-center justify-center text-[10px] font-bold text-[#00E5FF]">{h.token.charAt(0)}</div>
                      <div>
                        <div className="text-xs font-semibold">{h.token}</div>
                        <div className="text-[10px] text-gray-500">{h.amount}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold">{h.usd}</div>
                      <div className="text-[10px] text-gray-500">{h.pct}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <h3 className="font-bold text-sm mb-3">AI Wallet Assessment</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl font-bold text-[#10B981]">82</div>
                <div className="flex-1">
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="h-2 rounded-full bg-[#10B981]" style={{ width: '82%' }}></div>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded text-[10px] font-semibold">SMART MONEY</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">This wallet exhibits strong trading patterns with high win rate and consistent profit-taking. Classified as a sophisticated DeFi trader with deep market knowledge.</p>
            </div>
          </>
        )}

        {!searched && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500">Enter a wallet address to begin</h3>
            <p className="text-xs text-gray-600 mt-1">Supports ETH, SOL, BSC, and Polygon addresses</p>
          </div>
        )}
      </div>
    </div>
  );
}
