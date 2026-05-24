'use client';

import { useState, useEffect, useRef, type RefObject } from 'react';
import { POLLING_INTERVALS } from '@/lib/market/constants';

interface LivePriceData {
  priceUSD: number;
  priceChange24h: number;
  volume24h: number;
  lastUpdated: number;
}

/**
 * Subscribes to live DEX price for a pair. Returns the latest data and a
 * `priceRef` consumers attach to the element that should flash on change.
 *
 * The flash is driven by a `data-flash="up"|"down"` attribute the hook
 * writes directly to the DOM via the ref, and cleared 600ms later
 * without rerendering React. Pair with:
 *
 *   span[data-flash="up"]   { color: var(--color-up); transition: color 600ms; }
 *   span[data-flash="down"] { color: var(--color-down); transition: color 600ms; }
 *
 * Avoids the prior two-render-per-tick storm (set flash, then clear
 * 600ms later) which on a long token list = jank.
 */
export function useLivePrice(
  pairAddress: string | null,
  chain = 'ethereum',
): { data: LivePriceData | null; priceRef: RefObject<HTMLElement | null> } {
  const [data, setData] = useState<LivePriceData | null>(null);
  const prevPrice = useRef<number | null>(null);
  const priceRef = useRef<HTMLElement | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pairAddress) return;

    const poll = async () => {
      try {
        const res = await window.fetch(`/api/market/dexscreener/${pairAddress}?chain=${chain}`);
        if (!res.ok) return;
        const d = await res.json() as { priceUSD: number; priceChange24h: number; volume24h: number };
        const prev = prevPrice.current;
        if (prev !== null && d.priceUSD !== prev && priceRef.current) {
          priceRef.current.setAttribute('data-flash', d.priceUSD > prev ? 'up' : 'down');
          if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => {
            priceRef.current?.removeAttribute('data-flash');
          }, 600);
        }
        prevPrice.current = d.priceUSD;
        setData({ ...d, lastUpdated: Date.now() });
      } catch { /* silent */ }
    };

    void poll();
    const id = setInterval(poll, POLLING_INTERVALS.LIVE_PRICE);
    return () => {
      clearInterval(id);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [pairAddress, chain]);

  return { data, priceRef };
}
