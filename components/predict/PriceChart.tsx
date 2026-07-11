'use client';

import { useId, useMemo } from 'react';
import { formatUsd } from './utils';

interface Props {
  series: number[];
  target: number;
  livePrice?: number | null;
  height?: number;
  // emerald when the current price satisfies the market direction, else rose.
  favorable?: boolean;
  compact?: boolean;
}

// A lightweight, dependency-free area/line chart. Draws the real `series`, a
// dashed target line, a glowing "now" dot, and a subtle 24h/now axis feel. All
// geometry is derived from real data, no synthetic points.
export function PriceChart({
  series,
  target,
  livePrice,
  height = 180,
  favorable = true,
  compact = false,
}: Props) {
  const gid = useId().replace(/[:]/g, '');
  const W = 100; // viewBox width units (path uses percentages via preserveAspectRatio none)

  const model = useMemo(() => {
    const pts = series.filter((n) => Number.isFinite(n));
    // Fold the live tick onto the tail so the line reaches "now".
    const data = livePrice != null && Number.isFinite(livePrice) ? [...pts, livePrice] : pts;
    if (data.length < 2) return null;

    const values = [...data, target];
    let min = Math.min(...values);
    let max = Math.max(...values);
    const pad = (max - min) * 0.12 || Math.abs(max) * 0.01 || 1;
    min -= pad;
    max += pad;
    const span = max - min || 1;

    const x = (i: number) => (i / (data.length - 1)) * W;
    const y = (v: number) => ((max - v) / span) * height;

    const linePts = data.map((v, i) => `${x(i)},${y(v)}`);
    const linePath = `M ${linePts.join(' L ')}`;
    const areaPath = `${linePath} L ${W},${height} L 0,${height} Z`;
    const targetY = y(target);
    const last = data[data.length - 1];

    return { linePath, areaPath, targetY, lastX: W, lastY: y(last), last };
  }, [series, target, livePrice, height]);

  const stroke = favorable ? '#10B981' : '#F43F5E';
  const glow = favorable ? 'rgba(16,185,129,0.55)' : 'rgba(244,63,94,0.55)';

  if (!model) {
    return (
      <div
        className="w-full rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-[11px] text-gray-600"
        style={{ height }}
      >
        Chart warming up…
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${gid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* subtle horizontal gridlines for the axis feel */}
        {!compact &&
          [0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={W}
              y1={height * f}
              y2={height * f}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}

        {/* area + line */}
        <path d={model.areaPath} fill={`url(#fill-${gid})`} />
        <path
          d={model.linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          filter={`url(#glow-${gid})`}
        />

        {/* dashed target line */}
        <line
          x1="0"
          x2={W}
          y1={model.targetY}
          y2={model.targetY}
          stroke="rgba(159,208,255,0.85)"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />

        {/* glowing now-dot */}
        <circle cx={model.lastX} cy={model.lastY} r="2.4" fill={stroke} vectorEffect="non-scaling-stroke">
          <animate attributeName="r" values="2.4;3.6;2.4" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx={model.lastX} cy={model.lastY} r="2.4" fill="none" stroke={glow} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* target label pinned to the dashed line */}
      <div
        className="pointer-events-none absolute left-0 -translate-y-1/2 text-[9px] font-semibold text-[#9FD0FF] bg-[#0B1030]/80 rounded px-1"
        style={{ top: `${(model.targetY / height) * 100}%` }}
      >
        {formatUsd(target)}
      </div>

      {!compact && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-[9px] text-gray-600 px-0.5">
          <span>24h</span>
          <span>now</span>
        </div>
      )}
    </div>
  );
}
