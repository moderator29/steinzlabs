'use client';

/**
 * §3 P2-A.5 — Volume Profile.
 *
 * Horizontal histogram of volume traded at each price level. Buckets the
 * provided candles into N evenly-spaced price bins between the visible
 * high and low, sums volume in each bin, then renders a right-aligned
 * canvas histogram with the bar at the Point-of-Control (highest-volume
 * bin) highlighted.
 *
 * Designed to sit beside the AdvancedChart on token detail; same height
 * so the price scales align by eye.
 */

import { useEffect, useRef } from 'react';
import type { Candle } from '@/lib/services/ohlcv';

interface VolumeProfileProps {
  candles: Candle[];
  height: number;
  width?: number;
  bins?: number;
  className?: string;
}

export default function VolumeProfile({
  candles,
  height,
  width = 110,
  bins = 24,
  className = '',
}: VolumeProfileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Use the visible price range (high/low across all candles) and bin
    // close-prices weighted by volume. Industry-standard "volume by
    // price" — Birdeye, GMGN, and Bookmap all draw it the same way.
    let hi = -Infinity;
    let lo = Infinity;
    for (const c of candles) {
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    }
    if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi === lo) return;

    const binSize = (hi - lo) / bins;
    const volByBin = new Array(bins).fill(0);
    for (const c of candles) {
      const v = c.volume ?? 0;
      if (v <= 0) continue;
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((c.close - lo) / binSize)));
      volByBin[idx] += v;
    }

    const maxVol = Math.max(...volByBin);
    if (maxVol <= 0) return;
    const pocIdx = volByBin.indexOf(maxVol);

    const barH = height / bins;
    for (let i = 0; i < bins; i++) {
      // Top of canvas = highest price (visually consistent with chart
      // y-axis), so flip the index.
      const y = (bins - 1 - i) * barH;
      const w = (volByBin[i] / maxVol) * (width - 2);
      ctx.fillStyle = i === pocIdx ? 'rgba(245,158,11,0.85)' : 'rgba(77,128,255,0.45)';
      ctx.fillRect(width - w, y + 1, w, Math.max(1, barH - 1));
    }

    // Axis tick — label the POC price level so the user can read the
    // most-traded zone at a glance.
    const pocPrice = lo + (pocIdx + 0.5) * binSize;
    ctx.fillStyle = 'rgba(245,158,11,0.95)';
    ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const pocY = (bins - 1 - pocIdx) * barH + barH / 2;
    ctx.fillText(
      `POC ${pocPrice >= 1 ? pocPrice.toFixed(2) : pocPrice.toPrecision(4)}`,
      4,
      pocY,
    );
  }, [candles, width, height, bins]);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
