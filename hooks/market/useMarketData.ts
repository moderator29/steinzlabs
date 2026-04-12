'use client';

import { useState, useEffect, useCallback } from 'react';
import { CoinGeckoMarket } from '@/lib/market/types';

interface UseMarketDataOptions {
  page?: number;
  category?: string;
}

export function useMarketData({ page = 1, category = 'all' }: UseMarketDataOptions = {}) {
  const [tokens, setTokens] = useState<CoinGeckoMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), category });
      const res = await window.fetch(`/api/market/prices?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as CoinGeckoMarket[];
      setTokens(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => { fetch(); }, [fetch]);

  return { tokens, loading, error, refetch: fetch };
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
