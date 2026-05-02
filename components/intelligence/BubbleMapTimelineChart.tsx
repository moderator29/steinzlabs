'use client';

/**
 * §11 — Concentration timeline chart for the BubbleMap.
 *
 * Plots two series from public.holder_snapshots:
 *   • Top-10 holder % over time (left axis, %)
 *   • Total holder count over time (right axis, integer)
 *
 * The data accrues organically because /api/intelligence/holders/[token]
 * upserts a snapshot row on every page view (de-duplicated to one per
 * day per token+chain). A token freshly viewed will start with 1
 * snapshot; the chart shows an explanatory empty-state until at least
 * 2 snapshots exist.
 *
 * Lazy-loaded so the lightweight-charts bundle ships only on the
 * Intelligence page where it's actually used.
 */

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { Loader2 } from 'lucide-react';

interface Snapshot {
  snapped_at: string;
  holder_count: number;
  top10_pct: number;
}

interface Props {
  token: string;
  chain: string;
  days?: number;
  height?: number;
  className?: string;
}

const CONCENTRATION = '#a855f7'; // purple — concentration risk
const HOLDERS = '#22c55e';        // green — healthier when rising

export default function BubbleMapTimelineChart({ token, chain, days = 90, height = 260, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const concSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const holdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch snapshots whenever inputs change. Cancellation flag guards
  // against an in-flight response landing after an unmount or a
  // token/chain change.
  useEffect(() => {
    let cancelled = false;
    setSnapshots(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/intelligence/holders/${encodeURIComponent(token)}/timeline?chain=${encodeURIComponent(chain)}&days=${days}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { snapshots: Snapshot[] };
        if (!cancelled) setSnapshots(json.snapshots ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load timeline');
      }
    })();
    return () => { cancelled = true; };
  }, [token, chain, days]);

  // Mount the chart only when we have at least 2 snapshots — empty
  // state renders below without ever creating a chart, so there's
  // nothing to clean up.
  useEffect(() => {
    if (!snapshots || snapshots.length < 2) return;
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace' },
      grid: { vertLines: { color: 'rgba(148,163,184,0.06)' }, horzLines: { color: 'rgba(148,163,184,0.06)' } },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.1)', visible: true },
      leftPriceScale:  { borderColor: 'rgba(148,163,184,0.1)', visible: true },
      timeScale: { borderColor: 'rgba(148,163,184,0.1)', timeVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      width: container.clientWidth,
      height,
    });

    const concSeries = chart.addLineSeries({
      color: CONCENTRATION,
      lineWidth: 2,
      priceScaleId: 'left',
      priceFormat: { type: 'percent', precision: 1, minMove: 0.1 },
      title: 'Top-10 %',
    });

    const holdSeries = chart.addLineSeries({
      color: HOLDERS,
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      priceScaleId: 'right',
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
      title: 'Holders',
    });

    chartRef.current = chart;
    concSeriesRef.current = concSeries;
    holdSeriesRef.current = holdSeries;

    // Sort + map to lightweight-charts shape. Same monotonic-time
    // safeguard as WhaleActivityChart (one row per day per token+
    // chain so collisions are unlikely, but defensive code is cheap).
    const sorted = [...snapshots].sort((a, b) => new Date(a.snapped_at).getTime() - new Date(b.snapped_at).getTime());
    let lastTs = 0;
    const concData = [] as { time: UTCTimestamp; value: number }[];
    const holdData = [] as { time: UTCTimestamp; value: number }[];
    for (const s of sorted) {
      const parsed = new Date(s.snapped_at).getTime();
      if (!Number.isFinite(parsed)) continue;
      let ts = Math.floor(parsed / 1000) as UTCTimestamp;
      if ((ts as number) <= lastTs) ts = (lastTs + 1) as UTCTimestamp;
      lastTs = ts as number;
      concData.push({ time: ts, value: Number(s.top10_pct) || 0 });
      holdData.push({ time: ts, value: Number(s.holder_count) || 0 });
    }
    concSeries.setData(concData);
    holdSeries.setData(holdData);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        try {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        } catch { /* removed under us */ }
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chartRef.current = null;
      concSeriesRef.current = null;
      holdSeriesRef.current = null;
      chart.remove();
    };
  }, [snapshots, height]);

  if (error) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] text-xs text-red-400 border border-red-500/20 rounded-xl ${className}`} style={{ height }}>
        {error}
      </div>
    );
  }
  if (snapshots === null) {
    return (
      <div className={`flex items-center justify-center text-xs text-gray-500 border border-white/10 rounded-xl ${className}`} style={{ height }}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading concentration history…
      </div>
    );
  }
  if (snapshots.length < 2) {
    return (
      <div className={`flex flex-col items-center justify-center text-xs text-gray-500 border border-white/10 rounded-xl px-4 text-center ${className}`} style={{ height }}>
        <p className="font-semibold text-gray-300 mb-1">Concentration timeline starting now.</p>
        <p>We snapshot top-10 holder % and holder count once per day. Come back tomorrow for the first comparison point.</p>
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`Holder concentration timeline: top-10 % and total holder count across the last ${days} days`}
      className={`rounded-xl border border-white/10 overflow-hidden ${className}`}
    >
      <div ref={containerRef} style={{ width: '100%', height }} />
      <div className="px-3 py-1.5 text-[10px] text-gray-500 border-t border-white/10 bg-black/20 flex items-center gap-3">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: CONCENTRATION }} /> Top-10 % (left)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-0.5 border-t border-dotted" style={{ borderColor: HOLDERS }} /> Holders (right)</span>
        <span className="ml-auto">{snapshots.length} snapshots · {days}d</span>
      </div>
    </div>
  );
}
