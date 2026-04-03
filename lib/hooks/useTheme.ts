'use client';

import { useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'bingo';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('steinz_theme') as ThemeMode | null;
    if (stored && ['dark', 'light', 'bingo'].includes(stored)) {
      setThemeState(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      setThemeState('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('steinz_theme', 'dark');
    }
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('steinz_theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, []);

  return { theme, setTheme };
}
