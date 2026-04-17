'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, Heart, Share2, ExternalLink, Copy, X, Check, Bookmark, Archive, SlidersHorizontal, Zap, TrendingUp, BarChart2, Info } from 'lucide-react';
import { useContextFeed, useArchivedFeed, ChainFilter } from '@/lib/hooks/useContextFeed';
import { SolanaIcon, EthereumIcon, BscIcon, PolygonIcon, AvalancheIcon, AllChainsIcon } from './ChainIcons';
import { supabase } from '@/lib/supabase';

interface EngagementData {
  views: number;
  comments: number;
  shares: number;
  likes: number;
  liked: boolean;
  shared: boolean;
}

function BookmarkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <Bookmark className={className} />;
}

function ArchiveIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <Archive className={className} />;
}

type FeedMode = ChainFilter | 'archive';

const CHAIN_TABS: { id: FeedMode; label: string; icon: typeof AllChainsIcon; color: string; gradient: string }[] = [
  { id: 'all', label: 'All Chains', icon: AllChainsIcon, color: '#0A1EFF', gradient: 'from-[#0A1EFF] to-[#7C3AED]' },
  { id: 'solana', label: 'Solana', icon: SolanaIcon, color: '#9945FF', gradient: 'from-[#9945FF] to-[#14F195]' },
  { id: 'ethereum', label: 'Ethereum', icon: EthereumIcon, color: '#627EEA', gradient: 'from-[#627EEA] to-[#C99DFF]' },
  { id: 'bsc', label: 'BSC', icon: BscIcon, color: '#F0B90B', gradient: 'from-[#F0B90B] to-[#FCD535]' },
  { id: 'polygon', label: 'Polygon', icon: PolygonIcon, color: '#8247E5', gradient: 'from-[#8247E5] to-[#A76BFF]' },
  { id: 'avalanche', label: 'Avalanche', icon: AvalancheIcon, color: '#E84142', gradient: 'from-[#E84142] to-[#FF6B6B]' },
  { id: 'bookmarks', label: 'Bookmarks', icon: BookmarkIcon, color: '#FBBF24', gradient: 'from-[#FBBF24] to-[#F59E0B]' },
  { id: 'archive', label: 'Archive', icon: ArchiveIcon, color: '#94A3B8', gradient: 'from-[#94A3B8] to-[#64748B]' },
];

function getChainBadgeIcon(chain: string) {
  switch (chain) {
    case 'solana': return { Icon: SolanaIcon, color: '#14F195', bg: '#14F19515', label: 'SOL' };
    case 'ethereum': return { Icon: EthereumIcon, color: '#627EEA', bg: '#627EEA15', label: 'ETH' };
    case 'bsc': return { Icon: BscIcon, color: '#F0B90B', bg: '#F0B90B15', label: 'BSC' };
    case 'polygon': return { Icon: PolygonIcon, color: '#8247E5', bg: '#8247E515', label: 'POLY' };
    case 'avalanche': return { Icon: AvalancheIcon, color: '#E84142', bg: '#E8414215', label: 'AVAX' };
    default: return { Icon: AllChainsIcon, color: '#0A1EFF', bg: '#0A1EFF15', label: chain.toUpperCase().slice(0, 4) };
  }
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

function SharePopup({ event, onClose, onShared }: { event: any; onClose: () => void; onShared: () => void }) {
  const [shareUrl, setShareUrl] = useState('');
  const [shareText, setShareText] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        title: event.title,
        summary: event.summary,
        chain: event.chain,
        tokenSymbol: event.tokenSymbol || '',
        platform: event.platform || '',
      }),
    })
      .then(r => r.json())
      .then(data => {
        setShareUrl(data.shareUrl || '');
        setShareText(data.shareText || '');
        setGenerating(false);
      })
      .catch(() => setGenerating(false));
  }, [event]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      onShared();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(`${event.title}\n\nPowered by @SteinzLabs\n${shareUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    onShared();
  };

  const shareTelegram = () => {
    const text = encodeURIComponent(shareText);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
    onShared();
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    onShared();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#111827] rounded-t-2xl sm:rounded-2xl border border-white/10 p-5 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Share this event</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {generating ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-[#0A1EFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="glass rounded-xl p-3 mb-4 border border-white/5">
              <p className="text-xs text-gray-300 line-clamp-2 mb-2">{event.title}</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-xs text-gray-400 font-mono truncate outline-none"
                />
                <button
                  onClick={copyLink}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    copied
                      ? 'bg-[#10B981]/20 text-[#10B981]'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={shareTwitter}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-[#1DA1F2]/10 border border-white/5 hover:border-[#1DA1F2]/30 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="text-xs text-gray-400">X / Twitter</span>
              </button>

              <button
                onClick={shareTelegram}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-[#0088cc]/10 border border-white/5 hover:border-[#0088cc]/30 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span className="text-xs text-gray-400">Telegram</span>
              </button>

              <button
                onClick={shareWhatsApp}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-[#25D366]/10 border border-white/5 hover:border-[#25D366]/30 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
                <span className="text-xs text-gray-400">WhatsApp</span>
              </button>
            </div>

            <p className="text-center text-[10px] text-gray-600 mt-4">
              Powered by Steinz Labs
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ContextFeed() {
  const [activeMode, setActiveMode] = useState<FeedMode>('all');
  const isArchive = activeMode === 'archive';
  const activeChain: ChainFilter = isArchive ? 'all' : activeMode as ChainFilter;
  const feedChain = activeChain === 'bookmarks' ? 'all' : activeChain;
  const { events, loading, refresh, hasArchive } = useContextFeed(200, feedChain);
  const { events: archivedEvents, loading: archiveLoading, refresh: refreshArchive } = useArchivedFeed(feedChain);
  const [engagement, setEngagement] = useState<Record<string, EngagementData>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [shareEvent, setShareEvent] = useState<any>(null);
  const [likeAnimations, setLikeAnimations] = useState<Record<string, boolean>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'new_coins' | 'volume' | 'trending' | 'info'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const FEED_FILTERS = [
    { id: 'all' as const, label: 'All', icon: BarChart2 },
    { id: 'new_coins' as const, label: 'New Coins', icon: Zap },
    { id: 'volume' as const, label: 'Volume', icon: TrendingUp },
    { id: 'trending' as const, label: 'Trending', icon: TrendingUp },
    { id: 'info' as const, label: 'Info', icon: Info },
  ];

  useEffect(() => {
    // Local first (instant)
    try {
      const stored = localStorage.getItem('steinz_bookmarks');
      if (stored) setBookmarks(new Set(JSON.parse(stored)));
    } catch { /* Malformed JSON — return default */ }
    // Then merge from Supabase
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('bookmarks').select('event_id').eq('user_id', user.id).then(({ data, error }) => {
        if (error || !data) return;
        const remoteIds = data.map((r: { event_id: string }) => r.event_id);
        setBookmarks(prev => {
          const merged = new Set([...prev, ...remoteIds]);
          try { localStorage.setItem('steinz_bookmarks', JSON.stringify(Array.from(merged))); } catch { /* localStorage unavailable — silently ignore */ }
          return merged;
        });
      });
    });
  }, []);

  const toggleBookmark = useCallback((eventId: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      const adding = !next.has(eventId);
      if (adding) next.add(eventId); else next.delete(eventId);
      try { localStorage.setItem('steinz_bookmarks', JSON.stringify(Array.from(next))); } catch { /* localStorage unavailable — silently ignore */ }
      // Sync to Supabase
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        if (adding) {
          supabase.from('bookmarks').insert({ user_id: user.id, event_id: eventId }).then(({ error }) => {
            if (error) console.error('[ContextFeed] Bookmark insert failed:', error.message);
          });
        } else {
          supabase.from('bookmarks').delete().eq('user_id', user.id).eq('event_id', eventId).then(({ error }) => {
            if (error) console.error('[ContextFeed] Bookmark delete failed:', error.message);
          });
        }
      });
      return next;
    });
  }, []);

  const currentEvents = isArchive ? archivedEvents : events;
  const currentLoading = isArchive ? archiveLoading : loading;
  const baseEvents = activeChain === 'bookmarks'
    ? currentEvents.filter(e => bookmarks.has(e.id))
    : currentEvents;
  const displayEvents = activeFilter === 'all' ? baseEvents : baseEvents.filter(e => {
    const t = (e.type || '').toLowerCase();
    const title = (e.title || '').toLowerCase();
    if (activeFilter === 'new_coins') return t.includes('launch') || t.includes('new') || t.includes('listing') || title.includes('new') || title.includes('launch');
    if (activeFilter === 'volume') return t.includes('volume') || t.includes('trade') || title.includes('volume') || title.includes('whale');
    if (activeFilter === 'trending') return t.includes('trending') || t.includes('bullish') || e.sentiment === 'BULLISH' || e.sentiment === 'HYPE';
    if (activeFilter === 'info') return t.includes('info') || t.includes('update') || t.includes('news') || e.sentiment === 'NEUTRAL';
    return true;
  });

  const fetchEngagement = useCallback(async (eventId: string) => {
    if (engagement[eventId]) return engagement[eventId];

    try {
      const res = await fetch(`/api/engagement?eventId=${eventId}`);
      const data = await res.json();
      const eng: EngagementData = {
        views: data.views || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        likes: data.likes || 0,
        liked: false,
        shared: false,
      };
      setEngagement(prev => ({ ...prev, [eventId]: eng }));
      return eng;
    } catch {
      const fallback: EngagementData = { views: 0, comments: 0, shares: 0, likes: 0, liked: false, shared: false };
      setEngagement(prev => ({ ...prev, [eventId]: fallback }));
      return fallback;
    }
  }, [engagement]);

  const fetchedRef = useRef<Set<string>>(new Set());
  const viewedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unfetched = events.filter(e => !fetchedRef.current.has(e.id)).slice(0, 5);
    unfetched.forEach(event => {
      fetchedRef.current.add(event.id);
      fetchEngagement(event.id);
    });
  }, [events]);

  useEffect(() => {
    const unviewed = events.filter(e => !viewedRef.current.has(e.id)).slice(0, 5);
    if (unviewed.length === 0) return;
    unviewed.forEach(e => viewedRef.current.add(e.id));
    const timer = setTimeout(() => {
      unviewed.forEach(event => {
        fetch('/api/engagement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: event.id, action: 'view' })
        }).catch(() => {});
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [events]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (isArchive) {
      await refreshArchive();
    } else {
      await refresh();
    }
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleLike = async (eventId: string) => {
    const eng = engagement[eventId];
    if (!eng) return;

    const newLiked = !eng.liked;

    setLikeAnimations(prev => ({ ...prev, [eventId]: true }));
    setTimeout(() => setLikeAnimations(prev => ({ ...prev, [eventId]: false })), 400);

    setEngagement(prev => ({
      ...prev,
      [eventId]: {
        ...eng,
        likes: newLiked ? eng.likes + 1 : Math.max(0, eng.likes - 1),
        liked: newLiked,
      }
    }));

    fetch('/api/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, action: newLiked ? 'like' : 'unlike' })
    }).catch(() => {});
  };

  const handleShare = (event: any) => {
    setShareEvent(event);
  };

  const onShareComplete = (eventId: string) => {
    const eng = engagement[eventId];
    if (!eng || eng.shared) return;

    setEngagement(prev => ({
      ...prev,
      [eventId]: { ...eng, shares: eng.shares + 1, shared: true }
    }));

    fetch('/api/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, action: 'share' })
    }).catch(() => {});
  };

  const activeTab = CHAIN_TABS.find(t => t.id === activeMode)!;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {CHAIN_TABS.map(tab => {
          const isActive = activeMode === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMode(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                isActive
                  ? `bg-gradient-to-r ${tab.gradient} text-white border-transparent shadow-lg`
                  : 'text-gray-400 border-white/10 hover:text-white hover:border-white/20 bg-white/5'
              }`}
              style={isActive ? { boxShadow: `0 0 12px ${tab.color}40` } : {}}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: activeTab.color }}
            />
            <div
              className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75"
              style={{ backgroundColor: activeTab.color }}
            />
          </div>
          <span className="text-xs text-gray-400">
            {isArchive ? 'Archive' : 'Live'} | {displayEvents.length} events{activeChain === 'bookmarks' ? ' bookmarked' : ''}{isArchive ? ' (>24hrs old)' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${activeFilter !== 'all' ? 'text-[#0A1EFF] bg-[#0A1EFF]/10 border border-[#0A1EFF]/30' : 'text-gray-400 hover:text-[#0A1EFF] hover:bg-white/5'}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filter{activeFilter !== 'all' ? `: ${FEED_FILTERS.find(f => f.id === activeFilter)?.label}` : ''}</span>
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#141824] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
                {FEED_FILTERS.map(f => {
                  const FIcon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => { setActiveFilter(f.id); setShowFilterMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-all hover:bg-white/5 ${activeFilter === f.id ? 'text-[#0A1EFF] font-semibold' : 'text-gray-400'}`}
                    >
                      <FIcon className="w-3.5 h-3.5" />
                      {f.label}
                      {activeFilter === f.id && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-[#0A1EFF] hover:bg-white/5 transition-all"
          >
            <RefreshIcon spinning={refreshing} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {currentLoading ? (
        <div className="text-center py-16">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div
              className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${activeTab.color}40`, borderTopColor: 'transparent' }}
            />
            <div
              className="absolute inset-2 rounded-full border-2 border-b-transparent animate-spin"
              style={{ borderColor: activeTab.color, borderBottomColor: 'transparent', animationDirection: 'reverse', animationDuration: '0.8s' }}
            />
          </div>
          <p className="text-sm font-semibold mb-1">Loading {activeTab.label} Feed...</p>
          <p className="text-xs text-gray-400">Fetching real-time on-chain data</p>
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="text-center py-16">
          {isArchive ? (
            <>
              <Archive className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">No Archived Events</p>
              <p className="text-xs text-gray-400 mb-4">Events older than 24 hours will appear here. Keep the feed running to accumulate events.</p>
            </>
          ) : activeChain === 'bookmarks' ? (
            <>
              <Bookmark className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">No Bookmarks Yet</p>
              <p className="text-xs text-gray-400 mb-4">Bookmark events to save them here</p>
            </>
          ) : (
            <>
              <Eye className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">No Events on {activeTab.label}</p>
              <p className="text-xs text-gray-400 mb-4">Waiting for activity...</p>
              <button
                onClick={handleRefresh}
                className={`px-5 py-2 bg-gradient-to-r ${activeTab.gradient} rounded-lg text-xs font-semibold`}
              >
                Refresh
              </button>
            </>
          )}
        </div>
      ) : (
        displayEvents.map((event, i) => {
          const isPositive = event.sentiment === 'BULLISH';
          const isNegative = event.sentiment === 'BEARISH';
          const sentimentColor = isPositive ? '#10B981' : isNegative ? '#EF4444' : '#F59E0B';
          const eng = engagement[event.id] || { views: 0, comments: 0, shares: 0, likes: 0, liked: false, shared: false };
          const chainBadge = getChainBadgeIcon(event.chain);
          const ChainBadgeIcon = chainBadge.Icon;

          return (
            <div
              key={`${event.id}-${i}`}
              className="glass rounded-2xl p-5 border border-white/10 hover:border-[#0A1EFF]/30 transition-all overflow-hidden"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{
                      backgroundColor: `${sentimentColor}20`,
                      color: sentimentColor
                    }}
                  >
                    {event.sentiment}
                  </span>
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: chainBadge.bg, color: chainBadge.color }}
                  >
                    <ChainBadgeIcon className="w-3 h-3" />
                    {chainBadge.label}
                  </span>
                  {event.platform && (
                    <span className="px-2 py-0.5 rounded text-xs text-gray-300 bg-white/5 flex-shrink-0">
                      {event.platform}
                    </span>
                  )}
                  {event.valueUsd >= 50000 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A1EFF]/10 text-[#0A1EFF] border border-[#0A1EFF]/20 flex-shrink-0">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      INTEL
                    </span>
                  )}
                  {event.trustScore >= 75 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 flex-shrink-0">
                      VERIFIED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button
                    onClick={() => toggleBookmark(event.id)}
                    className={`transition-all duration-200 ${
                      bookmarks.has(event.id)
                        ? 'text-[#FBBF24]'
                        : 'text-gray-500 hover:text-[#FBBF24]'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${bookmarks.has(event.id) ? 'fill-current' : ''}`} />
                  </button>
                  <span className="text-gray-400 text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <h3 className="text-base font-bold mb-2 break-words line-clamp-2">{event.title}</h3>

              <p className="text-gray-300 text-sm mb-4 leading-relaxed break-words line-clamp-3">
                {event.summary}
              </p>

              <div className="flex items-center gap-3 mb-2 text-xs text-gray-400 overflow-hidden flex-wrap">
                {event.tokenPrice && (
                  <span className="flex-shrink-0 font-mono font-semibold text-white">{event.tokenPrice}</span>
                )}
                {event.tokenPriceChange24h !== undefined && event.tokenPriceChange24h !== 0 && (
                  <span
                    className="flex-shrink-0 font-semibold"
                    style={{ color: event.tokenPriceChange24h > 0 ? '#10B981' : '#EF4444' }}
                  >
                    {event.tokenPriceChange24h > 0 ? '+' : ''}{event.tokenPriceChange24h.toFixed(1)}%
                  </span>
                )}
                {event.valueUsd > 0 && (
                  <span className="flex-shrink-0">TX: ${event.valueUsd.toLocaleString()}</span>
                )}
              </div>

              {(event.tokenVolume24h || event.tokenLiquidity || event.tokenMarketCap) && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {event.tokenVolume24h && event.tokenVolume24h > 0 && (
                    <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 uppercase">Vol 24h</div>
                      <div className="text-[11px] font-semibold text-gray-300 font-mono">${event.tokenVolume24h >= 1000000 ? `${(event.tokenVolume24h / 1000000).toFixed(1)}M` : event.tokenVolume24h >= 1000 ? `${(event.tokenVolume24h / 1000).toFixed(0)}K` : event.tokenVolume24h.toLocaleString()}</div>
                    </div>
                  )}
                  {event.tokenLiquidity && event.tokenLiquidity > 0 && (
                    <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 uppercase">Liquidity</div>
                      <div className="text-[11px] font-semibold text-gray-300 font-mono">${event.tokenLiquidity >= 1000000 ? `${(event.tokenLiquidity / 1000000).toFixed(1)}M` : event.tokenLiquidity >= 1000 ? `${(event.tokenLiquidity / 1000).toFixed(0)}K` : event.tokenLiquidity.toLocaleString()}</div>
                    </div>
                  )}
                  {event.tokenMarketCap && event.tokenMarketCap > 0 && (
                    <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 uppercase">MCap</div>
                      <div className="text-[11px] font-semibold text-gray-300 font-mono">${event.tokenMarketCap >= 1000000000 ? `${(event.tokenMarketCap / 1000000000).toFixed(1)}B` : event.tokenMarketCap >= 1000000 ? `${(event.tokenMarketCap / 1000000).toFixed(0)}M` : event.tokenMarketCap >= 1000 ? `${(event.tokenMarketCap / 1000).toFixed(0)}K` : event.tokenMarketCap.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-white/20 rounded-full h-1.5 flex-shrink-0">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${event.trustScore}%`,
                        backgroundColor: event.trustScore > 70 ? '#10B981' : event.trustScore > 40 ? '#F59E0B' : '#EF4444'
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: sentimentColor }}>
                    {event.trustScore}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0"
                    style={{
                      backgroundColor: `${sentimentColor}20`,
                      color: sentimentColor
                    }}
                  >
                    {event.trustScore > 70 ? 'TRUSTED' : event.trustScore > 40 ? 'MEDIUM' : 'LOW'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.setItem('steinz_proof_event', JSON.stringify(event));
                    window.location.href = `/dashboard/proof?id=${event.id}`;
                  }}
                  className="text-[#0A1EFF] font-semibold text-xs hover:underline flex-shrink-0 ml-2"
                >
                  View Proof &rarr;
                </button>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> {eng.views.toLocaleString()}
                </span>
                <button
                  onClick={() => handleShare(event)}
                  className={`flex items-center gap-1.5 transition-all ${
                    eng.shared
                      ? 'text-[#0A1EFF]'
                      : 'hover:text-[#0A1EFF]'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" /> {eng.shares.toLocaleString()}
                </button>
                <button
                  onClick={() => handleLike(event.id)}
                  className={`flex items-center gap-1.5 transition-all ${
                    eng.liked
                      ? 'text-[#EF4444]'
                      : 'hover:text-[#EF4444]'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      eng.liked ? 'fill-current' : ''
                    } ${likeAnimations[event.id] ? 'scale-125' : 'scale-100'}`}
                  />
                  {eng.likes.toLocaleString()}
                </button>
              </div>
            </div>
          );
        })
      )}

      {shareEvent && (
        <SharePopup
          event={shareEvent}
          onClose={() => setShareEvent(null)}
          onShared={() => {
            onShareComplete(shareEvent.id);
            setShareEvent(null);
          }}
        />
      )}

    </div>
  );
}
