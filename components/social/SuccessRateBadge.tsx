'use client';

import { ShieldCheck } from 'lucide-react';

/**
 * SuccessRateBadge — single-purpose pill showing X/100 with a tone
 * keyed to the score band. Hidden when null (user has show_success_rate
 * off or no data yet).
 */

export interface SuccessRateBadgeProps {
  value: number | null;
  className?: string;
}

export function SuccessRateBadge({ value, className }: SuccessRateBadgeProps) {
  if (value === null) return null;
  const tone =
    value >= 80 ? { c: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', b: 'border-emerald-500/25' }
    : value >= 60 ? { c: 'text-[var(--nl-blue,#0A1EFF)]', bg: 'bg-[var(--nl-blue,#0A1EFF)]/[0.10]', b: 'border-[var(--nl-blue,#0A1EFF)]/25' }
    : value >= 40 ? { c: 'text-amber-300', bg: 'bg-amber-500/[0.08]', b: 'border-amber-500/25' }
    :               { c: 'text-red-300', bg: 'bg-red-500/[0.08]', b: 'border-red-500/25' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold tabular-nums ${tone.c} ${tone.bg} ${tone.b} ${className ?? ''}`}>
      <ShieldCheck className="w-3 h-3" />
      Success {value}/100
    </span>
  );
}
