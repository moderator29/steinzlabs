'use client';

import { useEffect, useState } from 'react';

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

export function useContextFeed(limit: number = 10) {
  const [events, setEvents] = useState<ContextEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/context-feed?limit=${limit}`);
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch context feed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  return { events, loading, refresh: fetchEvents };
}
