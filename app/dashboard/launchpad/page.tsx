'use client';

import { Rocket, ArrowLeft, Clock, Users, DollarSign, TrendingUp, CheckCircle, Zap, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LaunchpadPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');

  const launches = [
    { name: 'SolSwap Pro', desc: 'Next-gen DEX with AI routing on Solana', raised: '$1.2M', goal: '$2M', pct: 60, status: 'Live', chain: 'Solana', investors: 847, daysLeft: 12, verified: true },
    { name: 'ChainGuard', desc: 'Real-time exploit detection system', raised: '$800K', goal: '$1M', pct: 80, status: 'Live', chain: 'Ethereum', investors: 1234, daysLeft: 5, verified: true },
    { name: 'MetaRealm', desc: 'Web3 MMORPG with player economies', raised: '$3.5M', goal: '$3.5M', pct: 100, status: 'Funded', chain: 'Polygon', investors: 2891, daysLeft: 0, verified: true },
    { name: 'DeFi Pulse', desc: 'Advanced DeFi analytics platform', raised: '$0', goal: '$500K', pct: 0, status: 'Upcoming', chain: 'Arbitrum', investors: 0, daysLeft: 30, verified: false },
    { name: 'NFT Nexus', desc: 'Cross-chain NFT marketplace and launchpad', raised: '$250K', goal: '$750K', pct: 33, status: 'Live', chain: 'Base', investors: 456, daysLeft: 18, verified: true },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Rocket className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Launchpad</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#10B981]">$5.75M</div>
            <div className="text-[10px] text-gray-500">Total Raised</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#00E5FF]">12</div>
            <div className="text-[10px] text-gray-500">Projects</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#7C3AED]">5.4K</div>
            <div className="text-[10px] text-gray-500">Investors</div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Live', 'Upcoming', 'Funded'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {launches
            .filter(l => filter === 'All' || l.status === filter)
            .map((launch) => (
            <div key={launch.name} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-bold">{launch.name.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1">
                      {launch.name}
                      {launch.verified && <CheckCircle className="w-3 h-3 text-[#00E5FF]" />}
                    </div>
                    <div className="text-[10px] text-gray-500">{launch.desc}</div>
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${launch.status === 'Live' ? 'bg-[#10B981]/20 text-[#10B981]' : launch.status === 'Funded' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'}`}>
                  {launch.status}
                </span>
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-gray-500">{launch.raised} / {launch.goal}</span>
                  <span className="font-semibold text-[#00E5FF]">{launch.pct}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className="h-2 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED]" style={{ width: `${launch.pct}%` }}></div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[10px] text-gray-500">
                <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {launch.investors}</span>
                <span>{launch.chain}</span>
                {launch.daysLeft > 0 && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {launch.daysLeft}d left</span>}
                <button className="ml-auto text-[#00E5FF] font-semibold flex items-center gap-0.5">
                  Details <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
