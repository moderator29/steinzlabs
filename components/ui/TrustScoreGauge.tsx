'use client';

/**
 * Half-circle Trust Score gauge. Renders a 0..100 score as a 180°
 * arc with the needle pointing at the value. Color graded
 * red → amber → green so the visual matches the score range.
 *
 * Pure SVG, zero dep. Used on the proof modal hero, context-feed
 * card, security panel headline. Pairs with the canonical formula
 * in lib/trustScore/formula.ts.
 */

export interface TrustScoreGaugeProps {
  /** 0..100 */
  score: number;
  size?: number;
  /** Optional sub-label (e.g. 'TRUSTED'). */
  label?: string;
}

function colorFor(score: number): string {
  if (score >= 70) return '#10B981';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function TrustScoreGauge({ score, size = 120, label }: TrustScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const width = size;
  const height = size * 0.65;
  const cx = width / 2;
  const cy = height;
  const radius = width / 2 - 8;
  const angle = (clamped / 100) * 180;
  const color = colorFor(clamped);
  const trackPath = arcPath(cx, cy, radius, 0, 180);
  const valuePath = arcPath(cx, cy, radius, 0, angle);

  return (
    <div
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Trust score ${clamped} of 100${label ? `, ${label}` : ''}`}
      className="inline-flex flex-col items-center"
    >
      <svg width={width} height={height + 4} viewBox={`0 0 ${width} ${height + 4}`}>
        <path d={trackPath} stroke="rgba(255,255,255,0.08)" strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d={valuePath} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round" />
      </svg>
      <div className="flex items-baseline gap-1 -mt-3">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{Math.round(clamped)}</span>
        <span className="text-xs text-slate-500">/100</span>
      </div>
      {label ? <span className="text-[10px] uppercase tracking-wide font-semibold mt-0.5" style={{ color }}>{label}</span> : null}
    </div>
  );
}
