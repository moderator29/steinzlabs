'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface Props { className?: string }

export function ThemeToggle({ className = '' }: Props) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors ${className}`}
    >
      {theme === 'dark'
        ? <Moon className="w-4 h-4 text-white/60" />
        : <Sun className="w-4 h-4 text-yellow-500" />
      }
    </button>
  );
}
