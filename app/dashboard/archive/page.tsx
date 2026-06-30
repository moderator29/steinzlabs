'use client';

/**
 * Archive — the Context Feed, historical. Renders the persisted 24–72h event
 * window with the exact same cards, chain tabs, and type-filter pills as the
 * live feed (via the shared ContextEventCard + matchesTypeFilter), so it reads
 * as "the feed, just archived" rather than a separate, divergent surface.
 */

import { Archive, Clock, Search, ChevronDown } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { useState, useMemo } from 'react';
import { useArchivedFeed, type ChainFilter, type ContextEventFilter } from '@/lib/hooks/useContextFeed';
import ContextEventCard from '@/components/context-feed/ContextEventCard';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { archiveHowItWorks } from '@/lib/howItWorks/content/archive';

// Pill → the underscored event types it surfaces. Source fetchers emit a
// different taxonomy than the UI pills, and hyphen/prefix variants drift, so we
// normalise to underscores and match on inclusion. (Self-contained here to keep
// this branch independent of the parallel context-feed branch that adds the
// shared matcher to lib/contextFeed/filter.ts.)
const FILTER_TYPE_MAP: Record<Exclude<ContextEventFilter, 'all'>, readonly string[]> = {
  news: ['new_listing', 'trending', 'token_launch'],
  coins: ['new_listing', 'token_launch', 'trade', 'trending'],
  new_coins: ['new_listing', 'token_launch'],
  volume: ['whale_accumulation', 'whale_sell', 'large_transfer', 'trade'],
  trending: ['trending'],
};
function matchesType(type: string | undefined, filter: ContextEventFilter): boolean {
  if (filter === 'all') return true;
  const t = (type || '').toLowerCase().replace(/-/g, '_');
  return FILTER_TYPE_MAP[filter].some((allowed) => t.includes(allowed));
}

// Same type-filter pills as the live feed (drives the shared matchesTypeFilter).
const TYPE_FILTERS: { key: ContextEventFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'news', label: 'News' },
  { key: 'coins', label: 'Coins' },
  { key: 'new_coins', label: 'New' },
  { key: 'trending', label: 'Trending' },
  { key: 'volume', label: 'Volume' },
];

const CHAIN_FILTERS: { key: ChainFilter; label: string; color: string }[] = [
  { key: 'all', label: 'All Chains', color: '#9CA3AF' },
  { key: 'ethereum', label: 'ETH', color: '#627EEA' },
  { key: 'solana', label: 'SOL', color: '#9945FF' },
  { key: 'base', label: 'Base', color: '#0052FF' },
  { key: 'bsc', label: 'BSC', color: '#F0B90B' },
  { key: 'polygon', label: 'MATIC', color: '#8247E5' },
  { key: 'arbitrum', label: 'ARB', color: '#28A0F0' },
];

export default function ArchivePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContextEventFilter>('all');
  const [chainFilter, setChainFilter] = useState<ChainFilter>('all');
  const [visibleCount, setVisibleCount] = useState(20);

  // The archive hook fetches the persisted 24–72h window for the chain.
  const { events, loading } = useArchivedFeed(chainFilter);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((e) => {
      if (!matchesType(e.type, typeFilter)) return false;
      if (q) {
        return (
          e.title?.toLowerCase().includes(q) ||
          e.summary?.toLowerCase().includes(q) ||
          (e.tokenSymbol?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [events, typeFilter, searchQuery]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);

  return (
    <div className="min-h-screen text-white pb-20">
      <div className="sticky top-0 z-40 nl-glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <BackButton />
          <Archive className="w-5 h-5 text-[#0066FF]" />
          <h1 className="text-sm font-heading font-bold">Archive</h1>
          <span className="text-[10px] text-gray-500 ms-1">Events older than 24h</span>
          <HowItWorksButton content={archiveHowItWorks} className="ms-auto shrink-0" />
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Search */}
        <div className="flex items-center gap-2 nl-glass rounded-xl px-3 py-2.5 transition-colors">
          <Search className="w-4 h-4 text-gray-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived events..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600 text-white"
          />
        </div>

        {/* Type pills (same as the live feed) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                typeFilter === f.key
                  ? 'bg-[#0066FF]/20 text-[#0066FF] border border-[#0066FF]/30'
                  : 'text-gray-500 border border-white/[0.06] hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Chain pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {CHAIN_FILTERS.map((c) => (
            <button
              key={c.key}
              onClick={() => { setChainFilter(c.key); setVisibleCount(20); }}
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

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{filteredEvents.length} archived events</span>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
            <Clock className="w-3 h-3" />
            <span>Sorted by most recent</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="nl-glass rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-16 rounded-full bg-white/5" />
                  <div className="h-5 w-12 rounded bg-white/5" />
                </div>
                <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
                <div className="h-3 bg-white/5 rounded w-full mb-1" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <Archive className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500">No archived events found</h3>
            <p className="text-xs text-gray-600 mt-1">Older events appear here once they pass 24h. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleEvents.map((event) => (
              <ContextEventCard key={event.id} event={event} />
            ))}

            {visibleCount < filteredEvents.length && (
              <button
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="w-full py-3 rounded-xl text-xs font-semibold nl-button--ghost flex items-center justify-center gap-2"
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
