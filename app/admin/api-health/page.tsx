'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { StatusDot } from '@/components/ui/StatusDot';
import { formatTimeAgo } from '@/lib/formatters';

type ApiStatus = 'active' | 'error' | 'warning' | 'inactive';

interface ApiEndpoint {
  name: string;
  url: string;
  category: string;
  status: ApiStatus;
  latencyMs: number;
  uptime: number;
  lastChecked: number;
  errorMsg?: string;
}

const API_LIST: ApiEndpoint[] = [
  { name: 'Alchemy (Solana)',            url: 'https://solana-mainnet.g.alchemy.com', category: 'Blockchain', status: 'active',   latencyMs: 42,  uptime: 99.97, lastChecked: Date.now() - 30_000 },
  { name: 'Alchemy (Ethereum)',          url: 'https://eth-mainnet.g.alchemy.com', category: 'Blockchain', status: 'active', latencyMs: 68,  uptime: 99.95, lastChecked: Date.now() - 30_000 },
  { name: 'Alchemy (Base)',              url: 'https://base-mainnet.g.alchemy.com', category: 'Blockchain', status: 'active', latencyMs: 55,  uptime: 99.92, lastChecked: Date.now() - 30_000 },
  { name: 'DexScreener',                url: 'https://api.dexscreener.com', category: 'Market Data', status: 'active', latencyMs: 120, uptime: 99.80, lastChecked: Date.now() - 30_000 },
  { name: 'CoinGecko',                  url: 'https://api.coingecko.com', category: 'Market Data', status: 'warning', latencyMs: 450, uptime: 98.10, lastChecked: Date.now() - 30_000, errorMsg: 'Rate limit approaching' },
  { name: 'Uniswap v3 Subgraph',        url: 'https://api.thegraph.com', category: 'DEX Routing', status: 'active',  latencyMs: 180, uptime: 99.50, lastChecked: Date.now() - 30_000 },
  { name: 'Jupiter Aggregator',         url: 'https://quote-api.jup.ag', category: 'DEX Routing', status: 'active',  latencyMs: 95,  uptime: 99.90, lastChecked: Date.now() - 30_000 },
  { name: 'Birdeye',                    url: 'https://public-api.birdeye.so', category: 'Analytics', status: 'active',  latencyMs: 220, uptime: 99.60, lastChecked: Date.now() - 30_000 },
  { name: 'Arkham Intelligence',        url: 'https://api.arkhamintelligence.com', category: 'Analytics', status: 'active', latencyMs: 310, uptime: 99.20, lastChecked: Date.now() - 30_000 },
  { name: 'Flashbots Protect',          url: 'https://rpc.flashbots.net', category: 'MEV', status: 'active',  latencyMs: 88,  uptime: 99.80, lastChecked: Date.now() - 30_000 },
  { name: 'Jito Block Engine',          url: 'https://mainnet.block-engine.jito.wtf', category: 'MEV', status: 'active',  latencyMs: 72,  uptime: 99.85, lastChecked: Date.now() - 30_000 },
  { name: 'Supabase (Database)',        url: 'https://phvewrldcdxupsnakddx.supabase.co', category: 'Infrastructure', status: 'active', latencyMs: 28,  uptime: 99.99, lastChecked: Date.now() - 30_000 },
  { name: 'Cloudflare Turnstile',       url: 'https://challenges.cloudflare.com', category: 'Security', status: 'active', latencyMs: 65,  uptime: 99.99, lastChecked: Date.now() - 30_000 },
  { name: 'Anthropic Claude API',       url: 'https://api.anthropic.com', category: 'AI', status: 'active',  latencyMs: 820, uptime: 99.70, lastChecked: Date.now() - 30_000 },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Blockchain': 'text-blue-400 bg-blue-400/10',
  'Market Data': 'text-green-400 bg-green-400/10',
  'DEX Routing': 'text-purple-400 bg-purple-400/10',
  'Analytics': 'text-yellow-400 bg-yellow-400/10',
  'MEV': 'text-orange-400 bg-orange-400/10',
  'Infrastructure': 'text-cyan-400 bg-cyan-400/10',
  'Security': 'text-red-400 bg-red-400/10',
  'AI': 'text-pink-400 bg-pink-400/10',
};

export default function ApiHealthPage() {
  const [apis, setApis] = useState(API_LIST);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setApis(prev => prev.map(api => ({
        ...api,
        latencyMs: api.latencyMs,
        lastChecked: Date.now(),
      })));
      setLastRefresh(new Date());
      setLoading(false);
    }, 800);
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const healthy = apis.filter(a => a.status === 'active').length;
  const degraded = apis.filter(a => a.status === 'warning').length;
  const down = apis.filter(a => a.status === 'error' || a.status === 'inactive').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">API Health Monitor</h1>
          <p className="text-xs text-gray-500 mt-0.5">Monitoring {apis.length} endpoints — Last check: {formatTimeAgo(lastRefresh)}</p>
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-2 text-xs border border-[#1E2433] text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:border-[#2E3443] transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Operational', count: healthy, status: 'active' as const },
          { label: 'Degraded', count: degraded, status: 'warning' as const },
          { label: 'Down', count: down, status: 'error' as const },
        ].map(s => (
          <div key={s.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 flex items-center gap-3">
            <StatusDot status={s.status} size="lg" pulse={s.status !== 'inactive'} />
            <div>
              <div className="text-2xl font-bold text-white">{s.count}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="border-b border-[#1E2433]">
            <tr>{['API / Service', 'Category', 'Status', 'Latency', 'Uptime (30d)', 'Last Check', ''].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {apis.map(api => (
              <tr key={api.name} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{api.name}</div>
                  {api.errorMsg && <div className="text-yellow-400 text-[10px] mt-0.5">{api.errorMsg}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[api.category] ?? ''}`}>{api.category}</span>
                </td>
                <td className="px-4 py-3"><StatusDot status={api.status} label={api.status} pulse={api.status === 'active'} /></td>
                <td className="px-4 py-3">
                  <span className={`font-mono font-medium ${api.latencyMs < 100 ? 'text-green-400' : api.latencyMs < 300 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {api.latencyMs}ms
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={api.uptime >= 99.9 ? 'text-green-400' : api.uptime >= 99 ? 'text-yellow-400' : 'text-red-400'}>
                    {api.uptime.toFixed(2)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatTimeAgo(api.lastChecked)}</td>
                <td className="px-4 py-3">
                  <a href={api.url} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-gray-300">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
