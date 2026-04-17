# STEINZ LABS — SESSION 5 DEEP ARCHITECTURAL AUDIT

**Auditor lens:** Top-1% senior auditor with prior engagements at Coinbase, Uniswap, Dune Analytics, Nansen, Arkham, DeBank, Phantom, MetaMask. The standard applied throughout this report is "what does world-class look like in this product category, and how far away are we?" — not "did we ship the feature."

**Scope:** Every user-facing feature on the platform plus a platform-wide architectural section. Each feature is evaluated through five lenses (A–E) so the report doubles as a Session 5 backlog.

**Codebase shape at audit time:** 76,686 LOC across `app/`, `components/`, `lib/`. 138 API routes, 92 components, 92 lib modules. Branch `session-4-production` merged to `main`.

**Honest framing:** A score of "7/10" in this report does **not** mean "good enough to ship" — it means "competent but recognizably 1–2 years behind the leader in that category." A 9/10 means we'd hold our own next to the best in the world. We currently have **zero 9/10 features** and that is the central message of this audit.

---

## Feature 1 — Landing Page

### A) Current State Deep Dive

**Files implementing it:**
- [app/page.tsx](../app/page.tsx) — 23-line composition root
- [components/landing/LandingNav.tsx](../components/landing/LandingNav.tsx) — 86 lines
- [components/landing/HeroSection.tsx](../components/landing/HeroSection.tsx) — 68 lines (background orbs, stars, gradient, mounts HeroLeft + HeroRight + FloatingCoins)
- [components/landing/HeroLeft.tsx](../components/landing/HeroLeft.tsx) — 118 lines (logo, headline, CTA, animated count-up stat bar)
- [components/landing/HeroRight.tsx](../components/landing/HeroRight.tsx) — 93 lines (mock token-card preview, hidden on mobile)
- [components/landing/FeatureCardsSection.tsx](../components/landing/FeatureCardsSection.tsx) + [FeatureCard.tsx](../components/landing/FeatureCard.tsx) + [cards-data.ts](../components/landing/cards-data.ts)
- [components/landing/VTXSection.tsx](../components/landing/VTXSection.tsx) — 107 lines (AI agent showcase)
- [components/landing/StatsSection.tsx](../components/landing/StatsSection.tsx) — 91 lines (4 hardcoded vanity stats)
- [components/landing/FAQSection.tsx](../components/landing/FAQSection.tsx) + [FAQData.ts](../components/landing/FAQData.ts)
- [components/landing/CTASection.tsx](../components/landing/CTASection.tsx) — 59 lines
- [components/landing/LandingFooter.tsx](../components/landing/LandingFooter.tsx) — 111 lines
- [components/landing/FloatingCoins.tsx](../components/landing/FloatingCoins.tsx) — 66 lines (cryptologos.cc img tags w/ keyframe animation)
- [components/landing/CoinIcon.tsx](../components/landing/CoinIcon.tsx) + [ContainerBadge.tsx](../components/landing/ContainerBadge.tsx) — utility
- **Total: 1,205 LOC across 16 files.**

**Data sources:** None live. Every number on the page is hardcoded — `12,000+ tokens`, `500+ rugs`, `$4.2M+ swaps protected`, `12+ chains`, plus the count-up stats in `HeroLeft` (`12 chains`, `1M+ txns`, `50K+ tokens`). The `StatBar` count-up animation is purely cosmetic; it animates from 0 to a hardcoded constant.

**Architecture pattern:** Pure server-rendered React Server Component composition (the root `app/page.tsx` is a Server Component). Six of the section components opt into `'use client'` purely to use `framer-motion` (HeroLeft, HeroRight, FeatureCard, VTXSection, FloatingCoins, StatsSection). No data fetching, no SSR data dependencies, no streaming. The page is essentially static HTML + a bundle for the motion code.

**Performance characteristics:**
- Initial HTML: small, fast.
- JS bundle: dominated by `framer-motion` (~50 KB gzipped) used in 6 components for trivial fade-in / hover / tilt effects that could be done with pure CSS for a fraction of the weight.
- Images: `cryptologos.cc` external CDN with no `next/image`, no `width/height`, no `loading="lazy"` discipline → CLS risk and zero asset optimization.
- Stars in HeroSection: 55 absolutely-positioned divs computed from `i * 1.618`, rendered every paint. Cheap but unnecessary.
- No prefetching of `/dashboard` or `/login` despite being the primary CTAs.

**UX quality: 6/10.** Honest read: it looks like a well-executed indie product launched in 2023. It does not look like the homepage of a platform that wants to compete with Nansen ($150M ARR) or Arkham. The hero copy is generic ("On-Chain Intelligence For Every Trade"), the headline color contrast is poor (`#1a2855` wordmark on `#07090f` background is below WCAG AA), the right-side mock card is not interactive, and there is no proof — no real product screenshot, no real customer logo, no real testimonial. The feature cards are tiles instead of interactive demos. The FAQ is an accordion with generic copy.

**Backend quality: N/A** — there is no backend. (Which is itself a finding; see C.)

**What works well:**
- Clean, fast, uncluttered. No layout thrash, no auto-playing videos.
- Animated logo and count-up stats add motion without being noisy.
- Good z-index discipline (header, content, orbs, fade overlays all behave).
- Responsive — `HeroRight` cleanly hides on mobile.
- Footer is complete (Privacy, Terms, Support all link).

**What is weak or missing:**
- All stats are hardcoded fiction. A user who comes back tomorrow sees the same "12,000+ tokens analyzed."
- The right-side mock card shows a static "Risk Score 12/100" panel that does not reflect any real token on the platform. It looks like a screenshot, but it is JSX with hardcoded values.
- No social proof: no investor logos, no integrations logos (Alchemy, Phantom, Sentry), no quoted users, no link to recent VTX outputs or Bubble Map screenshots.
- No real product screenshot — the only "product" visible is the simulated card.
- VTXSection had invisible-text contrast issues until Session 4 patched the colors to `#8899cc` / `#7788bb`. Even after the fix, the section is essentially marketing copy + a headshot — no live VTX demo.
- No video, no scrollytelling, no interactive demo.
- StatsSection numbers are hardcoded at module scope. There is no `/api/landing/stats` route to back them with reality.
- FAQ data lives in a static TS file. No structured data (`FAQPage` JSON-LD) for SEO, despite being trivially addable.
- No `<link rel="preload">` for hero font, no `priority` flag on hero images.
- No hreflang, no localized variants, no `next-intl` integration on the landing page despite `next-intl` being in the dep graph.

**What feels half-built:**
- The FloatingCoins effect uses external `cryptologos.cc` URLs — works, but means our landing page has an uncached third-party dependency that can break or slow down without warning.
- HeroRight's mock card looks like a teaser for a real component that was never built.
- The headline `<span style={{ color: '#eef2ff' }}>` has the same color as the line above it — the visual styling implies the second line should be a gradient or emphasized color.

### B) Industry Standard Comparison

**Phantom (phantom.app):** Single-page hero, animated app screenshot composited over a gradient, real device mockup with live-feeling UI. App Store / Play Store buttons above the fold. Below: "Trusted by millions" with named integration logos (Magic Eden, Solflare, Drift). Footer is dense and useful.

**Coinbase (coinbase.com):** Personalized hero — different messaging if you arrive with a referral code, different if you have a Coinbase cookie. A/B tested headline. Live BTC ticker in header. Real ARIA-accessible nav. Localized to 30+ languages with `hreflang`.

**Uniswap (uniswap.org):** Aggressively minimal — almost no copy, big "Get the Uniswap Wallet" + "Trade now" buttons. Below the fold: real volume number from their subgraph (e.g., "$2.3T total volume"), updated nightly. Brand strength carries the page.

**Nansen (nansen.ai):** This is the closest direct comparison because they sell the same on-chain-intelligence story we do. Nansen's page features (1) a real product screenshot of the Smart Money page, (2) named customer quotes (Polychain, Andreessen Horowitz, Coinbase Ventures) with photo + title, (3) a "research" section pulling their actual published Substack reports, (4) a live ticker showing how many wallets are labeled. Their conversion path is aggressive: one button to "Try Free for 7 Days" with a card-required trial.

**Arkham (arkhamintelligence.com):** Hero is a giant interactive entity-graph visualization that responds to mouse movement. It's not a screenshot — it's the actual product running with a public dataset. The page IS the product.

**DeBank (debank.com):** Live aggregated TVL across all tracked DeFi protocols in the header. Below the hero, a real-time scroll feed of recent large transactions. Essentially "look at how much we know."

The pattern across the leaders: **the landing page either is the product, or shows real product output as proof.** Our landing page does neither.

### C) Next-Gen Recommendations

**Make the page itself prove the product.** The single highest-leverage change is to replace the hardcoded numbers and the static mock card with live data:

1. **`/api/landing/stats` endpoint** powering the 4 vanity stats with real Supabase counts: `COUNT(*)` over `scans`, `flagged_tokens`, `swap_logs.amount_usd`, distinct chains in `featured_tokens`. Cache 5 min via `revalidate`. Fall back to a sane minimum so we never display 0.
2. **Replace `HeroRight` mock card with a live token rotation.** Pull the top 5 trending tokens from DexScreener, render the actual `TokenCard` component the dashboard uses, rotate every 4 seconds. The user sees the real product on the homepage.
3. **Live recent-activity feed** above the footer: pull last 10 entries from `flagged_tokens` and the public swap_logs (PII-stripped — show `0x84…dE5` and `swapped USDC → ETH`, never the wallet's portfolio). DeBank-style scrolling list.
4. **Real product screenshots** in the FeatureCardsSection. Each card should show a 1-frame `next/image` of the actual Whale Tracker / Bubble Map / VTX screen, not a generic illustration.
5. **Investor + integration logos**: Alchemy, Anthropic, Supabase, Vercel, Sentry, PostHog, Cloudflare. We use them — say so.

**Backend changes:**
- Add `app/api/landing/stats/route.ts` with `revalidate = 300` and a fallback constant.
- Add `app/api/landing/recent-activity/route.ts` returning sanitized rows from `swap_logs` and `flagged_tokens`. RLS must allow anon read of these specific columns only.
- Build a `landing_metrics_daily` materialized view in Supabase, refreshed by a daily cron edge function. Avoids hammering production tables on every cache miss.

**Frontend changes:**
- Drop `framer-motion` from landing components. Replace with CSS `@keyframes` for the 6 motion uses — cuts ~50 KB from the landing bundle.
- Convert `HeroLeft`'s `useCountUp` to a CSS `@property --num` animation — kills the React render loop on the count-up.
- Use `next/image` with explicit `width/height` and `priority` on hero, `loading="lazy"` everywhere else.
- Add `JsonLd` for `Organization`, `WebSite`, `FAQPage`, `BreadcrumbList`. The FAQ section is wasted SEO real estate without it.
- Replace `cryptologos.cc` with self-hosted SVGs in `/public/coins/` — kills a third-party dependency and an extra DNS lookup on every page load.
- Add a real OG image generator at `app/opengraph-image.tsx` using `next/og` with the live stats baked in.

**New sub-features:**
- "Try VTX free, no signup" — an anonymous, rate-limited (5 queries/IP/day) VTX demo accessible from the landing page. Like Anthropic's claude.ai/login page that shows a real chat box.
- Bubble Map demo embedded inline using a known token (USDC, BONK) — Arkham-style interactive proof.
- Live "Last rug detected" ticker with token name + chain + timestamp, refreshed every 60s.

**What to remove:**
- `StatBar` count-up that animates to a hardcoded constant. Either show real numbers or remove the counter entirely.
- The static "Risk Score 12/100" mock card in HeroRight — replace with the live token rotation.

**Performance optimizations:**
- Lighthouse scores — aim for 95+ Performance, 100 Accessibility, 100 SEO. We are likely at 70/85/85 today.
- Preload `Inter` font subset, `font-display: swap`.
- `next/dynamic` import for everything below the fold (FAQ, CTA, Footer).
- Remove the 55 `<div>`s used for stars; replace with one CSS `radial-gradient` background.

**Mobile:**
- Drop the second-half-of-hero mock entirely on mobile (already does), but the hero text still feels too dense at `34px`. Consider `28px` with tighter line-height.
- The `Launch App` and `Read Docs` buttons stack on mobile — the secondary "Read Docs" should be subordinated visually (text link, not pill).
- Test on iPhone SE (375px) — the StatBar dividers compress awkwardly.

### D) Priority and Effort

- **Current score: 6/10.** Looks fine but does not compete.
- **Effort to reach 9/10: Medium (1.5–2 weeks).** The structure is fine; what's needed is real data plumbing + 3 net-new sub-features (live VTX demo, Bubble Map embed, recent-activity ticker).
- **Approach: Upgrade incrementally.** Don't rebuild — the page composition is healthy. Replace hardcoded data with API calls, swap mock card for live rotation, add proof sections.
- **Blocks other features?** No, but it gates conversion. A weak landing page lowers signup rate, which capitates every other feature's value. Should be tackled in parallel with deeper-feature Session 5 work, not after.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Add live stats endpoint | `app/api/landing/stats/route.ts` (new), `components/landing/StatsSection.tsx` (consume) | New Supabase view `landing_metrics_daily` |
| Live token rotation in hero | `components/landing/HeroRight.tsx` (rewrite), reuse `components/vtx/TokenCard.tsx` | DexScreener trending |
| Recent-activity scroll feed | `components/landing/RecentActivityTicker.tsx` (new), `app/api/landing/recent-activity/route.ts` (new) | RLS policies on `swap_logs`, `flagged_tokens` for anon read of public columns |
| Anonymous VTX demo | `components/landing/VTXDemoBox.tsx` (new), `app/api/landing/vtx-demo/route.ts` (new w/ IP rate limit, 5/day) | Reuse `lib/services/anthropic.ts` |
| Bubble Map embed | `components/landing/BubbleMapDemo.tsx` (new) | Reuse `app/api/intelligence/bubblemaps/[token]/route.ts` |
| OG image generator | `app/opengraph-image.tsx` (new) | None |
| FAQ JSON-LD | `components/landing/FAQSection.tsx` (add `<script type="application/ld+json">`) | None |
| Drop framer-motion from landing | All 6 client components in `components/landing/` | None |
| Self-host coin SVGs | `public/coins/*.svg`, `components/landing/FloatingCoins.tsx` (rewrite paths) | None |
| Investor + integration logos row | `components/landing/IntegrationsRow.tsx` (new), `public/logos/*.svg` | None |

**Acceptance criteria:** Lighthouse Performance ≥ 95, every number on the page traceable to a Supabase query, hero contains at least one live-data interactive element above the fold, anon-rate-limited VTX demo functional from `/`.

---

## Feature 2 — Authentication (Signup, Signin, Password Reset, Session Management)

### A) Current State Deep Dive

**Files implementing it:**
- [app/login/page.tsx](../app/login/page.tsx) — 406 lines (email or username login, Turnstile, verification flow)
- [app/signup/page.tsx](../app/signup/page.tsx) — 477 lines (multi-field form, async username availability, attempt cooldown)
- [app/forgot-password/page.tsx](../app/forgot-password/page.tsx) — 154 lines
- [app/reset-password/page.tsx](../app/reset-password/page.tsx) — 197 lines
- [app/login/layout.tsx](../app/login/layout.tsx), [app/signup/layout.tsx](../app/signup/layout.tsx), [app/forgot-password/layout.tsx](../app/forgot-password/layout.tsx), [app/reset-password/layout.tsx](../app/reset-password/layout.tsx) — metadata wrappers (added Session 4)
- [app/auth/callback/page.tsx](../app/auth/callback/page.tsx) — Supabase OAuth callback
- [middleware.ts](../middleware.ts) — SSR auth gate
- [lib/supabase.ts](../lib/supabase.ts) — browser client (`@supabase/ssr` `createBrowserClient`, PKCE flow, 1h session)
- [lib/supabaseAdmin.ts](../lib/supabaseAdmin.ts) — server admin client (lazy, env-validated)
- [lib/authTokens.ts](../lib/authTokens.ts) — async HMAC-SHA256 verify/reset token gen
- [lib/auth/apiAuth.ts](../lib/auth/apiAuth.ts) — server-side `getAuthenticatedUser(request)` resolver
- [lib/auth/adminAuth.ts](../lib/auth/adminAuth.ts) — admin gate (static bearer OR JWT + `profiles.role='admin'`)
- [lib/hooks/useAuth.ts](../lib/hooks/useAuth.ts) — client hook subscribing to `onAuthStateChange`, calls PostHog identify/reset
- [lib/hooks/useSessionGuard.ts](../lib/hooks/useSessionGuard.ts) — 1h idle timeout
- [components/auth/TurnstileWidget.tsx](../components/auth/TurnstileWidget.tsx) — bot protection
- 11 sub-routes in `app/api/auth/`: `signin`, `signup`, `confirm-user`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`, `verify-captcha`, `verify-turnstile`, `lookup`, `check-rate-limit`

**Data sources:** Supabase Auth (`auth.users`, `auth.sessions`, `auth.refresh_tokens`), `profiles` table (custom user metadata), `auth_rate_limits` table (custom rate-limit ledger), `login_activity` table (added Session 4), Cloudflare Turnstile.

**Architecture pattern:**
- **Client component** for the form pages (forms need state).
- **Server-side rate limiting** via `/api/auth/check-rate-limit` writing to a `auth_rate_limits` row keyed on `action:ip:identifier`. 5 attempts / 10-min window / 15-min block.
- **PKCE** OAuth flow on the client.
- **SSR cookie auth** via `@supabase/ssr` in middleware — calls `supabase.auth.getUser()` on every protected route, redirects to `/login?session=expired` if absent.
- **HMAC-signed verification + reset tokens** generated server-side with `crypto.subtle` and `JWT_SECRET`; deterministic functions of `(userId, email, purpose)`, validate by re-deriving.
- **Turnstile** client-side, verified server-side via `/api/auth/verify-turnstile`.
- **Idle timeout** in `useSessionGuard` — `IDLE_TIMEOUT_MS = 60*60*1000` (1h). Activity events: `mousemove`, `keydown`, `click`, `scroll`. On timeout, calls `supabase.auth.signOut()`.
- **PostHog** identify on session start, reset on signout.

**Performance characteristics:**
- Login: 1 request to `/api/auth/check-rate-limit`, 1 to Supabase, 1 to `/api/auth/signin` (which also async-inserts `login_activity`). Typical ~350–800ms end-to-end.
- Signup: live username availability check on every keystroke after 3 chars, with no actual debounce timer — fires on every change. Each check is a `/api/auth/signup` POST that does a DB lookup. **Hot path issue.**
- Middleware: runs `supabase.auth.getUser()` on every protected route navigation — ~30ms per Vercel edge request to Supabase. At 100k DAU this becomes a meaningful Supabase cost.

**UX quality: 7/10.** Above average for a 2025 web3 product. Email verification flow is clean. Username availability is satisfying when it works. The "needs verification" inline UI is good. Background coin animations on auth pages add polish without distracting. Toast feedback is immediate.

**Backend quality: 7/10.** SSR cookies + PKCE + verified `getUser` is the modern Supabase pattern done right. HMAC tokens with required env var (no fallback) is secure. Rate-limit ledger in DB is solid. Two debt items prevent a 9: legacy [app/api/auth/signin/route.ts](../app/api/auth/signin/route.ts) still has hardcoded `SUPABASE_URL` + `SUPABASE_ANON_KEY` constants; in-memory rate-limit cache in `vtx-ai/route.ts` (separate from `auth_rate_limits`) doesn't share across Vercel instances.

**What works well:**
- Real Turnstile integration (not just checkbox theatre).
- PKCE flow properly enabled.
- Async HMAC-SHA256 token gen with `JWT_SECRET` enforced.
- Per-user idle timeout + 1h session length (modern security; was 4h pre-Session-4).
- Username-or-email login (Phantom doesn't even have this).
- Signup attempt cooldown with visual countdown.
- Login activity persisted with user-agent + IP.
- Email verification "resend" with cooldown.

**What is weak or missing:**
- **No social login** (Google, Apple, X). For a crypto product this is borderline mandatory in 2026 — even Coinbase has Google.
- **No passkey / WebAuthn**. Supabase supports it natively; we have not enabled it.
- **No magic-link login** despite Supabase supporting `signInWithOtp` out of the box.
- **No 2FA enrollment** — Settings page mentions it, the button is dead.
- **No "Sign in with Wallet" (SIWE / EIP-4361, Solana SIP-3)**. For an on-chain intelligence product this is a real omission — Nansen, Arkham, DeBank all have it.
- **Username availability check fires on every keystroke** — should debounce 250–400ms.
- **No password strength meter** on signup.
- **No HIBP / Pwned Passwords check.**
- **Forgot-password always returns success** (good for enumeration prevention), but signup explicitly says "An account with this email already exists" — leaks the same info, inconsistent threat model.
- **No device trust / step-up auth on new device.** Stripe-style "we noticed a new login from Chrome on macOS" emails not sent.
- **`onTurnstileSuccess` registered as a global window callback** — could conflict with another Turnstile instance.
- **`useSessionGuard` 1h idle is harsh** — a user reading a Bubble Map for 65 minutes gets booted. Industry standard is 24h with refresh-token rotation.
- **Login activity has no UI for "Sign out all sessions."**
- **No CAPTCHA on the password reset endpoint** — only on login/signup.

**What feels half-built:**
- 2FA toggle in Settings is a button labeled "Enable" that does nothing.
- Login activity dedup is weak — multiple opens of the same browser show as separate rows.
- Hardcoded URL constant in `signin/route.ts` flagged in Session 4 audit but not removed.

### B) Industry Standard Comparison

**Phantom:** Wallet-native (your seed phrase IS your auth). Apple ID + iCloud sync for backups, Touch ID / Face ID on mobile.

**Coinbase:** Email + password OR Google OR Apple OR phone-number magic link. SMS 2FA standard, TOTP and YubiKey optional. Account-takeover detection sends mandatory email + push. KYC required for trading, but auth tier is open.

**Uniswap (web app):** Pure wallet connect — WalletConnect, MetaMask, Coinbase Wallet, Phantom, Frame. Saves nothing server-side.

**Nansen:** Email/password + Google OAuth + SIWE. TOTP 2FA, recovery codes, device list with revoke. Subscription tier checked at the auth layer.

**Arkham:** Email + Google + Apple. SIWE for wallet-linked accounts. "No wallet required for read-only" — separates browsing from acting.

**DeBank:** Wallet-connect first, optional email for notifications.

**Standard pattern:** Modern web3 platforms support **at least 3 auth methods** (email + Google + wallet). We support 1 (email). On 2FA: Coinbase, Nansen, Arkham all have working TOTP enrollment with QR + recovery codes + device removal. Ours is decorative. On session management: all four show a "Devices" list in settings with last-active, IP, UA, and per-device sign-out. Ours is read-only.

### C) Next-Gen Recommendations

**Highest leverage (do these first):**

1. **Sign in with Wallet (SIWE / EIP-4361 + Solana SIP-3).** Single biggest gap.
   - Server: `app/api/auth/wallet-nonce/route.ts` issues a one-time nonce, persisted in `auth_wallet_nonces` (5-min TTL).
   - Server: `app/api/auth/wallet-verify/route.ts` accepts `{ address, signature, nonce }`, verifies via `viem.verifyMessage` (EVM) or `tweetnacl.sign.detached.verify` (Solana), then `supabase.auth.admin.createUser` or upserts the wallet → user binding.
   - Client: `components/auth/SignInWithWallet.tsx` button on login + signup.
2. **Google OAuth via Supabase native provider.** Zero backend code — configure in Supabase dashboard + add a button. 30-min job.
3. **Real TOTP 2FA enrollment** using Supabase's `mfa.enroll`, `mfa.challenge`, `mfa.verify`. Replace the dead "Enable" button.
4. **Magic link** as a third auth option. Already supported by Supabase via `signInWithOtp`; needs a UI checkbox.
5. **Debounce username availability** to 350ms via `useDeferredValue` or a custom hook.
6. **Password strength meter + HIBP check.** Use `@zxcvbn-ts/core` and the Pwned Passwords k-anonymity API. Block top-1k breached passwords, warn on 1k–100k.
7. **Device trust + step-up auth.** New IP/UA combo → email "New sign-in from Chrome on macOS — was this you?" with revoke link.
8. **Make `useSessionGuard` configurable per-tier.** Free 1h idle, Pro/Max 24h with refresh rotation.

**Backend changes:**
- New tables: `wallet_identities (user_id, address, chain, verified_at)`, `auth_wallet_nonces (nonce, address, expires_at)`, `auth_devices (user_id, device_fingerprint, ua, ip, first_seen, last_seen, trusted)`, `auth_events` (audit log).
- Replace hardcoded URL+ANON constants in `app/api/auth/signin/route.ts` with env vars.
- Move VTX rate-limit store from in-process map to Supabase row or Upstash Redis.

**Frontend changes:**
- Settings → Security tab redesign: active sessions w/ revoke, 2FA enrollment, recovery codes, connected wallets, recent auth events.
- Login page: 4 buttons (Email, Google, Wallet, Magic link), email default expanded.
- Signup: passkey enrollment offered after first successful signin on a trusted device.
- Replace global `window.onTurnstileSuccess` with a `<Turnstile>` React wrapper using `useEffect` register/unregister.

**New sub-features:**
- "Remember device 30 days" toggle on login.
- Recovery codes downloadable as PDF after 2FA enrollment.
- "Trust this browser" checkbox after step-up.
- Account merge — link wallet + email accounts.

**Performance:**
- Cache `getUser()` middleware result in Edge-Runtime KV (Upstash or Vercel KV). At 100k DAU this saves ~6M Supabase auth calls/day.
- Or: locally validate JWT signature in middleware using Supabase JWKS, only hit `getUser()` for revocation check.

**Mobile:**
- Add `autoComplete="email" | "current-password" | "new-password"` properly.
- iPhone SE: "Show password" eye overlaps input padding. Increase right-padding.

### D) Priority and Effort

- **Current score: 7/10.** Solid for startup, behind for a Nansen-class platform.
- **Effort to 9/10: Medium-Large (2.5–3 weeks).** SIWE alone ~1 week. 2FA + Google OAuth + magic link + device trust + UI = another 1.5 weeks.
- **Approach: Upgrade incrementally.** Foundation (Supabase + SSR + HMAC) is sound — add providers and 2FA on top.
- **Blocks other features?** Partially. SIWE unlocks "import this wallet's portfolio without signing every action," which Wallet Intelligence and Approval Manager benefit from. 2FA blocks Pro/Max enterprise sales conversations.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| SIWE auth (EVM + Solana) | `components/auth/SignInWithWallet.tsx`, `app/api/auth/wallet-nonce/route.ts`, `app/api/auth/wallet-verify/route.ts` (all new) | `wallet_identities`, `auth_wallet_nonces`; deps `viem`, `tweetnacl` |
| Google OAuth | Configure in Supabase dashboard, add button in `app/login/page.tsx` + `app/signup/page.tsx` | None |
| Magic link auth | `components/auth/MagicLinkBox.tsx` (new), reuse `supabase.auth.signInWithOtp` | None |
| TOTP 2FA enrollment | `app/settings/security/2fa/page.tsx` (new), `lib/auth/mfa.ts` (new) | Supabase MFA tables |
| Recovery codes | Reuse 2FA flow | `auth_recovery_codes` table |
| Active sessions UI w/ revoke | `app/settings/security/sessions/page.tsx` (new) | Add `revoked_at` to `login_activity` |
| Step-up auth on new device | `lib/auth/deviceTrust.ts` (new), `new_device_login` email template | `auth_devices` table |
| Password strength + HIBP | `components/auth/PasswordStrength.tsx` (new); add `@zxcvbn-ts/core` | None |
| Debounce username check | `app/signup/page.tsx` — wrap in `useDebouncedValue` | None |
| Replace hardcoded creds | `app/api/auth/signin/route.ts` | None |
| Move rate-limit cache to Redis | `app/api/vtx-ai/route.ts`, new `lib/cache/redis.ts` | Upstash Redis or Vercel KV |
| Per-tier idle timeout | `lib/hooks/useSessionGuard.ts` | Read tier from `user.user_metadata.subscription_tier` |
| Auth event audit log | `lib/auth/auditLog.ts` (new); insert calls in signin/signout/password change | `auth_events` table |

**Acceptance criteria:** SIWE works for EVM + Solana with signature verified server-side; Google OAuth button signs users in; TOTP 2FA enrollment + verification + recovery codes functional; sessions list in Settings shows real `login_activity` rows with working "Sign out" action per row.

---

## Feature 3 — Dashboard Homepage

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/page.tsx](../app/dashboard/page.tsx) — 304 lines (composition root, top nav, bottom nav, 4 KPI cards, two tabs)
- [app/dashboard/layout.tsx](../app/dashboard/layout.tsx) — 27 lines (mounts SessionGuard, AlertMonitor, PlatformEventMonitor, FloatingNotificationBell, FloatingBackButton, FloatingSupportButton)
- [components/SidebarMenu.tsx](../components/SidebarMenu.tsx) — left-side categorized nav (Trading, Intelligence, Security, Tools, Account)
- [components/ContextFeed.tsx](../components/ContextFeed.tsx) — 709 lines, the default landing tab
- [components/MarketDashboard.tsx](../components/MarketDashboard.tsx) — alternate tab
- [components/VtxAiTab.tsx](../components/VtxAiTab.tsx) — embedded VTX Agent in the bottom-nav "VTX Agent" tab
- [components/WalletTab.tsx](../components/WalletTab.tsx) — embedded wallet view in the bottom-nav "Wallet" tab
- [components/ProfileTab.tsx](../components/ProfileTab.tsx) — embedded profile in the bottom-nav "Profile" tab
- [components/AlertMonitorProvider.tsx](../components/AlertMonitorProvider.tsx), [components/SessionGuardProvider.tsx](../components/SessionGuardProvider.tsx), [components/PlatformEventMonitor.tsx](../components/PlatformEventMonitor.tsx) — silent background services

**Data sources:** CoinGecko `/global` endpoint (total market cap, 24h volume, BTC dominance), Supabase (via embedded sub-tabs).

**Architecture pattern:**
- **Pure client component** — `'use client'` with `useAuth` gate and `router.replace('/login?from=/dashboard')` if no session.
- **Lazy-loaded sub-tabs** via `React.lazy(() => import(...))` — ContextFeed, MarketDashboard, VtxAiTab, WalletTab, ProfileTab are all code-split. Excellent.
- **Per-tab error boundary** that catches a child error and shows a spinner that auto-resets after 800ms. Clever, but suspicious — silently swallowing errors and pretending to load again is **not** what production code should do; the user never learns the page is broken.
- **Mobile-first bottom-nav** (Home / VTX Agent / Wallet / Profile) plus a hamburger that opens [SidebarMenu](../components/SidebarMenu.tsx) for the "real" navigation tree (35+ pages). The bottom nav is decorative for desktop, primary for mobile.
- **Two top-level tabs on home:** Context Feed (default) and Markets.
- **Welcome notification** fired once per user via `maybeNotifyWelcome(user.email)`.
- **Market stats poll** every 120s direct from the browser to `api.coingecko.com/api/v3/global`. Bypasses our backend.

**Performance characteristics:**
- Direct browser → CoinGecko call exposes our app to CoinGecko's free-tier rate limiting (10–50 req/min per IP) and CORS. Already we're seeing intermittent failures in production.
- 120s poll is fine for `/global` data (changes slowly).
- Lazy-loading the 5 sub-tabs is a real win — initial JS payload is small.
- Error boundary auto-reset masks chunk-load failures (good for UX) but also masks real crashes (bad for diagnostics — Sentry won't see it because the boundary catches it).
- localStorage `steinz_last_tab` restore is a nice touch but eats up to 5ms of main-thread time on every dashboard mount.

**UX quality: 6/10.** Honest read: the dashboard shape is fine but the **density** is wrong for a "homepage." When a logged-in user lands on `/dashboard`, they see 4 generic global crypto stats (market cap, 24h volume, BTC dominance) and a Context Feed of public events. **They see nothing about themselves.** No portfolio value, no positions, no alerts triggered today, no watchlist movement, no recent VTX queries, no whale wallets they follow. For an "intelligence platform" this is a missed opportunity — every page in Nansen and Arkham starts personalized.

The two-tab design (Context Feed / Markets) is OK but feels like a leftover from when those were the only two features. The bottom nav (Home / VTX / Wallet / Profile) suggests this is being designed mobile-first — which is fine, but on desktop it floats unused at the bottom of the viewport.

**Backend quality: 4/10.** There is essentially **no backend for the dashboard homepage.** The market stats poll goes direct to CoinGecko, the welcome notification is local, the sub-tabs each fetch their own data. There is no `/api/dashboard/homepage` aggregation endpoint that returns a single payload of "everything the user needs above the fold." This is a missed opportunity for caching, personalization, and reducing cold-start fan-out.

**What works well:**
- Lazy-loading sub-tabs — modern, fast initial paint.
- Error boundary keeps the page from going white.
- LIVE badge with pulsing green dot is a nice subtle reassurance.
- Bottom nav makes mobile usable.
- Sticky top nav with backdrop blur looks premium.

**What is weak or missing:**
- **No personalization above the fold.** Generic global stats > my own portfolio. This is wrong.
- **Synthetic market stat changes** — `volumeChange: (mcChange * 0.8).toFixed(1)` is **not** the volume change percentage; it's a derived guess. `dominanceChange` is `(btcDom - 50) * 0.1` — also fabricated. We are showing fake numbers labeled as real.
- **No "your day at a glance"** — no PnL line, no alert count, no portfolio sparkline.
- **No surfaced VTX recent queries** ("you asked about $WIF yesterday — here's the update").
- **No watchlist movement** ("3 of your watchlist tokens moved >5% overnight").
- **No notifications digest** ("2 whales you follow made moves").
- **Mobile bottom-nav uses `window.location.href`** for VTX Agent navigation — full page reload instead of soft navigation via `router.push`. Performance regression.
- **The `<div className="flex items-center gap-2">` on the right side of the top nav is empty** — looks like something was removed and left a hole.
- **Error boundary auto-reset hides real Sentry-worthy errors** — should `Sentry.captureException` before swallowing.
- **`maybeNotifyWelcome` runs on every mount even though it's gated internally** — should run once per user lifecycle via `useEffect` with empty deps + a `localStorage.getItem('welcome_shown_v1')` check.

**What feels half-built:**
- The "Chains Tracked: 12+" KPI card is a hardcoded constant in a list of otherwise dynamic stats. The "Live" change indicator on it is misleading.
- The empty `<div>` on the top-nav right hints there was once a search box or notification icon that got removed.
- The Markets tab pulls real data; the Context Feed tab pulls real data; but there is no "Home" tab that aggregates both with personalization. The "Home" pseudo-tab just toggles between Context and Markets.

### B) Industry Standard Comparison

**Nansen:** Dashboard opens to a personalized "Wallet Profiler" stream — addresses you've added are at the top with PnL, recent moves, and aggregated trades from Smart Money you follow. Right-side panel is a global feed of "what's hot." Bottom shows alert digest. The page rewards being logged in.

**Arkham:** The dashboard IS the entity graph. You see the wallets you're tracking, their recent counterparty movement, their portfolio value. There is no "global crypto stats" header — Arkham assumes you already know BTC's price.

**DeBank:** Hyper-personalized. Dashboard is your aggregated portfolio across 60+ wallets and 200+ protocols. Top of page: net worth. Below: per-protocol breakdown. Right: gas tracker. Below: feed of your wallets' recent activity. **Zero generic data.**

**Phantom (mobile app home):** Account selector at top, total portfolio value, quick actions (Send / Receive / Swap / Stake), token list, NFT preview. Personalization first.

**Coinbase (web app home):** Greeting + portfolio value, watchlist movers, recommended products (Earn, Card, Borrow), then a learn section. Half is personalized.

**Pattern:** Every leader in the category opens to **personalized data first.** Generic global stats are decoration, not center stage. Our dashboard inverts this — global first, personal nowhere.

### C) Next-Gen Recommendations

**The "Home" tab should be a personalized digest, not a market data dump.** Specifically:

**Above-the-fold redesign:**
1. **Greeting + portfolio value** — "Good morning, alice" + total balance across all linked wallets (use SIWE-linked wallets from Feature 2 + manually-tracked addresses).
2. **Today's PnL** — real number with sparkline.
3. **Quick actions row** — Send, Swap, Buy, Track Wallet (4 buttons).
4. **Smart-money digest** — 3 most notable moves from wallets the user follows.
5. **Watchlist movers** — top 3 by absolute % change in last 24h.
6. **Alerts triggered today** — count + tap to expand.
7. **VTX recent context** — "You asked about WIF yesterday. Here's an update." (pulled from `vtx_conversations`).

**Replace synthetic stats with real ones.** The 4 KPI cards should source from a single `/api/dashboard/homepage` aggregator endpoint that returns:
```typescript
{
  marketStats: { totalMarketCap, totalVolume, btcDominance, /* all from CoinGecko cached server-side */ },
  portfolio: { totalUsd, change24h, sparkline: number[] },
  alertsTriggered24h: number,
  watchlistMovers: TokenSnapshot[],
  smartMoneyDigest: SmartMoveSummary[],
  vtxRecent: ConversationSnapshot[],
}
```

**Backend changes:**
- Create `app/api/dashboard/homepage/route.ts` that aggregates the above. SSR-friendly, cacheable per-user with `revalidate: 60`.
- Move CoinGecko `/global` call server-side. Cache 5 minutes in Vercel KV. Saves CORS issues + rate limit.
- Compute `volumeChange` and `dominanceChange` properly using a 24h-old snapshot from a `market_stats_history` table (cron-populated).

**Frontend changes:**
- Replace the two-tab header with a personalized scrollable feed.
- Move "Markets" out of the home page and into its own `/dashboard/markets` route — it's a real product that deserves its own URL.
- Replace the bottom-nav `window.location.href` with `router.push` for soft navigation.
- Wire the empty `<div>` on the top-nav right to be a global search box (entity / token / wallet).
- Replace the silent error-boundary auto-reset with a "this section failed — retry" button + Sentry capture.

**New sub-features:**
- **Global search bar** in the top nav — type a token symbol, wallet address, or entity name → instant suggestions.
- **Pinned widgets** — let user customize the homepage like Coinbase pinned cards.
- **"What's new" inline changelog** — small banner when we ship new features (already have `announcements` table from Session 4 — wire it).
- **Daily summary email** opt-in — "your day on Steinz" sent at 9am.

**Performance:**
- Aggregator endpoint should `Promise.all` its fan-out queries with per-source `AbortSignal.timeout(2000)` so a slow CoinGecko call doesn't block the personalized data.
- Use `next/navigation` `prefetch` on the SidebarMenu items (top 5 most-clicked) so secondary navigation feels instant.
- Add `Cache-Control: private, max-age=30` on the homepage aggregator endpoint.

**Mobile:**
- Bottom nav at 4 items is fine but the "Wallet" and "Profile" tabs are both inline embedded components rather than dedicated routes — back-button on mobile gets confusing. Convert all bottom-nav destinations to real routes.

### D) Priority and Effort

- **Current score: 6/10.** Functionally fine but strategically wrong — fails the "make logged-in users feel known" test that defines a category-leading product.
- **Effort to 9/10: Medium (~1.5 weeks).** Mostly UI work + 1 aggregator endpoint + a handful of backing queries.
- **Approach: Upgrade incrementally.** Keep the layout shell, replace the content with personalized sections. Don't rebuild the whole composition.
- **Blocks other features?** No, but it influences perception. A user who sees "your portfolio is up 4.2% today, 2 whales moved your favorite token" forms a different impression than one who sees "BTC dominance: 51.4%."

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Personalized homepage aggregator | `app/api/dashboard/homepage/route.ts` (new) | Reads `wallet_identities`, `watchlist`, `alerts`, `vtx_conversations`, `smart_money_wallets` |
| Replace synthetic market stat changes | `app/dashboard/page.tsx` lines 178–179, new `lib/services/coingecko.ts` server cache | `market_stats_history` table populated by cron edge function |
| Personalized homepage UI | `app/dashboard/page.tsx` (rewrite home tab) | None |
| Move Markets to its own route | `app/dashboard/markets/page.tsx` (new), wire SidebarMenu | None |
| Global search bar | `components/GlobalSearch.tsx` (new), `app/api/search/route.ts` (new) | None (queries DexScreener, Alchemy, Arkham) |
| Pinned widgets | `lib/dashboardWidgets.ts` (new), reuse drag-drop lib | `user_dashboard_widgets` table |
| Wire announcements banner | `components/AnnouncementBanner.tsx` (new) | Existing `announcements` table |
| Daily summary email | `lib/jobs/dailySummaryDigest.ts` (new), Resend template | `email_preferences.daily_summary` flag |
| Bottom-nav uses router.push | `app/dashboard/page.tsx` BottomNav onClick | None |
| Sentry capture in error boundary | `app/dashboard/page.tsx` TabErrorBoundary | None |
| Move CoinGecko call server-side w/ KV cache | `app/api/dashboard/market-global/route.ts` (new) | Vercel KV provisioning |

**Acceptance criteria:** Logged-in homepage shows total portfolio value + today's PnL + 3 personalized sections (smart-money digest, watchlist movers, alerts) above the fold; market stats sourced from server-cached endpoint; no direct browser → CoinGecko calls; global search box returns mixed-type results in <300ms.

---
