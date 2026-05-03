# The Vault

The Vault is a sealed area gated by `naka_cult` tier. It contains three chambers — **the Conclave** (power), **the Oracle** (sight), and **the Sanctum** (soul) — and ships across phases.

## Routes

| Route | Phase | What it does |
|-------|-------|--------------|
| `/vault` | 4 ✅ | Entry cinematic, three chamber portals, identity strip, cult stats counter |
| `/vault/conclave` | 5 (next) | Decrees, vote orbs, treasury, the Codex, Whispers |
| `/vault/oracle` | 6 | Daily Seal (Anthropic), VTX Sage, Whisper Network, Echo Chamber stealth tracking |
| `/vault/sanctum` | 7 | Mantle (identity), Annals (achievements), Library (music + lore + art), Forge (NFTs) |

## Gate

Every `/vault/*` route runs `getCultAccess()` from `lib/cult/access.ts` server-side in the layout. Non-cult users are redirected to `/dashboard?denied=cult`. Phase 8 ships `/naka-cult` (the dramatic landing) as the proper redirect target — until then, dashboard is the safe fallback.

`getCultAccess()` returns `{ allowed, userId, tier, isChosen, username, displayName }`. `isChosen` reflects the Development NFT path; downstream Chosen-only UI flips on this flag.

## Components (`components/vault/`)

- `VaultEntryAnimation.tsx` — full cinematic on first visit, abbreviated on return. Pure CSS + Framer Motion; click anywhere to skip; respects `prefers-reduced-motion`. Persists "seen" in `localStorage`.
- `ChamberPortal.tsx` — single chamber card. Glass + animated cult-gradient border on hover, breathing micro-animation on idle.
- `IdentityStrip.tsx` — member name + rank pill in the layout header. Gold trim for Chosen, blue for Cultist.
- `CultStatsCounter.tsx` — count-up stats row driven by IntersectionObserver. Renders an em-dash for null values (no fabricated numbers).
- `sigils/ConclaveSigil.tsx` / `OracleSigil.tsx` / `SanctumSigil.tsx` — inline-SVG portal icons in the platform's new icon style: glowing geometric, gradient-filled, aligned with the brand reference (rocket / helmet / pentagon).

## Database (Phase 4 migration)

`supabase/migrations/2026_05_02_vault_foundation.sql`, applied live to Supabase via MCP:

- `profiles.is_chosen boolean` — Chosen Seal flag (currently owner-set; future on-chain resolver mirrors NakaLabs Development NFT ownership).
- `cult_user_preferences` — sound + music volume, vault entry theme, has-seen-cinematic. RLS: self-only read/write.
- `cult_ambient_tracks` — owner-curated track catalog for the future Vault mini-player. RLS: authenticated read, admin write.
- `cult_stats` view — aggregated cult counts (active members, chosen count). $NAKA total + decrees stay null/0 until Phase 5+ wires the real on-chain + governance data.

## Sound + ambient music

The SoundManager (`lib/cinematic/sound.ts` from Phase 1) + `cult_user_preferences` are already wired together via `<SoundControls />`. The Vault entry will play `vault-door-open` + `seal-rotate` + `cult-enter` once `/public/sounds/` ships. Until then, the cinematic plays silently.

## Dependencies between phases

- Phase 4 depends on Phase 3 (`naka_cult` tier value).
- Phase 4 picks up cinematic-layer CSS niceties (cult-gradient borders) when Phase 1 is also merged. Without Phase 1, Vault still renders cleanly using the inline `vault.css` styles in `app/vault/`.
- Merge order: `feat/cinematic-foundation` → `feat/wallet-connect-siwe` → `feat/naka-cult-plan-tier` → `feat/vault-foundation`.

## Owner action items

1. Drop ambient tracks: `INSERT INTO cult_ambient_tracks (title, storage_path) VALUES ...` for each Ddergo track. Storage path = the public URL of the audio file in your asset storage of choice.
2. (Optional, later) flip `profiles.is_chosen = true` for Development NFT holders in `/admin/users` until the on-chain resolver lands.
3. Drop sound effect MP3s into `public/sounds/` per `docs/cinematic-system.md`.
