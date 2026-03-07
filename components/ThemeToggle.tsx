'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme, ThemeMode } from '@/lib/hooks/useTheme';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const modes: { id: ThemeMode; icon: React.ElementType; label: string }[] = [
    { id: 'dark', icon: Moon, label: 'Dark' },
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'bingo', icon: Sparkles, label: 'Bingo' },
  ];

  return (
    <div className="flex items-center gap-1 bg-[#111827] rounded-lg p-1 border border-white/10" suppressHydrationWarning>
      {modes.map((m) => {
        const Icon = m.icon;
        const active = mounted && theme === m.id;
        return (
          <button key={m.id} onClick={() => setTheme(m.id)} suppressHydrationWarning
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${active ? 'bg-gradient-to-r from-[#00D4AA] to-[#6366F1] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Icon className="w-3 h-3" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
