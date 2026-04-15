'use client';

import { ArrowLeft, Archive, Clock, Filter, Search, TrendingUp, TrendingDown, Zap, AlertTriangle, RefreshCw, ChevronDown, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface ArchivedEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  chain: string;
  timestamp: string;
  timeAgo: string;
  significance: number;
  tokenSymbol?: string;
  priceChange?: number;
  volume?: string;
  walletAddress?: string;
  txHash?: string;
}

const FILTER_OPTIONS = [
  { key: 'all', label: 'All Events' },
  { key: 'whale', label: 'Whale Moves' },
  { key: 'price', label: 'Price Alerts' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'governance', label: 'Governance' },
  { key: 'security', label: 'Security' },
];

const CHAIN_FILTERS = [
  { key: 'all', label: 'All Chains', color: '#9CA3AF' },
  { key: 'ethereum', label: 'ETH', color: '#627EEA' },
  { key: 'solana', label: 'SOL', color: '#9945FF' },
  { key: 'base', label: 'Base', color: '#0052FF' },
  { key: 'bsc', label: 'BSC', color: '#F0B90B' },
  { key: 'polygon', label: 'MATIC', color: '#8247E5' },
];

function generateArchivedEvents(): ArchivedEvent[] {
  const events: ArchivedEvent[] = [];
  const types = ['whale_transfer', 'price_alert', 'liquidity_change', 'governance_vote', 'contract_deployment', 'large_swap'];
  const chains = ['Ethereum', 'Solana', 'Base', 'BSC', 'Polygon'];
  const tokens = ['ETH', 'SOL', 'BTC', 'USDC', 'LINK', 'UNI', 'AAVE', 'ARB', 'OP', 'PEPE'];

  for (let i = 0; i < 50; i++) {
    const type = types[i % types.length];
    const chain = chains[i % chains.length];
    const token = tokens[i % tokens.length];
    const hoursAgo = 24 + Math.floor(Math.random() * 168);
    const daysAgo = Math.floor(hoursAgo / 24);

    let title = '';
    let description = '';

    switch (type) {
      case 'whale_transfer':
        title = `Whale moved ${(Math.random() * 10000 + 500).toFixed(0)} ${token}`;
        description = `Large transfer detected on ${chain}. Value: $${(Math.random() * 5000000 + 100000).toFixed(0)}`;
        break;
      case 'price_alert':
        title = `${token} ${Math.random() > 0.5 ? 'surged' : 'dropped'} ${(Math.random() * 15 + 2).toFixed(1)}%`;
        description = `Significant price movement detected for ${token} on ${chain}`;
        break;
      case 'liquidity_change':
        title = `$${(Math.random() * 2000000 + 50000).toFixed(0)} liquidity ${Math.random() > 0.5 ? 'added' : 'removed'}`;
        description = `${token}/USDC pool on ${chain}`;
        break;
      case 'governance_vote':
        title = `${token} governance proposal ${Math.random() > 0.5 ? 'passed' : 'active'}`;
        description = `Community vote on protocol upgrade`;
        break;
      case 'contract_deployment':
        title = `New contract deployed on ${chain}`;
        description = `Verified contract with ${(Math.random() * 1000).toFixed(0)} initial transactions`;
        break;
      case 'large_swap':
        title = `${(Math.random() * 5000 + 100).toFixed(0)} ${token} swapped`;
        description = `DEX swap on ${chain} via ${chain === 'Solana' ? 'Raydium' : chain === 'Ethereum' ? 'Uniswap' : 'PancakeSwap'}`;
        break;
    }

    events.push({
      id: `archive-${i}`,
      type,
      title,
      description,
      chain: chain.toLowerCase(),
      timestamp: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
      timeAgo: daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`,
      significance: Math.floor(Math.random() * 10) + 1,
      tokenSymbol: token,
      priceChange: type === 'price_alert' ? (Math.random() * 30 - 15) : undefined,
      volume: `$${(Math.random() * 10000000 + 10000).toFixed(0)}`,
    });
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function getEventIcon(type: string) {
  switch (type) {
    case 'whale_transfer': return { icon: Zap, color: '#0A1EFF' };
    case 'price_alert': return { icon: TrendingUp, color: '#10B981' };
    case 'liquidity_change': return { icon: RefreshCw, color: '#7C3AED' };
    case 'governance_vote': return { icon: Filter, color: '#F59E0B' };
    case 'security': return { icon: AlertTriangle, color: '#EF4444' };
    default: return { icon: Zap, color: '#6B7280' };
  }
}

export default function ArchivePage() {
  const router = useRouter();
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [chainFilter, setChainFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    fetch('/api/context-feed?archived=true&limit=100')
      .then(r => r.json())
      .then(data => {
        const mapped = (data.events || []).map((e: Record<string, unknown>) => ({
          id: e.id as string || String(Date.now()),
          type: e.type as string || 'whale_transfer',
          title: e.title as string || '',
          description: e.summary as string || '',
          chain: e.chain as string || 'ethereum',
          timestamp: e.timestamp as string || new Date().toISOString(),
          timeAgo: '',
          significance: (e.trustScore as number) ? Math.ceil((e.trustScore as number) / 10) : 5,
          priceChange: e.tokenPriceChange24h as number || undefined,
          volume: e.tokenVolume24h ? `$${(e.tokenVolume24h as number).toLocaleString()}` : undefined,
        }));
        setEvents(mapped);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = events.filter(e => {
    if (typeFilter !== 'all' && !e.type.includes(typeFilter)) return false;
    if (chainFilter !== 'all' && e.chain !== chainFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || (e.tokenSymbol?.toLowerCase().includes(q));
    }
    return true;
  });

  const visibleEvents = filteredEvents.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Archive className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="text-sm font-heading font-bold">Archive</h1>
          <span className="text-[10px] text-gray-500 ml-1">Events older than 24h</span>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 bg-[#111827] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0A1EFF]/40 transition-colors">
          <Search className="w-4 h-4 text-gray-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived events..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600 text-white"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                  typeFilter === f.key
                    ? 'bg-[#0A1EFF]/20 text-[#0A1EFF] border border-[#0A1EFF]/30'
                    : 'text-gray-500 border border-white/[0.06] hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {CHAIN_FILTERS.map(c => (
              <button
                key={c.key}
                onClick={() => setChainFilter(c.key)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all border"
                style={{
                  borderColor: chainFilter === c.key ? c.color : 'rgba(255,255,255,0.04)',
                  backgroundColor: chainFilter === c.key ? `${c.color}15` : 'transparent',
                  color: chainFilter === c.key ? c.color : '#6B7280',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{filteredEvents.length} archived events</span>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
            <Clock className="w-3 h-3" />
            <span>Sorted by most recent</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#111827] rounded-xl p-4 border border-white/[0.04] animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white/5 rounded w-3/4" />
                    <div className="h-2 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <Archive className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500">No archived events found</h3>
            <p className="text-xs text-gray-600 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleEvents.map((event) => {
              const { icon: EventIcon, color } = getEventIcon(event.type);
              return (
                <div key={event.id} className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.04] hover:border-white/[0.08] transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                      <EventIcon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-xs font-semibold text-white truncate">{event.title}</h4>
                        {event.significance >= 8 && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold shrink-0">HIGH</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mb-2">{event.description}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[9px] text-gray-600 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {event.timeAgo}
                        </span>
                        {event.tokenSymbol && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0A1EFF]/10 text-[#0A1EFF] font-semibold">
                            {event.tokenSymbol}
                          </span>
                        )}
                        {event.priceChange !== undefined && (
                          <span className={`text-[9px] font-semibold flex items-center gap-0.5 ${event.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {event.priceChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {event.priceChange >= 0 ? '+' : ''}{event.priceChange.toFixed(1)}%
                          </span>
                        )}
                        {event.volume && (
                          <span className="text-[9px] text-gray-600">Vol: {event.volume}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleCount < filteredEvents.length && (
              <button
                onClick={() => setVisibleCount(prev => prev + 20)}
                className="w-full py-3 rounded-xl text-xs font-semibold text-gray-400 bg-[#111827] border border-white/[0.04] hover:border-white/[0.08] transition-all flex items-center justify-center gap-2"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Load more ({filteredEvents.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
