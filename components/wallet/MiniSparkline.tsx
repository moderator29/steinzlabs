'use client';

// FIX 5A.1 / Phase 4: mini 7-day sparkline rendered as inline SVG.
// Kept dependency-free (no recharts) so the wallet coin list stays light on mobile.

import { useEffect, useState } from 'react';

interface Props {
  coinGeckoId: string;
  width?: number;
  height?: number;
}

interface SparkData {
  points: number[];
  changePct: number;
}

const cache = new Map<string, SparkData>();

export function MiniSparkline({ coinGeckoId, width = 56, height = 22 }: Props) {
  const [data, setData] = useState<SparkData | null>(cache.get(coinGeckoId) ?? null);

  useEffect(() => {
    if (!coinGeckoId) return;
    if (cache.has(coinGeckoId)) {
      setData(cache.get(coinGeckoId) || null);
      return;
    }
    let cancelled = false;
    fetch(`/api/wallet/sparkline?id=${encodeURIComponent(coinGeckoId)}`)
      .then((r) => r.json())
      .then((d: SparkData) => {
        if (cancelled) return;
        if (Array.isArray(d.points) && d.points.length > 1) {
          cache.set(coinGeckoId, d);
          setData(d);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coinGeckoId]);

  if (!data || data.points.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const { points, changePct } = data;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const positive = changePct >= 0;
  const stroke = positive ? '#10B981' : '#EF4444';
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} aria-label="7-day price" className="flex-shrink-0">
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
