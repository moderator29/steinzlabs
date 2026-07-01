'use client';

/**
 * Archive — two surfaces over the Context Feed:
 *
 *   • Saved   — the user's persistent, curated vault (Supabase saved_events,
 *               user-id bound). Events stay here forever, even after they roll
 *               out of the live window. Backed by useSavedEvents / the
 *               /api/archive/save route.
 *   • Recent  — the existing real, Supabase-backed 24-72h replay of the feed,
 *               rendered with the same shared ContextEventCard as the live feed.
 *
 * Every card carries a Save toggle, so curating the vault works from either tab.
 */

import { Archive, Clock, Search, ChevronDown, Bookmark } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { useState, useMemo } from 'react';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { useArchivedFeed, type ChainFilter, type ContextEventFilter, type ContextEvent } from '@/lib/hooks/useContextFeed';
import { useSavedEvents } from '@/lib/hooks/useSavedEvents';
import SavableEventCard from '@/components/context-feed/SavableEventCard';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { archiveHowItWorks } from '@/lib/howItWorks/content/archive';

// Pill → the underscored event types it surfaces. Source fetchers emit a
// different taxonomy than the UI pills, and hyphen/prefix variants drift, so we
// normalise to underscores and match on inclusion.
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

type Tab = 'saved' | 'recent';

function matchesSearch(e: ContextEvent, q: string): boolean {
  if (!q) return true;
  return (
    (e.title?.toLowerCase().includes(q) ?? false) ||
    (e.summary?.toLowerCase().includes(q) ?? false) ||
    (e.tokenSymbol?.toLowerCase().includes(q) ?? false)
  );
}

export default function ArchivePage() {
  const [tab, setTab] = useState<Tab>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContextEventFilter>('all');
  const [chainFilter, setChainFilter] = useState<ChainFilter>('all');
  const [visibleCount, setVisibleCount] = useState(20);

  // Recent: persisted 24-72h window for the chain (real, Supabase-backed).
  const { events, loading: recentLoading } = useArchivedFeed(chainFilter);
  // Saved: the user's persistent vault.
  const { rows, savedRefs, loading: savedLoading, unauthorized, toggle } = useSavedEvents();

  const q = searchQuery.trim().toLowerCase();

  const recentFiltered = useMemo(() => {
    return events.filter((e) => matchesType(e.type, typeFilter) && matchesSearch(e, q));
  }, [events, typeFilter, q]);

  const savedFiltered = useMemo(() => {
    return rows
      .map((r) => r.payload)
      .filter((e) => {
        if (chainFilter !== 'all' && e.chain !== chainFilter) return false;
        return matchesType(e.type, typeFilter) && matchesSearch(e, q);
      });
  }, [rows, chainFilter, typeFilter, q]);

  // savedAt lookup so vault cards can show when each was saved.
  const savedAtByRef = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.event_ref, r.saved_at));
    return m;
  }, [rows]);

  const isSaved = tab === 'saved';
  const sourceFiltered = isSaved ? savedFiltered : recentFiltered;
  const loading = isSaved ? savedLoading : recentLoading;
  const visibleEvents = sourceFiltered.slice(0, visibleCount);

  return (
    <AuroraBackground fullHeight>
      <div className="text-white pb-20">
        <div className="sticky top-0 z-40 nl-glass backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center gap-3 px-4 h-14">
            <BackButton />
            <Archive className="w-5 h-5 text-[#0066FF]" />
            <h1 className="text-sm font-heading font-bold">Archive</h1>
            <HowItWorksButton content={archiveHowItWorks} className="ms-auto shrink-0" />
          </div>

          {/* Tabs: Saved vault vs Recent window */}
          <div className="flex items-center gap-2 px-4 pb-2">
            {([
              { key: 'saved', label: 'Saved', icon: Bookmark, hint: 'Your vault' },
              { key: 'recent', label: 'Recent', icon: Clock, hint: 'Last 24 to 72h' },
            ] as const).map((t) => {
              const active = tab === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setVisibleCount(20); }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[#0066FF]/15 text-white border border-[#0066FF]/40'
                      : 'text-gray-400 border border-white/[0.06] hover:text-gray-200'
                  }`}
                  style={active ? { boxShadow: '0 0 14px rgba(0,102,255,.28)' } : undefined}
                  aria-pressed={active}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  <span className={`text-[9px] font-normal ${active ? 'text-[#8B7CFF]' : 'text-gray-600'}`}>{t.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-2xl mx-auto nl-fade-up">
          {/* Search */}
          <div className="flex items-center gap-2 nl-glass rounded-xl px-3 py-2.5 transition-colors focus-within:border-[#0066FF]/40">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isSaved ? 'Search your saved events...' : 'Search archived events...'}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600 text-white"
            />
          </div>

          {/* Type pills */}
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
            <span className="text-xs text-gray-500">
              {sourceFiltered.length} {isSaved ? 'saved' : 'archived'} events
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <Clock className="w-3 h-3" />
              <span>{isSaved ? 'Newest saves first' : 'Sorted by most recent'}</span>
            </div>
          </div>

          {isSaved && unauthorized ? (
            <div className="text-center py-16">
              <Bookmark className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-400">Sign in to use your vault</h3>
              <p className="text-xs text-gray-600 mt-1">Saved events are tied to your account so they follow you across devices.</p>
            </div>
          ) : loading ? (
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
          ) : sourceFiltered.length === 0 ? (
            <div className="text-center py-16">
              {isSaved ? (
                <>
                  <Bookmark className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-gray-500">Your vault is empty</h3>
                  <p className="text-xs text-gray-600 mt-1">Hit Save on any feed or Recent card to keep it here for good.</p>
                </>
              ) : (
                <>
                  <Archive className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-gray-500">No archived events found</h3>
                  <p className="text-xs text-gray-600 mt-1">Older events appear here once they pass 24h. Try adjusting your filters.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleEvents.map((event) => (
                <SavableEventCard
                  key={event.id}
                  event={event}
                  saved={savedRefs.has(event.id)}
                  onToggle={toggle}
                  savedAt={isSaved ? savedAtByRef.get(event.id) : undefined}
                />
              ))}

              {visibleCount < sourceFiltered.length && (
                <button
                  onClick={() => setVisibleCount((prev) => prev + 20)}
                  className="w-full py-3 rounded-xl text-xs font-semibold nl-button--ghost flex items-center justify-center gap-2"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Load more ({sourceFiltered.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </AuroraBackground>
  );
}
