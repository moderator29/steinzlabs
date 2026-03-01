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
  tokenName?: string;
  tokenSymbol?: string;
  tokenPrice?: string;
  tokenVolume24h?: number;
  tokenLiquidity?: number;
  tokenMarketCap?: number;
  tokenPriceChange24h?: number;
  pairAddress?: string;
  dexUrl?: string;
  tokenIcon?: string;
  platform?: string;
  buys24h?: number;
  sells24h?: number;
}

export type ChainFilter = 'all' | 'solana' | 'ethereum' | 'bsc' | 'polygon';

const POLL_INTERVAL = 15000;
const POLL_INTERVAL_HIDDEN = 60000;

export function useContextFeed(limit: number = 50, chain: ChainFilter = 'all') {
  const [events, setEvents] = useState<ContextEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());
  const currentChain = useRef<ChainFilter>(chain);
  const abortRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/context-feed?limit=${limit}&chain=${chain}`, {
        signal: controller.signal,
      });
      const data = await response.json();
      const newEvents: ContextEvent[] = data.events || [];

      if (currentChain.current !== chain) {
        currentChain.current = chain;
        seenIds.current.clear();
        setEvents(newEvents.slice(0, 60));
      } else {
        setEvents(prev => {
          const merged = [...newEvents];
          for (const old of prev) {
            if (!merged.find(e => e.id === old.id)) {
              merged.push(old);
            }
          }
          merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return merged.slice(0, 80);
        });
      }

      newEvents.forEach(e => seenIds.current.add(e.id));
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Failed to fetch context feed:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [limit, chain]);

  useEffect(() => {
    setLoading(true);
    seenIds.current.clear();
    setEvents([]);
    currentChain.current = chain;
    fetchEvents();
  }, [chain]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const startPolling = () => {
      const interval = document.hidden ? POLL_INTERVAL_HIDDEN : POLL_INTERVAL;
      clearInterval(intervalId);
      intervalId = setInterval(fetchEvents, interval);
    };

    startPolling();

    const handleVisibility = () => {
      startPolling();
      if (!document.hidden) fetchEvents();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      abortRef.current?.abort();
    };
  }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
}
