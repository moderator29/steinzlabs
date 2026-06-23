'use client';

import { useId, useMemo, useState } from 'react';

/**
 * MicroChart — pure-SVG bar + area charts for admin dashboards.
 *
 * Replaces recharts (BarChart / AreaChart) on the 6 admin pages plus
 * the portfolio page. recharts pulled in ~70KB gz per route for plain
 * bar/area renderings we can express in ~150 lines of SVG with zero
 * runtime deps. No ResizeObserver loop, no React 19 portal warnings,
 * no SSR mismatch — viewBox does the scaling.
 *
 * API stays close enough to the recharts call site that migration is
 * mechanical:
 *   <MicroBar data={rows} xKey="label" yKey="value" />
 *   <MicroArea data={rows} xKey="ts" yKey="usd" />
 *
 * Tooltips: hover a bar / point to surface the underlying row.
 */

// Row is intentionally permissive — callers pass typed feature/usage/portfolio
// rows whose declared shape doesn't include an index signature. Using `object`
// keeps every concrete interface assignable.
type Row = object;

interface CommonProps<T extends Row> {
  data: T[];
  xKey: keyof T;
  yKey: keyof T;
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
  formatX?: (v: unknown) => string;
  className?: string;
}

const DEFAULT_COLOR = '#0A1EFF';
const PAD = { top: 12, right: 8, bottom: 22, left: 36 };

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtNumber(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function MicroBar<T extends Row>({
  data,
  xKey,
  yKey,
  color = DEFAULT_COLOR,
  height = 220,
  formatY = fmtNumber,
  formatX = (v) => String(v ?? ''),
  className,
}: CommonProps<T>) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 600; // viewBox width — SVG scales to container
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const { max, bars, ticks } = useMemo(() => {
    const values = data.map((r) => num((r as Record<string, unknown>)[yKey as string]));
    const max = Math.max(1, ...values);
    const step = data.length > 0 ? innerW / data.length : 0;
    const barW = Math.max(2, step * 0.7);
    const bars = data.map((r, i) => ({
      x: PAD.left + i * step + (step - barW) / 2,
      y: PAD.top + innerH - (num((r as Record<string, unknown>)[yKey as string]) / max) * innerH,
      w: barW,
      h: (num((r as Record<string, unknown>)[yKey as string]) / max) * innerH,
      row: r,
    }));
    const tickValues = [0, max * 0.5, max];
    return { max, bars, ticks: tickValues };
  }, [data, yKey, innerW, innerH]);

  if (data.length === 0) {
    return <EmptyState height={height} />;
  }

  return (
    <div className={className} style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Bar chart</title>
        {/* Y-axis grid + labels */}
        {ticks.map((t, i) => {
          const y = PAD.top + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={width - PAD.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 3} fill="rgba(255,255,255,0.45)" fontSize={9} textAnchor="end" fontFamily="monospace">
                {formatY(t)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={Math.max(1, b.h)}
            fill={color}
            fillOpacity={hover === i ? 1 : 0.75}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            rx={1.5}
          />
        ))}
        {/* X-axis labels (every Nth so they don't overlap) */}
        {bars.map((b, i) => {
          const everyN = Math.max(1, Math.ceil(data.length / 8));
          if (i % everyN !== 0) return null;
          return (
            <text
              key={`x-${i}`}
              x={b.x + b.w / 2}
              y={height - 6}
              fill="rgba(255,255,255,0.45)"
              fontSize={9}
              textAnchor="middle"
            >
              {formatX((b.row as Record<string, unknown>)[xKey as string])}
            </text>
          );
        })}
      </svg>
      {hover !== null && bars[hover] && (
        <div
          role="tooltip"
          className="pointer-events-none absolute rounded-md border border-white/10 bg-[#0A0E1A]/95 px-2 py-1.5 text-[10px] text-white shadow-lg"
          style={{
            left: `${((bars[hover].x + bars[hover].w / 2) / width) * 100}%`,
            top: 4,
            transform: 'translate(-50%, 0)',
          }}
        >
          <div className="font-mono text-[10px] text-slate-400">{formatX(bars[hover].row[xKey])}</div>
          <div className="font-bold text-white">{formatY(num(bars[hover].row[yKey]))}</div>
        </div>
      )}
    </div>
  );
}

export function MicroArea<T extends Row>({
  data,
  xKey,
  yKey,
  color = DEFAULT_COLOR,
  height = 220,
  formatY = fmtNumber,
  formatX = (v) => String(v ?? ''),
  className,
}: CommonProps<T>) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 600;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const { points, max, areaPath, ticks } = useMemo(() => {
    const values = data.map((r) => num((r as Record<string, unknown>)[yKey as string]));
    const max = Math.max(1, ...values);
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;
    const points = data.map((r, i) => ({
      x: PAD.left + i * step,
      y: PAD.top + innerH - (num((r as Record<string, unknown>)[yKey as string]) / max) * innerH,
      row: r,
    }));
    const baseline = PAD.top + innerH;
    const areaPath = points.length > 0
      ? `M ${points[0].x} ${baseline} ` +
        points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
        ` L ${points[points.length - 1].x} ${baseline} Z`
      : '';
    return { points, max, areaPath, ticks: [0, max * 0.5, max] };
  }, [data, yKey, innerW, innerH]);

  if (data.length === 0) {
    return <EmptyState height={height} />;
  }

  const gradientId = `${id}-grad`;

  return (
    <div className={className} style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Area chart</title>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => {
          const y = PAD.top + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={width - PAD.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 3} fill="rgba(255,255,255,0.45)" fontSize={9} textAnchor="end" fontFamily="monospace">
                {formatY(t)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => {
          const everyN = Math.max(1, Math.ceil(data.length / 8));
          if (i % everyN !== 0) return null;
          return (
            <text
              key={`x-${i}`}
              x={p.x}
              y={height - 6}
              fill="rgba(255,255,255,0.45)"
              fontSize={9}
              textAnchor="middle"
            >
              {formatX((p.row as Record<string, unknown>)[xKey as string])}
            </text>
          );
        })}
        {/* Invisible hit zones for tooltip */}
        {points.map((p, i) => (
          <circle
            key={`hit-${i}`}
            cx={p.x}
            cy={p.y}
            r={Math.max(6, innerW / data.length / 2)}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
        {hover !== null && points[hover] && (
          <circle cx={points[hover].x} cy={points[hover].y} r={3} fill={color} />
        )}
      </svg>
      {hover !== null && points[hover] && (
        <div
          role="tooltip"
          className="pointer-events-none absolute rounded-md border border-white/10 bg-[#0A0E1A]/95 px-2 py-1.5 text-[10px] text-white shadow-lg"
          style={{
            left: `${(points[hover].x / width) * 100}%`,
            top: 4,
            transform: 'translate(-50%, 0)',
          }}
        >
          <div className="font-mono text-[10px] text-slate-400">{formatX(points[hover].row[xKey])}</div>
          <div className="font-bold text-white">{formatY(num(points[hover].row[yKey]))}</div>
        </div>
      )}
    </div>
  );
}

interface DonutProps<T extends Row> {
  data: T[];
  nameKey: keyof T;
  valueKey: keyof T;
  colors?: string[];
  size?: number;
  formatValue?: (v: number) => string;
  className?: string;
}

const DONUT_DEFAULT_COLORS = ['#0A1EFF', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];

export function MicroDonut<T extends Row>({
  data,
  nameKey,
  valueKey,
  colors = DONUT_DEFAULT_COLORS,
  size = 220,
  formatValue = fmtNumber,
  className,
}: DonutProps<T>) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const innerR = r * 0.55;

  const { slices, total } = useMemo(() => {
    const values = data.map((d) => num((d as Record<string, unknown>)[valueKey as string]));
    const total = values.reduce((s, v) => s + v, 0);
    if (total === 0) return { slices: [], total: 0 };
    let acc = 0;
    const slices = data.map((d, i) => {
      const v = num((d as Record<string, unknown>)[valueKey as string]);
      const startAngle = (acc / total) * Math.PI * 2;
      acc += v;
      const endAngle = (acc / total) * Math.PI * 2;
      const x1 = cx + Math.sin(startAngle) * r;
      const y1 = cy - Math.cos(startAngle) * r;
      const x2 = cx + Math.sin(endAngle) * r;
      const y2 = cy - Math.cos(endAngle) * r;
      const xi2 = cx + Math.sin(endAngle) * innerR;
      const yi2 = cy - Math.cos(endAngle) * innerR;
      const xi1 = cx + Math.sin(startAngle) * innerR;
      const yi1 = cy - Math.cos(startAngle) * innerR;
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      const path = [
        `M ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${xi2} ${yi2}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1} ${yi1}`,
        'Z',
      ].join(' ');
      return { path, value: v, name: String((d as Record<string, unknown>)[nameKey as string]), color: colors[i % colors.length], row: d };
    });
    return { slices, total };
  }, [data, valueKey, nameKey, cx, cy, r, innerR, colors]);

  if (total === 0) return <EmptyState height={size} />;

  return (
    <div className={className} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-labelledby={`${id}-title`}>
          <title id={`${id}-title`}>Donut chart</title>
          {slices.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              fillOpacity={hover === null || hover === i ? 1 : 0.45}
              stroke="#0A0E1A"
              strokeWidth={1}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          ))}
          {hover !== null && slices[hover] && (
            <>
              <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize={12} fontWeight={700}>
                {formatValue(slices[hover].value)}
              </text>
              <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={9}>
                {((slices[hover].value / total) * 100).toFixed(1)}%
              </text>
            </>
          )}
        </svg>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#94A3B8', listStyle: 'none', margin: 0, padding: 0, minWidth: 120 }}>
          {slices.map((s, i) => (
            <li
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span style={{ color: 'white', fontVariantNumeric: 'tabular-nums' }}>
                {((s.value / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyState({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center text-xs text-slate-500 border border-dashed border-white/10 rounded-lg"
      style={{ height }}
    >
      No data yet.
    </div>
  );
}
