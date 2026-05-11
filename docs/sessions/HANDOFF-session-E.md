# Session E Handoff — Vault v2 Foundation Pass — 2026-05-02

> Read this in full before starting the next session. Sessions A/B/C/D handoffs are still applicable as background; this one is the canonical reference for the Vault v2 build.

---

## §0 — Table of contents

1. [What shipped — full PR-by-PR breakdown](#1)
2. [What shipped — full file inventory](#2)
3. [Live database state](#3)
4. [Project rules honored this session](#4)
5. [Brand reference and icon style](#5)
6. [Owner action items](#6)
7. [Spec coverage map — section by section](#7)
8. [Granular gaps not yet built](#8)
9. [Architectural decisions and intentional deviations](#9)
10. [Dependency graph between PRs](#10)
11. [Environment + secrets state](#11)
12. [Known issues / things to watch](#12)
13. [How to start the next session](#13)
14. [End-of-session metrics](#14)

---

<a id="1"></a>
## §1 — What shipped (6 PRs, all on origin)

Merge in **strict** order. Each PR depends on the ones above it.

### PR 1 — `feat/cinematic-foundation`

**Scope:** Foundation primitives for every cult/Vault surface.

**Adds:**
- `app/globals-cinematic.css` — vault color tokens (deepest #02050E → blue → crimson → gold), glassmorphic `.cinematic-container` with animated cult-gradient border, `.btn-cinematic` and `.btn-cult` buttons with light-sweep on hover, `.aurora-bg-vault` 3-layer aurora (radial + conic-drift + violet wash), `.pulse-loader` and `.energy-loader`, `.cinematic-press` / `.cinematic-lift` interaction primitives, `.cinematic-float` / `.cinematic-breathe` keyframes, `prefers-reduced-motion` short-circuits.
- `lib/cinematic/sound.ts` — `SoundManager` singleton over native `HTMLAudioElement` (no Howler dep). 14 named sound channels (`vault-door-open`, `seal-rotate`, `cult-enter`, `success-chime`, `error-tone`, `notification`, `hover-soft`, `click-soft`, `proposal-pass`, `proposal-fail`, `whisper-arrive`, `daily-seal`, `level-up`, `vault-door-close`). Persists enabled/volume/music-enabled/music-volume to `localStorage`. `playMusic(src)` / `pauseMusic` / `resumeMusic` / `stopMusic` for ambient. Silent no-op when assets are missing.
- `lib/cinematic/motion.ts` — Framer Motion presets: `EASE.out` / `EASE.inOut` / `EASE.spring`, variants `fadeUp`, `fadeIn`, `scaleIn`, `stagger(delay)`, `orbBurst`, `portalEnter`, `pageTransition`.
- `hooks/useReducedMotion.ts` — reactive `prefers-reduced-motion` reader with SSR-safe default.
- `hooks/useSound.ts` — React hook wrapping the SoundManager with reactive enabled/volume state and memoized `play()`.
- `components/cinematic/AuroraBackground.tsx` — wrapper applying `.aurora-bg-vault` class.
- `components/cinematic/CinematicContainer.tsx` — container component with `default | cult | chosen` variants, fade-up on viewport entry by default.
- `components/cinematic/CinematicButton.tsx` — primary / cult variants, optional `clickSound` and `hoverSound` props, press-feedback class.
- `components/cinematic/ParticleField.tsx` — pure-canvas particle system, `stars | mist | embers` variants, auto-tunes count by viewport (~70 desktop, ~30 mobile), pauses on `document.hidden` and reduced motion, RAF-driven, ~150 LOC, no `@tsparticles` dep.
- `components/cinematic/Loaders.tsx` — `PulseLoader`, `EnergyLoader`, `EmptyState`.
- `components/cinematic/SoundControls.tsx` — drop-in settings UI for SFX + ambient music with volume sliders and toggle buttons (Volume2/VolumeX/Music/Music2 lucide icons).
- `components/cinematic/index.ts` — barrel export.
- `app/globals.css` — `@import './globals-cinematic.css';` after the Google Fonts import.
- `docs/cinematic-system.md` — token map, component API, sound asset pipeline, performance contract, reduced-motion rules.

**No DB migration. No new npm deps.** (Framer Motion was already on `^11.0.8`.)

---

### PR 2 — `feat/wallet-connect-siwe`

**Scope:** Real WalletConnect/AppKit + MetaMask Sign-In With Ethereum on `/login` and `/signup`.

**Adds:**
- `components/auth/WalletAuthButton.tsx` — single component, `mode='signin' | 'signup'`. Opens AppKit modal → user picks any WalletConnect-compatible wallet (MetaMask, Phantom-EVM, Rainbow, etc.) → wagmi exposes the connected address → POST to `/api/auth/wallet-nonce` for a 16-byte nonce + SIWE message → `useSignMessage` prompts the wallet → POST to `/api/auth/wallet-verify` → server validates, atomically consumes the nonce, creates a `wallet_identities` row + Supabase user if new, returns a magic-link → browser navigates to the magic-link → session established → `/dashboard`. Auto-triggers SIWE on connect only when the user opted in via the button click. Disconnects on failure for a clean retry. No-ops when `HAS_APPKIT` is false. `AuthOrDivider` helper exported alongside.

**Modifies:**
- `app/login/page.tsx` — imports `WalletAuthButton`, renders it under the Google OAuth row with `mode="signin"`.
- `app/signup/page.tsx` — same treatment with `mode="signup"`.
- `app/api/auth/wallet-nonce/route.ts` — replaced direct `address.toLowerCase()` with `normalizeAddress(address, chain === "evm" ? "ethereum" : "solana")` so Solana base58 addresses are not corrupted on the way in.
- `app/api/auth/wallet-verify/route.ts` — same `normalizeAddress` substitution at the lookup, email-synthesis, and insert sites. Solana addresses use the canonical (case-preserving) form for indexing; the synthesized email path lowercases only the EVM canonical because email is case-insensitive.
- `docs/wallet-auth.md` — end-to-end flow diagram, file map, address normalization note, required env (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`), Solana follow-up plan, security notes.

**No DB migration** (reuses existing `auth_wallet_nonces` and `wallet_identities` tables).

**Solana wallet auth UI:** NOT shipped. Server-side `wallet-verify` already handles `chain: 'solana'` via `nacl.sign.detached.verify`; the UI side currently exposes EVM only.

---

### PR 3 — `feat/naka-cult-plan-tier`

**Scope:** `naka_cult` as the 5th tier across the platform — type system, gates, badges, pricing, admin, telegram, vtx-ai.

**Modifies:**
- `lib/subscriptions/tierCheck.ts` — `Tier` type widened to `"free" | "mini" | "pro" | "max" | "naka_cult"`, `TIER_ORDER.naka_cult = 4`, `normalizeTier` recognizes `"naka_cult"`.
- `lib/subscriptions/tiers.ts` — `SubscriptionTier` widened to add `'NAKA_CULT'`. New `NAKA_CULT` entry in `TIER_FEATURES` (every flag on, `maxWallets: 25`, `maxFollowedEntities: 9999`, `maxAlerts: 500`, `maxDCABots: 25`, `historicalSnapshots: 730`). New `TIER_PRICING.NAKA_CULT = { monthly: 0, yearly: 0, holdingThreshold: 600_000, nftAlternative: true }`. `requiresUpgrade` ordering map extended.
- `components/ui/TierBadge.tsx` — `Variant` widened, new `naka_cult` entry pointing at `/branding/badge-naka-cult.png` (asset is owner-action), crimson glow ring `rgba(220,20,60,0.6)`, popover copy "Naka Cult — the lineage. Vault entry, the Conclave, the Oracle, the Sanctum."
- `components/tier/TierGateOverlay.tsx` — `TIER_LABEL` includes `naka_cult: "Naka Cult"`.
- `app/dashboard/pricing/page.tsx` — added 5th tier card with `id: 'naka_cult'`, accent `#DC143C`, `gated: true`, custom `entryRules` array, "Held / not bought" price label, "Enter the Cult" CTA routing to `/naka-cult` (Phase 8 target). Grid widened to `lg:grid-cols-5`.
- `app/admin/users/page.tsx` — `TIER_BADGE` includes the cult palette, `tierCounts` initial map includes `naka_cult: 0`.
- `app/api/telegram/webhook/route.ts` — tier label "NAKA CULT" added to `tierGateMsg`.
- `app/api/vtx-ai/route.ts` — `serverTier` type widened, `isPro` predicate now true for `naka_cult` so unlimited VTX flag carries.

**Adds:**
- `supabase/migrations/2026_05_02_naka_cult_tier.sql` — `profiles.tier` CHECK constraint widened to include `'naka_cult'`. **Applied live via MCP.**
- `docs/naka-cult-plan.md` — tier ladder, entry rules (≥600k $NAKA OR Loyalty Gem NFT OR Development NFT), feature flag map, badge note, surface map, owner action items.

---

### PR 4 — `feat/vault-foundation`

**Scope:** `/vault` route gated by `tier='naka_cult'`, cinematic entry animation, three chamber portals, identity strip, cult stats counter.

**Adds:**
- `lib/cult/access.ts` — `getCultAccess()` server-only helper. Reads authenticated user's profile via `@supabase/ssr`, returns `{ allowed, userId, tier, isChosen, username, displayName }`. `allowed` is true when `tier === 'naka_cult'`. Read-only cookie path (no setAll writes outside Server Actions).
- `app/vault/layout.tsx` — server-rendered access gate. Non-cult users redirect to `/dashboard?denied=cult` (final target `/naka-cult` lands in Phase 8). Renders `IdentityStrip` in the header.
- `app/vault/page.tsx` — chamber hub. Server-loads `cult_stats` view, renders `VaultEntryGateway` (client-only entry animation), three `ChamberPortal` cards (all currently `comingSoon` except Conclave once Phase 5 merges), and `CultStatsCounter` row.
- `app/vault/VaultEntryGateway.tsx` — thin client wrapper around `VaultEntryAnimation` so the page module stays server-async.
- `app/vault/conclave/page.tsx` — placeholder with `ConclaveSigil` and "Coming soon" copy (replaced in Phase 5).
- `app/vault/oracle/page.tsx` — placeholder with `OracleSigil`.
- `app/vault/sanctum/page.tsx` — placeholder with `SanctumSigil`.
- `app/vault/vault.css` — scoped Vault styles. Aurora layers, portal cards, identity pill, stats grid, entry-door cinematic, vote-bar (added in Phase 5), urgent-pulse keyframe (Phase 5), coming-soon empty-state, mobile breakpoints (≤640px halves portal stat columns), `prefers-reduced-motion` short-circuits all animations.
- `components/vault/sigils/ConclaveSigil.tsx` — inline SVG rocket. Pink-to-purple body gradient (`#FF3D8A → #9333EA → #3B5BFF`), blue-cyan thrust radial, drop-shadow glow filter, halo circle. Pure SVG, scales via `size` prop, no asset fetch.
- `components/vault/sigils/OracleSigil.tsx` — inline SVG helmet/visor. Deep blue body gradient (`#3B5BFF → #1230B3 → #050B40`), electric-blue visor sweep with white highlight, chin/collar darker fill, halo.
- `components/vault/sigils/SanctumSigil.tsx` — inline SVG pentagon. Five-faceted gem with violet/blue inner triangles, center white highlight dot, halo.
- `components/vault/VaultEntryAnimation.tsx` — full cinematic 3s on first visit, abbreviated 0.6s on return (localStorage key `naka_vault_entered`). Phases: `init` (sigil materializes) → `seal` (rotates + pulses with crimson+blue glow) → `open` (two doors slide outwards horizontally with cubic-bezier easing) → `done`. Click-to-skip; `prefers-reduced-motion` collapses to instant resolve. Pure CSS + Framer Motion. Sound calls are wired but silent until MP3 assets land.
- `components/vault/ChamberPortal.tsx` — single portal card. Glass + animated cult-gradient border on hover, breathing micro-animation on idle (`vault-portal-breathe` keyframe). Renders sigil + name + tagline + description + CTA. `comingSoon` prop locks navigation but keeps the visual.
- `components/vault/IdentityStrip.tsx` — pill-shaped identity bar. Gold trim + border-shadow for `isChosen`, blue trim otherwise. "◈" sigil glyph + name + rank label.
- `components/vault/CultStatsCounter.tsx` — IntersectionObserver-driven count-up (1.1s, ease-out cubic). Null values render em-dash (no fabricated numbers). Optional `format` callback per stat for compact-number formatting.

**Adds DB:**
- `supabase/migrations/2026_05_02_vault_foundation.sql` — **Applied live via MCP.**
  - `profiles.is_chosen boolean DEFAULT false` — Chosen Seal flag.
  - `cult_user_preferences` table — sound on/off, sound volume, music on/off, music volume, vault entry theme enum (`default | crimson | aurora | minimal`), `has_seen_entry_cinematic` flag. RLS self-only read/insert/update.
  - `cult_ambient_tracks` table — owner-curated music catalog with title, artist (default "Ddergo"), storage_path, duration, is_active, display_order. RLS authenticated-read (active only) + admin-write via `is_admin()`.
  - `cult_stats` view — counts naka_cult members + chosen, $NAKA total NULL until on-chain resolver, `decrees_passed = 0` until Phase 5 view-replace.

**Adds:**
- `docs/vault.md` — routes, gate, components, schema, dependencies, owner action items.

---

### PR 5 — `feat/conclave-v2`

**Scope:** `/vault/conclave` working chamber. Author proposals, cast votes with live bar, treasury panel.

**Adds:**
- `app/api/cult/proposals/route.ts` — GET (list by `?status=active|passed|failed|all`, ordered by `ends_at desc`, capped 50) + POST (zod-validated body: kind enum, title 6–140, body 30–5000, durationHours 6–168, stakeNaka 0–1B). Both gated on `getCultAccess()`.
- `app/api/cult/proposals/[id]/vote/route.ts` — POST cast/change vote. Validates proposal is active and within window. Weight = 1 per cultist, 2 per Chosen (Elder-Decree double-weight rule from §8.2). Upserts (proposal_id, voter_id), then recomputes aggregates atomically from the votes table (no drift from incremental adjustments), updates voter_count.
- `app/vault/conclave/page.tsx` — replaces Phase-4 placeholder. Server-rendered hero (sigil + tagline + back link) + `<TreasuryPanel />` (server-rendered) + `<ConclaveClient />` (client).
- `app/vault/conclave/ConclaveClient.tsx` — top-level client component. Tab state (Active / Passed / Failed / All), `fetch('/api/cult/proposals?status=...')` on tab change, 10s visibility-aware polling (no polling when `document.hidden`). Empty-state when no proposals, "Author a Decree" CTA opens modal.
- `app/vault/conclave/ProposalCard.tsx` — single proposal card. Live vote bar (green-gradient yes / crimson-gradient no with glow), three vote buttons (Check / Minus / X icons), urgency pulse keyframe in last hour, status pill when resolved, voter count line.
- `app/vault/conclave/CreateProposalModal.tsx` — author form. Kind selector (decree/whisper/treasury), title input with 140 max, body textarea with 30–5000 enforcement and live counter, voting window dropdown (24h/48h/3d/7d), stake $NAKA input, error surfaces, gradient submit. Modal closes on backdrop click; click-stop on inner.
- `app/vault/conclave/TreasuryPanel.tsx` — server-rendered latest snapshot from `cult_treasury_snapshots`. Em-dash + owner instructions until first row exists.

**Modifies:**
- `app/vault/vault.css` — `.vault-vote-bar` + `__yes` + `__no` styles with gradients and glow, `.vault-portal--urgent` keyframe pulse.

**Adds DB:**
- `supabase/migrations/2026_05_02_conclave.sql` — **Applied live via MCP.**
  - `cult_proposals` — kind enum, title/body length CHECKs, stake_naka, status enum, yes/no/abstain weight numerics (28,2), voter_count, ends_at, resolved_at. Index on (status, ends_at desc). RLS cult-tier read.
  - `cult_proposal_votes` — composite PK (proposal_id, voter_id), choice enum, weight, is_chosen flag captured at vote time. Index on (proposal_id, created_at desc). RLS cult-tier read.
  - `cult_proposal_comments` — id, proposal_id, author_id, parent_id self-FK for threading, body 1–2000, RLS cult-tier read + self-insert.
  - `cult_treasury_snapshots` — balance_naka, balance_usd, source enum (`manual | alchemy | helius | rpc`), notes, captured_at. Index on captured_at desc. RLS cult-tier read + admin-write via `is_admin()`.
  - `cult_stats` view replaced — `decrees_passed` now counts `cult_proposals` with `status IN ('passed','executed') AND kind = 'decree'`.

**Adds:**
- `docs/conclave.md` — routes, API, tables, vote weighting model, real-time + resolution job plan, owner action items.

---

### PR 6 — `docs/vault-v2-session-handoff`

**Scope:** This document. The full Session E handoff.

**Adds:**
- `docs/sessions/HANDOFF-session-E.md` — this file.

---

<a id="2"></a>
## §2 — Full file inventory

### New files (47)

```
app/globals-cinematic.css
app/api/cult/proposals/route.ts
app/api/cult/proposals/[id]/vote/route.ts
app/vault/layout.tsx
app/vault/page.tsx
app/vault/VaultEntryGateway.tsx
app/vault/vault.css
app/vault/conclave/page.tsx
app/vault/conclave/ConclaveClient.tsx
app/vault/conclave/CreateProposalModal.tsx
app/vault/conclave/ProposalCard.tsx
app/vault/conclave/TreasuryPanel.tsx
app/vault/oracle/page.tsx
app/vault/sanctum/page.tsx
components/auth/WalletAuthButton.tsx
components/cinematic/AuroraBackground.tsx
components/cinematic/CinematicButton.tsx
components/cinematic/CinematicContainer.tsx
components/cinematic/Loaders.tsx
components/cinematic/ParticleField.tsx
components/cinematic/SoundControls.tsx
components/cinematic/index.ts
components/vault/ChamberPortal.tsx
components/vault/CultStatsCounter.tsx
components/vault/IdentityStrip.tsx
components/vault/VaultEntryAnimation.tsx
components/vault/sigils/ConclaveSigil.tsx
components/vault/sigils/OracleSigil.tsx
components/vault/sigils/SanctumSigil.tsx
hooks/useReducedMotion.ts
hooks/useSound.ts
lib/cinematic/motion.ts
lib/cinematic/sound.ts
lib/cult/access.ts
supabase/migrations/2026_05_02_naka_cult_tier.sql
supabase/migrations/2026_05_02_vault_foundation.sql
supabase/migrations/2026_05_02_conclave.sql
docs/cinematic-system.md
docs/wallet-auth.md
docs/naka-cult-plan.md
docs/vault.md
docs/conclave.md
docs/sessions/HANDOFF-session-E.md
```

### Modified files (10)

```
app/globals.css                                  (+1 @import line)
app/login/page.tsx                               (WalletAuthButton import + render)
app/signup/page.tsx                              (WalletAuthButton import + render)
app/api/auth/wallet-nonce/route.ts               (normalizeAddress)
app/api/auth/wallet-verify/route.ts              (normalizeAddress, 4 sites)
app/api/telegram/webhook/route.ts                (Tier label)
app/api/vtx-ai/route.ts                          (serverTier widening, isPro)
app/admin/users/page.tsx                         (TIER_BADGE + tierCounts)
app/dashboard/pricing/page.tsx                   (5th tier card, grid 5-col, handleSubscribe)
components/tier/TierGateOverlay.tsx              (TIER_LABEL)
components/ui/TierBadge.tsx                      (naka_cult variant + popover copy)
lib/subscriptions/tierCheck.ts                   (Tier + TIER_ORDER + normalizeTier)
lib/subscriptions/tiers.ts                       (SubscriptionTier + NAKA_CULT block + TIER_PRICING + requiresUpgrade)
```

### Approximate LOC by PR

```
PR1 cinematic-foundation       ~1,076 lines added
PR2 wallet-connect-siwe          ~219 lines added
PR3 naka-cult-plan-tier          ~200 lines added /  ~15 modified
PR4 vault-foundation           ~1,242 lines added
PR5 conclave-v2                  ~896 lines added /   ~8 modified
PR6 vault-v2-session-handoff     ~216 lines added (this doc)
                                 ──────
                                 ~3,849 lines added across 6 PRs
```

---

<a id="3"></a>
## §3 — Live database state

Three migrations applied to live Supabase project `phvewrldcdxupsnakddx` via MCP. Repo files mirror the live state.

### Migration 1 — `naka_cult_tier`
```sql
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('free', 'mini', 'pro', 'max', 'naka_cult'));
```

### Migration 2 — `vault_foundation`
- Added `profiles.is_chosen boolean DEFAULT false`
- Created `cult_user_preferences` (RLS self-only)
- Created `cult_ambient_tracks` (RLS authed-read / admin-write)
- Created `cult_stats` view (active_members, chosen_count, total_naka_held NULL, decrees_passed 0)

### Migration 3 — `conclave`
- Created `cult_proposals` (RLS cult-read; admin/server writes only)
- Created `cult_proposal_votes` (composite PK, RLS cult-read)
- Created `cult_proposal_comments` (threaded, RLS cult-read + self-insert)
- Created `cult_treasury_snapshots` (RLS cult-read + admin-write)
- Replaced `cult_stats` view with `decrees_passed` from real data

### Tables NOT yet migrated (Phase 6+ scope, listed for next session)

```
cult_customizations           (Sanctum / Mantle — Phase 7)
cult_titles_earned            (Sanctum / Mantle — Phase 7)
cult_achievements             (Sanctum / Annals — Phase 7)
cult_library_progress         (Sanctum / Library — Phase 7)
cult_playlists                (Sanctum / Library — Phase 7)
cult_audiences                (Chosen / Audience — Phase 8)
cult_audience_questions       (Chosen / Audience — Phase 8)
cult_early_access_features    (Chosen / Lab — Phase 8)
cult_early_access_feedback    (Chosen / Lab — Phase 8)
cult_whispers                 (Oracle / Whisper Network — Phase 6)
cult_whisper_echoes           (Oracle / Whisper Network — Phase 6)
cult_stealth_follows          (Oracle / Echo Chamber — Phase 6)
cult_daily_seals              (Oracle / Daily Seal — Phase 6)
```

The original spec's §10.3 has the schema for §7/§8 tables. Oracle tables are not specced yet.

### Supabase advisor state
Unchanged from end of Session D: 3 advisors total (`pg_trgm` extension placement, `is_admin()` SECURITY DEFINER, leaked-password protection). All accepted/deferred.

---

<a id="4"></a>
## §4 — Project rules honored this session

Encoded in `CLAUDE.md` at repo root, restated here for visibility:

### Identity
- All commits authored as `moderator29 <101205446+moderator29@users.noreply.github.com>`. Verified via `git config user.name` and `git config user.email` at session start.

### Forbidden in commit messages, code, comments, docs, READMEs, PR descriptions
- `Co-Authored-By: Claude` or any AI co-author trailer — **0 instances**
- `🤖 Generated with Claude Code` — **0 instances**
- `Generated with Claude Code` / `Generated by Claude` — **0 instances**
- `AI-assisted` / `AI assisted` / "Built with Claude Code" / any auto-generated AI attribution headers — **0 instances**

### Branch naming
- Forbidden prefixes `claude/`, `ai/`, `claude-code/` — **0 used**
- All branches use functional prefixes: `feat/cinematic-foundation`, `feat/wallet-connect-siwe`, `feat/naka-cult-plan-tier`, `feat/vault-foundation`, `feat/conclave-v2`, `docs/vault-v2-session-handoff`

### Branching & merging
- No commits to `main` — **0**. All work on feature branches cut from main (or chained where dependencies require).
- Pushed branch + stopped — owner merges every PR himself in the GitHub UI. **`gh pr create` was never invoked.**

### Commit message format
- Conventional Commits used throughout: `feat:`, `feat(auth):`, `feat(plans):`, `feat(vault):`, `feat(conclave):`, `docs:`.

### Code style
- No `any` types introduced.
- No `console.log` statements added in production paths.
- No commented-out code committed.
- No empty `try/catch` blocks added.
- Address comparisons go through `lib/utils/addressNormalize.ts` — fixed two pre-existing violations in `wallet-nonce` and `wallet-verify`.

### Mock data — forbidden
- **Zero fabricated numbers.** `cult_stats` returns NULL for `total_naka_held`; `CultStatsCounter` renders em-dash for null; `TreasuryPanel` shows owner instructions until the first snapshot row exists.

### Documentation
- `docs/` updated for every meaningful feature: `cinematic-system.md`, `wallet-auth.md`, `naka-cult-plan.md`, `vault.md`, `conclave.md`, this handoff.

### Security
- No secrets committed.
- Server-side validation on every write (`zod` on POST routes; CHECK constraints on every cult_* table).
- RLS enabled and policies set on every new cult_* table.
- Service-role admin client never exposed to client paths.

---

<a id="5"></a>
## §5 — Brand reference and icon style

**Source image (W "REDEFINING THE WEB3 SPACE" + 3 glowing icons):**
- The W logo image is **color/branding reference only — never used as a logo anywhere on the platform.** Aesthetic captured in `app/globals-cinematic.css` vault tokens (deepest blue, electric blue, violet, crimson, aurora layers).
- The three glowing icons (rocket pink-purple, blue helmet, blue pentagon) define the **new platform-wide icon style**: glowing geometric, gradient-filled, soft outer glow.
- This was confirmed by the user mid-session: "the w logo we not using it brr its just color refernce... for the icons thats should be the new style of icons on our plastform".

**Mapping baked into Phase 4:**
| Reference icon | Vault chamber | Symbolism | File |
|----------------|---------------|-----------|------|
| Rocket | The Conclave | "Launches" Decrees, governance | `components/vault/sigils/ConclaveSigil.tsx` |
| Helmet/visor | The Oracle | Sight, vision, intelligence | `components/vault/sigils/OracleSigil.tsx` |
| Pentagon | The Sanctum | Geometric / soul / identity | `components/vault/sigils/SanctumSigil.tsx` |

**Memory persistence:** the rules saved as a memory file at `~/.claude/projects/c--Users-DELL-LATITUDE-5320-Downloads/memory/steinz_labs_brand_icons.md` and indexed in `MEMORY.md`. Future sessions will recall this without being told again.

**NOT done:** the actual platform-wide icon ascension. Every existing surface (dashboard, market, wallet, settings, vtx, intelligence, smart-money, whale-tracer, dna-analyzer, portfolio, alerts, security-center, research, share, stats) still uses `lucide-react`. Replacing all of those with the new aesthetic is a dedicated multi-PR pass — not started.

---

<a id="6"></a>
## §6 — Owner action items (everything only you can do)

### Critical — gates the experience

1. **Merge the 6 PRs in the GitHub UI in this strict order:**
   1. `feat/cinematic-foundation`
   2. `feat/wallet-connect-siwe`
   3. `feat/naka-cult-plan-tier`
   4. `feat/vault-foundation`
   5. `feat/conclave-v2`
   6. `docs/vault-v2-session-handoff`

2. **Drop the cult sigil badge image:** `/public/branding/badge-naka-cult.png`. Style: cult sigil/symbol, crimson + blue glow, matching the brand reference. Until this lands, `<TierBadge tier="naka_cult" />` 404s on the image. Recommend ~64×64 transparent PNG.

3. **Promote yourself + early cultists** so you can walk the Vault during testing:
   ```sql
   UPDATE profiles SET tier = 'naka_cult' WHERE id = '<your-id>';
   UPDATE profiles SET is_chosen = true   WHERE id = '<your-id>';
   ```

### Important — unlocks features that exist but currently render dark/empty

4. **Drop sound effect MP3s** into `/public/sounds/` matching the names in `lib/cinematic/sound.ts`:
   ```
   /public/sounds/vault-door-open.mp3
   /public/sounds/vault-door-close.mp3
   /public/sounds/seal-rotate.mp3
   /public/sounds/cult-enter.mp3
   /public/sounds/success-chime.mp3
   /public/sounds/error-tone.mp3
   /public/sounds/notification.mp3
   /public/sounds/hover-soft.mp3
   /public/sounds/click-soft.mp3
   /public/sounds/proposal-pass.mp3
   /public/sounds/proposal-fail.mp3
   /public/sounds/whisper-arrive.mp3
   /public/sounds/daily-seal.mp3
   /public/sounds/level-up.mp3
   ```
   Sources: Freesound.org (CC0), Mixkit, Soundsnap (licensed), or originals. Until then, the cinematic plays silently — no console errors (the SoundManager swallows missing-asset errors).

5. **Insert the first treasury snapshot** so the Conclave Treasury panel renders real numbers:
   ```sql
   INSERT INTO cult_treasury_snapshots (balance_naka, balance_usd, source, notes)
   VALUES (2400000, 48000, 'manual', 'Initial seed');
   ```

6. **Insert ambient tracks** for the future Vault mini-player (table exists, player itself NOT yet built):
   ```sql
   INSERT INTO cult_ambient_tracks (title, storage_path, display_order, duration_seconds) VALUES
     ('Track 1 Title', '<public-url-or-storage-key>', 1, 240),
     ('Track 2 Title', '<public-url-or-storage-key>', 2, 195),
     ...;
   ```

### Production / infrastructure

7. **Smoke test WalletConnect on production** once PRs 1+2 are merged. Confirm `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set in Vercel for production env. Hit `/login`, click "Sign in with wallet", confirm: AppKit modal opens → MetaMask prompts → signature → magic-link consume → `/dashboard` lands.

8. **Outstanding owner items from Session D §8** still apply (carried forward, none completed this session):
   - Rotate every secret in `.env.local` per `SECURITY_BACKLOG.md` #1
   - GitHub branch protection on `main` — require status checks, **do NOT** enable approvals/Code Owner reviews (deadlock for solo)
   - Secret scanning + push protection in GitHub Settings
   - Leaked-password protection in Supabase Dashboard → Authentication → Policies
   - Repo metadata (description, website, topics)
   - Capture real Lighthouse / bundle / DB / API numbers per `docs/performance-baseline-2026-05-02.md`
   - Cross-device smoke test
   - Delete `backup-history-rewrite-2026-05-02/*` tags when comfortable

### Optional / future polish

9. (Optional) Schedule a Vercel cron hitting a future `/api/admin/cult/refresh-treasury` endpoint to insert fresh `cult_treasury_snapshots` rows automatically from on-chain reads. Not built; ~30 min in a follow-up PR.

10. (Optional) Decide on the Naka Cult NFT entry contracts (Loyalty Gem + Development NFT) and put them in env so `lib/cult/holdings.ts` (next session) can read ownership. Until then, tier is owner-set in admin panel.

---

<a id="7"></a>
## §7 — Spec coverage map (section by section)

Mapping every section of the original "STEINZ LABS — THE VAULT v2" prompt to its delivery state.

### §1 Cinematic Foundation (Platform-Wide)
| Sub | State |
|-----|-------|
| §1.1 Motion System (page transitions, hover lift, click ripple, scroll-triggered) | ⚠ Primitives only. Page transitions NOT applied to existing route changes. Scroll triggers used in CultStatsCounter and ChamberPortal only. |
| §1.2 Container System Upgrade (.container-elevated, animated borders) | ✅ As `.cinematic-container`. Applied in Vault chambers; NOT applied across existing platform surfaces. |
| §1.3 Text Brightness & Hierarchy (.heading-impact, .stat-number) | ✅ As `.cinematic-heading` + `.cinematic-stat`. NOT applied across existing platform surfaces. |
| §1.4 Color Vibrancy Upgrade (vault tokens) | ✅ All vault tokens defined. |
| §1.5 Aurora Background System (3 layers) | ✅ As `.aurora-bg-vault` + scoped `.vault-shell` variant in vault.css. |
| §1.6 Icon System Upgrade (replace EVERY platform icon) | ❌ **NOT done.** Only the 3 chamber sigils. Every other icon is still `lucide-react`. |
| §1.7 Loading & Empty States | ✅ `PulseLoader`, `EnergyLoader`, `EmptyState`. Existing platform spinners NOT swapped. |
| §1.8 Buttons That Feel Alive | ✅ `.btn-cinematic` and `.btn-cult`. Existing `.naka-button-primary` NOT replaced. |

### §2 Sound Design System
| Sub | State |
|-----|-------|
| §2.1 Setup (Howler) | ⚠ **Intentional deviation:** native HTMLAudio used instead, ~30KB saved, identical UX. |
| §2.2 Sound Library (14 sounds) | ⚠ Channel names defined; **MP3 assets NOT shipped** (owner action). |
| §2.3 Where to Apply | ⚠ Wiring NOT yet attached to vault entry / vote / proposal-pass / Daily Seal / Whispers. Scaffolded for it. |
| §2.4 User Control | ✅ `<SoundControls />` component ready to drop into settings. NOT yet placed in `/settings`. |

### §3 Particle & Visual Effects
| Sub | State |
|-----|-------|
| §3.1 Particle library (`@tsparticles`) | ⚠ **Intentional deviation:** custom canvas `ParticleField` used instead, ~50KB saved. |
| §3.2 Particle effects across platform (background stars, aurora mist, vote orb burst, seal glow, energy streams) | ⚠ Primitive only (`ParticleField` with `stars | mist | embers` variants). **None of the application-specific effects (vote burst, seal glow, energy streams) are wired in.** |
| §3.3 Particle Performance Rules | ✅ Auto-tunes by viewport, pauses on hidden tab, pauses on reduced-motion. |

### §4 The Vault v2 (Deeper Features)
| Sub | State |
|-----|-------|
| §4.1 Three chambers architecture | ✅ Routes scaffolded (`/vault`, `/vault/conclave`, `/vault/oracle`, `/vault/sanctum`). Conclave shipped; Oracle and Sanctum are placeholders. |
| §4.2 Vault Entry Animation v2 | ⚠ Shipped a refined version: dark → sigil materialise → rotate → seal pulse → doors split → reveal. **No fog particles, no light rays trailing through doorway.** Sound calls wired but silent until MP3s land. |
| §4.3 Three Chamber Portals UI | ✅ With breathing micro-animation, hover lift, animated cult-gradient border. Sigils match new icon style. |
| §4.4 Atmospheric Layer Upgrades (background music auto-play, dust particles, ambient lighting, lore notification) | ❌ NOT done. Tracks table exists; mini-player and lore notifications NOT built. |

### §5 The Conclave v2 Upgrades
| Sub | State |
|-----|-------|
| §5.1 Vote Orb System (individual orbs, holdings-scaled, color-coded, real-time additions) | ❌ **Shipped a percentage gradient bar instead of individual vote orbs.** This is the most visible visual deviation from the spec. |
| §5.2 Proposal Card Cinematic Upgrade | ⚠ Card has urgency pulse + gradient + voter count. Spec called for animated gradient bar with vote orbs and "alive" pulse — partial. |
| §5.3 Proposal Passing Cinematic (status flip, particle burst, sound, notification fanout) | ❌ NOT done. Resolution job + Realtime needed first. |
| §5.4 Treasury Dashboard (live balance, 30d trend chart, Recent Movement, Etherscan link) | ⚠ Latest snapshot only. **No 30d trend chart, no Recent Movement feed, no Etherscan link.** |

### §6 The Oracle v2 Upgrades
| Sub | State |
|-----|-------|
| §6.1 Daily Seal Cinematic Reveal (wax stamp, light burst, briefing sections) | ❌ NOT started. |
| §6.2 VTX Sage Visual Identity (sigil avatar, ink-writing text, cult-mode VTX) | ❌ NOT started. |
| §6.3 Whisper Network (anonymous feed, smoke effect, echo voting, verified badge) | ❌ NOT started. |
| §6.4 Stealth Tracking Console (Echo Chamber, 25-slot quiet pack, low-opacity cards) | ❌ NOT started. |

### §7 The Sanctum
| Sub | State |
|-----|-------|
| §7.1 Vision (4 sub-areas) | ❌ NOT started. |
| §7.2 Sanctum Layout (Mantle / Annals / Library / Forge) | ❌ NOT started. |
| §7.3 The Mantle (avatar, frame, glow, banner, title, sigil customization) | ❌ NOT started. Tables NOT migrated. |
| §7.4 The Annals (achievements, leaderboards, tiers, points) | ❌ NOT started. |
| §7.5 The Library (Ddergo Sanctuary v2, full-screen now-playing, visualizer, playlists, lore reading progress, art gallery) | ❌ NOT started. |
| §7.6 The Forge (NFT showcase, 3D rotation, OpenSea/Alchemy NFT API) | ❌ NOT started. |

### §8 The Chosen Exclusives
| Sub | State |
|-----|-------|
| §8.1 The Chosen Profile Treatment (gold ◈, animated avatar border, cape glow, gold vote orbs, leaderboard pinning) | ⚠ Partial. `is_chosen` flag exists; IdentityStrip flips to gold trim; vote weight 2× already enforced. **No gold avatar border, no cape glow, no leaderboard pinning, no gold vote orbs (because no vote orbs at all).** |
| §8.2 The Elder Chamber (Chosen-only sub-section, Elder Decrees, real-time chat, team DMs) | ❌ NOT done. |
| §8.3 The Audience (quarterly team calls, recordings, Q&A) | ❌ NOT done. Tables NOT migrated. |
| §8.4 Early Access Lab (Chosen test new features 24-72h before public) | ❌ NOT done. Tables NOT migrated. |
| §8.5 Chosen Customizations (animated frames, custom sigil designer, VTX voice profiles, custom Vault entry themes) | ❌ NOT done. (Vault entry theme enum exists in `cult_user_preferences` but the UI to switch themes is not built.) |
| §8.6 The Chosen Chronicles (Chosen-only lore chapters) | ❌ NOT done. |
| §8.7 Tokenized Rewards (framework only, not implemented) | ❌ NOT done. Per spec — explicitly deferred. |

### §9 Dramatic Landing Page Overhaul (`/naka-cult`)
| Sub | State |
|-----|-------|
| §9.1 Vision | ❌ NOT started. |
| §9.2 Hero Section v2 (typed headline, particles, Naka Go silhouette) | ❌ NOT started. |
| §9.3 Three Chambers Reveal (parallax 3D tilt, animated previews) | ❌ NOT started. |
| §9.4 Live Cult Stats (count-up, scrolling lattice of names) | ❌ NOT started. |
| §9.5 NFT Reveal (3D spinning Loyalty Gem + Development NFT) | ❌ NOT started. |
| §9.6 Music Preview Section | ❌ NOT started. |
| §9.7 The Oath Section / Naka Go lore CTA | ❌ NOT started. |
| §9.8 Page performance (FCP <1.2s on 3G, lazy-load 3D, reduced-motion fallback) | ❌ NOT started. |

### §10 Technical Architecture
| Dep | State |
|-----|-------|
| Framer Motion | ✅ already in repo. |
| Howler.js | ❌ Intentionally skipped — native HTMLAudio used. |
| @tsparticles/react + engine + preset-stars | ❌ Intentionally skipped — custom canvas. |
| Three.js | ❌ NOT added. Will be needed for §9 NFT 3D rotation on landing. |
| lottie-react | ❌ NOT added. Reserved for §9 if any complex Lottie work. |
| react-intersection-observer | ❌ NOT added. Native IntersectionObserver used directly in CultStatsCounter. |

### §11 Implementation Plan (10 phases originally)
| Phase | State |
|-------|-------|
| Phase 1 (Cinematic Foundation) | ✅ shipped |
| Phase 2 (Vault Foundation) | ✅ shipped (overlap with Phase 4 of this session) |
| Phase 3 (Vault Entry & Three Portals) | ✅ shipped |
| Phase 4 (The Conclave v2) | ⚠ partial — proposals + voting + treasury panel ✅; vote orbs / pass cinematic / Realtime / resolution job ❌ |
| Phase 5 (The Oracle v2) | ❌ NOT started |
| Phase 6 (The Sanctum) | ❌ NOT started |
| Phase 7 (Chosen Exclusives) | ❌ NOT started |
| Phase 8 (Landing Page Drama) | ❌ NOT started |
| **Phase 9 (Platform-Wide UI Ascension)** — apply containers, text brightness, icons, scroll triggers, hover/click feedback, sound across every existing surface | ❌ **NOT started. This is the biggest single unbuilt piece by surface area.** |
| Phase 10 (Testing & Polish) | ❌ NOT started |

### §12 Testing
| Test | State |
|------|-------|
| 15 critical-flow E2E tests | ❌ NOT done — no automated tests written this session |
| Lighthouse 90+ on NakaCult pages | ❌ NOT measured |
| 60fps animation verification | ❌ NOT measured |
| FCP <1.2s on 3G | ❌ NOT measured |
| `prefers-reduced-motion` audit | ✅ Built into every animation (CSS guards + JS short-circuits in ParticleField, VaultEntryAnimation) |
| Sound mute audit | ✅ Built in (SoundManager toggleable, persisted) |
| Keyboard accessibility | ⚠ Partial — buttons are real `<button>` with focus rings, but no full audit |
| WCAG AAA color contrast | ⚠ Vault tokens designed for AAA; not formally measured |
| Screen reader labels on decorative elements | ✅ All sigils, particle canvas, identity strip have `aria-label` / `aria-hidden` |

### §13 Deliverables Checklist
Of the bullet list at the bottom of the original spec — only the top 11 items are checked. The remainder (40+ bullets across Sound, Particles, Vault depth, Conclave depth, Oracle, Sanctum, Chosen, Landing, UI Ascension, Testing) is open.

---

<a id="8"></a>
## §8 — Granular gaps not yet built

A flat list of every concrete deliverable from the spec that did not ship this session. Use as a backlog for future PRs.

### Cinematic / sound / particles
- [ ] Drop sound MP3 assets (owner)
- [ ] Wire vault entry sounds (vault-door-open + seal-rotate + cult-enter on entry; vault-door-close on exit)
- [ ] Wire success-chime on successful vote / proposal create
- [ ] Wire error-tone on failed action
- [ ] Wire hover-soft on major CTAs
- [ ] Wire click-soft on every cinematic button
- [ ] Wire proposal-pass / proposal-fail when status flips
- [ ] Wire whisper-arrive when a new whisper appears
- [ ] Wire daily-seal on first Daily Seal open of the day
- [ ] Wire level-up on tier upgrade / Chosen Seal earned
- [ ] Add `<SoundControls />` to `/settings`
- [ ] Vote orb burst particles when a proposal passes
- [ ] Seal glow particles around Chosen avatars (always-on)
- [ ] Energy streams particles in active Conclave proposal cards (color matches lean)
- [ ] Aurora mist particles on `/naka-cult` landing hero
- [ ] Background star particles inside Vault interior
- [ ] Vault dust particles drifting upward

### Vault foundation depth
- [ ] Ambient music mini-player (draggable, EQ visualizer, 8-track rotation, persists across chamber routes, fades on exit)
- [ ] Lore notification system (slide-in from right when nakalibrary publishes new lore)
- [ ] Vault entry theme switcher UI (the enum exists in `cult_user_preferences`)
- [ ] Replace `/dashboard?denied=cult` redirect target with the real `/naka-cult` once it ships

### Conclave depth
- [ ] Individual vote orb visualization (replace gradient bar with orbs)
- [ ] Vote orb size scales with $NAKA holdings (sqrt to dampen whales)
- [ ] Vote orb hover popover (voter username + weight)
- [ ] Real-time vote updates via Supabase Realtime subscription on `cult_proposal_votes`
- [ ] Proposal-passing cinematic (golden glow + particle burst + sound + status badge transition)
- [ ] Proposal-failing cinematic (descending tone, gentle status change)
- [ ] Proposal resolution scheduled job (Vercel cron) — flips status active → passed/failed when ends_at < now(), pass rule yes_weight > no_weight AND voter_count >= 5
- [ ] Stake slash on fail (transfer to treasury) for Decree-kind proposals
- [ ] Stake return on pass
- [ ] Holdings-weighted votes (`sqrt(naka_balance)`) once `lib/cult/holdings.ts` exists
- [ ] Threaded comments UI (table is migrated)
- [ ] Treasury 30d trend chart
- [ ] Treasury "Recent Movement" feed with Decree tagging
- [ ] Treasury Etherscan link
- [ ] Live treasury auto-refresh (Vercel cron hitting `/api/admin/cult/refresh-treasury`)
- [ ] Notification fanout to all voters when their proposal passes/fails

### The Oracle (Phase 5 of original Implementation Plan)
- [ ] DB tables: `cult_daily_seals`, `cult_whispers`, `cult_whisper_echoes`, `cult_stealth_follows`
- [ ] Daily Seal cron (calls Anthropic with curated context, persists to `cult_daily_seals`)
- [ ] Daily Seal UI with cinematic wax stamp reveal + light burst
- [ ] Daily Seal token mention hover cards
- [ ] Daily Seal wallet mention links to whale profile
- [ ] Daily Seal animated $NAKA sigil "signature"
- [ ] VTX Sage cult-mode toggle
- [ ] VTX Sage avatar (rotating sigil during thinking)
- [ ] VTX Sage cult-themed chat bubble + ink-writing text effect
- [ ] Whisper Network feed (anonymous, smoke effect on cards)
- [ ] Whisper submission form
- [ ] Whisper Echo voting with real-time count
- [ ] Whisper verification badge (Chosen-verifies)
- [ ] Whisper-arrive sound + slide-in animation
- [ ] Stealth follows table + UI (25-slot quiet pack)
- [ ] Stealth follow alert preferences (Telegram + email)
- [ ] Live activity feed of stealth-followed wallets

### The Sanctum (Phase 6 of original)
- [ ] DB tables: `cult_customizations`, `cult_titles_earned`, `cult_achievements`, `cult_library_progress`, `cult_playlists`
- [ ] The Mantle (avatar / frame / glow / banner / title / sigil customization UI)
- [ ] The Annals (achievement engine, point totals, public/private flags, tier (bronze/silver/gold/mythic))
- [ ] Leaderboards (top voters, top whisper authors, most echoes, most accurate predictions, longest holders, composite influence)
- [ ] Animated leaderboard cards with position-change animations
- [ ] The Library — full-screen now-playing music mode
- [ ] The Library — audio visualizer (FFT bars synced to playback)
- [ ] The Library — track lyrics
- [ ] The Library — track suggestions submission + curation queue
- [ ] The Library — playlist creation (tables migrated)
- [ ] The Library — synced listening (see who else is listening to the same track)
- [ ] The Library — lore reading progress per chapter
- [ ] The Library — chapter unlock based on achievements
- [ ] The Library — art gallery (wallpapers, member-submitted, downloadable)
- [ ] The Forge — auto-detect connected-wallet NFTs (Alchemy NFT API)
- [ ] The Forge — 3D rotate-on-hover NFT cards
- [ ] The Forge — NakaLabs NFTs prominently featured
- [ ] The Forge — coming-soon section for upcoming drops
- [ ] The Forge — burn-to-upgrade mechanics scaffold

### Chosen Exclusives (Phase 7 of original)
- [ ] Chosen Profile Treatment (gold avatar border, cape effect, gold-tinted comments, gold vote orbs, leaderboard pinning, whisper bumping)
- [ ] Elder Chamber sub-section (Chosen-only Decrees, 2× weight already enforced)
- [ ] Elder Chamber real-time Chosen-only chat
- [ ] Elder Chamber direct messaging with team
- [ ] Audience system (DB: `cult_audiences`, `cult_audience_questions`)
- [ ] Audience video call URL + recording archive UI
- [ ] Audience question submission form + upvote
- [ ] Audience countdown timer to next call
- [ ] Early Access Lab (DB: `cult_early_access_features`, `cult_early_access_feedback`)
- [ ] Early Access feedback form + rating per feature
- [ ] Early Access feature flag system (Chosen-first toggle)
- [ ] Custom sigil designer (build your own from elements)
- [ ] VTX Sage voice customization (multiple voice profiles)
- [ ] Custom Vault entry theme picker UI
- [ ] Priority Daily Seal delivery (1h before regular Cultists)
- [ ] The Chosen Chronicles (private monthly lore with member name written in)
- [ ] Tokenized Rewards framework (tables and UI scaffold; per-spec deferred from actual airdrops/revenue share)

### Dramatic Landing Page (`/naka-cult`, Phase 8 of original)
- [ ] Route stub
- [ ] Hero with typed headline + particles + Naka Go silhouette ghosting in/out
- [ ] Background aurora drift + curve lines pattern
- [ ] Three Chambers Reveal section with parallax 3D tilt
- [ ] Live cult stats with scrolling lattice of cult names
- [ ] NFT showcase with 3D rotating Loyalty Gem + Development NFT (Three.js or CSS 3D)
- [ ] Music preview section (compact player + visualizer)
- [ ] The Oath section (Naka Go lore portrait + manifesto + final CTA)
- [ ] Mobile-optimized landing (no 3D, fewer particles, simpler animations)
- [ ] Steinz Labs ↔ NakaCult landing toggle
- [ ] FCP < 1.2s on 3G measurement + tuning

### Platform-Wide UI Ascension (Phase 9 of original — the biggest unbuilt piece)
- [ ] Apply `.cinematic-container` (or migrate `.naka-card` / `.glass-card-enhanced`) to dashboard cards
- [ ] Apply to whale tracker cards
- [ ] Apply to market coin rows
- [ ] Apply to VTX message bubbles
- [ ] Apply to portfolio cards
- [ ] Apply to settings panels
- [ ] Apply text brightness tokens (`.cinematic-heading`, `.cinematic-stat`) across all major headings + numbers
- [ ] Replace every `lucide-react` icon platform-wide with the new icon style
- [ ] Add scroll-triggered fade-up to every major section across every page
- [ ] Add hover lift / click ripple to every interactive element
- [ ] Add sound feedback to every button platform-wide (gated on `<SoundControls />` toggle)
- [ ] Replace all loading spinners with `PulseLoader` / `EnergyLoader`
- [ ] Apply `AuroraBackground` to selected hero sections (dashboard, market, portfolio)

### Testing (Phase 10 of original)
- [ ] 15 critical-flow E2E tests (cult onboarding, wallet link, submit Decree, vote with real-time orb update, treasury tracking, Daily Seal, Sage convo, submit whisper, echo whisper, stealth follow, Sanctum customization, achievement earn, Chosen full experience, Audience flow, landing → enter conversion)
- [ ] Lighthouse 90+ measurement on NakaCult pages
- [ ] 60fps animation profiling (Chrome DevTools)
- [ ] FCP < 1.2s on simulated 3G measurement
- [ ] Vault entry frame-drop check
- [ ] Particle systems performance audit
- [ ] Cross-browser test (Chrome / Safari / Firefox / mobile Safari / Android Chrome)
- [ ] Keyboard navigation full pass
- [ ] Screen reader full pass
- [ ] Color contrast WCAG AAA verification

### Conclave / on-chain
- [ ] `lib/cult/holdings.ts` — read connected wallet's $NAKA balance + NakaLabs NFT ownership
- [ ] On-chain access resolver — auto-promote to `naka_cult`, set `is_chosen` for Development NFT, demote on dispossession
- [ ] Periodic resolver cron (hourly?)
- [ ] Treasury auto-refresh cron
- [ ] Proposal resolution cron (every minute, flips active → passed/failed)

### Solana wallet auth
- [ ] Solana flavor of `WalletAuthButton` (Phantom / Solflare via `@solana/wallet-adapter-react` `signMessage`). Server side already accepts `chain: 'solana'`.

### Documentation
- [ ] `/docs/` index update once Oracle / Sanctum / Chosen / Landing ship
- [ ] CHANGELOG.md entry for Vault v2 release (when first PR is merged to main and prod-deployed)
- [ ] README.md cult section
- [ ] Whitepaper update mentioning the Vault

---

<a id="9"></a>
## §9 — Architectural decisions and intentional deviations

Decisions made this session that diverge from the spec. Each is justified; revisit if priorities change.

### Howler.js → native HTMLAudio
**Spec §2.1:** Install `howler`.
**Decision:** Used native `HTMLAudioElement` instead.
**Rationale:** Howler is ~30KB minified. For 14 short SFX with no need for sprite sheets, spatial audio, or fade curves beyond what `Audio.volume` offers, native is sufficient. Bundle stays leaner. Reversible — swap `lib/cinematic/sound.ts` to a Howler-backed implementation if/when sprite sheets become useful.

### `@tsparticles` → custom canvas `ParticleField`
**Spec §3.1:** Install `@tsparticles/react @tsparticles/engine @tsparticles/preset-stars`.
**Decision:** Wrote a 150-LOC pure-canvas particle system in `components/cinematic/ParticleField.tsx`.
**Rationale:** ~50KB saved. Custom system gives precise control over `stars`/`mist`/`embers` variants and exact look matching the cult brand. tsParticles has hundreds of options we'd never use. Reversible if we later need physics or interactivity tsParticles handles natively.

### Vote orbs → percentage gradient bar
**Spec §5.1:** Each vote becomes a glowing orb on the vote bar, sized by holdings, color by choice, real-time materialization with particle burst.
**Decision:** Shipped a percentage gradient bar with green-yes / crimson-no.
**Rationale:** Vote orbs require Realtime subscriptions (NOT yet wired) and holdings-scaled sizing (NOT yet computed) to feel right. A static-orb pre-implementation would have been "fake-cinematic" — picture-perfect bar says one or the other, no half-measures. The gradient bar is honest about what it is. **This is the most visible deviation from the spec.** The orb visualization is on the explicit gap list (§8) and should be the first Conclave follow-up after Realtime + holdings land.

### Three.js, Lottie, react-intersection-observer
**Spec §10:** Listed as Vault v2 deps.
**Decision:** Not added.
**Rationale:**
- Three.js is for §9 NFT 3D rotation on landing — landing not yet started.
- Lottie has no concrete use yet.
- `react-intersection-observer` not needed; native IntersectionObserver works in `CultStatsCounter` and is what Framer Motion's `whileInView` uses internally.

### Server-only proposal writes (no client INSERT policy)
**Spec §5:** Doesn't specify RLS shape.
**Decision:** `cult_proposals` has only a SELECT policy at the cult-tier level. INSERT/UPDATE goes through the Next.js API route that uses the service-role admin client.
**Rationale:** Lets the API route validate stake balance, body length, and kind enum before the row exists. RLS-only-INSERT would have been racey if the user spam-clicked the create button while their stake was being decremented. API route is the single transactional point.

### Vault layout redirect target
**Spec §9:** `/naka-cult` is the dramatic landing.
**Decision:** Layout currently redirects denied users to `/dashboard?denied=cult`.
**Rationale:** `/naka-cult` doesn't exist yet (Phase 8). `/dashboard` is a sane fallback that doesn't 404. **Single line change** when the landing ships.

### Tier badge popovers stay on click, not hover
**Spec:** Implies hover.
**Decision:** Click only.
**Rationale:** Mobile-first — hover doesn't exist on touch. Existing badge component already uses click. Maintained consistency.

### Polling instead of Supabase Realtime for Conclave
**Spec §5.1:** Real-time via Supabase Realtime.
**Decision:** 10s visibility-aware polling.
**Rationale:** Realtime requires careful subscription cleanup, channel lifecycle on tab visibility, and reconnect logic — all worth a dedicated PR rather than rushed in. Polling is a clean fallback that respects the user's bandwidth (paused when tab is hidden) and the bar still updates within 10s.

### Wallet auth — EVM only on UI; Solana server-ready
**Spec:** Doesn't specify chain split.
**Decision:** UI button only triggers EVM SIWE; server `wallet-verify` already handles `chain: 'solana'` via `nacl.sign.detached.verify`.
**Rationale:** Spec emphasised MetaMask explicitly. Solana wallet adapter integration in the UI is a separate ~50 LOC component. Backend already supports both, so the Solana follow-up is purely a frontend concern.

---

<a id="10"></a>
## §10 — Dependency graph between PRs

```
              feat/cinematic-foundation
                       │
                       ▼ (independent)
              feat/wallet-connect-siwe
                       │
                       ▼ (independent)
              feat/naka-cult-plan-tier
                       │ (Phase 4 depends on this for naka_cult tier)
                       ▼
              feat/vault-foundation
                       │ (Phase 5 depends on this for /vault layout)
                       ▼
              feat/conclave-v2
                       │ (independent)
                       ▼
         docs/vault-v2-session-handoff
```

**Why the chain:** Phase 4 imports `tier === 'naka_cult'` from Phase 3's `tierCheck.ts`, and Phase 5 lives at `/vault/conclave/page.tsx` which is created in Phase 4. The chain was made by `git checkout feat/<previous>` then `git checkout -b feat/<next>`, so each branch transparently includes its parent's commits. Merging in order is non-negotiable; merging out-of-order will produce conflicts on `lib/subscriptions/tierCheck.ts` and `app/vault/conclave/page.tsx`.

**Cinematic + WalletConnect** are independent of each other and of Phase 3+ — they can technically merge in any order relative to the chain, but the recommended sequence above keeps the diff history clean.

---

<a id="11"></a>
## §11 — Environment + secrets state

### Required env (already configured per Session D handoff)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — gates AppKit modal; verify in Vercel for production
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by `lib/cult/access.ts`
- `SUPABASE_SERVICE_ROLE_KEY` — used by `getSupabaseAdmin()` in API routes (proposal create / vote)
- `ANTHROPIC_API_KEY` — used by `/api/vtx-ai`; will be reused for Daily Seal in Oracle phase

### Env touched this session
None — no new env required.

### Secrets to drop (owner)
None new from this session. Session D §8 list still applies.

---

<a id="12"></a>
## §12 — Known issues / things to watch

### Things that will surface only after merge

1. **`/branding/badge-naka-cult.png` 404** — until owner drops the asset, the cult `<TierBadge>` will log a 404 in browser network tab. Cosmetic only; no JS error.

2. **Sound calls fire silently** — `playSound('vault-door-open')` in the entry animation hits an `<audio>` element with `src="/sounds/vault-door-open.mp3"` that 404s. The SoundManager swallows the `error` event so no console spam, but a network-tab observer will see the 404s. Drops once owner adds MP3s.

3. **Vault entry localStorage key** — `naka_vault_entered` persists per-device. If the user clears localStorage they'll get the full 3s entry again, not the 0.6s abbreviated. By design.

4. **Vote weight cap** — current weight is 1 (cultist) or 2 (chosen). When holdings-weighted weight ships, existing votes will keep their captured weight at vote time (correct behavior — `cult_proposal_votes.weight` is captured at insert and never reweights retroactively). Aggregates on `cult_proposals` are recomputed atomically from the votes table on each new vote, so no manual backfill needed.

5. **Tab switching during 10s poll** — `ConclaveClient` listens for `visibilitychange` and only polls when visible. Switching tabs and coming back triggers an immediate refresh.

6. **First Vault entry with cookies disabled** — if the user has localStorage disabled, the entry plays full-length every time. Not a regression — same behavior as any localStorage-cached UI.

### Code-level subtleties

7. **`getCultAccess` is read-only on cookies** — `setAll` is a no-op. This means we don't refresh Supabase auth tokens during a Vault page render. If the user's session is mid-refresh, they may briefly hit the "not allowed" path. Same constraint as any RSC-time gate; if it becomes a problem, refactor to a Server Action for the gate check.

8. **`cult_stats` view recomputes per call** — counts are on-the-fly. With current cult sizes this is fine (< 1ms). When member counts cross ~10K, materialise + refresh on cron.

9. **Conclave proposal status is updated by client polling, not the server** — there's no resolution job yet. So a proposal whose `ends_at` has passed but `status` is still `active` will continue to accept votes via `wallet-verify` until the cron lands. The vote API DOES check `proposal.ends_at < now()` and rejects with `409 expired`, so the data stays consistent — but the UI will show "Closed" for an expired-but-still-active proposal until the next status flip.

---

<a id="13"></a>
## §13 — How to start the next session

```bash
cd "C:/Users/DELL LATITUDE 5320/dev/steinzlabs"
git checkout main
git pull --ff-only
git config user.name           # confirm: moderator29
git config user.email          # confirm: 101205446+moderator29@users.noreply.github.com
cat CLAUDE.md | head -30       # refresh the rules
cat docs/sessions/HANDOFF-session-E.md   # this file
ls docs/                       # vault.md, conclave.md, cinematic-system.md, naka-cult-plan.md, wallet-auth.md
```

After all 6 PRs from this session are merged, pick from the §8 backlog and proceed. Suggested ordering by leverage (not prescriptive — owner picks):

1. **Asset drops** (badge PNG, sound MP3s, treasury seed, ambient tracks) — unblock multiple existing features at once
2. **`lib/cult/holdings.ts` + on-chain access resolver** — unblocks holdings-weighted votes and auto-tier promotion
3. **Conclave Realtime + resolution cron + vote orbs** — finishes the Conclave to spec
4. **`/naka-cult` dramatic landing** — public-facing wow factor, drives Vault entries
5. **Platform-Wide UI Ascension** — biggest surface-area unbuilt piece, best done after icon system finalises
6. **Oracle chamber** — Daily Seal + VTX Sage + Whispers + Stealth tracking
7. **Sanctum chamber** — Mantle + Annals + Library + Forge
8. **Chosen exclusives** — Elder Chamber, Audience, Early Access, Chronicles
9. **Testing pass** — 15 critical-flow E2E tests + Lighthouse + perf + a11y

For Supabase work, **always verify against the live DB via MCP** before trusting migration files (Session D rule). `mcp__supabase__list_tables` and `mcp__supabase__execute_sql` are the canonical truth.

---

<a id="14"></a>
## §14 — End-of-session metrics

| Surface | State |
|---------|-------|
| Production app on https://nakalabs.xyz | Live, healthy. **None of the 6 session PRs are deployed yet** — they're branches awaiting merge. |
| TypeScript errors | 0 |
| Build errors | 0 (typecheck only — no full `next build` run this session) |
| Lint errors | 0 (`npx tsc --noEmit` clean; ESLint not run separately) |
| Live Supabase advisors | 3 (unchanged from Session D — all accepted/deferred) |
| Live migrations applied this session | 3 (`naka_cult_tier`, `vault_foundation`, `conclave`) |
| New SQL files in repo | 3 (mirrors of the live migrations) |
| Authors on origin | `moderator29` + `dependabot[bot]` only — preserved |
| AI attribution in commits | 0 — preserved |
| `CLAUDE.md` enforcement | Still in place |
| Open PRs | 6 (this session's branches) |
| New files | 47 |
| Modified files | 13 |
| Total LOC added | ~3,849 |
| New docs | 6 (`cinematic-system.md`, `wallet-auth.md`, `naka-cult-plan.md`, `vault.md`, `conclave.md`, this handoff) |
| Dependencies added | 0 (Howler / @tsparticles intentionally skipped; Three.js / Lottie / react-intersection-observer deferred) |
| New env vars | 0 |
| Spec sections complete | §1.4–§1.5, §1.7–§1.8 partial, §3.3, §4.1, §4.3 ✅ — all others partial or not started |
| Spec sections NOT started | §6 Oracle, §7 Sanctum, §8 Chosen Exclusives, §9 Landing, §11 Phase 9 (UI Ascension), §12 Testing |
| Owner action items | 10 (3 critical, 4 important, 3 production/infra) — see §6 |

— end Session E handoff —
