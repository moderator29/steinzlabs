'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Appearance,
  DEFAULT_APPEARANCE,
  LS_KEY,
  LEGACY_THEME_KEY,
  ThemeMode,
  applyAppearance,
  effectiveTheme,
  normalizeAppearance,
} from './appearance';

/**
 * AppearanceProvider — the single per-user visual-settings provider (§3.4).
 * Supersedes the old lightweight theme-only provider but keeps the same
 * `ThemeProvider` + `useTheme()` exports so existing consumers (ThemeToggle)
 * keep working unchanged.
 *
 * Flow: localStorage applies instantly on mount (the pre-hydration script in
 * layout already painted it FOUC-free); then the server row is fetched and,
 * if present, becomes the cross-device source of truth. Every change applies
 * live, writes localStorage, and is debounce-persisted to Supabase.
 */

interface AppearanceCtx {
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
  /** Effective dark/light after resolving theme:'system'. */
  resolvedTheme: 'dark' | 'light';
}

interface ThemeCtxShape {
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  toggle: () => void;
}

const Ctx = createContext<AppearanceCtx>({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
  resolvedTheme: 'dark',
});

function readLocal(): Appearance {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeAppearance(JSON.parse(raw));
    // Migrate the legacy theme-only key if present.
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark') {
      return { ...DEFAULT_APPEARANCE, theme: legacy };
    }
  } catch { /* private mode / malformed */ }
  return DEFAULT_APPEARANCE;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setApp] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [resolvedTheme, setResolved] = useState<'dark' | 'light'>('dark');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  // Mount: apply localStorage immediately, then reconcile with the server row.
  useEffect(() => {
    const local = readLocal();
    setApp(local);
    applyAppearance(local);
    setResolved(effectiveTheme(local.theme));

    let cancelled = false;
    fetch('/api/user/appearance')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.appearance) return;
        const merged = normalizeAppearance(d.appearance);
        setApp(merged);
        applyAppearance(merged);
        setResolved(effectiveTheme(merged.theme));
        try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      })
      .catch(() => { /* not signed in / offline — localStorage stands */ })
      .finally(() => { hydrated.current = true; });

    return () => { cancelled = true; };
  }, []);

  // Re-resolve when the OS theme/motion changes and we're tracking 'system'.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mqTheme = window.matchMedia('(prefers-color-scheme: light)');
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => { applyAppearance(appearance); setResolved(effectiveTheme(appearance.theme)); };
    mqTheme.addEventListener('change', onChange);
    mqMotion.addEventListener('change', onChange);
    return () => { mqTheme.removeEventListener('change', onChange); mqMotion.removeEventListener('change', onChange); };
  }, [appearance]);

  const setAppearance = useCallback((patch: Partial<Appearance>) => {
    setApp((prev) => {
      const next = normalizeAppearance({ ...prev, ...patch });
      applyAppearance(next);
      setResolved(effectiveTheme(next.theme));
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
        if (next.theme !== 'system') localStorage.setItem(LEGACY_THEME_KEY, next.theme);
      } catch { /* ignore */ }
      // Debounced server persist (only after initial hydration, so we don't
      // immediately echo the server value back).
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch('/api/user/appearance', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(() => { /* offline — localStorage already holds it */ });
      }, 600);
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ appearance, setAppearance, resolvedTheme }}>{children}</Ctx.Provider>
  );
}

/** Full appearance controls. */
export function useAppearance(): AppearanceCtx {
  return useContext(Ctx);
}

/** Backward-compatible theme-only hook used by the existing ThemeToggle. */
export function useTheme(): ThemeCtxShape {
  const { appearance, setAppearance, resolvedTheme } = useContext(Ctx);
  const setTheme = useCallback((t: 'dark' | 'light') => setAppearance({ theme: t }), [setAppearance]);
  const toggle = useCallback(
    () => setAppearance({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' }),
    [setAppearance, resolvedTheme],
  );
  return { theme: (appearance.theme === 'system' ? resolvedTheme : appearance.theme), setTheme, toggle };
}
