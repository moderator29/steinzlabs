'use client';

import { useState, useEffect, useRef } from 'react';
import { OHLCVCandle, VolumeBar, Timeframe } from '@/lib/market/types';
import { timeframeToDays } from '@/lib/market/formatters';

export function useChartData(tokenId: string | null, timeframe: Timeframe) {
  const [candles, setCandles] = useState<OHLCVCandle[]>([]);
  const [volume, setVolume] = useState<VolumeBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, { candles: OHLCVCandle[]; volume: VolumeBar[] }>>(new Map());

  useEffect(() => {
    if (!tokenId) return;

    const cacheKey = `${tokenId}:${timeframe}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setCandles(cached.candles);
      setVolume(cached.volume);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const days = timeframeToDays(timeframe);

    window.fetch(`/api/market/token/${tokenId}/chart?days=${days}`)
      .then((r) => r.json())
      .then((data: { candles: OHLCVCandle[]; volume: VolumeBar[] }) => {
        if (cancelled) return;
        let c = data.candles ?? [];

        // Filter for sub-day timeframes
        if (timeframe === '1H') {
          const cutoff = Date.now() / 1000 - 3600;
          c = c.filter((x) => x.time >= cutoff);
        } else if (timeframe === '6H') {
          const cutoff = Date.now() / 1000 - 21600;
          c = c.filter((x) => x.time >= cutoff);
        }

        const v = data.volume?.slice(-c.length) ?? [];
        cache.current.set(cacheKey, { candles: c, volume: v });
        setCandles(c);
        setVolume(v);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chart load failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tokenId, timeframe]);

  return { candles, volume, loading, error };
}
