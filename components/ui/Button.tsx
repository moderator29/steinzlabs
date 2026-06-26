import { forwardRef, type ButtonHTMLAttributes } from 'react';

/**
 * §2 — the canonical button. One set of variants/sizes so CTAs look identical
 * platform-wide. Accent-driven (var(--nl-blue)) so the Appearance accent
 * control re-tints primary buttons live.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'neon';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[var(--nl-blue,#0066FF)] hover:bg-[var(--nl-blue-strong,#0052CC)] text-white border border-transparent shadow-[0_0_18px_rgba(0,102,255,0.4)] hover:shadow-[0_0_26px_rgba(0,102,255,0.55)]',
  secondary:
    'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/12',
  ghost:
    'bg-transparent hover:bg-white/[0.06] text-slate-300 hover:text-white border border-transparent',
  danger:
    'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30',
  // neon — black body, neon-blue lit edge (not a full fill), brightens on hover.
  neon:
    'text-white bg-[linear-gradient(180deg,rgba(8,12,28,0.9),rgba(3,5,14,0.95))] border border-[#0066FF]/55 hover:border-[#0066FF]/90 shadow-[0_0_10px_rgba(0,102,255,0.28),inset_0_0_10px_rgba(0,102,255,0.12)] hover:shadow-[0_0_18px_rgba(0,102,255,0.45),inset_0_0_14px_rgba(0,102,255,0.18)]',
};

// §UI — buttons trimmed to a tighter, more professional scale (smaller
// padding + radius). md is the default; sizes step up modestly so CTAs no
// longer dominate the layout.
const SIZE: Record<Size, string> = {
  sm: 'text-[11px] px-2.5 py-1 rounded-lg gap-1.5',
  md: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
  lg: 'text-[13px] px-4 py-2 rounded-lg gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block = false, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
