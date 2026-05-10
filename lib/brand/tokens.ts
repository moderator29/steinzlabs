/**
 * Brand tokens — single source of truth for the platform-wide visual system.
 *
 * Anchored to the W "REDEFINING THE WEB3 SPACE" reference image: deep navy
 * canvas, aurora ribbons in purple→teal→blue, electric-blue→crimson accents,
 * soft outer glow on every interactive surface. This is the **platform** brand
 * (Naka Labs) — applies platform-wide. The Vault / Cult area layers additional
 * crimson-sigil styling on top via vault.css.
 */

export const brandColors = {
  canvasBase: '#050816',
  canvasDeep: '#020512',
  canvasElev: '#0A0F2E',
  blueElectric: '#0066FF',
  blueIce:      '#00C8FF',
  blueDeep:     '#1230B3',
  crimson:      '#DC143C',
  crimsonGlow:  '#FF1744',
  gold: '#FFD86B',
  yes:     '#10B981',
  no:      '#FF1744',
  abstain: '#B4C0E0',
  textPrimary:   '#FFFFFF',
  textSecondary: '#D5DEFF',
  textMuted:     '#B4C0E0',
} as const;

export const brandGradients = {
  blueCrimson: 'linear-gradient(135deg, #0066FF 0%, #DC143C 100%)',
  rocket: 'linear-gradient(135deg, #7B2BFF 0%, #FF3DCB 50%, #00A1FF 100%)',
  helmet: 'linear-gradient(135deg, #0066FF 0%, #1230B3 60%, #050B40 100%)',
  pentagon: 'linear-gradient(135deg, #00C8FF 0%, #0066FF 100%)',
  auroraSweep:
    'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(0,102,255,0.18) 60deg, transparent 120deg, rgba(220,20,60,0.10) 180deg, transparent 240deg, rgba(0,200,255,0.14) 300deg, transparent 360deg)',
} as const;

export const brandGlows = {
  blueSm:  '0 0 12px rgba(0, 102, 255, 0.35)',
  blueMd:  '0 0 24px rgba(0, 102, 255, 0.45)',
  blueLg:  '0 0 48px rgba(0, 102, 255, 0.55)',
  crimson: '0 0 24px rgba(220, 20, 60, 0.45)',
  goldRim: '0 0 0 1.5px #FFD86B, 0 0 16px rgba(255,216,107,0.4)',
} as const;

export const brandRadii = {
  sm: '8px', md: '12px', lg: '18px', xl: '22px', pill: '999px',
} as const;

export const brandSpacing = {
  xs: '4px', sm: '8px', md: '12px', lg: '18px', xl: '24px', '2xl': '32px',
} as const;

export const brandEasing = {
  standard:  'cubic-bezier(0.4, 0, 0.2, 1)',
  cinematic: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const brandDurations = {
  fast: '150ms', base: '300ms', slow: '500ms', slower: '800ms',
} as const;

export type BrandColorToken    = keyof typeof brandColors;
export type BrandGradientToken = keyof typeof brandGradients;
export type BrandGlowToken     = keyof typeof brandGlows;
