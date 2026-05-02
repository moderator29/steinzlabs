'use client';

/**
 * §11 native chart for the Whale Tracker → Activity tab.
 *
 * Plots the running cumulative USD value of a whale's recent trades —
 * the only chart-worthy time series we have without a new backend
 * snapshot endpoint. The activity rows already carry timestamp +
 * value_usd; we sort them oldest-first, accumulate, and feed an
 * area series into lightweight-charts.
 *
 * Why an area chart, not OHLC: there's no open/high/low for a
 * cumulative-volume line. Picking candlestick here would produce
 * misleading wicks. Area gets the trend across without faking it.
 *
 * Empty input → renders a "Not enough activity to chart yet" stub
 * instead of a 0-tall chart that looks broken.
 */

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

/**
 * The component reads only the three time-series fields it needs.
 * The whale-tracker page passes the wider activity row shape
 * (tx_hash, token_symbol, etc.) — TypeScript structural typing
 * accepts that without casting.
 */
interface ActivityPoint {
  timestamp: string;
  value_usd: number | null;
  action?: string;
}

interface Props {
  activity: ActivityPoint[];
  height?: number;
  className?: string;
}

const BRAND_BLUE = '#4d80ff';

export default function WhaleActivityChart({ activity, height = 220, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace' },
      grid: { vertLines: { color: 'rgba(148,163,184,0.06)' }, horzLines: { color: 'rgba(148,163,184,0.06)' } },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.1)' },
      timeScale: { borderColor: 'rgba(148,163,184,0.1)', timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      width: container.clientWidth,
      height,
    });

    const series = chart.addAreaSeries({
      lineColor: BRAND_BLUE,
      topColor: 'rgba(77,128,255,0.3)',
      bottomColor: 'rgba(77,128,255,0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      // Guard on chartRef to avoid calling applyOptions on a removed
      // chart (audit §1: ResizeObserver can fire between cleanup start
      // and DOM unmount).
      if (containerRef.current && chartRef.current) {
        try {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        } catch {
          /* chart was removed under us; next observer cycle will see chartRef=null */
        }
      }
    });
    ro.observe(container);

    return () => {
      // Disconnect the observer FIRST and null the refs BEFORE chart.remove()
      // so any callback that's already queued sees an inert state and bails.
      ro.disconnect();
      chartRef.current = null;
      seriesRef.current = null;
      chart.remove();
    };
  }, [height]);

  // Update data whenever the activity array changes.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Sort oldest first; accumulate value_usd. Keep only timestamp-bearing,
    // numeric-value rows — the API can return null for either field. Also
    // drop rows whose timestamp string fails Date.parse (audit §3:
    // unsorted NaN's cause undefined sort behavior in V8).
    const points = [...activity]
      .filter(a => a.timestamp && typeof a.value_usd === 'number' && !Number.isNaN(a.value_usd) && Number.isFinite(new Date(a.timestamp).getTime()))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let cumulative = 0;
    // lightweight-charts requires UTCTimestamp (seconds, monotonically increasing).
    // Multiple trades in the same second are coalesced — last write wins on
    // duplicate ts, but we add a 1-second offset to preserve ordering.
    let lastTs = 0;
    const data = points.map(p => {
      const v = p.value_usd as number;
      cumulative += v;
      let ts = Math.floor(new Date(p.timestamp).getTime() / 1000) as UTCTimestamp;
      if (ts <= (lastTs as number)) ts = ((lastTs as number) + 1) as UTCTimestamp;
      lastTs = ts as number;
      return { time: ts, value: cumulative };
    });

    series.setData(data);
    if (data.length > 0) chartRef.current?.timeScale().fitContent();
  }, [activity]);

  const usable = activity.filter(a => a.timestamp && typeof a.value_usd === 'number');
  if (usable.length < 2) {
    return (
      <div className={`flex items-center justify-center text-xs text-gray-500 border border-white/10 rounded-xl ${className}`}
           style={{ height }}>
        Not enough activity to chart yet — needs at least 2 trades with USD value.
      </div>
    );
  }

  const totalUsd = usable.reduce((s, a) => s + (a.value_usd as number), 0);

  return (
    <div
      role="img"
      aria-label={`Cumulative whale activity: $${totalUsd.toFixed(0)} USD across ${usable.length} recent trades`}
      className={`rounded-xl border border-white/10 overflow-hidden ${className}`}
    >
      <div ref={containerRef} style={{ width: '100%', height }} />
      <div className="px-3 py-1.5 text-[10px] text-gray-500 border-t border-white/10 bg-black/20">
        Cumulative USD value across {usable.length} recent trades
      </div>
    </div>
  );
}
