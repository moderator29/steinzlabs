/**
 * §3.4 — Appearance system. Single source of truth for the per-user visual
 * controls: theme, accent, glass intensity, density, text size, motion.
 *
 * The shape here is shared by three consumers so they never drift:
 *   1. AppearanceProvider (React state + persistence)
 *   2. the pre-hydration inline script in app/layout.tsx (applies before paint)
 *   3. /api/user/appearance (Supabase row <-> this shape)
 *
 * Everything is applied to <html> as data-* attributes + a small set of CSS
 * variables, so the bulk of the UI restyles via globals.css with no React
 * re-render.
 */

export type ThemeMode = 'dark' | 'light' | 'system';
export type Accent = 'blue' | 'violet' | 'teal' | 'crimson' | 'gold';
export type GlassIntensity = 'off' | 'subtle' | 'full';
export type Density = 'comfortable' | 'compact';
export type TextSize = 'small' | 'default' | 'large';
export type Motion = 'full' | 'reduced';

export interface Appearance {
  theme: ThemeMode;
  accent: Accent;
  glass: GlassIntensity;
  density: Density;
  textSize: TextSize;
  motion: Motion;
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'dark',
  accent: 'blue',
  glass: 'full',
  density: 'comfortable',
  textSize: 'default',
  motion: 'full',
};

export const LS_KEY = 'naka_appearance';
// Kept in sync for backward-compat with the original lightweight theme toggle.
export const LEGACY_THEME_KEY = 'naka_theme';

/** On-brand accent presets. base drives --nl-blue (used app-wide); strong is the hover/active tone. */
export const ACCENTS: Record<Accent, { base: string; strong: string; soft: string }> = {
  blue:    { base: '#0A1EFF', strong: '#0916CC', soft: 'rgba(10,30,255,0.15)' },
  violet:  { base: '#7C3AED', strong: '#6D28D9', soft: 'rgba(124,58,237,0.15)' },
  teal:    { base: '#06B6D4', strong: '#0891B2', soft: 'rgba(6,182,212,0.15)' },
  crimson: { base: '#DC143C', strong: '#B01030', soft: 'rgba(220,20,60,0.15)' },
  gold:    { base: '#F59E0B', strong: '#D97706', soft: 'rgba(245,158,11,0.15)' },
};

const THEMES = new Set<ThemeMode>(['dark', 'light', 'system']);
const ACCENT_SET = new Set<Accent>(['blue', 'violet', 'teal', 'crimson', 'gold']);
const GLASS = new Set<GlassIntensity>(['off', 'subtle', 'full']);
const DENSITY = new Set<Density>(['comfortable', 'compact']);
const TEXT = new Set<TextSize>(['small', 'default', 'large']);
const MOTION = new Set<Motion>(['full', 'reduced']);

/** Coerce any partial/untrusted object into a valid Appearance. */
export function normalizeAppearance(raw: unknown): Appearance {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: THEMES.has(o.theme as ThemeMode) ? (o.theme as ThemeMode) : DEFAULT_APPEARANCE.theme,
    accent: ACCENT_SET.has(o.accent as Accent) ? (o.accent as Accent) : DEFAULT_APPEARANCE.accent,
    glass: GLASS.has(o.glass as GlassIntensity) ? (o.glass as GlassIntensity) : DEFAULT_APPEARANCE.glass,
    density: DENSITY.has(o.density as Density) ? (o.density as Density) : DEFAULT_APPEARANCE.density,
    textSize: TEXT.has(o.textSize as TextSize) ? (o.textSize as TextSize) : DEFAULT_APPEARANCE.textSize,
    motion: MOTION.has(o.motion as Motion) ? (o.motion as Motion) : DEFAULT_APPEARANCE.motion,
  };
}

/** Resolve theme:'system' to the OS preference; dark/light pass through. */
export function effectiveTheme(theme: ThemeMode): 'dark' | 'light' {
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }
  return theme;
}

/**
 * Apply an Appearance to the document root. Pure DOM — no React. Used by both
 * the provider and (inlined) the pre-hydration script. Safe to call on the
 * server-guarded paths only; callers must ensure document exists.
 */
export function applyAppearance(a: Appearance): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = effectiveTheme(a.theme);
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-accent', a.accent);
  root.setAttribute('data-glass', a.glass);
  root.setAttribute('data-density', a.density);
  root.setAttribute('data-text', a.textSize);
  // Honor the OS reduced-motion preference even when the user picked 'full'.
  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  root.setAttribute('data-motion', a.motion === 'reduced' || prefersReduced ? 'reduced' : 'full');
  root.style.colorScheme = theme;

  const accent = ACCENTS[a.accent] ?? ACCENTS.blue;
  root.style.setProperty('--nl-accent', accent.base);
  root.style.setProperty('--nl-blue', accent.base);
  root.style.setProperty('--nl-blue-strong', accent.strong);
  root.style.setProperty('--nl-accent-soft', accent.soft);
}
