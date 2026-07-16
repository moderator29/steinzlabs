'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Polls the live price endpoint so the coin page ticks in near real time.
 * Seeds from the values already loaded with the coin, then refreshes on an
 * interval. Real data only: on a failed poll it keeps the last real value.
 */
export function useLivePrice(
  chain: string,
  address: string,
  seed: { priceUsd: number | null; marketCapUsd: number | null; change24h: number | null },
  intervalMs = 2000,
) {
  const [price, setPrice] = useState<number | null>(seed.priceUsd);
  const [marketCap, setMarketCap] = useState<number | null>(seed.marketCapUsd);
  const [change24h, setChange24h] = useState<number | null>(seed.change24h);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prev = useRef<number | null>(seed.priceUsd);

  useEffect(() => {
    let alive = true;
    const url = `/api/coins/${chain}/${encodeURIComponent(address)}/price`;
    const tick = async () => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as { priceUsd: number | null; marketCapUsd: number | null; change24h: number | null };
        if (!alive || j.priceUsd == null) return;
        if (prev.current != null && j.priceUsd !== prev.current) {
          setFlash(j.priceUsd > prev.current ? 'up' : 'down');
          setTimeout(() => alive && setFlash(null), 600);
        }
        prev.current = j.priceUsd;
        setPrice(j.priceUsd);
        if (j.marketCapUsd != null) setMarketCap(j.marketCapUsd);
        if (j.change24h != null) setChange24h(j.change24h);
      } catch { /* keep last real value */ }
    };
    const id = setInterval(tick, intervalMs);
    void tick();
    return () => { alive = false; clearInterval(id); };
  }, [chain, address, intervalMs]);

  return { price, marketCap, change24h, flash };
}
