'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
}

interface UseOrderBookParams {
  pairAddress: string;
  chain: string;
  pollIntervalMs?: number;
}

interface UseOrderBookReturn {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  loading: boolean;
  lastUpdate: Date | null;
}

export function useOrderBook({
  pairAddress,
  chain,
  pollIntervalMs = 5000,
}: UseOrderBookParams): UseOrderBookReturn {
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [spread, setSpread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchOrderBook = useCallback(async () => {
    if (!pairAddress || !chain) return;

    try {
      const res = await fetch(
        `/api/orderbook?pair=${encodeURIComponent(pairAddress)}&chain=${encodeURIComponent(chain)}`,
        { signal: AbortSignal.timeout(10_000) },
      );

      if (!res.ok) return;

      const data: OrderBookData = await res.json();

      if (!mountedRef.current) return;

      setBids(data.bids ?? []);
      setAsks(data.asks ?? []);
      setSpread(data.spread ?? 0);
      setLastUpdate(new Date());
    } catch {
      // silently ignore fetch errors during polling
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [pairAddress, chain]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setBids([]);
    setAsks([]);
    setSpread(0);
    setLastUpdate(null);

    fetchOrderBook();

    intervalRef.current = setInterval(fetchOrderBook, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchOrderBook, pollIntervalMs]);

  return { bids, asks, spread, loading, lastUpdate };
}
