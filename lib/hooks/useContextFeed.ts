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

// FIX 5A.1 / Phase 7: added base/arbitrum/optimism. Server now returns events for these chains.
export type ChainFilter = 'all' | 'solana' | 'ethereum' | 'bsc' | 'polygon' | 'avalanche' | 'base' | 'arbitrum' | 'optimism' | 'bookmarks';

const POLL_INTERVAL = 20000;
const POLL_INTERVAL_HIDDEN = 60000;

export function useContextFeed(limit: number = 200, chain: ChainFilter = 'all') {
  const [events, setEvents] = useState<ContextEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasArchive, setHasArchive] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const currentChain = useRef<ChainFilter>(chain);
  const abortRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Always fetch all chains from the server to maximise event coverage,
      // then filter client-side by the selected chain for display.
      const response = await fetch(`/api/context-feed?limit=200&chain=all`, {
        signal: controller.signal,
      });
      const data = await response.json();
      const rawEvents: ContextEvent[] = data.events || [];
      if (data.hasArchive !== undefined) setHasArchive(data.hasArchive);
      const dedupMap = new Map<string, ContextEvent>();
      rawEvents.forEach(e => { if (!dedupMap.has(e.id)) dedupMap.set(e.id, e); });
      const allEvents = Array.from(dedupMap.values());

      // Apply chain filter client-side (bookmarks filter is handled in the component)
      const chainFilter = chain === 'bookmarks' ? 'all' : chain;
      const newEvents = chainFilter === 'all'
        ? allEvents
        : allEvents.filter(e => e.chain === chainFilter);

      if (currentChain.current !== chain) {
        currentChain.current = chain;
        seenIds.current.clear();
        setEvents(newEvents.slice(0, 200));
      } else {
        setEvents((prev: ContextEvent[]) => {
          const mergedMap = new Map<string, ContextEvent>();
          newEvents.forEach((e: ContextEvent) => mergedMap.set(e.id, e));
          prev.forEach((e: ContextEvent) => { if (!mergedMap.has(e.id)) mergedMap.set(e.id, e); });
          const merged = Array.from(mergedMap.values());
          merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return merged.slice(0, 200);
        });
      }

      allEvents.forEach(e => seenIds.current.add(e.id));
    } catch (error: any) {
      if (error?.name !== 'AbortError') {

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

  return { events, loading, refresh: fetchEvents, hasArchive };
}

export function useArchivedFeed(chain: ChainFilter = 'all') {
  const [events, setEvents] = useState<ContextEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchArchived = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const feedChain = chain === 'bookmarks' ? 'all' : chain;
      const response = await fetch(`/api/context-feed?limit=200&chain=${feedChain}&archived=true`, {
        signal: controller.signal,
      });
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {

      }
    } finally {
      setLoading(false);
    }
  }, [chain]);

  useEffect(() => {
    setLoading(true);
    setEvents([]);
    fetchArchived();
  }, [fetchArchived]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  return { events, loading, refresh: fetchArchived };
}
