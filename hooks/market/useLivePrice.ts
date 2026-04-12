'use client';

import { useState, useEffect, useRef } from 'react';
import { POLLING_INTERVALS } from '@/lib/market/constants';

interface LivePriceData {
  priceUSD: number;
  priceChange24h: number;
  volume24h: number;
  lastUpdated: number;
}

export function useLivePrice(pairAddress: string | null, chain = 'ethereum') {
  const [data, setData] = useState<LivePriceData | null>(null);
  const prevPrice = useRef<number | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!pairAddress) return;

    const poll = async () => {
      try {
        const res = await window.fetch(`/api/market/dexscreener/${pairAddress}?chain=${chain}`);
        if (!res.ok) return;
        const d = await res.json() as { priceUSD: number; priceChange24h: number; volume24h: number };
        const prev = prevPrice.current;
        if (prev !== null && d.priceUSD !== prev) {
          setFlash(d.priceUSD > prev ? 'up' : 'down');
          setTimeout(() => setFlash(null), 600);
        }
        prevPrice.current = d.priceUSD;
        setData({ ...d, lastUpdated: Date.now() });
      } catch { /* silent */ }
    };

    poll();
    const id = setInterval(poll, POLLING_INTERVALS.LIVE_PRICE);
    return () => clearInterval(id);
  }, [pairAddress, chain]);

  return { data, flash };
}
