# Cinematic System

The cinematic layer powers the Vault, NakaCult, and the Sanctum. It sits **alongside** the existing Naka design system (`.naka-card`, `.naka-button-primary`, `.glass-card-enhanced`) — it does not replace it. Use cinematic primitives for cult-themed surfaces; use Naka primitives for everywhere else.

## Tokens

Defined in `app/globals-cinematic.css` (auto-imported by `globals.css`).

### Backgrounds
- `--vault-bg-deepest` `#02050E`
- `--vault-bg-base` `#050816`
- `--vault-bg-elevated` `#0A1030`
- `--vault-bg-card` / `--vault-bg-card-hover` (rgba)

### Brand
- `--vault-blue` `#0066FF` · `--vault-blue-bright` · `--vault-blue-electric`
- `--vault-crimson` `#DC143C` · `--vault-crimson-bright`
- `--vault-gold` (Chosen-only)

### Gradients
- `--gradient-cult` (blue → crimson)
- `--gradient-electric` (electric → blue)
- `--gradient-shadow` (deepest → base)

## Components

```tsx
import {
  AuroraBackground, CinematicContainer, CinematicButton,
  ParticleField, PulseLoader, EnergyLoader, EmptyState, SoundControls,
} from '@/components/cinematic';
```

### `<AuroraBackground>`
Three-layer aurora (radial, conic, drift). Wrap a section root. Pure CSS — zero JS cost.

### `<CinematicContainer variant="default" | "cult" | "chosen">`
Glassmorphic card with animated border on hover. `cult` variant uses the cult gradient border, `chosen` adds gold. Fade-up on viewport entry by default (set `animate={false}` to opt out).

### `<CinematicButton variant="primary" | "cult" clickSound={...}>`
Primary cinematic CTA. Light-sweep on hover, press feedback, optional sound. For Naka brand surfaces (dashboard, settings) prefer `.naka-button-primary`.

### `<ParticleField variant="stars" | "mist" | "embers" count={?}>`
Pure-canvas particle layer. Auto-tunes to viewport, pauses on `prefers-reduced-motion` and `document.hidden`. Place inside an `<AuroraBackground>` or any positioned parent.

### `<PulseLoader />`, `<EnergyLoader />`
Cinematic alternatives to spinners. Pulse for content, energy for actions.

### `<EmptyState icon title description action>`
Floating-icon empty state.

### `<SoundControls />`
Renders the SFX + ambient music volume controls. State persists via localStorage (and Phase-4 DB once the table lands).

## Sound

`lib/cinematic/sound.ts` exposes the singleton:

```ts
import { soundManager, playSound } from '@/lib/cinematic/sound';

playSound('proposal-pass');
soundManager().setEnabled(false);
```

### Sound names

| Name | Trigger |
|------|---------|
| `vault-door-open` / `vault-door-close` | Vault entry / exit |
| `seal-rotate` | Naka sigil during entry |
| `cult-enter` | Bass swell entering NakaCult |
| `success-chime` / `error-tone` | Transactional results |
| `notification` | New event / alert |
| `hover-soft` / `click-soft` | Interaction feedback |
| `proposal-pass` / `proposal-fail` | Conclave outcomes |
| `whisper-arrive` | New whisper appears |
| `daily-seal` | First open of Daily Seal |
| `level-up` | Tier upgrade / Chosen Seal |

### Asset pipeline (owner action)

Drop royalty-free MP3s named `<sound-name>.mp3` into `public/sounds/`. Until then, `playSound()` is a silent no-op (HTMLAudio swallows missing-asset errors).

Recommended sources: Freesound.org (CC0), Soundsnap (licensed), or Mixkit.

## Motion

`lib/cinematic/motion.ts` exports Framer Motion variants used across the layer:

- `fadeUp` — sections entering viewport
- `fadeIn` — opacity-only
- `scaleIn` — modals, sigils
- `stagger(delay)` — for parent containers staggering children
- `orbBurst` — vote-orb spring entrance
- `portalEnter` — Vault chamber portals
- `pageTransition` — route changes

## Reduced motion

`hooks/useReducedMotion.ts` returns a reactive boolean. `ParticleField` already short-circuits when reduced motion is on; the CSS layer disables aurora rotation, breathing, floating, and ring pulses via `@media (prefers-reduced-motion: reduce)`.

## Performance contract

- **No JS-driven CSS animations** — all cinematic CSS uses `transform`/`opacity` only (GPU-accelerated).
- **Particle field**: 70 particles desktop, 30 mobile, paused when tab hidden, RAF-driven (no setInterval).
- **No external animation deps** beyond Framer Motion (already in repo).
- **No Howler / @tsparticles**: native HTMLAudio + canvas saves ~80KB.
