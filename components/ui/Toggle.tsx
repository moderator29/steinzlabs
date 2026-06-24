'use client';

/**
 * §2.2 — the ONE switch. Replaces the ~28 hand-rolled toggles. Soft-rectangle
 * track + soft-square knob (not a circle/pill), matching the platform shape
 * discipline. Accessible (role=switch, aria-checked, keyboard).
 */

type Size = 'sm' | 'md';

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible name; falls back to "Toggle". */
  label?: string;
  size?: Size;
  className?: string;
}

const DIMS: Record<Size, { track: string; knob: string; on: string; off: string }> = {
  sm: { track: 'w-8 h-5', knob: 'w-4 h-4 rounded-[4px]', on: 'left-[14px]', off: 'left-0.5' },
  md: { track: 'w-10 h-6', knob: 'w-5 h-5 rounded-[5px]', on: 'left-[18px]', off: 'left-0.5' },
};

export function Toggle({ checked, onChange, disabled = false, label, size = 'md', className = '' }: ToggleProps) {
  const d = DIMS[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? 'Toggle'}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative ${d.track} rounded-md transition-colors flex-shrink-0 ${
        checked ? 'bg-[var(--nl-blue,#0066FF)]' : 'bg-slate-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'} ${className}`}
    >
      <span
        className={`absolute top-0.5 ${checked ? d.on : d.off} ${d.knob} bg-white shadow transition-all`}
      />
    </button>
  );
}
