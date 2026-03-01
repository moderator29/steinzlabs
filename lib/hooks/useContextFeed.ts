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

export function useContextFeed(limit: number = 15, chain: ChainFilter = 'all') {
  const [events, setEvents] = useState<ContextEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());
  const currentChain = useRef<ChainFilter>(chain);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(`/api/context-feed?limit=${limit}&chain=${chain}&t=${Date.now()}`);
      const data = await response.json();
      const newEvents: ContextEvent[] = data.events || [];

      if (currentChain.current !== chain) {
        currentChain.current = chain;
        seenIds.current.clear();
        setEvents(newEvents.slice(0, 30));
      } else {
        setEvents(prev => {
          const merged = [...newEvents];
          for (const old of prev) {
            if (!merged.find(e => e.id === old.id)) {
              merged.push(old);
            }
          }
          merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return merged.slice(0, 40);
        });
      }

      newEvents.forEach(e => seenIds.current.add(e.id));
    } catch (error) {
      console.error('Failed to fetch context feed:', error);
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
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
}
