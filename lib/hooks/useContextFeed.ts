'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface ContextEvent {
  id: string;
  type: string;
  sentiment: string;
  title: string;
  summary: string;
  from: string;
  to: string;
  value: number;
  valueUsd: number;
  chain: string;
  trustScore: number;
  timestamp: string;
  txHash: string;
  blockNumber: number;
}

export function useContextFeed(limit: number = 15) {
  const [events, setEvents] = useState<ContextEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(`/api/context-feed?limit=${limit}&t=${Date.now()}`);
      const data = await response.json();
      const newEvents: ContextEvent[] = data.events || [];

      setEvents(prev => {
        const merged = [...newEvents];
        for (const old of prev) {
          if (!merged.find(e => e.id === old.id)) {
            merged.push(old);
          }
        }
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return merged.slice(0, 30);
      });

      newEvents.forEach(e => seenIds.current.add(e.id));
    } catch (error) {
      console.error('Failed to fetch context feed:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
}
