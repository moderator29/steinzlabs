'use client';

import { Radio, Activity, HardDrive, Zap, Globe, Loader2, RefreshCw } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { networkMetricsHowItWorks } from '@/lib/howItWorks/content/network-metrics';
import { useState, useEffect, useCallback } from 'react';

interface ChainMetrics { gas: string; tps: string; blocks: string }

export default function NetworkMetricsPage() {
  const [selectedChain, setSelectedChain] = useState('Ethereum');
  const [metrics, setMetrics] = useState<Record<string, ChainMetrics>>({});
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const chains = ['Ethereum', 'Solana', 'Base', 'Polygon', 'Arbitrum'];

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/network-metrics');
      if (res.ok) {
        const data = await res.json();
        if (!data.error) {
          const { fetchedAt: ts, ...chainData } = data as Record<string, unknown> & { fetchedAt?: string };
          setMetrics(chainData as Record<string, ChainMetrics>);
          setFetchedAt(typeof ts === 'string' ? ts : null);
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const m = metrics[selectedChain] || { gas: '—', tps: '—', blocks: '—' };

  // Honest health signal derived from real data: a chain is "responding" only
  // when the Alchemy RPC actually returned a current block for it. A value of
  // '—' (never fetched) or 'N/A' (fetch failed) means we cannot claim health,
  // so we never render a fabricated "Healthy / Excellent" badge.
  const hasBlock = m.blocks !== '—' && m.blocks !== 'N/A';
  const hasGas = m.gas !== '—' && m.gas !== 'N/A' && !m.gas.startsWith('N/A');
  const responding = hasBlock;
  const statusLabel = loading ? 'Checking…' : responding ? 'Live' : 'Unavailable';
  const statusColor = responding ? '#10B981' : '#F59E0B';

  return (
    <div className="min-h-screen text-white pb-20">
      <div className="sticky top-0 z-40 nl-glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <Radio className="w-5 h-5 text-[#0066FF]" />
          <h1 className="text-sm font-heading font-bold">Network Metrics</h1>
          <button
            onClick={fetchMetrics}
            disabled={loading}
            aria-label="Refresh network metrics"
            className="ms-auto shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <HowItWorksButton content={networkMetricsHowItWorks} className="shrink-0" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {chains.map((chain) => (
            <button key={chain} onClick={() => setSelectedChain(chain)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${selectedChain === chain ? 'nl-button' : 'nl-button--ghost'}`}>
              {chain}
            </button>
          ))}
        </div>

        <div className="nl-glass rounded-xl p-4 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#0066FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <Globe className="w-8 h-8 text-[#0066FF]" />
          </div>
          <h2 className="text-base font-heading font-bold">{selectedChain}</h2>
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className={`w-2 h-2 rounded-full ${responding ? 'animate-pulse' : ''}`} style={{ backgroundColor: statusColor }}></div>
            <span className="text-[10px]" style={{ color: statusColor }}>
              {loading ? 'Checking RPC…' : responding ? 'RPC Responding · Live' : 'RPC Unavailable'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Zap, label: 'Gas Price', value: m.gas, color: '#F59E0B' },
            { icon: Activity, label: 'TPS', value: m.tps, color: '#10B981' },
            { icon: HardDrive, label: 'Latest Block', value: m.blocks, color: '#0066FF' },
            { icon: Globe, label: 'Status', value: statusLabel, color: statusColor },
          ].map((item) => (
            <div key={item.label} className="nl-glass rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                <span className="text-[10px] text-gray-500">{item.label}</span>
              </div>
              <div className="text-sm font-bold">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="nl-glass rounded-xl p-4">
          <h3 className="font-bold text-sm mb-3">Network Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-xs text-gray-400">Latest Block</span>
              <span className="text-xs font-mono font-semibold">{m.blocks}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-xs text-gray-400">Gas Price</span>
              <span className="text-xs font-mono font-semibold">{m.gas}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-xs text-gray-400">Data Source</span>
              {/* Only claim "Live" when the RPC actually returned a current block
                  for this chain; otherwise report the honest fetch state. */}
              <span className="text-xs font-semibold text-[#4D6BFF]">
                Alchemy RPC{responding ? ' · Live' : loading ? '' : ' · No response'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-xs text-gray-400">RPC Status</span>
              <span className="text-xs font-semibold" style={{ color: statusColor }}>
                {loading ? 'Checking…' : responding ? (hasGas ? 'Block + gas live' : 'Block live') : 'Not responding'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-xs text-gray-400">Last Updated</span>
              <span className="text-xs font-mono font-semibold text-gray-300">
                {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : '—'}
              </span>
            </div>
          </div>
        </div>

        {!loading && !responding && (
          <p className="text-[11px] text-gray-500 text-center px-2">
            No live data returned for {selectedChain} on the last poll. Figures show as “N/A” until the RPC responds. Try Refresh.
          </p>
        )}
      </div>
    </div>
  );
}
