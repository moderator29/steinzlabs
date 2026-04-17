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

## Feature 4 — Context Feed

### A) Current State Deep Dive

**Files implementing it:**
- [components/ContextFeed.tsx](../components/ContextFeed.tsx) — 709 lines (the largest single component on the platform)
- [app/api/context-feed/route.ts](../app/api/context-feed/route.ts) — 703 lines (the largest single API route)
- [lib/hooks/useContextFeed.ts](../lib/hooks/useContextFeed.ts) — 169 lines (data hook)
- [components/ChainIcons.tsx](../components/ChainIcons.tsx) — chain badge components
- [app/api/engagement/](../app/api/engagement/) — likes/views/shares persistence

**Data sources (all aggregated server-side in one route):**
- Alchemy `alchemy_getAssetTransfers` (Ethereum large transfers)
- Solana RPC `getSignaturesForAddress` for known whale wallets (network activity)
- pump.fun frontend API (`frontend-api.pump.fun/coins?sort=created_timestamp`) for new Solana token launches
- DexScreener trending (`/latest/dex/tokens/trending`)
- DexScreener token-profiles per chain (Ethereum, Solana, BSC, Avalanche, Polygon)
- DexScreener search-pairs by keyword
- CoinGecko `/simple/price` for ETH/SOL/BNB/MATIC/AVAX USD prices
- 24h supplemental fetch loop that re-pulls each source every 5s with results merged into an in-process `eventStore` Map

**Architecture pattern:**
- **Server-side fan-out aggregator.** Single GET endpoint fans out to ~10 upstream sources via `Promise.all`. Returns up to 200 normalized `WhaleEvent` objects.
- **In-process cache** with two layers:
  - `priceCache` — ETH/SOL/BNB/MATIC/AVAX prices, 60s TTL.
  - `responseCache` — full payload keyed by chain filter, 5s TTL.
  - `eventStore` Map — sticky 72h dedup so events don't disappear on refresh.
- **Client-side hook** (`useContextFeed`) polls the route every ~30s.
- **Client-side filtering** by chain (Solana/Ethereum/BSC/Polygon/Avalanche/Bookmarks/Archive) and by event type (new_coins/volume/trending/info).
- **Engagement persistence** — likes/shares/views go to `/api/engagement` and persist in Supabase.
- **Bookmarks** — local-first then Supabase sync (added Session 4).

**Performance characteristics:**
- Cold cache request: 600ms–2s depending on upstream latency. The 10-source fan-out includes pump.fun which is reliably slow (~1s).
- Warm cache (within 5s): ~10ms.
- 30s client poll = ~2,800 requests per user per 24h. With 1k DAU = 2.8M backend calls/day before factoring in cache hit rate.
- The in-process cache means each Vercel edge instance has its own state — under load, the cache hit rate drops significantly.
- The `eventStore` Map grows unboundedly within a single instance (only pruned at 72h cutoff inside `storeEvents`); under sustained traffic it can leak memory.

**UX quality: 7/10.** Solid execution. The chain filter + type filter combo is good. Like/share/bookmark interactions feel responsive. Animation on like is satisfying. The "share to X" popup is clean. Empty states are decent. The chain icon system gives strong visual differentiation.

**Backend quality: 6/10.** The aggregator does a lot of work but the architecture is shaky. Issues:
- 10 upstream sources hit synchronously on every cache miss. One slow source (pump.fun) blocks the response.
- In-process cache and `eventStore` are per-Vercel-instance — at scale they fragment, costing 5–10x the upstream traffic.
- No distinction between "sources that updated" and "sources that errored" — a CoinGecko outage silently zeros the prices and the page renders with no USD values.
- Hard 5s cache TTL is not aligned with each source's natural cadence (pump.fun new tokens are interesting at 30s freshness, DexScreener trending at 5min).

**What works well:**
- Single normalized `WhaleEvent` shape — clients don't care which source produced it.
- Chain badges are universal and fast.
- Engagement system (likes/views) is wired through to Supabase.
- Bookmarks now sync server-side.
- Sentiment classification — events get tagged BULLISH/BEARISH/HYPE/NEUTRAL which feeds the filter.

**What is weak or missing:**
- **No real-time push.** Polls every 30s. For a "feed" this is the wrong model — leaders use SSE or WebSocket for instant updates.
- **No "since last visit" marker.** User can't tell what's new vs. what they already saw.
- **No event grouping.** Three different sources reporting the same whale move show as three rows. Should merge into one event with multiple confidences.
- **No "follow this token/wallet" inline.** The card has a Like button but not a Follow button.
- **No infinite scroll.** Hard 200-event ceiling per fetch.
- **No pagination cursor.** Can't go back further than the current window.
- **No personalization.** A free user with no follows sees the same feed as a Max user with 50 followed wallets.
- **No "explain this event" inline VTX call.** Wasted integration opportunity.
- **No filter persistence per-user** — chain filter resets to "all" on every reload.
- **`fetchSolanaNetworkActivity` queries hardcoded whale wallets** rather than the seeded `smart_money_wallets` table.
- **In-process `eventStore` is not durable** — Vercel cold start = empty feed for 5s.
- **Filter UI has 6 chain pills + 4 type filters but no search.** Can't find "BONK events from yesterday."
- **No archive query interface** — `archive` mode shows events from `useArchivedFeed` but no date pickers, no source filters.

**What feels half-built:**
- The "Bookmarks" tab is a chain filter but renders the bookmark Set against the current feed — if your bookmarked event aged out of the 200-event window, it disappears. Bookmarks should be queried directly from Supabase by ID.
- The "Archive" tab pulls from `useArchivedFeed` — separate hook, different shape — feels bolted on.
- The synthetic `recentTimestamp()` function returns `new Date().toISOString()` — not actually used for randomization anymore but still in the file.
- `priceCache` has fields for matic/avax that are populated but never displayed in the UI.

### B) Industry Standard Comparison

**Nansen "Wallet Profiler" feed:** Real-time stream of moves by tracked wallets, with sub-second updates. Each event is grouped by wallet — if the same wallet does 5 trades in a minute, you see one collapsed entry. "Mark all read" + per-event "track this wallet."

**Arkham real-time feed:** WebSocket-driven, live. Filters by entity type (exchange / fund / dev / scammer). Each event has a one-click "open in graph" that takes you to the entity-relationship view.

**DeBank feed:** Personalized to your followed addresses. No global feed. Updates every 30s.

**Twitter/X for crypto:** Asymmetric — most users follow 50–500 accounts, see only what's relevant. Algorithmic ranking on top. We have neither.

**TradingView idea stream:** Algorithmically ranked combination of "most viewed in 24h" + "from people you follow" + "from people who agree with your bias." Heavy use of recommender system.

**Pattern:** The leaders all converge on **personalized + real-time + grouped**. We are global + polling + ungrouped. We are 1.5–2 generations behind on this surface.

### C) Next-Gen Recommendations

**Make it a real feed, not a polling dump.**

**Highest leverage:**

1. **Server-Sent Events (SSE).** Convert `/api/context-feed` to stream new events as they're discovered. Client reads via `EventSource`, no polling. The aggregator fan-out continues server-side on a background worker, pushes deltas via SSE channel.
2. **Per-user "for you" ranking.** A simple scoring heuristic: `score = log(valueUsd) + 5*isFollowedWallet + 3*isWatchlistToken + 2*isBookmarkedEvent + freshness_decay`. Initially heuristic; later a real recommender.
3. **Event grouping.** When two events share `(wallet, token, ±5min window)`, collapse to one card with "5 trades, +$2.3M net." Done client-side from the event stream.
4. **"Since last visit" cursor.** Persist `last_seen_event_id` per user; show divider line + count.
5. **Inline VTX "Explain this."** Each event gets a small "?" icon that opens a VTX side panel pre-loaded with `Explain why this event matters: <event JSON>`.
6. **Real bookmarks query.** Bookmarks tab fetches directly from `bookmarks` table joined with `whale_events_archive` (a new persistent table for archived events), not filtered against the current 200-window.

**Backend changes:**
- Convert per-instance `eventStore` Map to **Redis stream** (Upstash). Solves both the per-instance fragmentation and the cold-start emptiness.
- Convert per-instance `responseCache` and `priceCache` to Redis with proper TTLs.
- Persistent `whale_events_archive` table in Supabase — keep 30 days, indexed by `(chain, type, timestamp DESC)` for archive queries.
- Background worker (Vercel cron + serverless) that runs every 60s, fans out to upstreams, writes new events to Redis stream + Supabase.
- SSE endpoint reads from Redis stream and pushes to subscribed clients.
- Per-user score computation via a `feed_personalization` function that joins user follows + watchlist + bookmarks.

**Frontend changes:**
- `EventSource` hook replacing the polling `useContextFeed`.
- "X new events" floating pill at the top when stream produces while user has scrolled down.
- "Mark all read" button updates `last_seen_event_id`.
- Inline "? Explain" → opens drawer with VTX response.
- Persist filter choice per user via `user_preferences.context_feed_filter` JSON.
- Infinite scroll with cursor-based pagination (`?before=<event_id>`).

**New sub-features:**
- **"Follow this wallet from event"** — one-click creates a `wallet_follows` row.
- **"Mute this token"** — hide all events for a token.
- **Daily digest email** — top 10 events per day for users who don't open the app.
- **Mobile push** for high-value events from followed wallets.
- **Embed widget** — public/`/embed/feed?chain=solana` for partners (cf. DeFiLlama embed).

**Performance:**
- Drop the 5s `responseCache` once SSE is in place.
- pump.fun fetch should be moved to a separate background poll (every 30s) and pushed into the stream, not fetched per request.
- All upstream calls should have per-source `AbortSignal.timeout(2000)` — the worst source is currently the floor for the whole response.

**Mobile:**
- Card layout already responsive but the chain filter pills wrap awkwardly on narrow screens — convert to horizontal scroll with `overflow-x-auto`.
- Like/Share buttons too small (`w-3 h-3`) — bump to `w-4 h-4` minimum for touch targets.

### D) Priority and Effort

- **Current score: 7/10.** It works and feels alive — but it's not personalized, not real-time, not grouped. By the standards of Nansen / Arkham this is mid-tier.
- **Effort to 9/10: Large (3 weeks).** SSE infrastructure + Redis + per-user ranking + grouping is a real project. The component itself is healthy; the backend aggregation needs an architectural upgrade.
- **Approach: Hybrid.** Keep the component shell. Replace the data layer (polling → SSE, in-process cache → Redis) and add ranking on top.
- **Blocks other features?** Soft yes. The real-time + Redis infrastructure work here unlocks Whale Tracker real-time, Sniper Bot live detection, and Notifications push. Worth building once.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Provision Redis (Upstash) | infra | `UPSTASH_REDIS_URL` env var |
| Background event worker | `app/api/cron/context-feed-poll/route.ts` (new), Vercel cron config | Writes to Redis stream `events:context-feed` |
| Persistent event archive | `lib/jobs/archive-events.ts` (new) | `whale_events_archive` table |
| SSE feed endpoint | `app/api/context-feed/stream/route.ts` (new) | Reads Redis stream |
| EventSource client hook | `lib/hooks/useContextFeedStream.ts` (new) | None |
| Per-user ranking | `lib/feed/personalize.ts` (new) | Joins `wallet_follows`, `watchlist`, `bookmarks` |
| Event grouping client-side | `components/ContextFeed.tsx` — add `groupEvents` reducer | None |
| "Since last visit" cursor | `app/api/feed/last-seen/route.ts` (new) | `feed_last_seen` table |
| Inline VTX explain | `components/ContextFeed.tsx` — add Explain button + drawer | Reuse `/api/vtx-ai` |
| Real Bookmarks query | `app/api/bookmarks/list/route.ts` (new), refactor `ContextFeed.tsx` bookmarks tab | `bookmarks` join `whale_events_archive` |
| Infinite scroll cursor | `useContextFeedStream.ts` — add `?before=<id>` param | None |
| Per-user filter persistence | Read/write to `user_preferences.context_feed_filter` | Existing `user_preferences` table |
| Daily digest email job | `lib/jobs/daily-event-digest.ts` (new) | Resend template |
| Embed widget | `app/embed/feed/page.tsx` (new) | None |
| Move pump.fun to background poll | Update worker | None |

**Acceptance criteria:** Feed updates appear within 5s of upstream event without page refresh; events from followed wallets / watchlist tokens rank in top 10 of feed for that user; "since last visit" divider appears with accurate count; bookmarks tab works for events older than current window; no direct upstream calls from the SSE endpoint (all reads from Redis stream).

---

## Feature 5 — Market / Trading Page

### A) Current State Deep Dive

**Files implementing it:**
- [app/market/page.tsx](../app/market/page.tsx) — markets index
- [app/market/layout.tsx](../app/market/layout.tsx) — page metadata
- [app/market/prices/page.tsx](../app/market/prices/page.tsx) + [app/market/prices/[tokenId]/page.tsx](../app/market/prices/[tokenId]/page.tsx) (189 lines) — token detail
- [app/market/trade/](../app/market/trade/), [app/market/watchlist/](../app/market/watchlist/) — sub-routes
- [app/dashboard/trading-suite/page.tsx](../app/dashboard/trading-suite/page.tsx) — 155 lines, **a "coming soon" marketing page**, not a real trading suite
- [components/MarketDashboard.tsx](../components/MarketDashboard.tsx) — the live markets table embedded in `/dashboard`
- 27 components in `components/market/` totaling **2,389 LOC** — including TradeTerminal, OrderBook, OrderForm, BuySellModal, AlertModal, CandlestickChart, KeyStatsGrid, PortfolioTable, RecentTradesFeed, TokenDetailHeader, SparklineChart, etc.

**Data sources:** CoinGecko `/coins/markets` for top tokens, DexScreener for pairs/trending, lightweight-charts for OHLCV rendering, Supabase `watchlist` table for user state, our own `useOrderBook` hook (simulated bid/ask depth).

**Architecture pattern:**
- **Hybrid feed** — tier-1 majors come from CoinGecko, long-tail tokens come from DexScreener, normalized into a single `CoinRow` shape.
- **Server-rendered shells, client-rendered tables** — the `app/market/*` routes are mostly thin shells that mount client components.
- **Token detail page** is `app/market/prices/[tokenId]/page.tsx` — client component with category-pill nav + price chart + key stats + holder breakdown + recent trades.
- **TradeTerminal** mounts OrderBook + OrderForm + RecentTradesFeed. The OrderBook is **synthetic** — `useOrderBook` returns derived bid/ask counts from DexScreener `txns.h1.buys/sells`, not real L2 depth.
- **`/dashboard/trading-suite/page.tsx`** is a **marketing landing page for a feature that does not exist** — 6 feature tiles labeled "Advanced Charting / Limit Orders / DCA Bots / Auto-Rebalance / P&L Tracking / Smart Alerts" plus a "coming soon integrations" row.

**Performance characteristics:**
- MarketDashboard loads majors first (10 hardcoded IDs), then DexScreener categories on demand.
- Sparklines (mini 7d charts) come baked into CoinGecko's response — no extra request, but they're SVG paths, not interactive.
- Token detail page does ~5 fetches on mount (price, security, holders, trades, OHLCV). Could be parallelized; currently is, but with no loading skeletons per section, the page jumps as each loads.
- CandlestickChart uses `lightweight-charts` (TradingView's open-source library) — solid choice, ~80KB gzipped, lazy-loaded.

**UX quality: 6/10.** The markets table looks good and responsive. Sparklines are nice. Filters are present (chain, category, search). Token detail page is dense with information. **Two big problems:**
1. The "Trading Suite" card in the sidebar takes you to a marketing page that says "Coming Q2 2026." Promised features (limit orders, DCA bots, auto-rebalance) don't exist. Users will click this once and never again.
2. The OrderBook in TradeTerminal looks like a real order book but is fabricated from DexScreener buy/sell counts. Sophisticated users will spot this immediately.

**Backend quality: 5/10.** Most of the "backend" is direct browser-to-CoinGecko/DexScreener fetches. There is no proxy, no caching, no rate-limit guard. We are exposing our users' IPs to upstream rate limits. Token detail fetches do not share a request — visiting BTC then ETH on a slow network refetches everything.

**What works well:**
- Strong component decomposition — 27 small components are testable and reusable.
- DexScreener integration covers the long tail well.
- Watchlist sync to Supabase (Session 2 work).
- CandlestickChart with fullscreen mode and `lightweight-charts` is pro-grade.
- BuySellModal correctly checks balance for both BUY and SELL (Session 1 fix).
- TokenLogo + ChainIcons unified.

**What is weak or missing:**
- **No real order book** — synthetic from buy/sell counts. Users expecting GMX/Hyperliquid-style depth will be misled.
- **No real recent trades feed** — the TradeTerminal "RecentTradesFeed" generates synthetic entries from DexScreener volume, not actual trades.
- **No multi-timeframe analysis** — CandlestickChart shows one timeframe, no 5m/15m/1h/4h/1d toggle.
- **No drawing tools, no indicators** — CandlestickChart is a passive viewer, not a TA workspace.
- **No limit orders, no stop-loss, no DCA** — promised on `/trading-suite/page.tsx` but not built.
- **No portfolio tab integration** — PortfolioTable component exists but isn't wired into a complete view.
- **No alert creation from chart** — clicking a price level should be able to "set alert at $X."
- **No comparison view** — can't overlay BTC vs ETH on the same chart.
- **No historical OHLCV beyond default range.**
- **No volume profile, no VWAP, no liquidity heatmap.**
- **No watchlist categorization** — single flat list.
- **No "trending" surface** — DexScreener trending is fetched but not prominently displayed.
- **Token detail page has no "wallet positions for this token" tab** — natural integration with portfolio data.
- **Direct browser-to-upstream calls** — CORS-fragile, IP-leaking, rate-limit-fragile.
- **No SSR data on token detail page** — the page is client-rendered, hurting SEO for "ETH price" type queries.

**What feels half-built:**
- `/dashboard/trading-suite/page.tsx` is a feature ad with no underlying feature.
- TradeTerminal looks fully functional but uses fabricated order book data.
- AlertModal exists but the alert-creation flow isn't reachable from common entry points.
- WatchlistGrid + WatchlistEmpty + WatchlistCard suggest a polished watchlist view that isn't fully wired.
- "Buy/Sell" button on token detail opens BuySellModal which then redirects to `/dashboard/swap` — feels disjointed.

### B) Industry Standard Comparison

**CoinGecko / CoinMarketCap:** Best-in-class read-only market data. CoinGecko has 13k+ tokens, every page has SSR for SEO, cached aggregator endpoints, multi-currency, multi-language. Token pages have wallet activity tabs, news feeds, audits. We are at ~25% of feature parity here.

**DexScreener:** Best-in-class for memecoin discovery. Real-time WebSocket updates, trending feeds, multi-chain, paid promotion slots. Token detail pages have everything: pair info, holder distribution, top traders, security score, transactions stream. **Our DexScreener integration is shallow** — we use them as a data source but never expose their richness.

**TradingView (chart):** The reference standard. 100+ indicators, drawing tools, replay mode, ideas/scripts, multi-monitor layouts. We use their lightweight-charts library but expose ~5% of its capability.

**Hyperliquid / GMX (perps):** Real order books, real trades feed, sub-second WebSocket updates. Our TradeTerminal is positioned to look like this but is not.

**Phantom / Trust Wallet (in-wallet markets):** Mobile-first, simple swap UI, no charts, no order books — they aim for the consumer flow. Different niche.

**Pattern:** There are two distinct categories. We are trying to occupy both — "premium analytics" (CoinGecko/Nansen) AND "trading terminal" (Hyperliquid/GMX) — and currently doing neither well. We need to **pick one identity** and execute it.

### C) Next-Gen Recommendations

**Strategic decision required: are we a market data + intelligence platform, or a trading terminal?** This audit recommends the former. Reasoning: building a real order book + live trades feed + matching engine is years of work; we already have momentum on intelligence + insights via VTX/Whale/Bubble Map.

**Highest leverage (assuming "intelligence + trading-as-output" path):**

1. **Remove the synthetic order book.** Replace TradeTerminal's OrderBook with a "Liquidity Distribution" view — actual data from DexScreener's `liquidity` field, broken down by pool. Honest and informative.
2. **Replace synthetic recent trades with real DexScreener pair trades.** They expose this in the pair endpoint but we're not reading the actual transaction list. Or accept that DexScreener doesn't expose individual txn lists and instead show a recent block-explorer link.
3. **Replace `/dashboard/trading-suite` marketing page with a real swap-only entry point** that links to the existing `/dashboard/swap`. Until we build limit orders / DCA / auto-rebalance, the marketing page is a credibility leak.
4. **Server-side proxy + cache for all market data.** New `app/api/market/*` routes wrapping CoinGecko + DexScreener with 30s–5min TTL via Vercel KV. Drops user-facing IP exposure and protects us from upstream rate limits.
5. **SSR token detail pages** for SEO — render the price, market cap, and chain info server-side so we rank for "BTC price" / "ETH price" queries.
6. **Multi-timeframe + indicators on CandlestickChart.** lightweight-charts supports overlays (SMA, EMA, RSI), drawing primitives, and time-scale switches. We use the bare bones.
7. **"Wallet positions" tab on token detail.** Show top 10 wallets holding this token (from Supabase `positions` table for tracked wallets) — leverages our intelligence advantage.

**Backend changes:**
- New `app/api/market/list/route.ts` — proxies CoinGecko `/coins/markets`, KV-cached 30s.
- New `app/api/market/token/[id]/route.ts` — proxies all token detail fetches in one call, KV-cached 60s.
- New `app/api/market/dex-pairs/[chain]/[address]/route.ts` — proxies DexScreener pair detail, KV-cached 15s.
- Add `dex_pair_snapshots` table populated by cron — 5-min rolling snapshots so we can compute proper price/volume changes.
- Move alert creation API to `/api/alerts/create` (already exists from Session 4) and wire CandlestickChart click-to-create-alert.

**Frontend changes:**
- TokenDetailHeader: add "Wallet Positions" tab querying tracked wallets table.
- CandlestickChart: timeframe selector (5m/15m/1h/4h/1d/1w), indicator overlay menu (SMA, EMA, RSI, MACD), draw-trendline tool.
- TradeTerminal: rebrand to "Pair Insights" with Liquidity Distribution + Volume Profile + Top Counterparties.
- MarketDashboard: add "Trending in Smart Money wallets" filter — tokens being bought by wallets in `smart_money_wallets`.
- Watchlist: add categorization (groups), add per-watchlist alerts.

**New sub-features:**
- **Compare mode** — overlay 2–4 tokens on the same chart, normalized.
- **Alerts inline with chart** — drag a horizontal line, set as alert.
- **News + social feed per token** — pull from LunarCrush (already integrated for sentiment) + crypto-panic API.
- **Token screener** — find tokens matching criteria (mcap range, age, holder count, security score).
- **Watchlist sharing** — public read-only watchlists, share link.

**Performance:**
- All market data should hit our backend, never the user's browser → upstream.
- KV cache hit rate target: 90%+.
- Token detail page should have an SSR-rendered "above the fold" section + client-rendered chart + tabs.

**Mobile:**
- The TradeTerminal grid breaks on mobile — OrderBook + OrderForm side-by-side becomes cramped. Stack vertically on `<lg`.
- CandlestickChart needs touch-friendly pan/zoom — currently desktop-mouse-optimized.
- Watchlist grid → list view on mobile.

### D) Priority and Effort

- **Current score: 6/10.** The component library is rich but the underlying data is partly fabricated and the strategic positioning is unclear.
- **Effort to 9/10: Large (3–4 weeks).** This is a multi-week build because the right answer involves removing the synthetic trading terminal aesthetic AND adding real intelligence (wallet positions per token, smart-money buy signals, multi-timeframe charts, screener). The component scaffolding is there — what's missing is the conviction.
- **Approach: Refactor + scope down.** Remove the "Trading Suite" marketing page, replace synthetic data with honest signals, double down on intelligence. Don't try to be Hyperliquid.
- **Blocks other features?** Yes — the strategic decision blocks Sniper Bot positioning (is it a trading product or an intel product?), Pricing tier definition (Pro = trading? or Pro = intel?), and VTX Agent recommendations (does VTX recommend trades?).

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Server-side market data proxy | `app/api/market/list/route.ts`, `app/api/market/token/[id]/route.ts`, `app/api/market/dex-pairs/[chain]/[address]/route.ts` (all new) | Vercel KV |
| SSR token detail page | Convert `app/market/prices/[tokenId]/page.tsx` to server component for above-the-fold | None |
| Replace synthetic OrderBook | `components/market/TradeTerminal.tsx`, new `components/market/LiquidityDistribution.tsx` | None |
| Replace synthetic RecentTradesFeed | `components/market/RecentTradesFeed.tsx` — show DexScreener pair link OR remove | None |
| Remove "Trading Suite" marketing page | Delete `app/dashboard/trading-suite/page.tsx`, remove from SidebarMenu | None |
| Multi-timeframe + indicators on chart | `components/market/CandlestickChart.tsx` rewrite | None (lightweight-charts already in deps) |
| Wallet Positions tab on token detail | `components/market/WalletPositionsTab.tsx` (new) | Query `positions` table for tracked wallets |
| "Trending in Smart Money" filter | `components/MarketDashboard.tsx` — add filter, query `smart_money_wallets` recent buys | None |
| Compare mode | `components/market/CompareMode.tsx` (new) | None |
| Alerts inline with chart | `components/market/CandlestickChart.tsx` — add alert primitive | Reuse `/api/alerts` |
| News per token | `lib/services/cryptopanic.ts` (new) | API key env var |
| Token screener | `app/dashboard/screener/page.tsx` (new) | None |
| Watchlist categorization | `components/market/WatchlistGrid.tsx` | Add `category` column to `watchlist` |
| Mobile responsive TradeTerminal | `components/market/TradeTerminal.tsx` | None |

**Acceptance criteria:** No browser → CoinGecko/DexScreener calls; token detail SSRs price + market cap; CandlestickChart supports 6 timeframes + 4 indicators + trendline draw + click-to-alert; TradeTerminal renamed and shows real liquidity data; the "Trading Suite" marketing page is gone.

---

## Feature 6 — Swap (EVM Standard, EVM Gasless, Solana Jupiter)

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/swap/page.tsx](../app/dashboard/swap/page.tsx) — 1,049 lines (the largest dashboard page)
- [app/swap/page.tsx](../app/swap/page.tsx) — public swap entry point
- [app/api/swap/quote/route.ts](../app/api/swap/quote/route.ts) — 32 lines (0x v2 Allowance Holder)
- [app/api/swap/price/route.ts](../app/api/swap/price/route.ts) — 29 lines (0x indicative)
- [app/api/swap/log/route.ts](../app/api/swap/log/route.ts) — 84 lines (post-swap persistence)
- [app/api/gasless/quote/](../app/api/gasless/quote/) + [submit](../app/api/gasless/submit/) + [status](../app/api/gasless/status/) + [price](../app/api/gasless/price/) — 0x gasless flow
- [lib/services/zerox.ts](../lib/services/zerox.ts) — 0x v2 client (price, quote, gasless price/quote/submit/status, swap-trades, gasless-trades)
- [lib/services/jupiter.ts](../lib/services/jupiter.ts) — Jupiter v6 client (quote, build swap tx, token prices)
- [lib/services/swap.ts](../lib/services/swap.ts) — unified service (`PLATFORM_FEE_BPS = 40`, ~0.4% take rate, getSwapQuote, buildSolanaSwapTx, recordSwapCompletion)

**Data sources / providers:** 0x Protocol v2 API (EVM standard + gasless), Jupiter v6 API (Solana), CoinGecko (price refs), Alchemy (balance reads + EVM tx broadcast).

**Architecture pattern:**
- **Three execution paths:**
  1. **EVM Standard** — get quote from 0x, prompt MetaMask for `eth_sendTransaction`, broadcast on-chain.
  2. **EVM Gasless** — get gasless quote from 0x, sign EIP-712 typed data with MetaMask, submit to 0x relay, poll `/gasless/status` until `confirmed`. Currently enabled for all EVM chains except `solana`, and disabled for native `ETH/MATIC/BNB/AVAX` sells (gas-token can't be gasless).
  3. **Solana** — get Jupiter v6 quote, build swap tx, sign with Phantom (`signAndSendTransaction`).
- **Three wallet sources:**
  1. External EVM wallet (MetaMask) — `window.ethereum`.
  2. External Solana wallet (Phantom) — `window.solana`.
  3. Built-in wallet — encrypted in `user_wallets` table (AES-GCM, Session 4), unlocked with the in-memory `walletSession` key.
- **Platform fee** — 0.4% (40 bps) integrator fee taken via 0x's `integrator_fee` mechanism (revenue tracked in `app/api/analytics/admin/route.ts`).
- **Post-swap logging** — `/api/swap/log` writes to `swap_logs` table.
- **PostHog event** — `track('swap_executed', { from_token, to_token, chain, from_amount, tx_hash })` (Session 4 wiring).
- **PriceImpact / slippage controls** in the UI; defaults to 1% slippage.

**Performance characteristics:**
- 0x quote: ~400–900ms typical.
- Jupiter quote: ~150–400ms (faster than 0x).
- Gasless flow: quote (500ms) → user signs (~3–10s human) → submit (200ms) → poll status until confirmed (5–60s typical).
- Standard EVM swap: quote → user signs → tx broadcast → block confirmation (~12–60s).
- Built-in wallet: AES-GCM decrypt (~50ms with PBKDF2 100k iters) + tx sign + broadcast.

**UX quality: 7/10.** This is one of the strongest pages on the platform. The chain selector + token picker + "From / To" layout is familiar (cf. Uniswap, Jupiter front-ends). Gasless toggle with explanatory copy is good. Auto-detection of which wallet to use (external EVM / Phantom / built-in) is smart. Price impact warning, slippage editor, gas estimate, and refresh button are all present. The success animation is satisfying.

**Backend quality: 7/10.** Honest assessment: this is one of our most professionally-built features. The 0x v2 Allowance Holder pattern is correctly implemented. Gasless flow with EIP-712 + relay polling is correctly implemented. Jupiter v6 integration is clean. The `swap.ts` unification gives us one API surface across chains. The `recordSwapCompletion` writes to a real audit table.

**What works well:**
- Real 0x v2 + Jupiter v6 — current generation routing.
- Gasless that actually works (most competitors don't have this).
- Three wallet sources cleanly switched at runtime.
- AES-GCM for built-in wallet (Session 4 hardening).
- 0.4% integrator fee — reasonable revenue model.
- Sentry instrumentation in catch blocks (Session 4).
- PostHog track on success.
- Chain-aware gasless availability check (correctly disables for native gas-token sells).
- Tx hash + status link to explorer post-confirmation.

**What is weak or missing:**
- **No multi-hop visualization.** 0x and Jupiter both return route plans (token A → B → C through 3 DEXes). We don't surface this — users can't see whether they're going through Uniswap V3 or Curve.
- **No "best price comparison" UI.** Show quotes from 0x AND 1inch AND Jupiter AND Kyber side-by-side; let user pick. Aggregator-of-aggregators.
- **No MEV protection messaging.** Flashbots Protect is in our `lib/services/mev.ts` but isn't surfaced in the UI for standard EVM swaps. Users at risk of sandwich attacks.
- **No price/quote auto-refresh.** Quote expires; user clicks "Swap" with stale price; tx fails or under-fills. Should auto-refresh every 15s with visible countdown.
- **No simulated execution preview.** Tenderly or Anvil-fork sim could show "you'll receive X tokens, this is the actual outcome" before signing. Industry standard at top tier.
- **No batch swaps.** Can't dollar-cost-buy 5 tokens in one transaction.
- **No swap history visible inside the swap page.** Users have to navigate to `/dashboard/transactions`.
- **No "swap from this wallet" preselection** — if a user clicks on a wallet from Wallet Intelligence, the swap page doesn't carry that context.
- **No EIP-2612 permit support.** When a permit is available, we should use it instead of approve+swap (saves a tx).
- **No NFT sweeping support.** Reservoir / OpenSea API integration.
- **No fiat on-ramp.** Can't fund the built-in wallet with a credit card. Moonpay / Stripe Crypto would close the loop.
- **Built-in wallet flow** for swap is gated by the in-memory wallet session key; if the user reloaded since unlocking, the swap silently fails with a generic "wallet session expired" error. Should re-prompt for password inline.
- **Slippage default of 1%** is fine for liquid pairs; should auto-adjust for low-liq tokens (suggest 3–5%).
- **No Solana priority fee tuning.** Jupiter v6 supports `priorityLevelWithMaxLamports` for fast inclusion; we don't use it.

**What feels half-built:**
- The "Solana" support across the broader app suggests SPL token approval / revoke functionality, but the swap doesn't surface this.
- The gasless toggle copy ("Gas paid by us in supported swaps") is misleading — gas isn't paid by us, it's deducted from the trade output.
- `quoteData.gasEstimateUsd` falls back to hardcoded numbers (`$0.001` for Solana, `$0.02` for Base, `$2.40` for ETH) when the quote doesn't include gas — these are stale.

### B) Industry Standard Comparison

**Uniswap web app:** Native L1 routing via Universal Router. Real-time quote auto-refresh every 30s. MEV protection via UniswapX (RFQ + intent-based). Simulation in tenderly built in for pre-execution display. Fiat on-ramp via Moonpay.

**Jupiter (jup.ag):** Best-in-class Solana DEX aggregator UI. Routes shown visually (5 hops through 3 AMMs visualized). Versioned transactions, priority fee selector. Smart wallet integration. Fast (sub-200ms quotes). Limit orders, DCA, and vault accounts all integrated.

**1inch:** Aggregator of aggregators effectively — they show price comparison vs. Uniswap, Sushi, etc. CHI gas tokens used for gas savings. Fusion mode for MEV-protected swaps.

**KyberSwap:** Routes shown as a flow diagram. Per-hop slippage. Gasless swaps via meta-tx.

**Phantom in-wallet swap:** Uses Jupiter under the hood. Polished UI, clear fee display, slippage auto-calc.

**Pattern:** The leaders (a) show routes visually, (b) provide MEV protection by default, (c) auto-refresh quotes with visible countdown, (d) offer pre-execution simulation, (e) offer fiat on-ramp. We have (a) data but not visualization, (b) capability but not UI, (c) no auto-refresh, (d) no sim, (e) no on-ramp.

### C) Next-Gen Recommendations

**Highest leverage:**

1. **Multi-aggregator quote comparison.** New `/api/swap/quotes-multi` route that fans out to 0x, 1inch v6, Kyber, OpenOcean, ParaSwap. Returns 5 quotes, UI shows a table sorted by output amount. User picks; we route through the chosen aggregator. **This makes us strictly better than any single-aggregator UI.**
2. **MEV protection toggle.** When enabled on EVM, route through Flashbots Protect RPC. Show a green shield icon. Auto-enable for swaps > $10k.
3. **Quote auto-refresh.** 15s countdown with visible progress; swap button disabled in last 3s of countdown.
4. **Tenderly simulation pre-execution.** Server-side simulate, return `expected_received` + `actual_outcome_match`. Show user "Simulated outcome: 1234 USDC (0.02% deviation from quote)."
5. **Visual route display.** Component `<RouteFlow>` that renders the multi-hop path with DEX logos.
6. **Solana priority fee selector.** Three buttons: "Slow / Normal / Fast" mapping to dynamic priority lamports.
7. **EIP-2612 permit support.** Detect token permit support, use signature-based approval instead of two transactions.
8. **Fiat on-ramp.** Moonpay or Stripe Crypto integration → buy USDC with credit card → flow into swap.
9. **Inline swap history.** Last 5 swaps shown below the swap form, click to repeat.

**Backend changes:**
- `app/api/swap/quotes-multi/route.ts` — fan-out aggregator.
- `app/api/swap/simulate/route.ts` — Tenderly integration with API key in env.
- `lib/services/oneinch.ts`, `lib/services/kyber.ts`, `lib/services/openocean.ts`, `lib/services/paraswap.ts` — new clients.
- `lib/services/flashbots.ts` — Protect RPC wrapper.
- `lib/services/moonpay.ts` — fiat on-ramp.
- Rate-limit guard on `/api/swap/quote` per user — currently unbounded, expensive.

**Frontend changes:**
- Replace single quote display with quote comparison table (collapsed by default, expandable).
- Add MEV shield toggle next to gasless toggle.
- Add countdown timer ring around the "Swap" button.
- Add `<RouteFlow>` component showing path.
- Add priority fee selector (Solana only).
- Re-prompt for wallet password inline when built-in session expired.
- Show last 5 swaps inline.

**New sub-features:**
- **Swap recipes** — "Buy these 3 tokens at this allocation" → batch into 1 click.
- **Repeat swap** — "do it again with same params."
- **Reverse swap** — "sell what I just bought."
- **Limit orders via Jupiter or 0x.** Both APIs support it; we don't expose it.
- **DCA** via Jupiter Vaults integration on Solana, or 0x scheduled-orders on EVM.

**Performance:**
- Cache token metadata (decimals, logo) in Redis for 24h. Currently every swap re-fetches.
- Prefetch `/api/swap/price` on amount change with debounce 300ms; only fetch `/api/swap/quote` (heavier) when user clicks Swap.

**Mobile:**
- Token picker modal currently overflows on iPhone SE — needs `max-h-[80vh] overflow-y-auto`.
- Slippage editor "Custom" input keyboard should be `inputMode="decimal"`.

### D) Priority and Effort

- **Current score: 7/10.** Genuinely solid. The 3-path architecture, gasless, AES-GCM built-in wallet, integrator fee — these are all done correctly.
- **Effort to 9/10: Medium-Large (2.5–3 weeks).** Multi-aggregator comparison + MEV + sim + visual route = bulk of the work.
- **Approach: Layer on, don't rebuild.** The execution path is correct. Add the comparison layer, the protection layer, the visualization layer.
- **Blocks other features?** No — but the platform fee revenue depends on swap volume, which depends on UX quality. This is a revenue feature.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Multi-aggregator quote comparison | `app/api/swap/quotes-multi/route.ts` (new), `lib/services/oneinch.ts`, `kyber.ts`, `openocean.ts`, `paraswap.ts` (all new) | 1inch, Kyber, OpenOcean, ParaSwap API keys |
| MEV protection toggle | `app/dashboard/swap/page.tsx`, `lib/services/flashbots.ts` (new) | Flashbots Protect RPC config |
| Quote auto-refresh | `app/dashboard/swap/page.tsx` — countdown timer + interval | None |
| Tenderly simulation | `app/api/swap/simulate/route.ts` (new), `lib/services/tenderly.ts` (new) | Tenderly API key |
| Visual route display | `components/swap/RouteFlow.tsx` (new) | None |
| Solana priority fee selector | `app/dashboard/swap/page.tsx` | Jupiter v6 already supports it |
| EIP-2612 permit support | `lib/services/permit.ts` (new), wire into swap flow | None |
| Fiat on-ramp | `lib/services/moonpay.ts` (new), `components/swap/FiatOnRamp.tsx` (new) | Moonpay API key |
| Re-prompt wallet password inline | `app/dashboard/swap/page.tsx`, modal component | None |
| Inline swap history | `app/dashboard/swap/page.tsx` — query `swap_logs` for last 5 | Existing `swap_logs` |
| Limit orders | `app/dashboard/swap/limit/page.tsx` (new) | Jupiter limit-order or 0x scheduled-orders |
| DCA orders | `app/dashboard/swap/dca/page.tsx` (new) | Jupiter Vaults |
| Per-user quote rate limit | `app/api/swap/quote/route.ts` middleware | Redis |
| Token metadata cache | `lib/cache/tokenMetadata.ts` (new) | Redis 24h |

**Acceptance criteria:** Multi-aggregator comparison functional with at least 3 sources; MEV-protected EVM swap routes through Flashbots when enabled; quote auto-refreshes every 15s with countdown; Tenderly simulation result shown before signing; multi-hop route visually rendered; Solana priority fee selector functional; EIP-2612 permits used when token supports them.

---

## Feature 7 — VTX Agent (AI Chat, Token Cards, Swap Cards, Wallet Analysis)

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/vtx-ai/page.tsx](../app/dashboard/vtx-ai/page.tsx) — 853 lines (the dedicated VTX page)
- [components/VtxAiTab.tsx](../components/VtxAiTab.tsx) — 1,135 lines (embedded VTX in the dashboard bottom nav)
- [app/api/vtx-ai/route.ts](../app/api/vtx-ai/route.ts) — 969 lines (the largest API route on the platform)
- [app/api/vtx/conversations/route.ts](../app/api/vtx/conversations/route.ts) — Supabase persistence (Session 4)
- [components/vtx/TokenCard.tsx](../components/vtx/TokenCard.tsx) + [SwapCard.tsx](../components/vtx/SwapCard.tsx) — rich-output components
- [lib/services/anthropic.ts](../lib/services/anthropic.ts) — Anthropic SDK wrapper, tool definitions, advisor pattern
- [lib/services/arkham.ts](../lib/services/arkham.ts), [goplus.ts](../lib/services/goplus.ts), [coingecko.ts](../lib/services/coingecko.ts), [dexscreener.ts](../lib/services/dexscreener.ts), [alchemy.ts](../lib/services/alchemy.ts), [alchemy-solana.ts](../lib/services/alchemy-solana.ts), [lunarcrush.ts](../lib/services/lunarcrush.ts) — data sources VTX queries

**Data sources (via tool use):** GoPlus (token security), CoinGecko (market data), DexScreener (pair search), Alchemy (EVM token meta + holder count + contract code), Alchemy Solana (SPL meta + supply), LunarCrush (social sentiment), Arkham (entity labels + address intel + holders). 9 named tools defined in `VTX_TOOLS`.

**Architecture pattern:**
- **Anthropic Claude (`claude-sonnet-4-6`) with tool use**, max 5 tool iterations per query (`MAX_TOOL_ITERATIONS = 5`).
- **Two execution modes**: streaming (`vtxStream`) for real-time UI, non-streaming (`vtxQuery`) for tool-rich completions.
- **Custom "advisor" sub-tool** named `advisor` (max 2 uses) — appears to be a recursive sub-LLM call for second opinions.
- **System prompt** is a 100+ line carefully crafted instruction set: defines VTX as "the most advanced crypto intelligence agent," enforces "use ONLY real-time data" rule, sets personality, lists capabilities, defines token-card output format, defines security-analysis format, defines AI-analysis format. The prompt is tier-aware (free/pro/max) and personality-aware (professional/degen/conservative/neutral).
- **Address detection** — regex-based detectors for EVM (`0x[a-fA-F0-9]{40}`) and Solana (base58 32–44 chars). Routes to `wallet_profile` or `token_security_scan` automatically.
- **Chart-signal detection** — natural language patterns like "show me the price chart of ETH" produce a `chartType: 'price' | 'bubble' | 'portfolio' | 'holders'` flag; UI renders the appropriate chart component.
- **Arkham intent detection** — phrases like "who is..." trigger `entity_lookup`.
- **Rate limiting** — `FREE_TIER_LIMIT = 25` per 24h per IP, **stored in an in-process Map** (broken at scale).
- **Token cards** — when a token is discussed, the route builds a `tokenCard` object from DexScreener data and returns it alongside the text reply.
- **Conversation persistence** — Session 4 added `/api/vtx/conversations` to sync chat history to Supabase.
- **Response sanitizer** — `sanitizeVtxResponse(scrubBranding(fullText))` strips markdown (`**`, `*`, `—`, `#`, backticks) so output is plain text.
- **Settings** — personality, depth, risk appetite, default chain, language, web search, focus mode, message sound; stored in localStorage `vtx_settings` and synced to `user_display_preferences` (planned).

**Performance characteristics:**
- Simple query (no tools): 600ms–2s.
- Token analysis (1–3 tool calls): 3–8s.
- Deep wallet profile (4–5 tool calls + advisor): 8–20s.
- Streaming SSE response keeps perceived latency low even for long answers.
- The 5-iteration tool loop can occasionally hit timeout on Vercel's 60s function limit when one of the underlying APIs (GoPlus, Arkham) is slow.

**UX quality: 8/10.** Honest read: this is the **strongest single feature on the platform**. The chat UI is polished, token cards are visually rich, the chart auto-detection is impressive, the personality presets give it character. The "Web Search," "Focus Mode," and "Auto Charts" toggles feel like a real product. The conversation history with date-grouped sidebar is well-built. Tier gating (free 25/day, pro unlimited) is clean.

**Backend quality: 8/10.** This is genuinely well-engineered. Tool-use orchestration is correct. Multi-source data integration is the right architecture. The system prompt is thoughtful. Sentry capture wraps the top-level catch (Session 4). The chart-signal regex is clever and works. **Two issues prevent a 9:** (1) in-process rate-limit cache fragments across instances (broken at >1 Vercel instance); (2) the 5-iteration cap with no graceful degradation can leave the user with a half-finished answer.

**What works well:**
- Real Anthropic tool use, not fake "AI."
- Multi-source data fusion (security + market + entity + social).
- Address auto-detection routes to the right tool.
- Streaming SSE keeps UI responsive.
- Personality presets actually change tone.
- Tier-aware system prompt.
- Token card + chart side-rendering.
- Plain-text output by default (Session 4 — no markdown clutter).
- Conversation history with Supabase sync (Session 4).
- Sentry instrumentation.

**What is weak or missing:**
- **In-process rate limit doesn't scale.** With 2+ Vercel instances, free users effectively get 50/day. Move to Redis.
- **No conversation memory across sessions.** The system prompt does not include prior conversation summary; user has to re-explain context every time.
- **No user-specific knowledge.** VTX doesn't know "user follows wallet X, watchlists tokens Y, has $Z portfolio." It's a stateless oracle.
- **No proactive notifications.** VTX should be able to ping the user: "you asked about WIF yesterday; it just dropped 30% on $WALLET sell pressure."
- **No "save this answer" / pin / bookmark.** Conversations are scrolling history; you can't surface a great VTX response as a permalink.
- **No image input.** User can't paste a chart screenshot and ask "what does this look like?"
- **No file attachment.** User can't drop a CSV of addresses for batch analysis.
- **No voice input/output** despite Anthropic + ElevenLabs integration being trivial.
- **No "show me how you got this answer" / source citations.** The token cards show the data but the prose doesn't cite which tool produced which fact.
- **5-iteration cap with no fallback** — when hit, the user sees an incomplete answer with no explanation.
- **No A/B testing of system prompts.** We can't measure "did personality=degen produce better engagement?"
- **No model fallback.** When Claude is down, the entire feature is dead.
- **No streaming token cards** — token card appears at the very end as a discrete object, not progressively as the LLM mentions tokens.
- **No "just trades" mode** — VTX always wants to explain; sometimes a user just wants a swap suggestion. Should have a "concise" depth.
- **No web search tool** despite the `webSearch` toggle in settings — the toggle is decorative.
- **Swap card / token card is one-way** — user can't say "modify this swap card to use 2x the amount."
- **Free tier 25/day** is generous-but-IP-based, so a user behind CGNAT shares quota with neighbors.

**What feels half-built:**
- The "Web Search" setting toggle has no implementation.
- The "Message Sound" toggle plays a chime but the chime is a Web Audio API beep, not a real notification sound.
- The `advisor` sub-tool is defined but unclear how often it actually triggers in production.
- Charts can be rendered inline (`chartType`) but the chart components don't fully match the discussed token in 100% of cases — there's a chart-token vs. discussed-token mismatch on edge cases.
- Conversation history sidebar lists by date but doesn't search.
- "Focus Mode" is a setting but not visibly different from default.

### B) Industry Standard Comparison

**ChatGPT-4 with Code Interpreter (general AI):** Tool use, file uploads, image input/output, web browsing, persistent memory across sessions, custom GPTs. The bar is set very high.

**Perplexity Finance:** AI-first finance research. Cites sources inline with footnotes. Streaming with progressive enrichment. Web search built in.

**Bloomberg Terminal AI features:** Constrained to financial data, but very high-quality citations. Pre-canned prompts ("show me earnings surprises this week"). Voice input.

**Nansen "AI summary" (recently launched):** Limited to portfolio summaries. Fast (sub-2s). No tool use; just a wrapper around their data with GPT-4.

**Arkham Intelligence "Ask Arkham" beta:** Conversational search over their entity graph. Returns links to entity pages, not free-form prose. Less ambitious than us, but very accurate.

**Goose / Cursor (dev agents):** Long-running agentic loops with full tool transparency — user sees every tool call, every retry, every failure. Source-cited output by default.

**Pattern:** The leaders in domain-specific AI agents (Perplexity, Bloomberg, Arkham) are **citation-first** and **fast**. The leaders in general AI (ChatGPT, Claude.ai) are **multimodal** (image, file, voice) and **memory-aware**. We currently score above-average on tool use and presentation, below average on multimodal + citations + memory.

### C) Next-Gen Recommendations

**Highest leverage:**

1. **Per-user memory.** Maintain a compact "user profile summary" in `user_vtx_memory` (50–500 tokens) auto-updated after every conversation. Inject into system prompt. Suddenly VTX knows: "this user follows ETH whales, watches AI tokens, prefers concise answers." Massive UX upgrade.
2. **Move rate limit to Redis.** Critical scale fix.
3. **Source citations.** Every claim VTX makes should be footnoted with the source tool ("Price: $123 [DexScreener, 30s ago]"). Implement by post-processing the streaming output to insert footnote markers when a tool result is referenced.
4. **Real web search tool.** The setting exists; wire it. Use Brave Search API or Tavily.
5. **Image input.** Let users paste chart screenshots; route to Claude's vision API. "What pattern is this?" is a killer crypto query.
6. **File attachment.** Let users drop a CSV of addresses for batch analysis.
7. **Streaming token cards.** When the LLM mentions a token, immediately fire a side-channel query for the token card and render it inline as it's available — don't wait for end of response.
8. **Proactive VTX nudges.** Background job that scans yesterday's conversations, finds tokens/wallets the user asked about, checks for material updates (price move > 10%, whale move, security flag change), sends an in-app notification.
9. **Conversation summaries** for long histories; auto-collapse to summaries after 50 messages.
10. **Saved answers** — pin button on any assistant message, lives in `vtx_saved_answers`.
11. **Voice input** via Web Speech API (free, in-browser). Voice output via ElevenLabs (paid) or browser TTS (free).
12. **A/B test system prompts.** Track per-prompt-variant: response length, user thumbs-up rate, follow-up question rate.
13. **Model fallback.** When Anthropic is down, fall back to OpenAI GPT-4 with a translated system prompt. Or to a smaller Anthropic model.

**Backend changes:**
- New `user_vtx_memory` table — `(user_id, summary, last_updated)`.
- Background job `lib/jobs/vtx-update-memory.ts` — runs nightly, summarizes the user's recent conversations into the memory blob.
- Move rate limit from `rateLimitStore` Map to Redis with INCR + EXPIRE.
- New `app/api/vtx-ai/citations/route.ts` — internal helper that converts tool calls to footnote spans.
- New `lib/services/braveSearch.ts` or `tavily.ts`.
- New `lib/jobs/vtx-proactive-nudges.ts` — scans `vtx_conversations` for user's followed entities, checks for material updates, dispatches via notification system.
- `lib/services/anthropicVision.ts` — image input handler.

**Frontend changes:**
- Drag-drop zone in chat input for images and CSVs.
- Source-citation inline footnote rendering with hover popover.
- Saved answers panel in sidebar.
- Voice input button (mic icon) + voice output toggle.
- "VTX is thinking…" with visible tool call display ("Calling token_security_scan…").
- Long conversation auto-collapse with summary.
- Suggestion chips below input ("Recent: WIF analysis, ETH whales, BONK security").

**New sub-features:**
- **VTX-curated daily brief** — every morning, VTX generates a personalized 5-bullet brief: market context + your portfolio moves + your followed wallets' actions + your watchlist changes.
- **VTX-driven swap suggestions** — when the user asks about a token, VTX can proactively offer "want me to draft a swap?" → returns SwapCard.
- **VTX-driven alert suggestions** — "I noticed you ask about WIF a lot. Want me to set a price alert?"
- **VTX-as-research-assistant** — "Write me a 1-paragraph thesis on why I should hold this token" → citation-rich.
- **Public shareable VTX answers** — pin a great answer, share `/vtx/answer/<id>` publicly. SEO + virality.

**Performance:**
- Pre-warm Anthropic SDK at module load (Vercel cold-start cost ~200ms).
- Cache tool results for 60s with proper invalidation — same user asking "is BTC bullish?" 3 times shouldn't re-hit GoPlus 3 times.
- Use `claude-haiku-4-5` for the chart-detection regex pre-check (faster, cheaper); only use sonnet for the main response.

**Mobile:**
- Conversation sidebar — convert to swipe-from-left drawer.
- Token cards stack vertically below chat on mobile.
- Voice input is a huge win on mobile.

### D) Priority and Effort

- **Current score: 8/10.** Genuinely strong feature, our differentiator. Above the median for AI-first crypto products.
- **Effort to 9/10: Medium (2 weeks).** Per-user memory + Redis rate limit + citations + proactive nudges = the main wins. Voice + image input is another week.
- **Approach: Layer enhancements on a healthy foundation.** Don't rebuild — extend.
- **Blocks other features?** No — VTX is the platform's unique advantage. It enables everything else (it can drive swaps, suggest alerts, explain entities). The more we invest here, the more leverage every other feature gets.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Per-user memory | `lib/jobs/vtx-update-memory.ts`, inject into `app/api/vtx-ai/route.ts` system prompt | `user_vtx_memory` table |
| Move rate limit to Redis | `app/api/vtx-ai/route.ts`, `lib/cache/redis.ts` | Upstash Redis |
| Source citations | `lib/vtx/citations.ts` (new), wire into streaming response | None |
| Brave / Tavily web search tool | `lib/services/braveSearch.ts`, add `web_search` to `VTX_TOOLS` | Brave or Tavily API key |
| Image input (vision) | `lib/services/anthropicVision.ts`, drag-drop UI | None (Anthropic SDK supports it) |
| File attachment (CSV) | `app/api/vtx-ai/upload/route.ts` (new) | Vercel Blob storage |
| Streaming token cards | Refactor `app/api/vtx-ai/route.ts` to fire side-channel token-card fetch on first mention | None |
| Proactive nudges | `lib/jobs/vtx-proactive-nudges.ts` (new), Vercel cron | Reuse notifications system |
| Saved answers | `vtx_saved_answers` table, `app/api/vtx/saved/route.ts` (new) | New table |
| Voice input + output | `components/vtx/VoiceInput.tsx`, `lib/services/elevenlabs.ts` (optional) | None for input; ElevenLabs for output |
| A/B test prompts | `lib/vtx/promptVariants.ts`, log variant in `vtx_conversations.metadata` | Add `prompt_variant` column |
| Model fallback | `lib/services/anthropic.ts` — try sonnet, on 5xx try opus, on timeout try OpenAI | OpenAI API key |
| Tool result cache | `lib/cache/toolResults.ts` (new) | Redis |
| VTX daily brief | `lib/jobs/vtx-daily-brief.ts` (new) | Reuse Resend |
| Public shareable answers | `app/vtx/answer/[id]/page.tsx` (new) | Reuse `vtx_saved_answers` |

**Acceptance criteria:** Per-user memory injected and visibly improves response quality (e.g., "based on your tracked wallets..."); rate limit shared across instances; every fact in VTX response is citable to a tool call; image input accepts a chart screenshot and Claude responds with pattern analysis; proactive nudge delivered for at least one followed-wallet event; saved answers pinnable and shareable.

---

## Feature 8 — Wallet Intelligence (EVM and Solana)

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/wallet-intelligence/page.tsx](../app/dashboard/wallet-intelligence/page.tsx) — 1,120 lines
- [app/api/wallet/route.ts](../app/api/wallet/route.ts) — main wallet intel endpoint (likely)
- [app/api/wallet/approvals/](../app/api/wallet/approvals/), [history/](../app/api/wallet/history/) — sub-endpoints
- [lib/services/evm-intelligence.ts](../lib/services/evm-intelligence.ts) — `buildEvmWalletIntelligence` aggregator
- [lib/services/solana-intelligence.ts](../lib/services/solana-intelligence.ts) — `buildSolanaWalletIntelligence` + `normalizeSolanaTransactions`
- [lib/services/alchemy.ts](../lib/services/alchemy.ts) — token balances, transfers, contract code
- [lib/services/alchemy-solana.ts](../lib/services/alchemy-solana.ts) — SPL meta + supply

**Data sources:** Alchemy (EVM token balances, asset transfers, contract code, ETH balance), Alchemy Solana (SOL balance, SPL holdings), CoinGecko (USD prices), Etherscan/Bscscan/Basescan (tx history fallback), DexScreener (price refs for long-tail tokens), Arkham (entity labels).

**Architecture pattern:**
- **One unified UI** for both EVM and Solana — chain auto-detected from address format. Same `WalletData` shape rendered for both.
- **Server-side aggregation** in `buildEvmWalletIntelligence` / `buildSolanaWalletIntelligence` — fans out to balance, holdings, transfers, USD pricing in parallel.
- **Client-side state** for `WalletData` plus an "expanded transactions" toggle.
- **Tabbed view**: Wallet | Contract (so the same page also handles contract addresses).
- **Recent transactions** rendered with type, asset, value, from/to.

**Performance characteristics:**
- A wallet with 30+ tokens fans out to 30+ price lookups; without batching this is slow (3–6s).
- Token logos are URL strings from CoinGecko + Alchemy enrichment — hit-or-miss; unknown tokens show generic placeholder.
- No caching — every search retrieves fresh data, even if the same address was queried 10 seconds ago.
- Transaction history limited to 15–50 most recent.

**UX quality: 6/10.** The page is information-dense and looks credible. The chain auto-detection is nice. The holdings table renders well. **Weaknesses:** no PnL view, no portfolio over time chart, no realized vs. unrealized breakdown, no comparison ("show this wallet's behavior vs. a benchmark wallet"), no copy-trade button, no "follow this wallet" inline action, no entity label display ("this is Binance Hot Wallet 14"), no smart-money badge, no risk score, no related wallets.

**Backend quality: 6/10.** The aggregation pattern is correct. Multi-chain support is real. Two real issues: (1) **no caching layer** — the same wallet is re-fetched on every page view, costing Alchemy compute units; (2) **no historical snapshots** — we can show "current portfolio" but not "this wallet's PnL over 30 days" because we don't snapshot.

**What works well:**
- One unified UI for EVM + Solana.
- Real Alchemy data (not mock).
- Token logo enrichment via CoinGecko + Alchemy.
- Transaction list with type/asset detection.
- Contract tab as a secondary mode.
- Multiple chains supported (ETH, Base, Polygon, Avalanche, BSC, Solana).

**What is weak or missing:**
- **No PnL.** Cannot tell from the wallet view whether this wallet is up or down on its positions. This is table-stakes for Nansen, Arkham, DeBank, Zerion.
- **No portfolio history chart.** Just the snapshot.
- **No transaction labeling.** Transfers don't say "swapped on Uniswap" or "received from Coinbase."
- **No entity label integration.** Arkham labels are integrated into VTX but not into Wallet Intelligence.
- **No DeFi position discovery.** Wallets with positions in Aave, Curve, Compound, Pendle, EigenLayer show only token balances, not the actual underlying position.
- **No NFT holdings.** Crypto-native users have meaningful NFT positions that we ignore.
- **No staked/locked balance.** ETH staked via Lido, Solana staked via JitoSOL — not shown.
- **No "follow this wallet" inline action.**
- **No "copy this trade" inline action.** Should connect to swap.
- **No related wallets** ("this wallet has high transfer activity with 0xABC, 0xDEF").
- **No alert creation from wallet view** ("alert me when this wallet sends > $10k").
- **No DNA badge** linking to the DNA Analyzer for that wallet.
- **No smart-money badge** even when the wallet is in `smart_money_wallets`.
- **No counterparty visualization.**
- **Search-only flow.** Cannot browse a list of "wallets I'm tracking."
- **No saved searches / recent searches.**
- **No comparison view** ("this wallet vs. that wallet").

**What feels half-built:**
- The "Contract" tab is present but is essentially a duplicate of Contract Analyzer functionality.
- The 1,120-line page does a lot but every interesting action ends in a dead end (no follow, no alert, no copy-trade).
- Transactions list shows raw transfer data without trade-DNA classification (despite DNA Analyzer existing as a separate feature).

### B) Industry Standard Comparison

**Nansen Wallet Profiler:** Real PnL across all positions, normalized to USD over time. Per-token entry/exit prices. Holding-period analysis. Trade DNA classification. Entity labels. Counterparty graph. "Follow" button that wires into their alert system. The reference standard.

**Arkham Wallet:** Identity attribution at the top ("This wallet is owned by Jane Smith of Polychain Capital"). Position list with PnL. Network of related wallets visualized. Transaction history with full counterparty entity labels. One-click "subscribe to alerts."

**DeBank:** Multi-chain aggregation across 60+ chains. DeFi protocol position discovery (Aave deposits, Curve LP, etc). Net worth chart over time. Realized/unrealized PnL. NFT holdings. Multi-wallet aggregation under one user.

**Zerion:** Best mobile UX. All EVM chains. NFT-native. Per-protocol breakdown. PnL chart.

**Etherscan/Solscan:** Best block explorer view. Comprehensive but raw — no PnL, no analysis layer. Free.

**Pattern:** The leaders all have (a) PnL, (b) DeFi position discovery, (c) NFT support, (d) historical chart, (e) entity labels, (f) action buttons (follow, alert, copy). We have none of these. We are essentially "Etherscan with a CoinGecko price overlay" right now — credible but not differentiated.

### C) Next-Gen Recommendations

This is one of the most under-realized features on the platform given the data we already have access to.

**Highest leverage:**

1. **Portfolio history snapshots** — daily cron snapshots `(wallet_address, date, holdings_json, total_usd)` into `wallet_portfolio_snapshots`. Power a 30/90/365-day chart.
2. **PnL calculation** — for each token in current holdings, find acquisition price from transaction history, compute current value, derive realized + unrealized PnL.
3. **DeFi position discovery** — integrate Zerion API or DeBank API (yes, paid) for protocol position discovery. Or build per-protocol adapters for the top 10 (Aave, Compound, Curve, Lido, Pendle, EigenLayer, Uniswap V3 LPs, Maker, Convex, Yearn).
4. **NFT holdings** — Alchemy NFT API (free up to a point) or Reservoir API. Show top 5 collections + total floor value.
5. **Entity label overlay** — wire Arkham labels at the top: "This wallet is labeled: Binance 14 (Exchange Hot Wallet)."
6. **Transaction labeling** — classify each tx via heuristics or via VTX: "Swap (Uniswap V3): 1 ETH → 2,400 USDC at $2,400/ETH."
7. **Action buttons** — Follow, Alert, Copy Trade, Open in Bubble Map, Open in Network Graph. Wire to existing infrastructure.
8. **Smart-money badge + DNA archetype display** — when wallet is in `smart_money_wallets` or `wallet_dna_archetypes`, surface that.
9. **Tracked wallets list** — left panel with user's followed wallets, click to load each.
10. **Wallet comparison** — split-pane view of two wallets side-by-side.

**Backend changes:**
- New `wallet_portfolio_snapshots` table — keyed `(wallet_address, snapshot_date)`. Cron job populates daily for tracked wallets only (not every queried wallet, that's too expensive).
- New `wallet_pnl` table — pre-computed per-(wallet, token) realized/unrealized.
- New `lib/services/zerion.ts` (already partially exists) for DeFi positions.
- New `lib/services/alchemyNfts.ts` for NFT holdings.
- New `lib/jobs/wallet-snapshot-daily.ts` cron job.
- Cache wallet intelligence results in Redis for 60s — same wallet queried twice in a minute should not re-fan-out.

**Frontend changes:**
- New tab structure: Overview | Holdings | DeFi | NFTs | History | Activity.
- Portfolio chart at the top of Overview tab.
- Entity badge under wallet address.
- Action button row: Follow • Alert • Copy Trade • Bubble Map • Network Graph • DNA.
- Tracked wallets sidebar.
- Each transaction row gets a labeled type ("Swap", "LP Deposit", "Lend", "Stake", "NFT Mint", etc).

**New sub-features:**
- **"Mirror this portfolio"** — generate swap recipe to replicate this wallet's allocation, scaled to the user's budget.
- **"Find similar wallets"** — query `wallet_dna_archetypes` for wallets with same archetype + similar holdings.
- **"Counterparty network"** — graph of top 10 counterparties this wallet has transferred to/from.
- **Public shareable wallet pages** — `/w/<address>` SEO-friendly entry, free traffic from "[ADDR] etherscan" searches.

**Performance:**
- 60s Redis cache.
- Pre-compute snapshots only for tracked wallets — don't snapshot every querying user's random search.
- Multi-chain aggregation should `Promise.all` per-chain, not sequential.

**Mobile:**
- Tabs become a horizontal scroll on mobile.
- Portfolio chart sized to a 16:9 aspect ratio.

### D) Priority and Effort

- **Current score: 6/10.** Functional but generic. The data is there, the actionability is not.
- **Effort to 9/10: Large (3–4 weeks).** PnL + portfolio history + DeFi + NFTs + entity labels + action wiring is a substantial build. PnL alone is multi-day work because acquisition-cost calculation is non-trivial.
- **Approach: Layer on without rewriting the page.** Add tabs, add backing data, wire actions.
- **Blocks other features?** Yes. Portfolio (Feature 28) cannot be world-class without this. Smart Money (Feature 13) wallet drill-down ends here. Network Graph (Feature 15) and Bubble Map (Feature 12) refer back. This is plumbing for the rest of the intelligence suite.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Daily portfolio snapshot cron | `lib/jobs/wallet-snapshot-daily.ts` (new), Vercel cron | `wallet_portfolio_snapshots` |
| PnL calculation | `lib/services/pnl.ts` (new) | `wallet_pnl` table |
| Portfolio history chart | `components/wallet/PortfolioChart.tsx` (new) | None |
| DeFi position discovery | `lib/services/defiPositions.ts` (Zerion or per-protocol) | Zerion API key |
| NFT holdings | `lib/services/alchemyNfts.ts` (new) | None |
| Entity label overlay | `app/dashboard/wallet-intelligence/page.tsx` — call `getEntityLabel` from arkham service | Existing |
| Transaction labeling | `lib/services/txClassifier.ts` (new) | None (heuristics + VTX call) |
| Action buttons (Follow/Alert/Copy Trade) | `components/wallet/WalletActions.tsx` (new) | Reuse `wallet_follows`, `alerts`, `/dashboard/swap` |
| Smart-money + DNA badge | Render badge when wallet in `smart_money_wallets` or `wallet_dna_archetypes` | Existing tables |
| Tracked wallets sidebar | `components/wallet/TrackedWalletsSidebar.tsx` (new) | `wallet_follows` |
| Wallet comparison view | `app/dashboard/wallet-intelligence/compare/page.tsx` (new) | None |
| 60s Redis cache | `app/api/wallet/route.ts` middleware | Redis |
| Mirror portfolio | `lib/services/mirrorPortfolio.ts` (new) | None |
| Counterparty graph | `components/wallet/CounterpartyGraph.tsx` (new) | None (uses existing graph lib) |
| Public shareable wallet page | `app/w/[address]/page.tsx` (new, SSR) | None |

**Acceptance criteria:** Wallet view shows 30-day PnL chart with realized + unrealized; Aave/Lido/Curve positions discovered for top 10 protocols; entity label rendered when known (e.g. "Binance 14"); Follow / Alert / Copy Trade buttons functional and wire to existing infrastructure; tracked wallets sidebar lists followed wallets with quick-load.

---
