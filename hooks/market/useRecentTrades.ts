'use client';

import { useState, useEffect } from 'react';
import { RecentTrade } from '@/lib/market/types';
import { POLLING_INTERVALS } from '@/lib/market/constants';

export function useRecentTrades(pairAddress: string | null, chain = 'ethereum') {
  const [trades, setTrades] = useState<RecentTrade[]>([]);

  useEffect(() => {
    if (!pairAddress) return;

    const poll = async () => {
      try {
        const res = await window.fetch(`/api/market/dexscreener/${pairAddress}?chain=${chain}`);
        if (!res.ok) return;
        const d = await res.json() as { recentTrades?: RecentTrade[] };
        if (d.recentTrades?.length) {
          setTrades((prev) => {
            const combined = [...(d.recentTrades ?? []), ...prev];
            return combined.slice(0, 50);
          });
        }
      } catch { /* silent */ }
    };

    poll();
    const id = setInterval(poll, POLLING_INTERVALS.RECENT_TRADES);
    return () => clearInterval(id);
  }, [pairAddress, chain]);

  return { trades };
}
