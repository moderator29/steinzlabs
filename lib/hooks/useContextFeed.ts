'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export interface ContextEvent {
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
  // Bug §1: the raw `timestamp` is the real on-chain / source event time.
  // `displayTimestamp` is a staggered version used for the clock in the UI
  // so batch-delivered events (10 news items all emitted at 07:07:41) don't
  // render as a wall of identical timestamps. Events are spaced at least
  // 6 seconds apart visually; the raw time is kept for sort/filter logic.
  displayTimestamp?: string;
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

// Bug §1: enforce a minimum visual spacing of 6s between adjacent events so
// that batch-delivered items (all stamped at the same second by the upstream
// cron) don't read as "10 things happened at 07:07:41". Operates on a DESC
// sorted list (newest first); walks from newest→oldest and if the next item
// is within 6s of the previous one, its displayTimestamp is pushed back.
// The raw `timestamp` stays untouched so sorting/filtering is unaffected.
const MIN_GAP_MS = 6000;
function staggerDisplayTimestamps(sorted: ContextEvent[]): ContextEvent[] {
  let lastDisplay = Number.POSITIVE_INFINITY;
  return sorted.map((e) => {
    const real = new Date(e.timestamp).getTime();
    const display = Number.isFinite(real)
      ? Math.min(real, lastDisplay - MIN_GAP_MS)
      : real;
    lastDisplay = Number.isFinite(display) ? display : lastDisplay;
    return {
      ...e,
      displayTimestamp: Number.isFinite(display)
        ? new Date(display).toISOString()
        : e.timestamp,
    };
  });
}

// FIX 5A.1 / Phase 7: added base/arbitrum/optimism. Server now returns events for these chains.
export type ChainFilter = 'all' | 'solana' | 'ethereum' | 'bsc' | 'polygon' | 'avalanche' | 'base' | 'arbitrum' | 'optimism' | 'bookmarks';

const POLL_INTERVAL = 20000;
const POLL_INTERVAL_HIDDEN = 60000;

export type ContextEventFilter = 'all' | 'news' | 'coins' | 'new_coins' | 'volume' | 'trending';

export function useContextFeed(limit: number = 200, chain: ChainFilter = 'all', filter: ContextEventFilter = 'all') {
  const [events, setEvents] = useState<ContextEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasArchive, setHasArchive] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // Merge a batch of raw events into state — chain-filter client-side, dedup,
  // sort newest-first, re-stagger display timestamps. Shared by the initial
  // fetch and the live SSE stream so both deliver identical UI behaviour.
  const applyRawEvents = useCallback((rawEvents: ContextEvent[]) => {
    if (!rawEvents.length) return;
    const dedupMap = new Map<string, ContextEvent>();
    rawEvents.forEach((e) => { if (e.id && !dedupMap.has(e.id)) dedupMap.set(e.id, e); });
    const allEvents = Array.from(dedupMap.values());
    const chainFilter = chain === 'bookmarks' ? 'all' : chain;
    const newEvents = chainFilter === 'all' ? allEvents : allEvents.filter((e) => e.chain === chainFilter);

    setEvents((prev: ContextEvent[]) => {
      const mergedMap = new Map<string, ContextEvent>();
      newEvents.forEach((e) => mergedMap.set(e.id, e));
      prev.forEach((e) => { if (!mergedMap.has(e.id)) mergedMap.set(e.id, e); });
      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return staggerDisplayTimestamps(merged.slice(0, 200));
    });
    allEvents.forEach((e) => seenIds.current.add(e.id));
  }, [chain]);

  const fetchEvents = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Hard 15s ceiling so a flaky cold-start never leaves the UI spinning.
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // Always fetch all chains from the server to maximise event coverage,
      // then filter client-side by the selected chain for display.
      const response = await fetch(`/api/context-feed?limit=200&chain=all&filter=${encodeURIComponent(filter)}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (data.hasArchive !== undefined) setHasArchive(data.hasArchive);
      applyRawEvents(data.events || []);
    } catch (error) {
      // AbortError is expected on chain switch / unmount — stay silent.
      // Anything else is a real failure worth logging for diagnosis.
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('[context-feed] fetch failed:', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, applyRawEvents]);

  useEffect(() => {
    setLoading(true);
    seenIds.current.clear();
    setEvents([]);
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, filter]);

  // §B5 — live updates via the (previously-unwired) SSE endpoint, which pushes
  // deltas every ~5s and shares one upstream tick across clients. Falls back to
  // the original interval polling if SSE errors or EventSource is unavailable,
  // so the worst case is exactly the prior behaviour.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      const interval = document.hidden ? POLL_INTERVAL_HIDDEN : POLL_INTERVAL;
      intervalId = setInterval(fetchEvents, interval);
    };

    const startSse = () => {
      if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
        startPolling();
        return;
      }
      try {
        es = new EventSource(`/api/context-feed/events?chain=all&limit=200&filter=${encodeURIComponent(filter)}`);
        es.addEventListener('events', (ev) => {
          try {
            const payload = JSON.parse((ev as MessageEvent).data) as { events?: ContextEvent[] };
            if (payload.events?.length) applyRawEvents(payload.events);
          } catch { /* malformed frame — ignore this tick */ }
        });
        es.onerror = () => {
          // SSE dropped — close it and degrade to interval polling.
          es?.close();
          es = null;
          startPolling();
        };
      } catch {
        startPolling();
      }
    };

    startSse();

    const handleVisibility = () => {
      // Re-sync immediately when the tab returns to the foreground. If we fell
      // back to polling, also re-pace the interval for the new visibility.
      if (!document.hidden) fetchEvents();
      if (intervalId) startPolling();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalId) clearInterval(intervalId);
      es?.close();
      document.removeEventListener('visibilitychange', handleVisibility);
      abortRef.current?.abort();
    };
  }, [fetchEvents, filter, applyRawEvents]);

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
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('[context-feed] archive fetch failed:', error.message);
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
