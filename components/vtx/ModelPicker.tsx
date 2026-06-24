'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Zap, Sparkles, Brain } from 'lucide-react';

/**
 * VTX model picker — Fast / Balanced / Deepest. Per CLAUDE.md rules,
 * the UI does NOT mention model names by vendor — these labels are
 * neutral. The server route maps the internal ID to whichever
 * Anthropic / OpenAI / local model is currently configured.
 *
 * Audit §5.3 / B.5 P1 VTX model toggle. Stateless presentation —
 * caller owns the selected value + persistence (localStorage key
 * naka_vtx_model is established by the existing VtxAiTab harness).
 */

export type VtxModelId = 'fast' | 'balanced' | 'deepest';

interface ModelMeta {
  id: VtxModelId;
  label: string;
  hint: string;
  icon: typeof Zap;
}

const MODELS: ModelMeta[] = [
  { id: 'fast', label: 'Fast', hint: 'Snap answers, lighter reasoning', icon: Zap },
  { id: 'balanced', label: 'Balanced', hint: 'Default — depth + speed', icon: Sparkles },
  { id: 'deepest', label: 'Deepest', hint: 'Long reasoning, slower', icon: Brain },
];

export interface ModelPickerProps {
  value: VtxModelId;
  onChange: (id: VtxModelId) => void;
}

export function VtxModelPicker({ value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.id === value) ?? MODELS[1];
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:border-[#0066FF]/40 text-xs text-slate-200 transition-colors"
      >
        <CurrentIcon className="w-3 h-3 text-[#8FA3FF]" />
        <span className="font-semibold">{current.label}</span>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="VTX model"
          className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0F1320] border border-white/10 shadow-2xl overflow-hidden z-[var(--z-dropdown,100)]"
        >
          {MODELS.map((m) => {
            const Icon = m.icon;
            const active = m.id === value;
            return (
              <li key={m.id}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`w-full text-start px-3 py-2.5 flex items-start gap-2.5 transition-colors ${
                    active ? 'bg-[#0066FF]/10' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${active ? 'text-[#8FA3FF]' : 'text-slate-500'}`} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-xs font-semibold ${active ? 'text-white' : 'text-slate-200'}`}>
                      {m.label}
                    </span>
                    <span className="block text-[10px] text-slate-400 leading-tight mt-0.5">{m.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
