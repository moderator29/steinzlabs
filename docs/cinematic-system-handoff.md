# Cinematic System Asset Handoff

> Single, copy-paste-ready operational guide for the Vault / NakaCult cinematic system on Steinz Labs. Drop the assets, run the SQL, set the env, configure the crons — in that order — and the system goes from skeleton to fully operational.
>
> **This document was generated from the actual codebase state, not from spec assumptions.** Every path, schema, sound name, and SQL statement here matches what is on `main` and on the live Supabase project (`phvewrldcdxupsnakddx`).

**Last verified:** 2026-05-03 against `main` HEAD.

---

## Table of contents

- [§A — Branding assets](#a)
- [§B — Sound effects](#b)
- [§C — Ambient music](#c)
- [§D — Database SQL (ready to paste)](#d)
- [§E — Environment variables](#e)
- [§F — Vercel cron configuration](#f)
- [§G — Manual verification checklist](#g)
- [§H — Troubleshooting](#h)
- [§I — Asset source recommendations](#i)
- [§J — Reference: spec sections still NOT built](#j)

---

<a id="a"></a>
## §A — Branding assets

Drop into `/public/branding/`. The folder already contains `badge-mini.png`, `badge-pro.png`, `badge-max.png`, and the platform logo set — those are existing and stay. The cinematic system adds **one strictly required image** plus **three optional images** referenced by sigil components / vault entry. The brand reference image you sent (W "REDEFINING THE WEB3 SPACE" + 3 glowing icons) drives the aesthetic for all of them.

### A.1 — Critical (required before merge)

- [ ] **`/public/branding/badge-naka-cult.png`** — the cult sigil that renders inside `<TierBadge tier="naka_cult" />`. Required because the component sets it as `<img src>`; missing file = 404 in network tab on every page that shows a Naka Cult member's name.

  | Property | Spec |
  |---|---|
  | Path | `/public/branding/badge-naka-cult.png` |
  | Dimensions | 64×64 px (renders at 16–24 px in most surfaces; 2× density for retina) |
  | Format | PNG with full transparency |
  | Color | Cult sigil — crimson `#DC143C` + electric blue `#0066FF`, matching the brand reference's palette |
  | Style | Glowing geometric, gradient-filled, soft outer halo (same family as the rocket/helmet/pentagon icons) |
  | Used in | `components/ui/TierBadge.tsx` line 50 |
  | Required? | **Yes — page shows broken image until this lands** |

### A.2 — Optional (existing components currently render fine without these, but spec mentions them)

- [ ] **`/public/branding/sigil-naka.svg`** — the Naka sigil shown during the vault entry animation. Currently `components/vault/VaultEntryAnimation.tsx` uses the unicode `◈` character for the sigil (line 124). Dropping a real SVG and swapping the JSX is a 2-line follow-up; for now the unicode glyph renders with the correct gradient via CSS.
  - Dimensions: 96×96 vector (SVG)
  - Color: blue `#1E90FF` → crimson `#DC143C` gradient (handled in CSS — file can be a flat single-color shape)
  - Format: SVG
  - Required? No — current implementation uses CSS-styled unicode

- [ ] **`/public/branding/curve-lines.svg`** — background pattern referenced in spec §1.5 layer 3 ("Subtle curve lines pattern"). The shipped `vault.css` does not currently load this file; the aurora-bg uses radial + conic gradients instead. Drop the file only if you want a follow-up PR to add the third layer.
  - Dimensions: 120×120 tileable
  - Color: white at 3% opacity (overlaid)
  - Format: SVG
  - Required? No

- [ ] **`/public/branding/seal-daily.svg`** — wax-seal art for the future Oracle Daily Seal cinematic. **The Oracle chamber is not yet built**, so this is not referenced anywhere in current code. Park this until Oracle phase ships.
  - Dimensions: 256×256
  - Color: crimson wax red, aged-paper highlights
  - Required? No (future phase)

- [ ] **`/public/branding/ddergo-cover.png`** — fallback album art for the Vault ambient music dock. **The mini-player is not yet built**; tracks live in `cult_ambient_tracks` but no UI consumes them. Park this until the Sanctum/Library phase.
  - Required? No (future phase)

### A.3 — Already on the platform (no action)

These exist on `main` and don't need re-supplying:

```
/public/branding/badge-mini.png       Mini tier badge (blue)
/public/branding/badge-pro.png        Pro tier badge (platinum)
/public/branding/badge-max.png        Max tier badge (gold)
/public/branding/logo-square-final.png  Naka Labs square logo
/public/branding/logo-horizontal-final.png  Naka Labs horizontal logo
/public/icon-{16..1024}.png           Favicon set
/public/og-image.png                  Open Graph
```

---

<a id="b"></a>
## §B — Sound effects

`lib/cinematic/sound.ts` line 62 does:

```ts
audio.src = `/sounds/${name}.mp3`;
```

The folder `/public/sounds/` **does not yet exist on `main`** — create it and drop the 14 MP3s below. Until they exist, every `playSound(...)` call is a silent no-op (the SoundManager swallows the missing-asset `error` event so there's no console spam).

Format spec for every file:
- **MP3** (most browsers; OGG fallback is mentioned in code comments but not implemented — single MP3 is enough)
- **Mono or stereo, 44.1 kHz, 96–128 kbps** (keeps file size <100 KB for sub-second clips)
- Trim leading/trailing silence
- Normalize to ~−14 LUFS so volumes are consistent across the library
- All paths exact — names are matched by string in code

### B.1 — The 14 sounds

- [ ] **`/public/sounds/vault-door-open.mp3`** — 2–3 s. Heavy steel door creak that builds, ending on a deep bass thunk. Plays during the vault entry animation as the doors split open. Triggered by `VaultEntryAnimation` (when wired — sound calls are scaffolded but not yet attached to the phase transitions). Target: <80 KB.
- [ ] **`/public/sounds/vault-door-close.mp3`** — 1–2 s. Reversed creak + softer thunk. Plays on Vault exit. Target: <60 KB.
- [ ] **`/public/sounds/seal-rotate.mp3`** — 1 s. Subtle metallic whir. Plays as the Naka sigil rotates into place during entry. Target: <40 KB.
- [ ] **`/public/sounds/cult-enter.mp3`** — 2–3 s. Bass swell that resolves into a soft chime. Plays once when the user enters the Vault for the first time per session. Target: <80 KB.
- [ ] **`/public/sounds/success-chime.mp3`** — 0.4–0.6 s. Soft glassy bell. Plays on successful vote / proposal create / setting saved. Target: <30 KB.
- [ ] **`/public/sounds/error-tone.mp3`** — 0.3–0.5 s. Low subtle buzz, not aggressive. Plays on validation errors. Target: <25 KB.
- [ ] **`/public/sounds/notification.mp3`** — 0.4 s. Glassy ping. New event / alert toast. Target: <30 KB.
- [ ] **`/public/sounds/hover-soft.mp3`** — 0.15–0.25 s. Almost-imperceptible whoosh. Reserved for **major CTAs only** — gating in `CinematicButton` (`hoverSound` prop, default null). Target: <15 KB.
- [ ] **`/public/sounds/click-soft.mp3`** — 0.08–0.15 s. Tactile click. Default `clickSound` for every `CinematicButton`. Target: <10 KB.
- [ ] **`/public/sounds/proposal-pass.mp3`** — 1.5 s. Triumphant rising tone. Plays when a Conclave proposal flips to `passed` status (currently no resolution job — fires when implemented). Target: <60 KB.
- [ ] **`/public/sounds/proposal-fail.mp3`** — 1 s. Gentle descending tone, no negative connotation. Target: <45 KB.
- [ ] **`/public/sounds/whisper-arrive.mp3`** — 0.6–0.8 s. Whispered breath. Reserved for the Oracle / Whisper Network (not yet built). Target: <40 KB.
- [ ] **`/public/sounds/daily-seal.mp3`** — 1.5–2 s. Mystical chime with a hint of breath, opening-a-seal feeling. Reserved for Oracle Daily Seal (not yet built). Target: <80 KB.
- [ ] **`/public/sounds/level-up.mp3`** — 1.5–2 s. Triumphant fanfare, brief. Plays on tier upgrade or Chosen Seal earned. Target: <70 KB.

### B.2 — Where each sound is wired today vs. specced

| Sound | Wired in code today? | Wired in spec |
|---|---|---|
| `vault-door-open` | Scaffolded; not called yet | VaultEntryAnimation phase 'open' |
| `vault-door-close` | Scaffolded; not called | Vault exit |
| `seal-rotate` | Scaffolded; not called | Sigil rotation |
| `cult-enter` | Scaffolded; not called | Vault first entry |
| `success-chime` | Not yet called | Vote cast / proposal create |
| `error-tone` | Not yet called | Validation errors |
| `notification` | Not yet called | New alert |
| `hover-soft` | Optional prop on CinematicButton | Major CTA hover |
| `click-soft` | Default prop on CinematicButton (calls play even before file exists; silent no-op) | Every clickable cinematic surface |
| `proposal-pass` | Not yet called | Status flip to passed |
| `proposal-fail` | Not yet called | Status flip to failed |
| `whisper-arrive` | Not yet called | Oracle (future) |
| `daily-seal` | Not yet called | Oracle (future) |
| `level-up` | Not yet called | Tier upgrade |

**Implication:** dropping the MP3s is a no-op until the wiring is done. Wiring is small (one `playSound('...')` line per call site) but is in the §J backlog. If you want sounds to play immediately, also do the wiring pass.

### B.3 — Recommended royalty-free sources

- [Mixkit.co](https://mixkit.co/free-sound-effects/) — free, no attribution, MP3 ready
- [Pixabay Sounds](https://pixabay.com/sound-effects/) — free, no attribution
- [Freesound.org](https://freesound.org/) — Creative Commons; check license per file
- [ZapSplat](https://www.zapsplat.com/) — free with account
- Custom commission via Fiverr / AudioJungle if you want originals

---

<a id="c"></a>
## §C — Ambient music

The Vault mini-player is **not yet built** — but the catalog table `cult_ambient_tracks` is live. Drop tracks now and they'll be picked up automatically when the player ships in the Sanctum / Library phase. There's also a Spotify fallback path if you'd rather embed.

### C.1 — Path convention

`storage_path` in the table can be either:
- A relative path under `/public/audio/<file>.mp3` (next.js serves it directly), OR
- A fully-qualified public URL to your CDN / Supabase Storage / S3.

Recommended: drop the MP3s in `/public/audio/` for the smallest possible setup. Move to a CDN later if you want bandwidth control.

### C.2 — The 8 tracks

- [ ] **`/public/audio/shiba-spirit.mp3`** — Shiba Spirit by Ddergo (3:42)
- [ ] **`/public/audio/midnight-mutation.mp3`** — Midnight Mutation by Naka Collective (4:11)
- [ ] **`/public/audio/ice-cream-dreams.mp3`** — Ice Cream Dreams by VoV (2:58)
- [ ] **`/public/audio/akaishi-sunrise.mp3`** — Akaishi Sunrise by Ddergo (5:03)
- [ ] **`/public/audio/cookie-cult.mp3`** — Cookie Cult by n4kaishi8a (3:27)
- [ ] **`/public/audio/pulse-cycle.mp3`** — Pulse Cycle by Naka Collective (6:14)
- [ ] **`/public/audio/nippo-anthem.mp3`** — NIPPO Anthem by Ddergo feat. VoV (4:45)
- [ ] **`/public/audio/born-1948.mp3`** — Born 1948 by Naka Go Records (3:55)

The SQL to seed these into `cult_ambient_tracks` is in §D Script 3 below.

### C.3 — Spotify fallback

If you don't want to host the MP3s, use the existing Spotify playlist embed:
- **Playlist ID:** `1EBo00rAaRNIm8v83eul66`
- **Embed URL:** `https://open.spotify.com/embed/playlist/1EBo00rAaRNIm8v83eul66`

When the mini-player ships, it'll detect missing local files and fall back to the embed automatically (this is a planned behavior in the Sanctum phase, not yet wired).

---

<a id="d"></a>
## §D — Database SQL (ready to paste)

Every script below is **copy-paste ready** for the Supabase SQL Editor. They match the live schema on project `phvewrldcdxupsnakddx`.

### Script 1 — Promote a test account to Naka Cult

The column is **`tier`** (not `subscription_tier` — that name is from a different platform). The tier ladder also uses lowercase `'naka_cult'`, not uppercase.

```sql
-- By email (preferred for the maintainer)
UPDATE profiles
SET tier = 'naka_cult',
    is_chosen = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'phantomfcalls@gmail.com');

-- By user UUID directly (if you have it)
UPDATE profiles
SET tier = 'naka_cult',
    is_chosen = true
WHERE id = '<your-user-uuid>';

-- Verify
SELECT id, username, tier, is_chosen
FROM profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'phantomfcalls@gmail.com');
```

### Script 2 — Insert the first treasury snapshot

The table is `cult_treasury_snapshots`. Fields: `balance_naka numeric` (nullable), `balance_usd numeric` (nullable), `source text CHECK IN ('manual','alchemy','helius','rpc')`, `notes text`, `captured_at timestamptz default now()`.

```sql
INSERT INTO cult_treasury_snapshots (balance_naka, balance_usd, source, notes)
VALUES (2400000, 48000, 'manual', 'Initial seed snapshot');

-- Verify the Conclave Treasury panel will pick this up
SELECT * FROM cult_treasury_snapshots ORDER BY captured_at DESC LIMIT 1;
```

You can re-run this any time with fresh numbers; the panel reads the most recent row.

### Script 3 — Seed ambient tracks

The table is `cult_ambient_tracks`. Schema: `id`, `title`, `artist text default 'Ddergo'`, `storage_path text NOT NULL`, `duration_seconds integer`, `is_active boolean default true`, `display_order integer default 0`.

Replace `'/audio/<file>.mp3'` paths with your CDN URLs if you're hosting elsewhere.

```sql
INSERT INTO cult_ambient_tracks (title, artist, storage_path, duration_seconds, display_order) VALUES
  ('Shiba Spirit',       'Ddergo',                  '/audio/shiba-spirit.mp3',     222, 1),
  ('Midnight Mutation',  'Naka Collective',         '/audio/midnight-mutation.mp3', 251, 2),
  ('Ice Cream Dreams',   'VoV',                     '/audio/ice-cream-dreams.mp3', 178, 3),
  ('Akaishi Sunrise',    'Ddergo',                  '/audio/akaishi-sunrise.mp3',  303, 4),
  ('Cookie Cult',        'n4kaishi8a',              '/audio/cookie-cult.mp3',      207, 5),
  ('Pulse Cycle',        'Naka Collective',         '/audio/pulse-cycle.mp3',      374, 6),
  ('NIPPO Anthem',       'Ddergo feat. VoV',        '/audio/nippo-anthem.mp3',     285, 7),
  ('Born 1948',          'Naka Go Records',         '/audio/born-1948.mp3',        235, 8);

-- Verify
SELECT title, artist, duration_seconds FROM cult_ambient_tracks ORDER BY display_order;
```

### Script 4 — Achievements catalog

**Not applicable yet.** The achievements table (`cult_achievements`) is **not yet migrated** — it's planned for the Sanctum/Annals phase. When it ships, the seed catalog (per §7.4 of the original spec) will need:
- "First Decree Author" — wrote a proposal that passed
- "Echo Master" — has a whisper with 500+ echoes
- "Voice of the Cult" — voted on 100+ proposals
- "The Diligent" — verified 50+ whispers
- "Shadow Walker" — 25 stealth follows active

Each with a tier (`bronze | silver | gold | mythic`) and a points value. The schema and the catalog seed are deferred to that PR.

### Script 5 — Verify the constraint accepts naka_cult

The `profiles.tier` CHECK constraint was widened to `('free','mini','pro','max','naka_cult')` by migration `naka_cult_tier`. If you're verifying a fresh environment:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'profiles_tier_check';
-- Expected: CHECK ((tier = ANY (ARRAY['free'::text, 'mini'::text, 'pro'::text, 'max'::text, 'naka_cult'::text])))
```

### Script 6 — (Optional) Bulk-promote multiple test accounts

If you want a small group to have Vault access:

```sql
UPDATE profiles
SET tier = 'naka_cult'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'phantomfcalls@gmail.com',
    -- add more emails here
  )
);
```

### Script 7 — (Optional) Audit current cult population

Useful when sanity-checking who has access:

```sql
SELECT
  p.id,
  u.email,
  p.username,
  p.tier,
  p.is_chosen,
  p.tier_expires_at,
  p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.tier = 'naka_cult'
ORDER BY p.created_at DESC;
```

### Script 8 — (Optional) Insert a seed proposal so /vault/conclave isn't empty on first visit

Replace `<author-uuid>` with a `naka_cult` user's UUID (e.g. yourself after Script 1).

```sql
INSERT INTO cult_proposals (author_id, kind, title, body, stake_naka, ends_at)
VALUES (
  '<author-uuid>',
  'decree',
  'Genesis Decree — establish the Conclave',
  'The first Decree of the Conclave. Voting open. The cult speaks for the first time. Cast your vote — yes to mark this moment, no if you disagree, abstain to stand neutral.',
  10000,
  now() + interval '7 days'
);

-- Verify
SELECT id, title, status, ends_at FROM cult_proposals ORDER BY created_at DESC LIMIT 1;
```

---

<a id="e"></a>
## §E — Environment variables

The cinematic / vault system itself adds **zero new env vars**. Everything below is either already configured (Session D) or scoped for the next phase.

### E.1 — Already configured (verify these exist in Vercel for production)

```bash
# Wallet auth
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=        # gates AppKit modal — wallet sign-in fails silently if missing

# Supabase
NEXT_PUBLIC_SUPABASE_URL=                    # used by lib/cult/access.ts
NEXT_PUBLIC_SUPABASE_ANON_KEY=               # used by lib/cult/access.ts
SUPABASE_SERVICE_ROLE_KEY=                   # used by /api/cult/proposals/* (admin client)

# Anthropic (already used by /api/vtx-ai; will be reused for Daily Seal in Oracle phase)
ANTHROPIC_API_KEY=

# Existing infrastructure
ALCHEMY_API_KEY=
HELIUS_API_KEY=
NEXT_PUBLIC_SITE_URL=https://nakalabs.xyz
```

### E.2 — Reserved for future phases (set when those phases ship — leave empty/unset for now)

```bash
# On-chain holdings resolver (Phase: Oracle / on-chain access resolver)
NAKA_TOKEN_CONTRACT=                         # the live $NAKA token contract address
NAKA_TREASURY_WALLET=                        # team treasury wallet address (read by future /api/cron/refresh-treasury)
NAKA_LOYALTY_GEM_CONTRACT=                   # leave empty until $27 Loyalty Gem NFT mints
NAKA_DEV_NFT_CONTRACT=                       # leave empty until $48 Development NFT mints
NAKA_HOLDING_THRESHOLD=600000                # documented in code; constant, no need to make env
```

When the on-chain access resolver lands, those four contract envs will be read. Until then, tier is set manually via Script 1 in §D.

### E.3 — Where to set them

- **Production:** Vercel Dashboard → Project → Settings → Environment Variables → Production
- **Preview:** same page, Preview tab (mirror what production has)
- **Local dev:** `.env.local` at repo root — `.env*` is gitignored already

---

<a id="f"></a>
## §F — Vercel cron configuration

`vercel.json` currently has 35 crons. **None of them touch the cult system** — that's correct, because the only cult cron logic that's written today is the 10s polling in `ConclaveClient.tsx` (client-side, not a cron). When future cult crons are needed, they'll be added to `vercel.json`.

### F.1 — Crons NOT yet built (planned for follow-up phases)

These should be added in the listed PR — not now.

- [ ] **`/api/cron/cult-resolve-proposals`** — every 10 minutes — flips `cult_proposals.status` from `active` to `passed` / `failed` once `ends_at < now()`. Pass rule: `yes_weight > no_weight` AND `voter_count >= 5`. Stake-slash on fail (Decree-only). Cost: lightweight (single query + small UPDATE).
  ```json
  { "path": "/api/cron/cult-resolve-proposals", "schedule": "*/10 * * * *" }
  ```

- [ ] **`/api/cron/cult-refresh-treasury`** — every 6 hours — reads on-chain $NAKA balance for `NAKA_TREASURY_WALLET` via Alchemy and inserts a new row into `cult_treasury_snapshots`. Cost: lightweight (1 RPC call + 1 INSERT).
  ```json
  { "path": "/api/cron/cult-refresh-treasury", "schedule": "0 */6 * * *" }
  ```

- [ ] **`/api/cron/cult-verify-membership`** — daily 03:00 — reads connected wallet $NAKA holdings + NakaLabs NFT ownership for every active member, promotes / demotes `tier` and sets / clears `is_chosen`. Cost: moderate (one Alchemy/Helius call per active member).
  ```json
  { "path": "/api/cron/cult-verify-membership", "schedule": "0 3 * * *" }
  ```

- [ ] **`/api/cron/cult-generate-daily-seal`** — daily 07:00 — calls Anthropic with curated context and writes one row to `cult_daily_seals` (table not yet migrated). Cost: moderate (1 Anthropic call).
  ```json
  { "path": "/api/cron/cult-generate-daily-seal", "schedule": "0 7 * * *" }
  ```

### F.2 — How to add when ready

When a future PR ships any of those endpoints, append the entry to the `crons` array in `vercel.json` and ship it on a `feat/` branch — Vercel picks up the new schedule on the next deploy. **Vercel Hobby tier caps at 2 crons; Pro = 40.** The repo is currently at 35 — adding all four cult crons puts it at 39, still under the Pro cap.

### F.3 — Each cron must

- Verify a `Authorization: Bearer ${process.env.CRON_SECRET}` header (existing crons in `app/api/cron/_shared.ts` show the pattern).
- Have an early-exit when there's nothing to do (e.g. resolve-proposals exits in <50 ms when no proposals are due).
- Be idempotent — safe to re-run if Vercel retries.

---

<a id="g"></a>
## §G — Manual verification checklist

After dropping assets / running SQL / deploying, walk through these in order. If a step fails, jump to §H Troubleshooting.

### G.1 — Pre-deploy

- [ ] Step 1 — Drop **`/public/branding/badge-naka-cult.png`** (the only critical asset). Optional: SVG sigil + curve-lines + seal-daily.
- [ ] Step 2 — Drop the 14 sound effect MP3s into **`/public/sounds/`**. (If skipped, Vault still works silently.)
- [ ] Step 3 — Drop the 8 ambient music MP3s into **`/public/audio/`**. (If skipped, the future mini-player will fall back to Spotify embed.)
- [ ] Step 4 — Verify env vars in Vercel (§E.1).
- [ ] Step 5 — Run SQL Script 1 (promote yourself to `naka_cult`).
- [ ] Step 6 — Run SQL Script 2 (insert first treasury snapshot).
- [ ] Step 7 — Run SQL Script 3 (seed ambient tracks).
- [ ] Step 8 — (Optional) run Script 8 to seed a genesis proposal so the Conclave isn't empty on first visit.
- [ ] Step 9 — Push the asset commit / merge any pending PR. Vercel auto-deploys from main.

### G.2 — Smoke test on production

- [ ] Step 10 — Visit `/` → confirm landing renders, no 404 errors in network tab.
- [ ] Step 11 — Visit `/login`. Confirm:
  - Email + password form renders
  - "Continue with Google" button renders
  - **"Sign in with wallet" button renders** (Phase 2 deliverable)
  - Click it → AppKit modal opens
- [ ] Step 12 — Visit `/dashboard/pricing`. Confirm:
  - **5 tier cards** render (Free, Mini, Pro, Max, Naka Cult)
  - Naka Cult card shows the crimson border and "Held — not bought" price
  - Naka Cult card lists Entry rules (≥600k $NAKA, Loyalty Gem NFT, Development NFT)
  - "Enter the Cult" CTA routes to `/naka-cult` (currently 404 until Phase 8 — that's OK)
- [ ] Step 13 — Visit `/vault` directly. Confirm:
  - **Cinematic entry animation plays** (3 seconds first time: dark → sigil materialises → seal pulse → doors split)
  - You can click anywhere to skip
  - After entry, the chamber hub renders with three portal cards
  - Identity strip at top shows your username + "Chosen" rank (because Script 1 set `is_chosen=true`)
  - Cult stats row shows real numbers (Active Cultists ≥ 1, Decrees Passed = 0 or 1 if you ran Script 8 + voted, Chosen Seals ≥ 1, $NAKA Held = "—" because the on-chain reader isn't built yet)
  - Particles do NOT render in the hub (the current Vault doesn't enable ParticleField — primitives exist, application is in §J backlog)
- [ ] Step 14 — Click "The Conclave" portal. Confirm:
  - Treasury Panel renders the snapshot from Script 2 (e.g. "2.40M $NAKA · ≈$48K USD")
  - Tab bar shows Active / Passed / Failed / All
  - If Script 8 was run, the genesis proposal is visible in Active
  - Click "Yes" / "No" / "Abstain" — vote bar updates within 1 second
  - Click "Author a Decree" → modal opens, validate the form, submit → new card appears in Active within 10s (polling)
- [ ] Step 15 — Click "The Oracle" portal → confirm placeholder "Coming soon" page (Phase 6).
- [ ] Step 16 — Click "The Sanctum" portal → confirm placeholder "Coming soon" page (Phase 7).
- [ ] Step 17 — Visit `/vault` from a non-cult account (sign in as someone with `tier='free'`). Confirm:
  - You're redirected to `/dashboard?denied=cult`
  - Vault HTML never reaches the browser (server-side gate)
- [ ] Step 18 — Open DevTools → Network tab on `/vault`. Confirm:
  - `badge-naka-cult.png` returns 200 (after Step 1)
  - `/sounds/*.mp3` returns 200 for any sound that's been wired (currently none called automatically)
  - No 5xx server errors
- [ ] Step 19 — Test on mobile (375 px). Confirm:
  - Vault hub stacks vertically
  - Stats row renders 2-up grid (not 4-up)
  - Entry animation skip button stays accessible at bottom
- [ ] Step 20 — Test with `prefers-reduced-motion: reduce` (Chrome DevTools → Rendering → Emulate CSS media). Confirm:
  - Vault entry animation is instant (no door slide)
  - Aurora drift animation stops
  - Portal breathing micro-animation stops
- [ ] Step 21 — Toggle dark / light theme on dashboard, then visit `/vault`. Confirm Vault stays dark (vault.css is theme-locked — intentional).
- [ ] Step 22 — Verify TypeScript build: locally run `npx tsc --noEmit` → should be 0 errors. (Already verified at session end.)

### G.3 — Sound and music verification (only after wiring pass — currently scaffolded but not auto-called)

- [ ] Step 23 — Drop the 14 MP3s into `/public/sounds/`. Visit `/settings`, drop in `<SoundControls />` (it's not yet placed there — manual wiring needed; see §J backlog), confirm the toggle + volume slider works.
- [ ] Step 24 — Once sound calls are wired into Vault entry / vote / proposal-pass: confirm sounds play in Chrome (autoplay policy may suppress on first load — user gesture unblocks).
- [ ] Step 25 — Once the ambient mini-player is built: confirm the dock appears bottom-right of `/vault`, plays a track from `cult_ambient_tracks`, persists across chamber routes, and respects the `music_enabled` user preference.

---

<a id="h"></a>
## §H — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/vault` redirects to `/dashboard?denied=cult` even though I'm me | `profiles.tier` is not `naka_cult` | Run §D Script 1 with your email; the `profiles_tier_check` constraint requires lowercase `naka_cult` |
| `<TierBadge tier="naka_cult" />` shows broken image | `/public/branding/badge-naka-cult.png` missing | §A.1 — drop the file |
| Vault entry animation doesn't play | localStorage key `naka_vault_entered=true` from a prior session — that's the abbreviated 0.6s entry, not "doesn't play" | Open DevTools → Application → Local Storage → delete the key, refresh |
| Vault entry animation never resolves | Page is stuck in `init` phase — almost always a JS error before the timer fires; check console | Hard reload, check console; if still stuck open `components/vault/VaultEntryAnimation.tsx` and verify the timer setTimeouts |
| No sound effects | Either user has muted via `<SoundControls />` (check localStorage `naka_sound_enabled`), OR the MP3 files don't exist (check `/sounds/<name>.mp3` returns 200), OR no sound call is wired yet (most are not — see §B.2) | §B; remember the wiring pass is separate from the asset drop |
| Daily Seal not generating | The Oracle chamber and `/api/cron/cult-generate-daily-seal` are not yet built | Out of scope for current state — see §J |
| Treasury Panel shows "—" forever | No row in `cult_treasury_snapshots` | Run §D Script 2 |
| Treasury Panel always shows the same number | No refresh cron yet | Out of scope until `/api/cron/cult-refresh-treasury` ships (§F.1) |
| Conclave is empty even though I created a proposal | Polling is on a 10s interval and only when tab is visible; switch tabs → switch back to force a refresh, or wait | Working as designed |
| "expired" 409 when voting | `proposal.ends_at` has passed but no resolution job has run | Until the resolve-proposals cron exists, no fix on the user side; the proposal is truly closed |
| Vote bar shows percentage, not vote orbs | Vote orb visualization is a documented spec gap (§J) | Will land in a Conclave follow-up PR |
| WalletConnect modal doesn't open | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is not set or empty | Set it in Vercel; `HAS_APPKIT` short-circuits the button if absent |
| `lib/cult/access.ts` always returns `{ allowed: false }` even though the user has the right tier | Cookies aren't reaching the server-side Supabase client. Check that the user actually has a session (e.g., visit `/dashboard` first; if that bounces you to login, your session is gone) | Re-login |
| Light theme breaks Vault visuals | Vault is intentionally dark-only — the cult palette is designed for the deep black canvas | Working as designed; don't theme-override the `.vault-shell` |
| `prefers-reduced-motion` doesn't disable some animation | The CSS `@media (prefers-reduced-motion: reduce)` blocks at the bottom of `vault.css` and `globals-cinematic.css` cover everything; if a new animation slips in, add it to those blocks | Edit and PR |

---

<a id="i"></a>
## §I — Asset source recommendations

### Branding / icons (the cult sigil + future icon ascension)

- **Free / open source**
  - [Lucide React](https://lucide.dev/) — already installed; placeholder until custom icons land
  - [SVGRepo](https://www.svgrepo.com/) — free SVGs you can recolor with the cult gradient
- **Premium**
  - [IconScout](https://iconscout.com/) — paid + free, premium glowing icon packs available
  - [Flaticon Premium](https://www.flaticon.com/) — broad library, gradient styles
- **AI-generated (for unique cult-themed art)**
  - DALL-E 3 / Midjourney with prompts like _"glowing cult sigil, crimson + electric blue, geometric, 3D render, isolated on transparent background, top-down"_
  - **Caveat:** AI-generated art often needs cleanup in Figma / Photoshop for perfect transparency
- **Commission**
  - Fiverr / 99designs / Dribbble freelancers
  - Specify: 64×64 PNG with transparency, crimson `#DC143C` + blue `#0066FF`, soft outer glow halo, sigil/symbol, geometric, matches the brand reference image

### Sound effects (the 14 MP3s)

- [Mixkit Free SFX](https://mixkit.co/free-sound-effects/) — free, no attribution, MP3 download
- [Pixabay Sounds](https://pixabay.com/sound-effects/) — free, no attribution
- [Freesound.org](https://freesound.org/) — Creative Commons (verify license per file before use)
- [ZapSplat](https://www.zapsplat.com/) — free with account, large library
- **Commission custom**
  - [AudioJungle](https://audiojungle.net/) — paid templates
  - Fiverr "sound design" gigs — custom 14-clip pack typically $50–150

### Music (the 8 ambient tracks)

- **Use the actual Ddergo tracks** from `nakalibrary.vercel.app/ddergo` — these are your existing creative assets
- **Spotify embed fallback** (Section §C.3) — zero asset hosting overhead
- **Commission new tracks** if you want exclusive Vault-only audio:
  - Fiverr — composer freelancers in the lo-fi / ambient genre
  - SoundBetter — higher-end producers
  - Independent artists on Bandcamp who do commissions

---

<a id="j"></a>
## §J — Reference: spec sections still NOT built

This is a quick pointer back to the full handoff so this asset doc isn't read in isolation. The complete punch list is in **`docs/sessions/HANDOFF-session-E.md` §7 + §8** (~260 lines of granular gaps).

Highlights of what is **not yet built** and therefore won't be exercised by the verification checklist (§G):

1. **The Oracle chamber** — Daily Seal, VTX Sage, Whisper Network, Echo Chamber. `/vault/oracle` is a placeholder.
2. **The Sanctum chamber** — Mantle, Annals, Library (incl. mini-player), Forge. `/vault/sanctum` is a placeholder.
3. **Chosen exclusives** — Elder Chamber, Audience, Early Access Lab, Chronicles. `is_chosen` flag is wired into vote weight (2×) and Identity Strip gold trim, but the dedicated UIs are not built.
4. **Dramatic landing page** — `/naka-cult` does not exist yet; current Vault denials redirect to `/dashboard?denied=cult` as a safe fallback.
5. **Sound wiring pass** — most `playSound(...)` calls are scaffolded but not hooked into the actual UX events. Drop the assets first; wiring is a separate small PR.
6. **Vote orb visualization** — currently a percentage gradient bar, not individual orbs.
7. **Real-time vote updates** — currently 10 s polling, not Supabase Realtime.
8. **Proposal resolution cron** — proposals don't auto-flip to passed/failed yet.
9. **On-chain holdings resolver** — tier promotion is manual via §D Script 1 until `lib/cult/holdings.ts` ships.
10. **Treasury auto-refresh cron** — manual snapshot inserts only.
11. **Daily Seal generation cron** — Oracle phase deliverable.
12. **Platform-wide UI ascension** — cinematic primitives exist; existing platform surfaces (dashboard, market, wallet, etc.) have not been migrated to the new tokens.
13. **Icon system upgrade across the platform** — only the 3 chamber sigils match the new style; everything else is still `lucide-react`.

When any of those phases ship, this asset handoff should be re-read and **updated in place** — new tables (e.g. `cult_daily_seals`, `cult_achievements`, `cult_audiences`) will need their own seed sections, new sounds may be referenced, new env vars (e.g. `NAKA_TOKEN_CONTRACT`) will become live.

---

## Summary

To go from "skeleton" to "fully operational" right now, in this exact order:

1. Drop **one image** — `/public/branding/badge-naka-cult.png`
2. Drop **14 MP3 sound effects** into `/public/sounds/` (optional but recommended; soundless until done)
3. Drop **8 MP3 music tracks** into `/public/audio/` (optional; Spotify fallback exists)
4. Run **8 SQL scripts** in §D (only Scripts 1, 2, 3 are required to make every shipped feature work — Scripts 4–8 are optional / deferred)
5. **Verify env vars** in Vercel — no new ones needed
6. **No cron config changes** required for current shipped state
7. Walk the **22-step verification checklist** in §G

Anything beyond that is in §J — those are future phases, not blockers for the current Vault foundation + Conclave to be fully usable.
