'use client';

import { useState, useEffect } from 'react';
import { CoinGeckoDetail } from '@/lib/market/types';

export function useTokenDetail(tokenId: string | null) {
  const [detail, setDetail] = useState<CoinGeckoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    window.fetch(`/api/market/token/${tokenId}`)
      .then((r) => r.json())
      .then((data: CoinGeckoDetail) => {
        if (!cancelled) setDetail(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tokenId]);

  return { detail, loading, error };
}
