'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Lightweight theme provider. Writes `data-theme` to the <html> element and
// persists to localStorage. Defaults to 'dark'. Components that want to
// render differently in light mode use the CSS data-theme selectors in
// globals.css — no React re-renders needed for the bulk of the UI.

type Theme = 'dark' | 'light';

interface Ctx { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }

const ThemeCtx = createContext<Ctx>({
  theme: 'dark',
  setTheme: () => {},
  toggle: () => {},
});

const KEY = 'naka_theme';

function apply(t: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const stored = (typeof window !== 'undefined' && (localStorage.getItem(KEY) as Theme | null)) || null;
    const initial: Theme = stored === 'light' ? 'light' : 'dark';
    setThemeState(initial);
    apply(initial);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch { /* private mode */ }
    apply(t);
  }, []);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return <ThemeCtx.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() { return useContext(ThemeCtx); }
