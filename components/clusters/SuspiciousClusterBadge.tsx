'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * Suspicious-cluster chip. Pairs with
 * lib/clusters/suspiciousDetector.ts — the lib scores the cluster;
 * this component renders the badge with the contributing signal
 * names in a hover tooltip.
 */

export interface SuspiciousClusterBadgeProps {
  level: 'low' | 'medium' | 'high';
  score: number;
  signals: string[];
}

const LEVEL_META: Record<'low' | 'medium' | 'high', { label: string; bg: string; text: string }> = {
  low: { label: 'Low risk', bg: 'bg-emerald-500/15 border-emerald-500/40', text: 'text-emerald-300' },
  medium: { label: 'Coordinated?', bg: 'bg-amber-500/15 border-amber-500/40', text: 'text-amber-300' },
  high: { label: 'Likely Sybil', bg: 'bg-red-500/15 border-red-500/40', text: 'text-red-300' },
};

export function SuspiciousClusterBadge({ level, score, signals }: SuspiciousClusterBadgeProps) {
  if (level === 'low') return null;
  const m = LEVEL_META[level];
  const tooltip = signals.length > 0
    ? `Suspicion ${Math.round(score * 100)}/100: ${signals.join(' · ')}`
    : `Suspicion ${Math.round(score * 100)}/100`;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${m.bg} ${m.text}`}
      title={tooltip}
      aria-label={tooltip}
    >
      <AlertTriangle className="w-3 h-3" />
      {m.label}
    </span>
  );
}
