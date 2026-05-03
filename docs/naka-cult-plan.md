# The Naka Cult Plan — 5th Tier

The Naka Cult is the apex tier on Steinz Labs. It sits above Max in the tier ladder and is **gated by holdings, not subscriptions** — there is no Stripe checkout for it.

## Tier ladder (canonical)

```
free  →  mini  →  pro  →  max  →  naka_cult
```

Source of truth: `lib/subscriptions/tierCheck.ts`. The `Tier` type and `TIER_ORDER` map are read by every gate (API routes, UI wrappers, middleware). Adding tiers above `naka_cult` requires bumping both.

## Entry rules

A wallet qualifies for `naka_cult` if **any** of the following is true:

| Path | Detection |
|------|-----------|
| Hold ≥ **600,000 $NAKA** | On-chain balance check on connected wallet(s) |
| Own a **NakaLabs Loyalty Gem NFT** | Alchemy NFT API ownership check |
| Own a **NakaLabs Development NFT** | Alchemy NFT API ownership check — also grants **The Chosen Seal** |

Phase 4 ships `lib/cult/access.ts` with the resolver. Until then, `naka_cult` is a recognised tier value but no production code sets it.

## What it unlocks

The Naka Cult tier inherits **everything in Max**, plus:

- **The Vault** entry animation and ambient music
- **The Conclave** — vote on Decrees, propose Whispers / Decrees, treasury visibility
- **The Oracle** — Daily Seal briefings, VTX Sage (cult-mode), Whisper Network, Echo Chamber stealth tracking
- **The Sanctum** — identity customization (Mantle), achievements + leaderboards (Annals), music + lore + art (Library), NFT showcase (Forge)
- For Development NFT holders only — **The Chosen** exclusives: Elder Chamber, quarterly Audience, Early Access Lab, Chronicles, customizations

## Pricing surface

`/dashboard/pricing` renders the tier as the 5th card with a `Held — not bought` price label and an "Enter the Cult" CTA that routes to `/naka-cult` (the dramatic landing page) instead of the Stripe stub.

## Feature flags

The Naka Cult tier is recognised by every existing gate via `tierCheck.ts`. The two feature-flag tables in repo:

| File | Tier shape | Naka Cult value |
|------|------------|-----------------|
| `lib/subscriptions/tierCheck.ts` | lowercase `'free' \| 'mini' \| 'pro' \| 'max' \| 'naka_cult'` | order = 4 |
| `lib/subscriptions/tiers.ts` | UPPERCASE `'FREE' \| 'PRO' \| 'PREMIUM' \| 'NAKA_CULT'` | all features on, `maxWallets: 25`, `maxAlerts: 500` |

The lowercase shape is the canonical one; the UPPERCASE shape is legacy and primarily drives `TIER_FEATURES` lookups. Both are kept in sync.

## Database

Live constraint:

```sql
profiles.tier IN ('free', 'mini', 'pro', 'max', 'naka_cult')
```

Migration: `supabase/migrations/2026_05_02_naka_cult_tier.sql` (applied to live DB on 2026-05-02). `tier_expires_at` semantics carry over — if a user's NAKA balance drops below threshold, a periodic job (Phase 4) downgrades them to `max` (or whatever paid tier they have via Stripe) and clears `tier_expires_at` since the gate is on-chain rather than time-based.

## Badge

`<TierBadge tier="naka_cult" />` renders `/branding/badge-naka-cult.png` with a crimson glow ring. Asset is owner-action: drop the artwork into `public/branding/` matching the cult/sigil aesthetic from the brand reference.

## Where it appears across the platform

- `/dashboard/pricing` — 5th tier card with entry rules block (this PR)
- `<TierBadge>` — popovers everywhere a username renders (this PR)
- `effectiveTier()` helper — recognises `naka_cult` (auto via `tierCheck.ts`)
- API tier gates (`apiTierGate.ts`, `serverTierCheck.ts`) — recognise it auto via `tierCheck.ts`
- `/naka-cult` landing — Phase 8 (dramatic landing page)
- Vault routes (`/vault`, `/vault/conclave`, `/vault/oracle`, `/vault/sanctum`) — Phase 4+

## Owner action items

1. Drop **`/public/branding/badge-naka-cult.png`** — cult sigil, crimson + blue glow, matching the reference aesthetic.
2. Phase 4 will add `lib/cult/access.ts` and a periodic resolver — review the threshold + NFT contract list when that PR lands.
