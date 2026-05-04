/**
 * Brand tokens — single source of truth for the cult/cinematic visual system.
 *
 * Anchored to the W "REDEFINING THE WEB3 SPACE" reference image: deep navy
 * canvas, aurora ribbons in purple→teal→blue, electric-blue→crimson accents,
 * soft outer glow on every interactive surface.
 *
 * All values are also mirrored as CSS custom properties in globals-brand.css
 * so non-React code (CSS files, vault.css, scoped stylesheets) can consume
 * them without importing this file.
 */

export const cultColors = {
  // Canvas — deep navy-black
  canvasBase: '#050816',
  canvasDeep: '#020512',
  canvasElev: '#0A0F2E',

  // Primary accents (the rocket/helmet/pentagon gradient family)
  blueElectric: '#0066FF',
  blueIce:      '#00C8FF',
  blueDeep:     '#1230B3',
  crimson:      '#DC143C',
  crimsonGlow:  '#FF1744',

  // Chosen / premium
  gold: '#FFD86B',

  // Semantic
  yes:     '#10B981',
  no:      '#FF1744',
  abstain: '#B4C0E0',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#D5DEFF',
  textMuted:     '#B4C0E0',
} as const;

export const cultGradients = {
  // Signature: blue → crimson, the W image's core gradient.
  blueCrimson: 'linear-gradient(135deg, #0066FF 0%, #DC143C 100%)',

  // Rocket: purple-pink-blue (purple top, pink mid, blue base)
  rocket: 'linear-gradient(135deg, #7B2BFF 0%, #FF3DCB 50%, #00A1FF 100%)',

  // Helmet/visor: pure blue depth
  helmet: 'linear-gradient(135deg, #0066FF 0%, #1230B3 60%, #050B40 100%)',

  // Pentagon: electric blue wireframe vibe
  pentagon: 'linear-gradient(135deg, #00C8FF 0%, #0066FF 100%)',

  // Aurora ribbon (background)
  auroraSweep:
    'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(0,102,255,0.18) 60deg, transparent 120deg, rgba(220,20,60,0.10) 180deg, transparent 240deg, rgba(0,200,255,0.14) 300deg, transparent 360deg)',
} as const;

export const cultGlows = {
  blueSm:  '0 0 12px rgba(0, 102, 255, 0.35)',
  blueMd:  '0 0 24px rgba(0, 102, 255, 0.45)',
  blueLg:  '0 0 48px rgba(0, 102, 255, 0.55)',
  crimson: '0 0 24px rgba(220, 20, 60, 0.45)',
  goldRim: '0 0 0 1.5px #FFD86B, 0 0 16px rgba(255,216,107,0.4)',
} as const;

export const cultRadii = {
  sm:   '8px',
  md:   '12px',
  lg:   '18px',
  xl:   '22px',
  pill: '999px',
} as const;

export const cultSpacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '18px',
  xl: '24px',
  '2xl': '32px',
} as const;

export const cultEasing = {
  // Material standard sharp; pairs with framer-motion default.
  standard:  'cubic-bezier(0.4, 0, 0.2, 1)',
  // Smooth slow-in fast-out (used on the cinematic entry animation).
  cinematic: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const cultDurations = {
  fast:    '150ms',
  base:    '300ms',
  slow:    '500ms',
  slower:  '800ms',
} as const;

export type CultColorToken    = keyof typeof cultColors;
export type CultGradientToken = keyof typeof cultGradients;
export type CultGlowToken     = keyof typeof cultGlows;
