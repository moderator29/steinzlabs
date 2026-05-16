'use client';

/**
 * Stacked-bar visualization of decomposed wallet risk. Pairs with
 * lib/walletIntel/riskDecomposition.ts — the lib produces the five
 * component scores; this file renders them as a single horizontal
 * bar with one segment per dimension so users see what's driving
 * the overall number.
 *
 * No external dep — pure SVG sized to fill its container. Renders
 * accessibly: each segment carries an aria-label and the bar acts as
 * a progressbar landmark.
 */

export interface RiskBarComponents {
  concentration: number;
  liquidity: number;
  entryTiming: number;
  smartMoneyFollowing: number;
  scamExposure: number;
}

export interface RiskStackedBarProps {
  overall: number;
  components: RiskBarComponents;
  level: 'low' | 'medium' | 'high' | 'extreme';
}

const DIMENSIONS: Array<{
  key: keyof RiskBarComponents;
  label: string;
  color: string;
  weight: number; // matches riskDecomposition weights
}> = [
  { key: 'concentration',         label: 'Concentration',    color: '#0A1EFF', weight: 0.20 },
  { key: 'liquidity',              label: 'Liquidity',         color: '#7C3AED', weight: 0.25 },
  { key: 'entryTiming',            label: 'Entry timing',      color: '#F59E0B', weight: 0.15 },
  { key: 'smartMoneyFollowing',    label: 'Smart-money risk',  color: '#06B6D4', weight: 0.10 },
  { key: 'scamExposure',           label: 'Scam exposure',     color: '#EF4444', weight: 0.30 },
];

const LEVEL_LABEL: Record<RiskStackedBarProps['level'], string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  extreme: 'Extreme risk',
};

const LEVEL_COLOR: Record<RiskStackedBarProps['level'], string> = {
  low: 'text-emerald-300',
  medium: 'text-amber-300',
  high: 'text-orange-300',
  extreme: 'text-red-300',
};

export function RiskStackedBar({ overall, components, level }: RiskStackedBarProps) {
  return (
    <div
      role="group"
      aria-label={`Wallet risk decomposition. Overall ${overall} of 100.`}
      className="space-y-2"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Risk score</span>
        <span className={`font-bold ${LEVEL_COLOR[level]}`}>
          {overall}/100 · {LEVEL_LABEL[level]}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={overall}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full rounded-full bg-white/[0.04] border border-white/10 overflow-hidden flex"
      >
        {DIMENSIONS.map((d) => {
          const score = components[d.key];
          const weight = score * d.weight;
          return (
            <div
              key={d.key}
              title={`${d.label}: ${score}/100`}
              aria-label={`${d.label} ${score} of 100`}
              style={{ width: `${weight}%`, backgroundColor: d.color }}
              className="h-full"
            />
          );
        })}
      </div>
      <ul className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
        {DIMENSIONS.map((d) => (
          <li key={d.key} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            {d.label} {components[d.key]}
          </li>
        ))}
      </ul>
    </div>
  );
}
