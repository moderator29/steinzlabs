# Session 5A Progress

Branch: `session-5a-production`

## Phase 1 — Brand Migration (IN PROGRESS)

- [x] Branding assets copied from `/public/branding/` to `/public/` and `/public/icons/`
- [x] `manifest.json` created with Naka Labs identity
- [x] Root `app/layout.tsx` metadata updated to Naka Labs
- [x] Brand components: `components/brand/Logo.tsx`, `AgentAvatar.tsx`, `NakaLoader.tsx`
- [x] Canonical `components/ui/SteinzLogo.tsx` now renders `/logo.png` (propagates to every consumer including `SteinzLogoSpinner`)
- [x] Global text replacement: "Steinz Labs" → "Naka Labs", "STEINZ LABS" → "NAKA LABS", "@steinzlabs" → "@nakalabs", "steinzlabs.com" → "nakalabs.com"
- [x] Standalone `Steinz` word replaced in VTX route, community/dna/vtx-ai pages, notifications

Internal identifiers (file paths, package name, CSS vars `--steinz-*`, env vars `STEINZ_*`, Supabase tables) intentionally unchanged to avoid breaking deployment, per prompt rules.

## Phase 2 — Infrastructure

- [x] `@upstash/redis` installed
- [x] `lib/cache/redis.ts`: getRedis, cacheGet/Set/Del, cacheWithFallback, rateLimit — all graceful no-op fallbacks when env vars missing
- [x] `lib/api/fetchWithRetry.ts`: exponential backoff, AbortController timeout, Sentry tagging
- [x] `vercel.json`: 11 cron schedules registered
- [x] `app/api/cron/_shared.ts`: `verifyCron()` + `cronResponse()` helpers
- [x] 11 cron stub route handlers created under `app/api/cron/<job>/route.ts`
- [x] VTX rate limit migrated to Redis-backed with in-process fallback; callsites updated to `await`

**User action required before deploy:** add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET` (generate 32-char random) to Vercel env vars. Code falls back gracefully until then.


## Phase 3 — Auth Upgrades

- [x] `app/api/auth/signin/route.ts`: uses env vars (no hardcoded credentials)
- [x] `components/auth/GoogleSignInButton.tsx`: Supabase OAuth Google flow
- [x] `components/auth/SignInWithWallet.tsx`: EVM (MetaMask) + Solana (Phantom) SIWE with typed providers
- [x] `app/api/auth/wallet-nonce/route.ts`: issues signed-message nonce (5 min TTL)
- [x] `app/api/auth/wallet-verify/route.ts`: viem `verifyMessage` for EVM, tweetnacl for Solana, creates Supabase user + magic-link session
- [x] `supabase/migrations/2026_session5a_auth.sql`: auth_wallet_nonces, wallet_identities, user_telegram_links + RLS
- [x] Login page: Google + Wallet buttons wired, explicit Turnstile render with polling (mobile fix), `size: 'flexible'`, hard navigation after sign-in (fixes cookie race)
- [x] Signup page: Google + Wallet buttons wired above email form, same Turnstile config

**User actions required before deploy:**
1. Enable Google provider in Supabase Dashboard → Authentication → Providers → Google (set authorized redirect URIs)
2. Run `supabase/migrations/2026_session5a_auth.sql` in Supabase SQL Editor
