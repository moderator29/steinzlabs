'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { OHLCVCandle, VolumeBar } from '@/lib/market/types';
import { LoadingSkeleton } from './LoadingSkeleton';

interface CandlestickChartProps {
  data: OHLCVCandle[];
  volumeData?: VolumeBar[];
  height?: number;
  loading?: boolean;
  enableFullscreen?: boolean;
}

export function CandlestickChart({ data, volumeData, height = 400, loading, enableFullscreen }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (loading || !data.length || typeof window === 'undefined') return;

    let chart: any = null; // lightweight-charts IChartApi type is incompatible with dynamic import
    let cancelled = false;
    let handleResize: (() => void) | null = null;

    const init = async () => {
      const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');
      // §13 audit fix: cancel guard for the case where the cleanup
      // function ran while the dynamic import was still in flight.
      if (cancelled || !containerRef.current) return;

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: fullscreen ? window.innerHeight - 100 : height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.03)' },
          horzLines: { color: 'rgba(255,255,255,0.03)' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderVisible: false, textColor: '#6b7280' },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#22c55e', borderDownColor: '#ef4444',
        wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      });
      candleSeries.setData(data);

      chart.timeScale().fitContent();
      chartRef.current = chart;

      handleResize = () => {
        if (containerRef.current && chart) {
          try {
            chart.applyOptions({ width: containerRef.current.clientWidth });
          } catch { /* chart was removed under us */ }
        }
      };
      window.addEventListener('resize', handleResize);
    };

    init();
    // §13 audit fix: the inner init() returned a remove-listener
    // closure that the outer cleanup never invoked, leaking one
    // resize listener per remount. Track handleResize at the outer
    // scope and clean it up here.
    return () => {
      cancelled = true;
      if (handleResize) window.removeEventListener('resize', handleResize);
      if (chart) {
        chartRef.current = null;
        chart.remove();
        chart = null;
      }
    };
  }, [data, volumeData, height, loading, fullscreen]);

  if (loading) return <LoadingSkeleton variant="chart" />;

  const chartContent = (
    <div className="relative w-full" style={{ height: fullscreen ? '100%' : height }}>
      {enableFullscreen && (
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="absolute top-2 right-2 z-10 p-1.5 bg-[#141824] border border-[#1E2433] rounded text-gray-400 hover:text-white transition-colors"
        >
          {fullscreen ? <X size={14} /> : <Maximize2 size={14} />}
        </button>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-40 bg-[#0A0E1A] p-4 flex flex-col">
        {chartContent}
      </div>
    );
  }

  return chartContent;
}
