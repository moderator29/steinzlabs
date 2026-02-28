'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, MessageSquare, Link2, Heart, RefreshCw } from 'lucide-react';
import { useContextFeed } from '@/lib/hooks/useContextFeed';
import ViewProofModal from './ViewProofModal';

interface EngagementData {
  views: number;
  comments: number;
  shares: number;
  likes: number;
  liked: boolean;
  shared: boolean;
}

export default function ContextFeed() {
  const { events, loading, refresh } = useContextFeed(10);
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

  if (loading) {
    return (
      <div className="text-center py-20">
        <RefreshCw className="w-8 h-8 text-[#00E5FF] mx-auto mb-3 animate-spin" />
        <p className="text-lg mb-1 font-semibold">Loading Context Feed...</p>
        <p className="text-sm text-gray-400">Fetching real-time on-chain events</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <Eye className="w-8 h-8 text-gray-500 mx-auto mb-3" />
        <p className="text-lg mb-1 font-semibold">No Events Found</p>
        <p className="text-sm text-gray-400">Waiting for whale activity...</p>
        <button
          onClick={refresh}
          className="mt-4 px-6 py-2 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-lg font-semibold"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const isPositive = event.sentiment === 'BULLISH';
        const isNegative = event.sentiment === 'BEARISH';
        const sentimentColor = isPositive ? '#10B981' : isNegative ? '#EF4444' : '#F59E0B';
        const eng = engagement[event.id] || { views: 0, comments: 0, shares: 0, likes: 0, liked: false, shared: false };

        return (
          <div
            key={event.id}
            className="glass rounded-2xl p-5 border border-white/10 hover:border-[#00E5FF]/30 transition-all overflow-hidden"
          >
            <div className="flex items-start justify-between mb-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                style={{
                  backgroundColor: `${sentimentColor}20`,
                  color: sentimentColor
                }}
              >
                {event.sentiment}
              </span>
              <span className="text-gray-400 text-xs flex-shrink-0 ml-2">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <h3 className="text-base font-bold mb-2 break-words line-clamp-2">{event.title}</h3>

            <p className="text-gray-300 text-sm mb-4 leading-relaxed break-words line-clamp-3">
              {event.summary}
            </p>

            <div className="flex items-center gap-3 mb-4 text-xs text-gray-400 overflow-hidden">
              {event.tokenPrice && (
                <span className="flex-shrink-0">{event.tokenPrice}</span>
              )}
              {event.valueUsd > 0 && (
                <span className="flex-shrink-0">${event.valueUsd.toLocaleString()}</span>
              )}
              {event.platform && (
                <span className="flex-shrink-0 truncate max-w-[80px]">{event.platform}</span>
              )}
              <span className="flex-shrink-0">{event.chain}</span>
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
      })}

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
