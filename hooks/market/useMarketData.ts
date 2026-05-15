'use client';

import { useState, useEffect, useCallback } from 'react';
import { CoinGeckoMarket } from '@/lib/market/types';

interface UseMarketDataOptions {
  page?: number;
  category?: string;
}

// Audit M8 #4 — was cache: 'no-store' on every category click, so
// flipping All -> DeFi -> All cost three round-trips for the same
// data. Now cache 5 seconds in-process per (category, page) key,
// piggy-backing on the API's edge cache for everything beyond that.
// Industry parity: SWR's dedupingInterval defaults to 2s; Birdeye
// instant-flip behaviour. Trade-off: a real refresh requires
// refetch() (still exposed) — auto-refresh on focus is intentionally
// not added here because the API responses already serve stale-while-
// revalidate from the edge.
const PROCESS_CACHE_TTL_MS = 5_000;
interface CachedEntry { data: CoinGeckoMarket[]; expiresAt: number }
const processCache = new Map<string, CachedEntry>();
const inflight = new Map<string, Promise<CoinGeckoMarket[]>>();

export function useMarketData({ page = 1, category = 'all' }: UseMarketDataOptions = {}) {
  const [tokens, setTokens] = useState<CoinGeckoMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    const cacheKey = `${category}:${page}`;
    const now = Date.now();
    if (!force) {
      const hit = processCache.get(cacheKey);
      if (hit && hit.expiresAt > now) {
        setTokens(hit.data);
        setLoading(false);
        return;
      }
      // Coalesce concurrent fetches for the same key — tab-flip races
      // never queue 2 identical requests anymore.
      const pending = inflight.get(cacheKey);
      if (pending) {
        try {
          const data = await pending;
          setTokens(data);
        } finally {
          setLoading(false);
        }
        return;
      }
    }
    try {
      setLoading(true);
      setError(null);
      // Pump.fun / BNB-meme hit DexScreener via /api/market/dex-category so
      // the tabs feel alive even though CoinGecko doesn't index those markets.
      const isDexPreset = category === 'pumpfun' || category === 'bnb-meme';
      const url = isDexPreset
        ? `/api/market/dex-category?preset=${category}`
        : `/api/market/prices?${new URLSearchParams({ page: String(page), category })}`;
      const fetchPromise = window.fetch(url, {
        signal: AbortSignal.timeout(10_000),
      }).then(async (res): Promise<CoinGeckoMarket[]> => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return Array.isArray(data) ? data : (data?.tokens ?? []);
      });
      inflight.set(cacheKey, fetchPromise);
      try {
        const rows = await fetchPromise;
        processCache.set(cacheKey, { data: rows, expiresAt: now + PROCESS_CACHE_TTL_MS });
        setTokens(rows);
      } finally {
        inflight.delete(cacheKey);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => { void load(); }, [load]);

  return { tokens, loading, error, refetch: () => load(true) };
}

export function useTokenSearch(query: string) {
  const [results, setResults] = useState<{ id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await window.fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as { coins?: typeof results };
        setResults(data.coins ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, searching };
}
