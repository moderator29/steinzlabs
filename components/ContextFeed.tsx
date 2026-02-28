'use client';

import { useState } from 'react';
import { Eye, MessageSquare, Link2, Heart, RefreshCw } from 'lucide-react';
import { useContextFeed } from '@/lib/hooks/useContextFeed';
import ViewProofModal from './ViewProofModal';

export default function ContextFeed() {
  const { events, loading, refresh } = useContextFeed(10);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [engagement, setEngagement] = useState<{ [key: string]: { views: number; comments: number; shares: number; likes: number; liked: boolean; shared: boolean } }>({});

  const getEngagement = (eventId: string) => {
    if (!engagement[eventId]) {
      const base = {
        views: Math.floor(Math.random() * 20000 + 5000),
        comments: Math.floor(Math.random() * 1000 + 200),
        shares: Math.floor(Math.random() * 500 + 100),
        likes: Math.floor(Math.random() * 3000 + 500),
        liked: false,
        shared: false,
      };
      setEngagement(prev => ({ ...prev, [eventId]: base }));
      return base;
    }
    return engagement[eventId];
  };

  const handleLike = (eventId: string) => {
    setEngagement(prev => {
      const e = prev[eventId] || getEngagement(eventId);
      return { ...prev, [eventId]: { ...e, likes: e.liked ? e.likes - 1 : e.likes + 1, liked: !e.liked } };
    });
  };

  const handleShare = (eventId: string) => {
    setEngagement(prev => {
      const e = prev[eventId] || getEngagement(eventId);
      if (e.shared) return prev;
      return { ...prev, [eventId]: { ...e, shares: e.shares + 1, shared: true } };
    });
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
        const eng = getEngagement(event.id);

        return (
          <div
            key={event.id}
            className="glass rounded-2xl p-5 border border-white/10 hover:border-[#00E5FF]/30 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `${sentimentColor}20`,
                  color: sentimentColor
                }}
              >
                {event.sentiment}
              </span>
              <span className="text-gray-400 text-xs">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <h3 className="text-lg font-bold mb-2">{event.title}</h3>

            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
              {event.summary}
            </p>

            <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
              <span>${event.valueUsd.toLocaleString()}</span>
              <span>{event.from.slice(0, 6)}...{event.from.slice(-4)}</span>
              <span>{event.chain}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-20 bg-white/20 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${event.trustScore}%`,
                      backgroundColor: event.trustScore > 70 ? '#10B981' : event.trustScore > 40 ? '#F59E0B' : '#EF4444'
                    }}
                  />
                </div>
                <span className="text-xs font-semibold" style={{ color: sentimentColor }}>
                  {event.trustScore}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-semibold"
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
                className="text-[#00E5FF] font-semibold text-xs hover:underline"
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
          }}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
