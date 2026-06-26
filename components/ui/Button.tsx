import { forwardRef, type ButtonHTMLAttributes } from 'react';

/**
 * §2 — the canonical button. One set of variants/sizes so CTAs look identical
 * platform-wide. Accent-driven (var(--nl-blue)) so the Appearance accent
 * control re-tints primary buttons live.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[var(--nl-blue,#0066FF)] hover:bg-[var(--nl-blue-strong,#0052CC)] text-white border border-transparent shadow-[0_0_16px_rgba(0,102,255,0.25)]',
  secondary:
    'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/12',
  ghost:
    'bg-transparent hover:bg-white/[0.06] text-slate-300 hover:text-white border border-transparent',
  danger:
    'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30',
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
