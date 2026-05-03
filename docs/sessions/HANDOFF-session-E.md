# Session E Handoff — Vault v2 Foundation Pass — 2026-05-02

> Read this if you're continuing the Vault v2 build. Top-up to Sessions A/B/C/D — those handoffs are still applicable.

This session opened the "Vault v2 Breath-Taking Edition" build (~18-hour overnight scope). Five high-leverage PRs were shipped at the picture-perfect bar; the remaining spec sections are listed at the bottom for the next session to pick up.

---

## §1 — What shipped (5 PRs, all on origin)

**Merge order matters.** Each PR explicitly notes its dependency. Merge top-to-bottom:

| # | Branch | What it adds | Live migration |
|---|--------|--------------|----------------|
| 1 | `feat/cinematic-foundation` | CSS aurora + cult tokens, Framer Motion presets, native-Audio SoundManager (no Howler dep), pure-canvas ParticleField (no @tsparticles dep), Loaders, EmptyState, SoundControls, useReducedMotion + useSound. **Foundation primitives every later phase rides on.** | — |
| 2 | `feat/wallet-connect-siwe` | Real WalletConnect/AppKit + MetaMask sign-in on `/login` and `/signup`. Uses the existing SIWE backend (`/api/auth/wallet-{nonce,verify}`) — also fixed two `.toLowerCase()` violations on raw addresses per CLAUDE.md (Solana base58 case-sensitivity). | — |
| 3 | `feat/naka-cult-plan-tier` | `naka_cult` as the 5th tier across the platform: tierCheck.ts (canonical), tiers.ts (legacy), TierBadge variant, TierGateOverlay label, admin user palette + counts, Telegram tier label, vtx-ai serverTier, pricing page (5th card with entry rules + crimson gradient). | `naka_cult_tier` (CHECK constraint widened) |
| 4 | `feat/vault-foundation` | `/vault` route gated by `tier='naka_cult'`. Cinematic entry animation (3s first / 0.6s return), three chamber portals with new icon-style sigils (rocket/helmet/pentagon), identity strip, cult stats counter. **Depends on #3.** | `vault_foundation` (`profiles.is_chosen`, `cult_user_preferences`, `cult_ambient_tracks`, `cult_stats` view) |
| 5 | `feat/conclave-v2` | `/vault/conclave` working chamber: author Decrees / Whispers / Treasury motions, vote yes/no/abstain with live bar, treasury panel, 10s polling refresh. **Depends on #4.** | `conclave` (cult_proposals, cult_proposal_votes, cult_proposal_comments, cult_treasury_snapshots; cult_stats view extended) |

All PRs:
- TypeScript clean (0 errors)
- No mock data — null/empty-state where data isn't yet available
- Conventional Commits, no AI attribution
- Live Supabase migrations applied via MCP (3 of them); SQL also in `supabase/migrations/`

PR URLs:
- https://github.com/moderator29/steinzlabs/pull/new/feat/cinematic-foundation
- https://github.com/moderator29/steinzlabs/pull/new/feat/wallet-connect-siwe
- https://github.com/moderator29/steinzlabs/pull/new/feat/naka-cult-plan-tier
- https://github.com/moderator29/steinzlabs/pull/new/feat/vault-foundation
- https://github.com/moderator29/steinzlabs/pull/new/feat/conclave-v2

---

## §2 — Brand reference locked in

The W "REDEFINING THE WEB3 SPACE" image is **color/branding reference only — not a logo to use anywhere**. The three glowing icons next to it (rocket, helmet/visor, pentagon) are the **new platform-wide icon style**: glowing geometric, gradient-filled, soft outer glow.

Mapping baked into Phase 4:
- **Rocket** → The Conclave (governance — "launches" decrees)
- **Helmet/visor** → The Oracle (sight — intel, daily seal, sage)
- **Pentagon** → The Sanctum (soul — identity, achievements, lore)

The three sigils live in `components/vault/sigils/` as inline SVG. When the icon system pass happens (originally Section 1.6 of the spec), source/build the rest of the platform's icons in this same aesthetic.

---

## §3 — Owner action items (what only you can do)

These cannot be done in a Claude session — they need you in the GitHub UI / Vercel UI / Supabase Dashboard / your asset library.

### Critical (gates the experience)

1. **Merge the 5 PRs in the order above.** Each has a self-contained commit message and PR description. No branch protection needed — solo maintainer.
2. **Drop the cult sigil badge:** `/public/branding/badge-naka-cult.png` — sigil/symbol, crimson + blue glow, matching the cinematic brand reference. Until this lands, `<TierBadge tier="naka_cult" />` 404s on the image.
3. **Promote yourself + early cultists to `naka_cult` tier** so you can actually walk into the Vault during testing:
   ```sql
   UPDATE profiles SET tier='naka_cult' WHERE id='<your-id>';
   UPDATE profiles SET is_chosen=true   WHERE id='<your-id>'; -- optional: gold trim + 2x vote weight
   ```

### Important (unlocks features that exist but are dark)

4. **Drop sound effect MP3s into `/public/sounds/`** matching the names in `lib/cinematic/sound.ts` (`vault-door-open.mp3`, `seal-rotate.mp3`, `cult-enter.mp3`, etc — full list in `docs/cinematic-system.md`). Until then, the cinematic plays silently. Sources: Freesound.org (CC0), Mixkit, or original.
5. **Insert the first treasury snapshot** so the Conclave Treasury panel renders real numbers:
   ```sql
   INSERT INTO cult_treasury_snapshots (balance_naka, balance_usd, source, notes)
   VALUES (2400000, 48000, 'manual', 'Initial seed');
   ```
6. **Insert ambient tracks** for the future Vault mini-player:
   ```sql
   INSERT INTO cult_ambient_tracks (title, storage_path, display_order) VALUES
     ('Track Title 1', '<public-url>', 1), ...;
   ```

### Nice-to-have

7. **Production smoke test of WalletConnect** — you have the env (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`). Once #1 is merged, hit `/login`, click "Sign in with wallet", confirm MetaMask flow → magic-link consume → land on `/dashboard`.
8. **Outstanding owner items from Session D §8** still apply (secret rotation, branch protection w/o approvals, secret scanning, leaked-password protection, repo metadata).

---

## §4 — What is NOT yet built (for the next session)

The original spec was ~18 days of work; this overnight pass shipped the foundation + most-impactful chamber. Everything below is **scoped, documented, and ready for the next session** but not yet implemented:

### The Oracle (`/vault/oracle`)
- Daily Seal (Anthropic-driven daily briefing, cinematic wax-seal reveal)
- VTX Sage (cult-mode VTX with sigil avatar + ink-writing text effect)
- Whisper Network (anonymous intel feed with smoke effects + Echo voting)
- Echo Chamber (stealth wallet tracking, 25-slot quiet pack)

### The Sanctum (`/vault/sanctum`)
- The Mantle — identity customization (avatar, frame, glow, banner, title, sigil)
- The Annals — achievements + leaderboards
- The Library — Ddergo Sanctuary upgrade (full-screen now-playing, visualizer, playlists, lore reading progress, art gallery)
- The Forge — auto-detected NFT showcase, 3D rotate

### Chosen Exclusives
- The Elder Chamber (Conclave sub-section, 2x vote weight already partially done in cult_proposal_votes.is_chosen)
- The Audience — quarterly team calls (cult_audiences + cult_audience_questions tables stubbed in spec, not yet migrated)
- Early Access Lab (cult_early_access_features + feedback)
- Chosen-only customizations + Chronicles

### Conclave follow-ups
- **Supabase Realtime subscriptions** to replace 10s polling — pushes vote orb bursts directly. Trivial to wire from current state.
- **Proposal resolution scheduled job** — flip `status=active` → `passed`/`failed` once `ends_at < now()`. Pass rule: `yes_weight > no_weight` AND `voter_count >= 5`. Decree-only stake slash-on-fail.
- **On-chain holdings-weighted votes** — replace flat `weight = 1 (cultist) | 2 (chosen)` with `sqrt(naka_balance)` once `lib/cult/holdings.ts` reads the connected wallet. Server-side via Alchemy/Helius.
- **Threaded comments UI** — table exists, UI not yet built.

### Dramatic landing page
- `/naka-cult` — the cinematic landing (Section 9 of the spec). Cult layout has a fallback redirect (`/dashboard?denied=cult`) until this ships.

### Platform-wide icon ascension
- Audit and replace every `lucide-react` icon on the platform with the glowing-geometric brand style. The three sigils in `components/vault/sigils/` are the reference.

### On-chain access resolver
- `lib/cult/holdings.ts` — reads connected wallet's $NAKA balance + NakaLabs NFT ownership and auto-promotes to `naka_cult` tier (and sets `is_chosen` for Development NFT holders). Until this lands, tier is owner-set in admin panel.

---

## §5 — How to start the next session

```bash
cd "C:/Users/DELL LATITUDE 5320/dev/steinzlabs"
git checkout main
git pull --ff-only
git config user.name           # confirm: moderator29
git config user.email          # confirm: 101205446+moderator29@users.noreply.github.com
cat CLAUDE.md | head -30       # refresh the rules
cat docs/sessions/HANDOFF-session-E.md
ls docs/                       # vault.md, conclave.md, cinematic-system.md, naka-cult-plan.md, wallet-auth.md
```

Pick the next chamber (Oracle is the natural follow-up), cut a fresh `feat/oracle-foundation` branch off main (after the 5 PRs are merged), and continue.

---

## §6 — Working state at end of Session E

| Surface | State |
|---------|-------|
| Production app | Live, healthy. None of the 5 PRs are deployed yet — they're branches awaiting merge. |
| TypeScript errors | 0 |
| Live Supabase advisors | 3 (unchanged from Session D) |
| Live migrations applied | 3 new (naka_cult_tier, vault_foundation, conclave) |
| Authors on origin | `moderator29` + `dependabot[bot]` only — preserved. |
| AI attribution in commits | 0 — preserved. |
| Open PRs | 5 (this session's branches) |
| Lines added | ~3,400 across 5 PRs + this handoff |
| New docs | `vault.md`, `conclave.md`, `cinematic-system.md`, `naka-cult-plan.md`, `wallet-auth.md`, this handoff |

— end Session E handoff —
