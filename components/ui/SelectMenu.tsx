'use client';

import { useState, useRef, useEffect, type ComponentType } from 'react';
import { ChevronDown, CheckCircle } from '@/components/icons/brand';
import { ChainLogo } from '@/components/common/ChainLogo';

export interface SelectOption {
  id: string;
  label: string;
  /** optional count badge shown on the right */
  count?: number;
  /** render a real chain logo by chain id */
  chain?: string;
  /** lucide/brand icon component */
  Icon?: ComponentType<{ className?: string }>;
  /** simple color dot (fallback when no logo/icon) */
  colorDot?: string;
}

interface SelectMenuProps {
  value: string;
  options: SelectOption[];
  onChange: (id: string) => void;
  /** label shown when nothing matches value */
  placeholder?: string;
  /** muted prefix shown before the selected label in the trigger (e.g. "Time") */
  prefix?: string;
  /** accent color classes for the active/selected row */
  accentClass?: string;
  className?: string;
  /** min-width of the trigger button */
  triggerClassName?: string;
}

/**
 * SelectMenu — a single compact trigger button that opens a vertical
 * dropdown list (the same pattern as the wallet picker). Replaces scattered
 * horizontal chip rows. Supports real chain logos, icons, or color dots, plus
 * an optional count badge per row. Closes on outside-click and Escape.
 */
export function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'Select',
  prefix,
  accentClass = 'text-[#8FA3FF]',
  className = '',
  triggerClassName = '',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.id === value) ?? options[0];

  const renderGlyph = (o: SelectOption, size: number) => {
    if (o.chain) return <ChainLogo chain={o.chain} size={size} />;
    if (o.Icon) return <o.Icon className="w-3.5 h-3.5" />;
    if (o.colorDot) return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, backgroundColor: o.colorDot }} />;
    return null;
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors bg-white/5 border border-white/10 text-white hover:border-white/20 ${triggerClassName}`}
      >
        {selected ? renderGlyph(selected, 16) : null}
        <span className="truncate">
          {prefix && <span className="text-slate-500 font-normal">{prefix}: </span>}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[180px] max-h-[280px] overflow-y-auto rounded-xl border border-white/10 bg-[#0b0f1a] shadow-xl shadow-black/40 p-1">
          {options.map((o) => {
            const active = o.id === value;
            return (
              <button
                key={o.id || 'all'}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                  active ? `bg-white/[0.06] ${accentClass}` : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {renderGlyph(o, 18)}
                <span className="flex-1 text-left truncate">{o.label}</span>
                {typeof o.count === 'number' && o.count > 0 && (
                  <span className="text-[10px] text-slate-500 tabular-nums">{o.count}</span>
                )}
                {active && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
