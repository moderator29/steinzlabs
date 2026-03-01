'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, MessageSquare, Link2, Heart, RefreshCw, Zap, Globe, Hexagon, Triangle, Circle } from 'lucide-react';
import { useContextFeed, ChainFilter } from '@/lib/hooks/useContextFeed';
import ViewProofModal from './ViewProofModal';

interface EngagementData {
  views: number;
  comments: number;
  shares: number;
  likes: number;
  liked: boolean;
  shared: boolean;
}

const CHAIN_TABS: { id: ChainFilter; label: string; icon: typeof Globe; color: string; gradient: string }[] = [
  { id: 'all', label: 'All Chains', icon: Globe, color: '#00E5FF', gradient: 'from-[#00E5FF] to-[#7C3AED]' },
  { id: 'solana', label: 'Solana', icon: Zap, color: '#9945FF', gradient: 'from-[#9945FF] to-[#14F195]' },
  { id: 'ethereum', label: 'Ethereum', icon: Hexagon, color: '#627EEA', gradient: 'from-[#627EEA] to-[#C99DFF]' },
  { id: 'bsc', label: 'BSC', icon: Triangle, color: '#F0B90B', gradient: 'from-[#F0B90B] to-[#FCD535]' },
  { id: 'polygon', label: 'Polygon', icon: Circle, color: '#8247E5', gradient: 'from-[#8247E5] to-[#A76BFF]' },
];

function getChainBadge(chain: string): { color: string; bg: string; label: string } {
  switch (chain) {
    case 'solana': return { color: '#14F195', bg: '#14F19515', label: 'SOL' };
    case 'ethereum': return { color: '#627EEA', bg: '#627EEA15', label: 'ETH' };
    case 'bsc': return { color: '#F0B90B', bg: '#F0B90B15', label: 'BSC' };
    case 'polygon': return { color: '#8247E5', bg: '#8247E515', label: 'POLY' };
    default: return { color: '#00E5FF', bg: '#00E5FF15', label: chain.toUpperCase().slice(0, 4) };
  }
}

export default function ContextFeed() {
  const [activeChain, setActiveChain] = useState<ChainFilter>('all');
  const { events, loading, refresh } = useContextFeed(20, activeChain);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [engagement, setEngagement] = useState<Record<string, EngagementData>>({});

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

  useEffect(() => {
    events.forEach(event => {
      if (!engagement[event.id]) {
        fetchEngagement(event.id);
      }
    });
  }, [events]);

  useEffect(() => {
    events.forEach(event => {
      fetch('/api/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, action: 'view' })
      }).catch(() => {});
    });
  }, [events]);

  const handleLike = async (eventId: string) => {
    const eng = engagement[eventId];
    if (!eng) return;

    const newLiked = !eng.liked;
    setEngagement(prev => ({
      ...prev,
      [eventId]: {
        ...eng,
        likes: newLiked ? eng.likes + 1 : eng.likes - 1,
        liked: newLiked,
      }
    }));

    if (newLiked) {
      fetch('/api/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, action: 'like' })
      }).catch(() => {});
    }
  };

  const handleShare = async (eventId: string) => {
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

  const activeTab = CHAIN_TABS.find(t => t.id === activeChain)!;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {CHAIN_TABS.map(tab => {
          const isActive = activeChain === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveChain(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                isActive
                  ? `bg-gradient-to-r ${tab.gradient} text-white border-transparent shadow-lg`
                  : 'text-gray-400 border-white/10 hover:text-white hover:border-white/20 bg-white/5'
              }`}
              style={isActive ? { boxShadow: `0 0 12px ${tab.color}40` } : {}}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: activeTab.color }}
          />
          <span className="text-xs text-gray-400">
            Live — {events.length} events
          </span>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {loading ? (
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
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <Eye className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <p className="text-sm font-semibold mb-1">No Events on {activeTab.label}</p>
          <p className="text-xs text-gray-400 mb-4">Waiting for activity...</p>
          <button
            onClick={refresh}
            className={`px-5 py-2 bg-gradient-to-r ${activeTab.gradient} rounded-lg text-xs font-semibold`}
          >
            Refresh
          </button>
        </div>
      ) : (
        events.map((event) => {
          const isPositive = event.sentiment === 'BULLISH';
          const isNegative = event.sentiment === 'BEARISH';
          const sentimentColor = isPositive ? '#10B981' : isNegative ? '#EF4444' : '#F59E0B';
          const eng = engagement[event.id] || { views: 0, comments: 0, shares: 0, likes: 0, liked: false, shared: false };
          const chainBadge = getChainBadge(event.chain);

          return (
            <div
              key={event.id}
              className="glass rounded-2xl p-5 border border-white/10 hover:border-[#00E5FF]/30 transition-all overflow-hidden"
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
                    className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: chainBadge.bg, color: chainBadge.color }}
                  >
                    {chainBadge.label}
                  </span>
                  {event.platform && (
                    <span className="px-2 py-0.5 rounded text-xs text-gray-300 bg-white/5 flex-shrink-0">
                      {event.platform}
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-xs flex-shrink-0 ml-2">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <h3 className="text-base font-bold mb-2 break-words line-clamp-2">{event.title}</h3>

              <p className="text-gray-300 text-sm mb-4 leading-relaxed break-words line-clamp-3">
                {event.summary}
              </p>

              <div className="flex items-center gap-3 mb-4 text-xs text-gray-400 overflow-hidden flex-wrap">
                {event.tokenPrice && (
                  <span className="flex-shrink-0 font-mono">{event.tokenPrice}</span>
                )}
                {event.valueUsd > 0 && (
                  <span className="flex-shrink-0">${event.valueUsd.toLocaleString()}</span>
                )}
                {event.tokenPriceChange24h !== undefined && event.tokenPriceChange24h !== 0 && (
                  <span
                    className="flex-shrink-0 font-semibold"
                    style={{ color: event.tokenPriceChange24h > 0 ? '#10B981' : '#EF4444' }}
                  >
                    {event.tokenPriceChange24h > 0 ? '+' : ''}{event.tokenPriceChange24h.toFixed(1)}%
                  </span>
                )}
                {event.tokenLiquidity && event.tokenLiquidity > 0 && (
                  <span className="flex-shrink-0">Liq: ${event.tokenLiquidity >= 1000 ? `${(event.tokenLiquidity / 1000).toFixed(0)}K` : event.tokenLiquidity.toFixed(0)}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-white/20 rounded-full h-1.5 flex-shrink-0">
                    <div
                      className="h-1.5 rounded-full"
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
                  onClick={() => setSelectedEvent(event)}
                  className="text-[#00E5FF] font-semibold text-xs hover:underline flex-shrink-0 ml-2"
                >
                  View Proof &rarr;
                </button>
              </div>

              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> {eng.views.toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> {eng.comments.toLocaleString()}
                </span>
                <button
                  onClick={() => handleShare(event.id)}
                  className={`flex items-center gap-1.5 hover:text-[#00E5FF] transition-colors ${eng.shared ? 'text-[#00E5FF]' : ''}`}
                >
                  <Link2 className="w-3.5 h-3.5" /> {eng.shares.toLocaleString()}
                </button>
                <button
                  onClick={() => handleLike(event.id)}
                  className={`flex items-center gap-1.5 hover:text-[#EF4444] transition-colors ${eng.liked ? 'text-[#EF4444]' : ''}`}
                >
                  <Heart className={`w-3.5 h-3.5 ${eng.liked ? 'fill-current' : ''}`} /> {eng.likes.toLocaleString()}
                </button>
              </div>
            </div>
          );
        })
      )}

      {selectedEvent && (
        <ViewProofModal
          key={selectedEvent.id}
          event={{
            id: selectedEvent.id,
            title: selectedEvent.title,
            summary: selectedEvent.summary,
            from: selectedEvent.from,
            to: selectedEvent.to,
            value: selectedEvent.value,
            valueUsd: selectedEvent.valueUsd,
            chain: selectedEvent.chain,
            trustScore: selectedEvent.trustScore,
            txHash: selectedEvent.txHash,
            timestamp: selectedEvent.timestamp,
            sentiment: selectedEvent.sentiment,
            views: engagement[selectedEvent.id]?.views || 0,
            comments: engagement[selectedEvent.id]?.comments || 0,
            shares: engagement[selectedEvent.id]?.shares || 0,
            likes: engagement[selectedEvent.id]?.likes || 0,
            pairAddress: selectedEvent.pairAddress || '',
            dexUrl: selectedEvent.dexUrl || '',
            tokenName: selectedEvent.tokenName || '',
            tokenSymbol: selectedEvent.tokenSymbol || '',
            tokenPrice: selectedEvent.tokenPrice || '',
            platform: selectedEvent.platform || '',
            tokenVolume24h: selectedEvent.tokenVolume24h || 0,
            tokenLiquidity: selectedEvent.tokenLiquidity || 0,
            tokenMarketCap: selectedEvent.tokenMarketCap || 0,
            tokenPriceChange24h: selectedEvent.tokenPriceChange24h || 0,
          }}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
