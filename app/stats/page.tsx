'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, BarChart3, TrendingUp, Zap, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface StatsData {
  totalTrades: number;
  totalVolumeUsd: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  topPairs: Array<{ pair: string; count: number }>;
  chainVolumes: Record<number, number>;
  recentTrades: Array<{
    pair: string;
    amountUsd: number;
    wallet: string;
    timestamp: string;
    chainId: number;
  }>;
  gaslessRatio: number;
  standardCount: number;
  gaslessCount: number;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum',
  137: 'Polygon', 43114: 'Avalanche', 56: 'BNB', 10: 'Optimism',
};

function fmtUsd(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/public-stats')
      .then(r => r.json())
      .then(d => { if (!d.error) setStats(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const volume = stats
    ? period === '24h' ? stats.volume24h
    : period === '7d' ? stats.volume7d
    : period === '30d' ? stats.volume30d
    : stats.totalVolumeUsd
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Platform Stats</h1>
            <p className="text-xs text-gray-400">Real-time trading activity on Naka Labs</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading stats...</div>
        ) : !stats ? (
          <div className="text-center py-20 text-gray-500">No trading data available yet.</div>
        ) : (
          <div className="space-y-6">
            {/* Volume + Period Toggle */}
            <div className="bg-[#0f1320] rounded-2xl p-6 border border-[#1a1f2e]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#0A1EFF]" />
                  <span className="font-bold">Total Volume</span>
                </div>
                <div className="flex gap-1">
                  {(['24h', '7d', '30d', 'all'] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`px-3 py-1 text-xs rounded-lg ${period === p ? 'bg-[#0A1EFF] text-white' : 'bg-white/5 text-gray-400'}`}
                    >{p === 'all' ? 'All Time' : p}</button>
                  ))}
                </div>
              </div>
              <div className="text-3xl font-bold">{fmtUsd(volume)}</div>
              <div className="text-sm text-gray-400 mt-1">{stats.totalTrades.toLocaleString()} total trades</div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0f1320] rounded-xl p-4 border border-[#1a1f2e]">
                <TrendingUp className="w-4 h-4 text-green-400 mb-1" />
                <div className="text-xs text-gray-400">Standard Swaps</div>
                <div className="text-lg font-bold">{stats.standardCount}</div>
              </div>
              <div className="bg-[#0f1320] rounded-xl p-4 border border-[#1a1f2e]">
                <Zap className="w-4 h-4 text-yellow-400 mb-1" />
                <div className="text-xs text-gray-400">Gasless Swaps</div>
                <div className="text-lg font-bold">{stats.gaslessCount}</div>
              </div>
              <div className="bg-[#0f1320] rounded-xl p-4 border border-[#1a1f2e]">
                <Activity className="w-4 h-4 text-purple-400 mb-1" />
                <div className="text-xs text-gray-400">Gasless Adoption</div>
                <div className="text-lg font-bold">{(stats.gaslessRatio * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-[#0f1320] rounded-xl p-4 border border-[#1a1f2e]">
                <BarChart3 className="w-4 h-4 text-blue-400 mb-1" />
                <div className="text-xs text-gray-400">Top Pairs</div>
                <div className="text-lg font-bold">{stats.topPairs.length}</div>
              </div>
            </div>

            {/* Top Pairs */}
            {stats.topPairs.length > 0 && (
              <div className="bg-[#0f1320] rounded-2xl p-5 border border-[#1a1f2e]">
                <h3 className="font-bold text-sm mb-3">Top Traded Pairs</h3>
                <div className="space-y-2">
                  {stats.topPairs.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{p.pair}</span>
                      <span className="text-gray-500">{p.count} trades</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Trades Ticker */}
            {stats.recentTrades.length > 0 && (
              <div className="bg-[#0f1320] rounded-2xl p-5 border border-[#1a1f2e]">
                <h3 className="font-bold text-sm mb-3">Recent Trades</h3>
                <div className="space-y-2">
                  {stats.recentTrades.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-mono">{t.wallet}</span>
                        <span className="text-white font-semibold">{t.pair}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-300">{fmtUsd(t.amountUsd)}</span>
                        <span className="text-gray-500 text-[10px]">{CHAIN_NAMES[t.chainId] || `Chain ${t.chainId}`}</span>
                        <span className="text-gray-500">{timeAgo(t.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
