'use client';

/**
 * RiskRing — SVG arc gauge for the wallet intelligence / DNA risk
 * score. Score 0..100 maps to:
 *
 *   0..24    Low risk      emerald
 *   25..49   Moderate      amber
 *   50..74   High          orange
 *   75..100  Extreme       red
 *
 * Animates from 0 → score on mount (300ms cubic-bezier) for the
 * 'score lands with weight' effect the audit B.8 P2 spec asked
 * for. Pure presentation.
 */

import { useEffect, useState } from 'react';

export interface RiskRingProps {
  score: number; // 0..100
  size?: number; // diameter in px
  thickness?: number;
  label?: string;
}

const BAND = (score: number) => {
  if (score < 25) return { color: '#10B981', label: 'LOW RISK' };
  if (score < 50) return { color: '#F59E0B', label: 'MODERATE' };
  if (score < 75) return { color: '#F97316', label: 'HIGH RISK' };
  return { color: '#EF4444', label: 'EXTREME' };
};

export function RiskRing({ score, size = 160, thickness = 14, label }: RiskRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const [drawn, setDrawn] = useState(0);
  const band = BAND(clamped);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 320;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDrawn(clamped * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - drawn / 100);

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`Risk score ${clamped} of 100, ${band.label}`}>
        <defs>
          <linearGradient id={`risk-grad-${clamped}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={band.color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={band.color} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={thickness}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#risk-grad-${clamped})`}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 8px ${band.color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-4xl font-bold tabular-nums" style={{ color: band.color }}>
          {Math.round(drawn)}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mt-0.5">
          {label ?? band.label}
        </div>
      </div>
    </div>
  );
}
