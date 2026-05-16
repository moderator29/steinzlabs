'use client';

import { Lock, Unlock, Flame } from 'lucide-react';

/**
 * LP-lock chip. Pairs with lib/security/lpLockDuration.ts. Renders
 * the lock tier with severity-appropriate icon + color. The lib
 * supplies the human-readable label; this component picks the visual.
 */

export type LpLockChipTier = 'unknown' | 'rugbait' | 'short' | 'standard' | 'long' | 'forever';

export interface LpLockChipProps {
  tier: LpLockChipTier;
  label: string;
}

const META: Record<LpLockChipTier, { icon: typeof Lock; bg: string; text: string }> = {
  unknown:  { icon: Unlock, bg: 'bg-slate-500/15 border-slate-500/40',    text: 'text-slate-300' },
  rugbait:  { icon: Unlock, bg: 'bg-red-500/15 border-red-500/40',         text: 'text-red-200' },
  short:    { icon: Lock,   bg: 'bg-amber-500/15 border-amber-500/40',     text: 'text-amber-200' },
  standard: { icon: Lock,   bg: 'bg-yellow-500/15 border-yellow-500/40',   text: 'text-yellow-200' },
  long:     { icon: Lock,   bg: 'bg-emerald-500/15 border-emerald-500/40', text: 'text-emerald-200' },
  forever:  { icon: Flame,  bg: 'bg-emerald-500/15 border-emerald-500/40', text: 'text-emerald-200' },
};

export function LpLockChip({ tier, label }: LpLockChipProps) {
  const m = META[tier];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${m.bg} ${m.text}`}
      title={label}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
