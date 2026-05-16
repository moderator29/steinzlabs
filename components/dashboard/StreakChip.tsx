'use client';

import { Flame } from 'lucide-react';

/**
 * StreakChip — dashboard greeting chip showing the user's daily check-in
 * streak. Pure presentation; consumer feeds the streak length + a
 * pending flag from lib/onboarding/streak.ts.
 *
 * Visual rule of thumb:
 *   • 0       gray, "Start your streak"
 *   • 1..2    cool, low-key
 *   • 3..6    warm orange, gain
 *   • 7..29   strong orange + glow
 *   • 30+     gold + extra glow ('legendary')
 */

export interface StreakChipProps {
  current: number;
  pending?: boolean;
  longest?: number;
}

function tone(current: number) {
  if (current === 0) return { color: '#94a3b8', glow: 'none', label: 'Start your streak' };
  if (current < 3) return { color: '#FBBF24', glow: 'none', label: `${current}-day streak` };
  if (current < 7) return { color: '#F97316', glow: '0 0 12px rgba(249,115,22,0.45)', label: `${current}-day streak` };
  if (current < 30) return { color: '#F97316', glow: '0 0 18px rgba(249,115,22,0.65)', label: `${current}-day streak` };
  return { color: '#FACC15', glow: '0 0 22px rgba(250,204,21,0.85)', label: `${current}-day streak` };
}

export function StreakChip({ current, pending, longest }: StreakChipProps) {
  const t = tone(current);
  const title = longest && longest > current ? `${t.label} · best ${longest}` : t.label;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white/[0.03] text-[11px] font-semibold transition-all"
      style={{ borderColor: `${t.color}55`, color: t.color, boxShadow: t.glow }}
      title={title}
    >
      <Flame className="w-3 h-3" style={{ color: t.color }} />
      <span className="tabular-nums">{t.label}</span>
      {pending && current > 0 ? (
        <span aria-hidden className="w-1 h-1 rounded-full" style={{ backgroundColor: t.color, animation: 'naka-pulse 1.8s ease-in-out infinite' }} />
      ) : null}
    </span>
  );
}
