'use client';

/**
 * Coin price chart. Two modes: a smooth area line (default, the calm view) and
 * full candles. Real OHLC only, from the keyless candle endpoint. Colors follow
 * the brand: emerald for up, rose for down. Fully responsive to its container.
 */

import { useEffect, useRef } from 'react';
import type { CoinCandle } from '@/lib/coins/types';

export type ChartMode = 'line' | 'candle';

/** A user's buy/sell on this coin, plotted as a marker on the chart. */
export interface TradeMarker { time: number; side: 'buy' | 'sell' }

export function CoinChart({ candles, mode, height = 260, up = true, markers = [] }: {
  candles: CoinCandle[];
  mode: ChartMode;
  height?: number;
  up?: boolean;
  markers?: TradeMarker[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!candles.length || typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    let cancelled = false;
    let onResize: (() => void) | null = null;

    const init = async () => {
      const mod = await import('lightweight-charts');
      const { createChart, ColorType, CrosshairMode, CandlestickSeries, AreaSeries, createSeriesMarkers } = mod;
      if (cancelled || !containerRef.current) return;

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8a93a6' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderVisible: false, textColor: '#6b7280' },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
        handleScale: false,
        handleScroll: false,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let series: any;
      if (mode === 'candle') {
        series = chart.addSeries(CandlestickSeries, {
          upColor: '#10B981', downColor: '#F43F5E',
          borderUpColor: '#10B981', borderDownColor: '#F43F5E',
          wickUpColor: '#10B981', wickDownColor: '#F43F5E',
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.setData(candles.map((c) => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })));
      } else {
        const color = up ? '#10B981' : '#F43F5E';
        series = chart.addSeries(AreaSeries, {
          lineColor: color,
          topColor: up ? 'rgba(16,185,129,0.22)' : 'rgba(244,63,94,0.22)',
          bottomColor: 'rgba(8,11,20,0)',
          lineWidth: 2,
          priceLineVisible: false,
          crosshairMarkerVisible: true,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.setData(candles.map((c) => ({ time: c.time as any, value: c.close })));
      }

      // Overlay the user's own buys (green +) and sells (rose -) as markers.
      // Only markers inside the loaded candle window can render, so we clamp to
      // it; markers outside this timeframe simply do not show for this range.
      if (markers.length && series) {
        const first = candles[0]?.time ?? -Infinity;
        const last = candles[candles.length - 1]?.time ?? Infinity;
        const marks = markers
          .filter((m) => Number.isFinite(m.time) && m.time >= first && m.time <= last)
          .sort((a, b) => a.time - b.time)
          .map((m) => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            time: m.time as any,
            position: (m.side === 'buy' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
            color: m.side === 'buy' ? '#10B981' : '#F43F5E',
            shape: 'circle' as const,
            // Our own marker glyphs: a buy reads as a green star, a sell as a rose hash.
            text: m.side === 'buy' ? '*' : '#',
          }));
        try { createSeriesMarkers(series, marks); } catch { /* markers unsupported on this build */ }
      }

      chart.timeScale().fitContent();
      onResize = () => {
        if (containerRef.current && chart) {
          try { chart.applyOptions({ width: containerRef.current.clientWidth }); } catch { /* removed */ }
        }
      };
      window.addEventListener('resize', onResize);
    };
    void init();

    return () => {
      cancelled = true;
      if (onResize) window.removeEventListener('resize', onResize);
      if (chart) { chart.remove(); chart = null; }
    };
  }, [candles, mode, height, up, markers]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
