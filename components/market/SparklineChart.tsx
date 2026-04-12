'use client';

import { useEffect, useRef } from 'react';

interface SparklineChartProps {
  data: number[];
  isPositive: boolean;
  height?: number;
}

export function SparklineChart({ data, isPositive, height = 48 }: SparklineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data.length || typeof window === 'undefined' || !containerRef.current) return;

    let chart: { remove: () => void } | null = null;

    const init = async () => {
      const { createChart, ColorType } = await import('lightweight-charts');
      if (!containerRef.current) return;

      const color = isPositive ? '#22c55e' : '#ef4444';

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'transparent' },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        timeScale: { visible: false },
        crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
        handleScroll: false,
        handleScale: false,
      });

      const areaSeries = (chart as unknown as { addAreaSeries: (o?: unknown) => { setData: (d: unknown) => void } }).addAreaSeries({
        lineColor: color,
        topColor: `${color}33`,
        bottomColor: `${color}00`,
        lineWidth: 1.5,
      });

      const now = Math.floor(Date.now() / 1000);
      const interval = 3600; // hourly points for 7-day sparkline
      areaSeries.setData(data.map((v, i) => ({ time: now - (data.length - i) * interval, value: v })));
    };

    init();
    return () => { if (chart) chart.remove(); };
  }, [data, isPositive, height]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
