'use client';

import { Link2, ArrowLeft, Users, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WalletClustersPage() {
  const router = useRouter();

  const clusters = [
    { id: 'C-001', name: 'Alpha Whale Group', wallets: 23, totalValue: '$142M', risk: 'Low', connections: 187, activity: 'High', color: '#10B981' },
    { id: 'C-002', name: 'DeFi Power Users', wallets: 45, totalValue: '$89M', risk: 'Low', connections: 312, activity: 'Very High', color: '#00E5FF' },
    { id: 'C-003', name: 'Suspicious Cluster #47', wallets: 12, totalValue: '$28M', risk: 'High', connections: 56, activity: 'Medium', color: '#EF4444' },
    { id: 'C-004', name: 'NFT Collectors Ring', wallets: 67, totalValue: '$34M', risk: 'Medium', connections: 423, activity: 'High', color: '#F59E0B' },
    { id: 'C-005', name: 'MEV Bot Network', wallets: 8, totalValue: '$67M', risk: 'High', connections: 34, activity: 'Very High', color: '#EF4444' },
    { id: 'C-006', name: 'VC Fund Wallets', wallets: 15, totalValue: '$450M', risk: 'Low', connections: 89, activity: 'Low', color: '#7C3AED' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Link2 className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Wallet Clusters</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#00E5FF]">170</div>
            <div className="text-[10px] text-gray-500">Clusters</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#7C3AED]">2.4K</div>
            <div className="text-[10px] text-gray-500">Wallets</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#F59E0B]">18</div>
            <div className="text-[10px] text-gray-500">Suspicious</div>
          </div>
        </div>

        <div className="space-y-2">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cluster.color}20` }}>
                    <Users className="w-4 h-4" style={{ color: cluster.color }} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{cluster.name}</div>
                    <div className="text-[10px] text-gray-500">{cluster.id} · {cluster.wallets} wallets</div>
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cluster.risk === 'Low' ? 'bg-[#10B981]/20 text-[#10B981]' : cluster.risk === 'Medium' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#EF4444]/20 text-[#EF4444]'}`}>
                  {cluster.risk} Risk
                </span>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-gray-500">
                <span>Value: {cluster.totalValue}</span>
                <span>Links: {cluster.connections}</span>
                <span>Activity: {cluster.activity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
