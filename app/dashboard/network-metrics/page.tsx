'use client';

import { Radio, ArrowLeft, Activity, Cpu, HardDrive, Zap, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NetworkMetricsPage() {
  const router = useRouter();
  const [selectedChain, setSelectedChain] = useState('Ethereum');

  const chains = ['Ethereum', 'Solana', 'BSC', 'Polygon', 'Arbitrum'];

  const metrics: Record<string, { gas: string; tps: string; validators: string; tvl: string; blocks: string; pendingTx: string }> = {
    Ethereum: { gas: '24 Gwei', tps: '15.2', validators: '895K', tvl: '$48.2B', blocks: '19,451,823', pendingTx: '142K' },
    Solana: { gas: '0.00025 SOL', tps: '4,200', validators: '1,847', tvl: '$4.8B', blocks: '248,912,445', pendingTx: '2.1K' },
    BSC: { gas: '3 Gwei', tps: '68', validators: '29', tvl: '$5.1B', blocks: '35,892,112', pendingTx: '8.4K' },
    Polygon: { gas: '45 Gwei', tps: '32', validators: '100', tvl: '$1.2B', blocks: '52,341,678', pendingTx: '12K' },
    Arbitrum: { gas: '0.1 Gwei', tps: '42', validators: 'N/A', tvl: '$2.8B', blocks: '178,234,567', pendingTx: '3.2K' },
  };

  const m = metrics[selectedChain];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Radio className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-sm font-heading font-bold">Network Metrics</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {chains.map((chain) => (
            <button key={chain} onClick={() => setSelectedChain(chain)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${selectedChain === chain ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {chain}
            </button>
          ))}
        </div>

        <div className="glass rounded-xl p-4 border border-white/10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <Globe className="w-8 h-8 text-[#00E5FF]" />
          </div>
          <h2 className="text-base font-heading font-bold">{selectedChain}</h2>
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
            <span className="text-[10px] text-[#10B981]">Network Healthy</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Zap, label: 'Gas Price', value: m.gas, color: '#F59E0B' },
            { icon: Activity, label: 'TPS', value: m.tps, color: '#10B981' },
            { icon: Cpu, label: 'Validators', value: m.validators, color: '#7C3AED' },
            { icon: HardDrive, label: 'TVL', value: m.tvl, color: '#00E5FF' },
          ].map((item) => (
            <div key={item.label} className="glass rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                <span className="text-[10px] text-gray-500">{item.label}</span>
              </div>
              <div className="text-sm font-bold">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-xl p-4 border border-white/10">
          <h3 className="font-bold text-sm mb-3">Network Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-xs text-gray-400">Latest Block</span>
              <span className="text-xs font-mono font-semibold">{m.blocks}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-xs text-gray-400">Pending Transactions</span>
              <span className="text-xs font-semibold">{m.pendingTx}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-xs text-gray-400">Network Health</span>
              <span className="text-xs font-semibold text-[#10B981]">Excellent</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
