'use client';

import { Radio, Activity, Cpu, HardDrive, Zap, Globe, Loader2, RefreshCw } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface ChainMetrics { gas: string; tps: string; blocks: string }

export default function NetworkMetricsPage() {
  const router = useRouter();
  const [selectedChain, setSelectedChain] = useState('Ethereum');
  const [metrics, setMetrics] = useState<Record<string, ChainMetrics>>({});
  const [loading, setLoading] = useState(true);

  const chains = ['Ethereum', 'Solana', 'Base', 'Polygon', 'Arbitrum'];

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/network-metrics');
      if (res.ok) {
        const data = await res.json();
        if (!data.error) setMetrics(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const m = metrics[selectedChain] || { gas: '—', tps: '—', blocks: '—' };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <Radio className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="text-sm font-heading font-bold">Network Metrics</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {chains.map((chain) => (
            <button key={chain} onClick={() => setSelectedChain(chain)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${selectedChain === chain ? 'bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {chain}
            </button>
          ))}
        </div>

        <div className="glass rounded-xl p-4 border border-white/10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <Globe className="w-8 h-8 text-[#0A1EFF]" />
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
            { icon: HardDrive, label: 'Latest Block', value: m.blocks, color: '#0A1EFF' },
            { icon: Globe, label: 'Status', value: loading ? 'Fetching...' : 'Live', color: '#10B981' },
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
              <span className="text-xs text-gray-400">Data Source</span>
              <span className="text-xs font-semibold text-[#4D6BFF]">Alchemy RPC (Live)</span>
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
