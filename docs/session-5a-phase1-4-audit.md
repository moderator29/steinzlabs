# Session 5A — Phase 1–4 Self-Audit

## Build
`npm run build` → exit 0. Clean production build. No type errors, no lint failures.

## Code hygiene
- `grep -rn "TODO\|FIXME\|XXX"` on all Phase 1–4 files → 0 matches.
- `grep -rn ": any"` on all Phase 1–4 files → 0 matches.
- `grep -rni "Steinz Labs"` in `app/**/*.tsx` + `components/**/*.tsx` → 0 matches.

## Phase 1 — Brand Migration
- All 19 brand assets exist under `/public/branding/`; canonical copies present at `/public/logo.png`, `/public/logo-horizontal.png`, `/public/favicon.ico`, `/public/og-image.png`, `/public/apple-touch-icon.png`, plus `/public/icons/icon-{16..1024}.png` and Android Chrome icons.
- `public/manifest.json` is valid JSON with correct Naka Labs identity.
- `app/layout.tsx` metadata references Naka Labs, correct OG/Twitter cards, icons, manifest link, metadataBase.
- Canonical `components/ui/SteinzLogo.tsx` re-implemented to render `/logo.png`, so every existing import (including `SteinzLogoSpinner`) picks up the new brand without path rewrites.
- Internal identifiers (env vars `STEINZ_*`, CSS vars `--steinz-*`, file paths, package.json name) intentionally preserved.
- Login / signup pages still render branding (`<SteinzLogo size={48} />`).

## Phase 2 — Infrastructure
- `lib/cache/redis.ts`: lazy client init, env-var guard with single warning, all operations wrapped in try/catch, Sentry-tagged on failure. Safe no-op fallback when `UPSTASH_REDIS_REST_URL`/`_TOKEN` unset → verified by running `npm run build` without them.
- `lib/api/fetchWithRetry.ts`: exponential backoff (500 × 2^attempt), `AbortController` timeout, retries only on 5xx/429/network, Sentry-tagged final failure.
- `vercel.json`: 11 cron schedules registered.
- `app/api/cron/_shared.ts`: `verifyCron()` returns 401 only when `CRON_SECRET` present and mismatched, allows requests in dev mode, logs a warning.
- 11 cron stub route handlers under `app/api/cron/*/route.ts` — each verifies, timestamps, returns `{ ok, job, durationMs, timestamp }`.
- VTX rate-limit migrated to Redis with in-process fallback, all 4 callsites now `await`ed.
- `lib/services/` imports unchanged (no breakage).

## Phase 3 — Auth Upgrades
- `app/api/auth/signin/route.ts`: uses `process.env.NEXT_PUBLIC_SUPABASE_URL!` and `_ANON_KEY!` (no hardcoded values).
- `components/auth/GoogleSignInButton.tsx`: Supabase OAuth flow with `redirectTo=/auth/callback`, loading/error state, no `any`.
- `components/auth/SignInWithWallet.tsx`: typed `EvmProvider` / `SolanaProvider` interfaces, no `window as any`, error surface, both EVM+Solana paths.
- `app/api/auth/wallet-nonce/route.ts`: validates input, 5-min TTL nonce, service-role Supabase insert, structured error response.
- `app/api/auth/wallet-verify/route.ts`: viem `verifyMessage` (EVM), tweetnacl (Solana), consumes nonce, creates user + wallet identity + magic-link session; all error branches return JSON.
- `supabase/migrations/2026_session5a_auth.sql`: valid SQL — three tables with RLS, `DROP POLICY IF EXISTS` before `CREATE POLICY` for re-runnability.
- Turnstile: explicit render + 200 ms poll loop + `size: 'flexible'` confirmed on both `app/login/page.tsx` and `app/signup/page.tsx`.
- Hard navigation: `window.location.assign(destination)` confirmed in `app/login/page.tsx:242`.
- Google + Wallet buttons wired above email form on both pages.

## Phase 4 — Dashboard Redesign
- `components/dashboard/CompactKpiBar.tsx`: loading state ("—"), fetch-error silently preserves previous data, 2-min refresh, cleanup on unmount.
- `components/dashboard/PersonalizedHome.tsx`: loading state (`NakaLoader`), proper empty states per section with CTA links, typed `HomepageData`, no `any`.
- `components/dashboard/GlobalSearch.tsx`: Cmd/Ctrl+K capture, 300 ms debounce, click-outside close, Escape close, typed `SearchResult`.
- `app/api/dashboard/homepage/route.ts`: requires authenticated user (`getAuthenticatedUser`), 30-s Redis cache keyed per user, parallel Supabase queries, all `?? []` fallbacks — returns valid JSON when authenticated.
- `app/api/dashboard/market-globals/route.ts`: 120-s Redis cache, CoinGecko via `fetchWithRetry`, returns 502 on upstream failure.
- `app/api/dashboard/search/route.ts` (created on separate path so existing `/api/search` is not overwritten): address detection + CoinGecko search, 5-min cache.
- `app/dashboard/page.tsx`: new `overview` tab defaults on, `CompactKpiBar` + `GlobalSearch` in sticky header, `pt-[120px]` matches the taller header.
- Bottom nav uses `setActiveNav` (internal state) or `router.push` for href-based items — no forced `window.location.href`.

## Issues found → fixed
1. **Production login loop (10-s kick-back).** Root cause: `lib/hooks/useSessionGuard.ts` required a legacy `steinz_session` cookie no longer written by the email/password path. Rewritten to use the Supabase session as the source of truth, initial check deferred 2 s to close the post-sign-in cookie-race window. Detailed write-up in `docs/login-loop-audit.md`.

## Net result
- Build passes.
- All Phase 1–4 code hygiene targets met (no TODOs, no `any`, no brand leaks).
- Production login regression fixed at the root, not papered over.
