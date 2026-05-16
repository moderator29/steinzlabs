'use client';

/**
 * Lightweight inline sparkline. Renders a single SVG <path> for a
 * series of numbers — used on holdings rows, token cards, KPI tiles
 * to show trend at a glance without spinning up Recharts.
 *
 * Zero dep. Auto-detects up/down trend by comparing first vs last
 * sample and colors the stroke accordingly. Caller can override with
 * the color prop. Renders inline-block at the provided width/height.
 */

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  /** When true, fills the area below the line at low opacity. */
  filled?: boolean;
  className?: string;
}

const TREND_UP = '#10B981';
const TREND_DOWN = '#EF4444';
const TREND_FLAT = '#6B7280';

export function Sparkline({
  data,
  width = 80,
  height = 22,
  stroke,
  filled = false,
  className,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <span aria-hidden className={`inline-block ${className ?? ''}`} style={{ width, height }} />;
  }
  const finite = data.filter((n) => Number.isFinite(n));
  if (finite.length < 2) {
    return <span aria-hidden className={`inline-block ${className ?? ''}`} style={{ width, height }} />;
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || 1;
  const step = finite.length > 1 ? width / (finite.length - 1) : width;

  const points = finite.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return { x, y };
  });

  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`))
    .join(' ');

  const trend = finite[finite.length - 1] - finite[0];
  const color = stroke ?? (trend > 0 ? TREND_UP : trend < 0 ? TREND_DOWN : TREND_FLAT);

  const fillPath = filled
    ? `${path} L ${width.toFixed(2)} ${height.toFixed(2)} L 0 ${height.toFixed(2)} Z`
    : '';

  return (
    <svg
      role="img"
      aria-label={`Trend ${trend >= 0 ? 'up' : 'down'} ${Math.abs(trend).toFixed(2)}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`inline-block ${className ?? ''}`}
    >
      {filled && (
        <path d={fillPath} fill={color} fillOpacity={0.18} stroke="none" />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
