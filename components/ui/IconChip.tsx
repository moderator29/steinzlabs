import type { ReactNode } from 'react';

/**
 * §2.2 — soft-RECTANGLE icon container (never a circle). Replaces the
 * scattered circular/blob icon wrappers across the app. Reserve circles for
 * avatars and status dots only.
 */

type Size = 'sm' | 'md' | 'lg';
type Tone = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export interface IconChipProps {
  children: ReactNode;
  size?: Size;
  tone?: Tone;
  className?: string;
}

const SIZE: Record<Size, string> = {
  sm: 'w-7 h-7 rounded-lg',
  md: 'w-9 h-9 rounded-lg',
  lg: 'w-11 h-11 rounded-xl',
};

const TONE: Record<Tone, string> = {
  default: 'bg-white/[0.05] border-white/10 text-slate-300',
  accent: 'bg-[var(--nl-accent-soft,rgba(10,30,255,0.15))] border-[var(--nl-blue,#0A1EFF)]/30 text-[var(--nl-blue,#0A1EFF)]',
  success: 'bg-emerald-500/12 border-emerald-500/30 text-emerald-400',
  warning: 'bg-amber-500/12 border-amber-500/30 text-amber-400',
  danger: 'bg-red-500/12 border-red-500/30 text-red-400',
};

export function IconChip({ children, size = 'md', tone = 'default', className = '' }: IconChipProps) {
  return (
    <div className={`flex items-center justify-center flex-shrink-0 border ${SIZE[size]} ${TONE[tone]} ${className}`}>
      {children}
    </div>
  );
}
