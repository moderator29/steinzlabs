'use client';

/**
 * A tiny per-row price sparkline. Honest, keyless and zero extra requests: it
 * reconstructs a short price trail from the coin's own reported % changes
 * (5m / 1h / 24h) relative to the live price, so every point is real data we
 * already carry, not a fabricated series. Renders nothing without enough
 * signal. Colour follows 24h direction — emerald up, rose down.
 */

import type { Coin } from '@/lib/coins/types';

export function Sparkline({ coin, width = 60, height = 22 }: { coin: Coin; width?: number; height?: number }) {
  const p = coin.priceUsd;
  if (!p || p <= 0) return null;

  // Back out an earlier price from a % change: price_then = price_now / (1 + chg%).
  const back = (chg: number | null | undefined) => (chg == null ? null : p / (1 + chg / 100));
  const series = [back(coin.change24h), back(coin.change1h), back(coin.change5m), p]
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || max || 1;
  const stepX = width / (series.length - 1);
  // 1px vertical padding so the peak/trough don't clip the stroke.
  const y = (v: number) => (1 + (height - 2) * (1 - (v - min) / span)).toFixed(1);
  const pts = series.map((v, i) => `${(i * stepX).toFixed(1)},${y(v)}`).join(' ');

  const up = (coin.change24h ?? 0) >= 0;
  const color = up ? '#10B981' : '#F43F5E';
  const gid = `spk-${(coin.tokenKey || coin.symbol || 'x').replace(/[^a-z0-9]/gi, '')}-${up ? 'u' : 'd'}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 opacity-90" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.30" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
