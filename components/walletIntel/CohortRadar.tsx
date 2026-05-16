'use client';

/**
 * Cohort comparison radar chart. Renders 6 percentile axes with the
 * target wallet overlaid on the cohort median band. Pure SVG, no
 * external chart lib.
 *
 * Pairs with lib/walletIntel/cohortRadar.ts — the lib produces the
 * percentile rows; this component draws them.
 */

const AXES = [
  { key: 'realizedPnl',         label: 'PnL' },
  { key: 'winRate',              label: 'Win rate' },
  { key: 'avgHoldHours',         label: 'Hold' },
  { key: 'tradeCount',           label: 'Volume' },
  { key: 'concentration',        label: 'Diversify' },
  { key: 'smartMoneyOverlap',    label: 'SM align' },
] as const;

type AxisKey = (typeof AXES)[number]['key'];

export interface CohortRadarProps {
  axes: Record<AxisKey, { percentile: number }>;
  size?: number;
}

function pointForAxis(idx: number, value01: number, cx: number, cy: number, radius: number) {
  const angle = (Math.PI * 2 * idx) / AXES.length - Math.PI / 2;
  const r = radius * Math.max(0, Math.min(1, value01));
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

export function CohortRadar({ axes, size = 220 }: CohortRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 24;
  const ringSteps = [0.25, 0.5, 0.75, 1];

  const targetPath = AXES.map((a, i) => {
    const p = pointForAxis(i, axes[a.key].percentile / 100, cx, cy, radius);
    return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }).join(' ') + ' Z';

  const labels = AXES.map((a, i) => {
    const labelPoint = pointForAxis(i, 1.12, cx, cy, radius);
    return { ...a, x: labelPoint.x, y: labelPoint.y };
  });

  return (
    <svg
      role="img"
      aria-label="Cohort comparison radar"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="text-slate-400"
    >
      {ringSteps.map((step) => {
        const pts = AXES.map((_, i) => pointForAxis(i, step, cx, cy, radius));
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
        return <path key={step} d={d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
      })}
      {AXES.map((_, i) => {
        const end = pointForAxis(i, 1, cx, cy, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={end.x.toFixed(2)}
            y2={end.y.toFixed(2)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        );
      })}
      <path d={targetPath} fill="rgba(10,30,255,0.20)" stroke="#0A1EFF" strokeWidth={1.5} strokeLinejoin="round" />
      {AXES.map((a, i) => {
        const p = pointForAxis(i, axes[a.key].percentile / 100, cx, cy, radius);
        return <circle key={a.key} cx={p.x} cy={p.y} r={3} fill="#0A1EFF" />;
      })}
      {labels.map((l) => (
        <text
          key={l.key}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="currentColor"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}
