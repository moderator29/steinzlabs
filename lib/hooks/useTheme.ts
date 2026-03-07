'use client';

import { useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'bingo';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('bingo');

  useEffect(() => {
    const stored = localStorage.getItem('naka_theme') as ThemeMode | null;
    if (stored && ['dark', 'light', 'bingo'].includes(stored)) {
      setThemeState(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      document.documentElement.setAttribute('data-theme', 'bingo');
    }
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('naka_theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, []);

  return { theme, setTheme };
}
