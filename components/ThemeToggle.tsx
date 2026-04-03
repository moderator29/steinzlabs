'use client';

import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Sparkles, ChevronDown } from 'lucide-react';
import { useTheme, ThemeMode } from '@/lib/hooks/useTheme';

const modes: { id: ThemeMode; icon: React.ElementType; label: string }[] = [
  { id: 'dark', icon: Moon, label: 'Dark' },
  { id: 'light', icon: Sun, label: 'Light' },
  { id: 'bingo', icon: Sparkles, label: 'Bingo' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!mounted) return null;

  const current = modes.find(m => m.id === theme) ?? modes[0];
  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg px-3 py-2 text-xs font-medium text-gray-300 hover:text-white transition-all"
      >
        <CurrentIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:block">{current.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-36 bg-[#111827] border border-white/[0.1] rounded-xl shadow-xl overflow-hidden z-50">
          {modes.map((m) => {
            const Icon = m.icon;
            const active = theme === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setTheme(m.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors ${
                  active
                    ? 'bg-[#0A1EFF]/10 text-[#0A1EFF]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {m.label}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0A1EFF]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
