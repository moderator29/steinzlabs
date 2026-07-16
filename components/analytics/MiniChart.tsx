'use client';

/**
 * Dependency-free responsive sparkline / area chart for the Analytics surfaces.
 * Hand-rolled SVG (no chart lib): a smooth polyline over a soft gradient fill,
 * brand blue by default, emerald/rose when the series ends up or down. The
 * viewBox is normalised to 0..100 on both axes and the SVG stretches to its
 * container width, so it scales cleanly from a 390px phone to desktop.
 */

interface MiniChartProps {
  /** Y values in chronological order. Fewer than 2 points renders an empty state. */
  data: number[];
  /** Fixed pixel height of the chart. Width is always 100% of the parent. */
  height?: number;
  /** Force a stroke/fill colour. Defaults to a sign-aware brand palette. */
  color?: string;
  /** Draw the gradient area under the line. */
  area?: boolean;
  className?: string;
  /** Accessible label for screen readers. */
  ariaLabel?: string;
}

const BRAND = '#0066FF';
const UP = '#10B981';
const DOWN = '#F43F5E';

export function MiniChart({ data, height = 56, color, area = true, className = '', ariaLabel }: MiniChartProps) {
  const clean = data.filter((n) => Number.isFinite(n));
  if (clean.length < 2) {
    return (
      <div
        className={`flex items-center justify-center text-[11px] text-white/30 ${className}`}
        style={{ height }}
      >
        Not enough data yet
      </div>
    );
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const stepX = 100 / (clean.length - 1);
  // Leave a small vertical margin so the stroke is never clipped at the edges.
  const pad = 6;
  const usable = 100 - pad * 2;
  const points = clean.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / span) * usable;
    return [x, y] as const;
  });

  const stroke = color ?? (clean[clean.length - 1] >= clean[0] ? UP : BRAND);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const fill = `${line} L100,100 L0,100 Z`;
  const gradId = `mc-${stroke.replace('#', '')}-${clean.length}`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabel ?? 'Trend chart'}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={fill} fill={`url(#${gradId})`} />}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export { BRAND as MINI_CHART_BRAND, UP as MINI_CHART_UP, DOWN as MINI_CHART_DOWN };
export default MiniChart;
