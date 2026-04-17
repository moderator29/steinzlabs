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

## Feature 9 — DNA Analyzer

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/dna-analyzer/page.tsx](../app/dashboard/dna-analyzer/page.tsx) — 997 lines
- [app/api/dna-analyzer/route.ts](../app/api/dna-analyzer/route.ts) — backend
- Upstream service shape inferred from page: `AIAnalysis` interface with `personalityProfile`, `tradingStyle`, `riskProfile`, `overallScore`, `portfolioGrade`, `strengths/weaknesses/recommendations` arrays, `personalityTraits[]`, `marketOutlook`, `topInsight`, `sectorBreakdown`, `metrics: { diversification, timing, riskManagement, consistency, conviction }`.

**Data sources:** Uses Wallet Intelligence as input (`buildEvmWalletIntelligence` / `buildSolanaWalletIntelligence`), then calls Anthropic Claude to generate the personality + grading analysis.

**Architecture pattern:**
- **AI-augmented wallet profiler.** The "DNA" is essentially a structured Claude analysis of the wallet's tx history.
- Page accepts an address (auto-fills from connected wallet via `useWallet`) and renders a multi-section result: hero score + portfolio grade + 5 metrics radar, sector breakdown pie, partner wallets table, AI-generated text sections, recommendations.
- Server fan-out: holdings + transactions + sector classification + Claude call.

**Performance characteristics:**
- Claude call dominates latency (~5–15s for a deep analysis).
- Sector classification is naive — substring matching on token symbols probably.
- No streaming; user waits for the full response before anything renders.

**UX quality: 7/10.** Visually impressive — the radar chart of 5 metrics, the portfolio grade letter, the "personality traits" pills are all good design. The flow (paste address → wait → see your wallet's "personality") is fun and shareable.

**Backend quality: 6/10.** Uses our existing wallet intel + Claude — sound architecture. But: no caching (every analysis re-runs Claude, expensive), no persistence (the analysis isn't saved, so the user can't return to it), no comparison ("how does my DNA compare to other wallets?"), the grading rubric isn't versioned (today's "B+" might be tomorrow's "A" if the prompt changes).

**What works well:**
- Concept is unique to the platform (Nansen has trader-archetype, but not the "DNA" framing).
- AI personality profile is genuinely fun.
- Radar chart visualization.
- Recommendations actionable in spirit.
- Auto-fills connected wallet.

**What is weak or missing:**
- **No persistence.** Run the analysis, close the page, it's gone. Should save to `wallet_dna_archetypes` table and return cached if already analyzed in last 7 days.
- **No comparison.** "How does my DNA compare to BlackRock's wallet" would be killer.
- **No leaderboard.** "Top 10 DIAMOND_HANDS wallets this week" would drive engagement.
- **No social sharing.** "I'm a Diamond Hand! Find your DNA" tweet card with OG image. Would drive virality.
- **No streaming.** User sits and watches a spinner for 10s.
- **No "DNA over time"** — wallets evolve; should snapshot DNA monthly.
- **Sector breakdown is shallow.** Memecoin / DeFi / Stable / L1L2 — but no NFT, no perps, no LP, no staking.
- **No actionable feedback loop.** "Your timing score is 4/10" — OK, but how do I improve?
- **No tier gating.** The DNA Analyzer should arguably be a Pro feature (Claude calls are expensive), but currently any user can run it.
- **No batch DNA runs.** Can't analyze "all my followed wallets" in one click.
- **Doesn't surface in Wallet Intelligence.** When viewing a wallet, there's no badge/link "see this wallet's DNA."
- **No "DNA-similar wallets"** — given my DNA, find others with similar archetype + sector profile.

**What feels half-built:**
- The recommendations array is generated but not persisted; the user can't act on them later.
- The portfolio grade is a single letter with no rubric explanation visible.
- "Partner Wallets" table is generated but unclear how the relationship is computed.
- The page is a 997-line monolith — should be decomposed into sub-components.

### B) Industry Standard Comparison

**Nansen "Wallet Profiler"** has trader-archetype tagging (Hodler, Trader, Diamond Hands). But it's a tag, not a 5-axis score with AI commentary.

**Trader Joe / GMX leaderboard:** PnL-focused, no personality. Shows top traders by ROI.

**Compass.fish / DUNE dashboards:** Custom analytics — power users build queries. Not a productized DNA.

**Twitter/X "@arkham_intel" engagement-driven posts:** Anecdotally gets 100k+ impressions on "this wallet is up X%." Personality framing would fit naturally.

**Strava DNA / Spotify Wrapped analogies:** The shareable annual "you're a Punk Indie listener" frame from Spotify Wrapped is the model. We should aim for that virality.

**Pattern:** No one in crypto has done a "Wrapped"-quality wallet personality product. **This is an open opportunity** — and we're 60% of the way there.

### C) Next-Gen Recommendations

**Highest leverage:**

1. **Persist + cache.** Save every analysis to `wallet_dna_archetypes (wallet_address, dna_json, generated_at, expires_at)`. Return cached if < 7 days. Massive cost saving + faster response.
2. **Streaming response.** Send sections as they generate (Personality first, then Strengths, then Weaknesses, then Recommendations).
3. **Shareable OG image card.** New `app/api/dna/og/[address]/route.tsx` that generates a Twitter/X-friendly "I'm a Diamond Hand" card. Drives organic traffic.
4. **Public DNA pages.** `/dna/<address>` — SEO-friendly, indexable. Free traffic from "0xABC etherscan analyze" searches.
5. **DNA leaderboards.** `/dna/leaderboard` — top wallets in each archetype this week/month.
6. **DNA-similar wallets.** "5 wallets that share your DNA" — drives cross-discovery.
7. **DNA over time.** Monthly snapshot, render evolution line.
8. **Improve recommendations to be actionable.** "Increase your stablecoin allocation by 10%" → button that opens a swap recipe.
9. **Tier gate behind Pro.** Free users get 1 analysis/month, Pro/Max unlimited.
10. **Surface DNA badge in Wallet Intelligence and Smart Money pages.**

**Backend changes:**
- New `wallet_dna_archetypes` table (referenced in seed; verify schema).
- Streaming endpoint via SSE.
- OG image generator using `next/og`.
- Public DNA page route.
- Leaderboard backed by daily-aggregated view.

**Frontend changes:**
- Decompose the 997-line page into `<DNAHeader>`, `<DNARadar>`, `<DNATraits>`, `<DNARecommendations>`, `<DNASectorBreakdown>`, `<DNAPartnerWallets>`.
- Add streaming reveal of each section.
- Add "Share to X" button with the OG image preview.
- Add "Compare to" input box.
- Add "Find similar wallets" button.

**New sub-features:**
- **DNA matchmaking** — "find wallets with complementary DNA to mine" (for diversification).
- **DNA-driven alerts** — "alert me when a Whale Follower wallet enters BONK."
- **Annual "Steinz Wrapped"** — December summary of the user's followed wallets' year.

**Performance:**
- 7-day cache.
- Stream sections.
- Use Haiku for the sector classification (cheap), Sonnet for the personality + recommendations (deep).

**Mobile:**
- Radar chart responsive.
- Share-to-X is prime mobile use case — make sure the share intent works.

### D) Priority and Effort

- **Current score: 7/10.** Genuinely interesting product — undercooked.
- **Effort to 9/10: Medium (1.5–2 weeks).** Persistence + streaming + OG card + public pages + leaderboards. Not technically hard, just unbuilt.
- **Approach: Layer on, plus a viral-loop sub-feature investment.** This is one of our best growth-loop opportunities.
- **Blocks other features?** No — but enables Smart Money cross-linking, Wallet Intelligence enrichment, and serves as a marketing vector.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Persist DNA + cache 7d | `app/api/dna-analyzer/route.ts` — read/write `wallet_dna_archetypes` | Existing table |
| Stream DNA sections via SSE | `app/api/dna-analyzer/route.ts` rewrite, `lib/hooks/useDnaStream.ts` (new) | None |
| Shareable OG image | `app/dna/og/[address]/route.tsx` (new) | None |
| Public DNA page | `app/dna/[address]/page.tsx` (new, SSR) | None |
| DNA leaderboards | `app/dashboard/dna-analyzer/leaderboard/page.tsx` (new), `app/api/dna/leaderboard/route.ts` (new) | DB view aggregating archetype counts |
| DNA-similar wallets | `app/api/dna/similar/route.ts` (new) | Cosine similarity over DNA vector |
| DNA over time | Monthly snapshot job `lib/jobs/dna-monthly-snapshot.ts` | `wallet_dna_history` table |
| Actionable recommendations | Recommendation rows get "Apply" button → swap recipe | Reuse swap |
| Tier gating | Read tier in `app/api/dna-analyzer/route.ts`, return 403 if free w/ usage > 1/month | `dna_usage` table |
| Decompose 997-line page | `components/dna/*.tsx` | None |
| Surface DNA badge elsewhere | `wallet-intelligence/page.tsx`, `smart-money/page.tsx` | Existing |

**Acceptance criteria:** Same wallet analyzed twice within 7 days returns cached result instantly; OG share card renders on Twitter/X with the wallet's archetype + grade; `/dna/<address>` is publicly indexable and SSR; leaderboard shows top 10 wallets per archetype this week.

---

## Feature 10 — Whale Tracker

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/whale-tracker/page.tsx](../app/dashboard/whale-tracker/page.tsx) — 718 lines
- [app/api/whale-tracker/route.ts](../app/api/whale-tracker/route.ts) — backend (~700 LOC inferred)
- [app/api/moneyRadar/](../app/api/moneyRadar/) — follow/unfollow API (used in whale-tracker page)

**Data sources:** Etherscan/Bscscan/Basescan (large EVM transfer history), Solana RPC (large signature history), DexScreener (token/pair pricing), CoinGecko (USD reference). Filters out known CEX, contract, and DEX router addresses via `KNOWN_NON_HUMAN_PREFIXES` and `KNOWN_CEX_PATTERNS`.

**Architecture pattern:**
- **Server-side aggregation** of recent large transfers across multiple chains (ETH, Base, BSC, Polygon, Arbitrum, Optimism, Avalanche, Solana, Sui, Ton).
- **Whale tier classification**: MEGA (>$5M), LARGE (>$1M), MID (>$100k), SMALL (else).
- **Human-vs-bot heuristic** — excludes known router/contract/CEX addresses.
- **Two views:** `WhaleProfile` (per-wallet) and `WhaleFeedEvent` (per-transaction).
- **Follow/unfollow** persists to Supabase via `/api/moneyRadar/follow` (Session 2 work).
- **Client-side filtering** by chain, by tier.
- **Notifications** wired — when a followed whale moves, fires `addLocalNotification`.

**Performance characteristics:**
- Multi-chain fan-out — slow if any single explorer is slow.
- Polls every 60s.
- Etherscan free tier rate-limited (5 req/sec); under load this becomes a real bottleneck.

**UX quality: 7/10.** The whale-feed list with tier badges and chain pills is good. The follow/unfollow UX is clean. Filtering by chain and tier feels right. Notification on followed-whale move is the right behavior.

**Backend quality: 6/10.** Sensible aggregation; the human-vs-bot filter is needed and works. Major gaps: no real-time push (60s polling), no historical archive (events disappear after the window), no Arkham entity-label integration (despite Arkham being available — labels would massively improve the view), no per-event "explain" via VTX, no DEX/CEX leg classification (a "transfer to Coinbase" should be labeled as "deposit to exchange").

**What works well:**
- Multi-chain coverage including Solana (rare for products in this category).
- Tier classification with clean visual badges.
- Human heuristic filtering.
- Follow + alert wiring.
- Tracked-whale alerts route to notifications.

**What is weak or missing:**
- **No real-time push** — polling every 60s.
- **No entity labels overlay** — Arkham labels would tell us "this is Andreessen Horowitz" instead of `0x4f3...`.
- **No CEX deposit/withdraw classification.**
- **No exchange-flow analysis** — net inflow/outflow to CEX over 24h is a key signal we don't compute.
- **No DEX-specific labeling** — a swap on Uniswap V3 vs Curve has different signal value.
- **No "explain this whale move" inline VTX call.**
- **No multi-event sequencing** — wallet doing 3 trades in 5 minutes shows as 3 separate cards, not a strategy.
- **No portfolio context** — when a whale buys ETH, we don't show "this is now 30% of their portfolio."
- **No counterparty graph** — who did the whale receive from / send to.
- **No historical archive** — events older than the polling window vanish.
- **No alert thresholds.** Currently all events for a followed whale fire a notification; should be configurable ("alert me only on > $1M moves").
- **No "whale leaderboard."**
- **No social context** — when a whale ape's into a token at the same time other whales do, that convergence isn't surfaced.

**What feels half-built:**
- The 10-chain support is broad but most chains use the same Etherscan-API-pattern with no chain-specific optimization.
- The `WhaleProfile` view has a "featured" flag but no clear UI for it.
- The `recentTokens` array is computed but used inconsistently.
- The `tags` array exists on `WhaleProfile` but is never populated meaningfully.

### B) Industry Standard Comparison

**Whale Alert (whalealert.io):** The category leader on Twitter (>2M followers) but the website is bare-bones. Real-time WebSocket push of >$1M moves. CEX classification. Token labeling. No personalization.

**Arkham Real-time Feed:** Entity-labeled, real-time, filterable. "All exchange withdrawals > $5M" is one click. They have years of entity labeling.

**Nansen Alerts:** Per-wallet alerts with thresholds. Telegram + email + push. Smart-money labeling.

**Lookonchain (Twitter @lookonchain):** Manual curation of high-quality whale moves. Sub-1-hour latency from event to tweet. Editorial.

**Pattern:** **Real-time + entity labels + actionable filtering** is the table stakes. We have actionable filtering, weak on entity labels, no real-time.

### C) Next-Gen Recommendations

**Highest leverage:**

1. **WebSocket / SSE real-time push.** Replace 60s polling. Re-use the Redis stream infrastructure recommended for Context Feed (Feature 4).
2. **Arkham entity overlay.** Every whale address checked against Arkham; render the label inline.
3. **CEX flow classification.** Detect transfers to/from CEX-tagged addresses; render as "deposit to Coinbase" / "withdrawal from Binance."
4. **Whale leaderboard.** Top 100 wallets by 30-day net flow, by win rate, by activity.
5. **Convergence detection.** When 3+ whales buy the same token in 1h, surface as a "Convergence" event.
6. **Configurable alert thresholds.** Per-followed-whale: min USD, action filter (buy only / sell only / both), chain filter.
7. **VTX "explain this" inline.**
8. **Historical archive.** Persistent `whale_events_archive` table (shared with Context Feed archive).

**Backend changes:**
- Background worker that ingests large transfers continuously, writes to Redis stream + `whale_events_archive`.
- SSE endpoint reading from Redis stream.
- Entity label join (Arkham) at write time so we don't re-fetch on every read.
- CEX address registry table `cex_addresses (address, exchange_name, chain)`.
- Convergence detection job — every 5min, query for tokens bought by ≥3 distinct whales.

**Frontend changes:**
- `EventSource` hook replacing polling.
- Entity label overlay on every whale address.
- CEX flow icon (deposit / withdraw).
- "Convergence" event card.
- Per-whale alert config drawer.

**New sub-features:**
- **CEX flow dashboard** — 24h net inflow/outflow to top 10 exchanges, line chart.
- **Whale × Token matrix** — what % of token X supply is held by whales over time.
- **Insider detection** — whales that consistently buy 1–24h before price pumps.
- **Alpha leaderboard** — whales with best 30/90d win rates.

**Performance:**
- Etherscan/Bscscan calls to be replaced with Alchemy webhook subscriptions where possible — push instead of poll.
- Cache CEX address registry in memory per-instance (small, doesn't change often).

**Mobile:**
- Card layout fine; filter pills could collapse into a single dropdown on narrow screens.

### D) Priority and Effort

- **Current score: 7/10.** Solid execution; lacks the real-time + entity + convergence layer that defines the category leaders.
- **Effort to 9/10: Medium-Large (2–3 weeks).** SSE infrastructure (shared with Feature 4) + entity labels + convergence detection + leaderboard.
- **Approach: Layer enhancements.** Don't rewrite the page; add real-time data layer + entity overlay.
- **Blocks other features?** No — but shares infrastructure with Context Feed and Smart Money. Building the real-time stream once benefits all three.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| SSE real-time feed | `app/api/whale-tracker/stream/route.ts` (new), reuse Redis stream from F4 | Redis |
| Arkham entity overlay | Update `app/api/whale-tracker/route.ts` to join with Arkham labels | Existing arkham service |
| CEX address registry | `cex_addresses` table seeded from public lists | New table |
| CEX flow classification | `lib/services/cexFlow.ts` (new) — checks every event source/dest | None |
| Convergence detection | `lib/jobs/whale-convergence.ts` (new), Vercel cron 5min | `whale_convergence_events` table |
| Configurable alert thresholds | `wallet_follows` table — add `alert_min_usd`, `alert_actions`, `alert_chains` JSON | Schema migration |
| VTX explain inline | Reuse VTX explain pattern from F4 | None |
| Whale leaderboard | `app/dashboard/whale-tracker/leaderboard/page.tsx` (new) | DB view |
| Insider detection | `lib/jobs/insider-detection.ts` (new) — cross-correlates whale buys with subsequent price moves | `insider_signals` table |
| CEX flow dashboard | `app/dashboard/whale-tracker/cex-flows/page.tsx` (new) | None |
| Alpha leaderboard | Per-wallet 30/90d win rate aggregate | `wallet_pnl` (from F8) |

**Acceptance criteria:** Whale events push within 5s of upstream block confirmation; entity labels rendered for >50% of events; CEX deposit/withdraw classified; convergence event card appears when ≥3 whales buy the same token in 1h; per-followed-whale alert thresholds configurable.

---

## Feature 11 — Wallet Clusters

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/wallet-clusters/page.tsx](../app/dashboard/wallet-clusters/page.tsx) — 370 lines
- [app/api/wallet-clusters/route.ts](../app/api/wallet-clusters/route.ts) — backend
- [lib/services/cluster-detection.ts](../lib/services/cluster-detection.ts) — `detectCluster` algorithm + types
- [lib/jobs/cluster-detection.ts](../lib/jobs/cluster-detection.ts) — background job that ingests transfers, applies clustering, persists results
- DB tables: `wallet_clusters`, `wallet_cluster_members`

**Data sources:** Birdeye holders (Solana), Alchemy asset transfers (EVM), `smart_money_wallets` seeded entities, internal cluster detection algorithm.

**Architecture pattern:**
- **Background job pulls candidate addresses** (token holders or seeded smart-money wallets) → fetches transfer history → runs clustering algorithm → persists clusters with members + signals + risk score.
- **Page reads from `wallet_clusters` + `wallet_cluster_members` tables** (cached) with optional fresh-detection trigger.
- **Behavior classification**: `accumulation | distribution | pump | wash_trading | unknown`.
- **Coordination score**: 0-100 metric; `≥60 = high risk`, `40-59 = medium`, `<40 = low`.

**Performance characteristics:**
- Detection job is heavy — fans out to N transfer-history queries, runs graph algorithm, multi-second.
- Cached reads are fast.
- No real-time — depends on the cron schedule.

**UX quality: 5/10.** The visualization is largely tabular — clusters listed with members. Lacks a graph view despite the page being literally about networks. The risk-level color coding works. The signals breakdown is informative when populated.

**Backend quality: 6/10.** The clustering algorithm is custom and correctly persists results. Tables are normalized. **Big issue:** the algorithm is a black box — no documentation of the heuristics, no test coverage, no way for users to understand why two wallets clustered. Also: depends on Birdeye for Solana holders which is paid + rate-limited.

**What works well:**
- Real persistent clusters (not on-the-fly).
- Multi-signal scoring (timing, value, transfer graph).
- Risk classification.
- Token-scoped clustering (analyze clusters for a specific token).

**What is weak or missing:**
- **No graph visualization** of cluster members + their transfer relationships. This is THE feature for this page.
- **No cluster confidence explanation.** "Why are these wallets clustered? What signals fired?"
- **No timeline view.** When did the cluster form? When did it act?
- **No comparison to known scams.** "This pattern matches 3 historical rugs" (uses our `flagged_tokens` history).
- **No alerting.** When a high-risk cluster is detected on a token in the user's watchlist, no notification.
- **No "investigate this address" entry point** — users can't easily ask "is this wallet part of a cluster?"
- **Birdeye-only for Solana holders** — single point of failure.
- **No cross-chain clustering.** A wallet that funded EVM addresses from a Solana CEX withdrawal isn't tracked.
- **Minimal UI density** at 370 lines — most of this surface is unbuilt.

**What feels half-built:**
- Page reads cluster data but the visualization is mostly text.
- "Refresh" triggers a re-detection but with no feedback on progress.
- The `transfers` array in `ClusterData` is fetched but barely visualized.

### B) Industry Standard Comparison

**Bubblemaps.io:** The reference standard. Visual graph of holders + transfers + clusters as colored bubbles. Free tier on basic tokens, paid for advanced. Used by Solana ecosystem extensively.

**Arkham Intelligence Clusters:** Auto-detected and labeled (e.g. "Alameda Research Cluster" with 47 wallets). Confidence scores and supporting evidence. Manual analyst review queue.

**Breadcrumbs.app / Chainalysis Reactor:** Compliance-grade. Used by exchanges and law enforcement. Very deep tracing.

**Pattern:** Visual-first, evidence-transparent, multi-chain. We have backend, no viz, no transparency.

### C) Next-Gen Recommendations

**Highest leverage:**
1. **Graph visualization** using d3 force-directed (already used in Bubble Map page) — render members as nodes, transfers as edges, cluster as a colored hull.
2. **Signal evidence panel.** When user clicks a cluster, show "These wallets cluster because: 8 wallets transferred from a single funding wallet within 30 minutes; 6 wallets bought the same token within a 5-block window."
3. **Historical pattern matching.** Compare this cluster's signature to past rugs (use `flagged_tokens` archive); show "67% similarity to [past rug X]."
4. **Cluster alerting.** When a high-risk cluster touches a watchlist token, notify user.
5. **Reverse lookup** — paste an address, see all clusters it belongs to.
6. **Cross-chain clustering** — bridge transfer detection.

**Backend changes:**
- Add `cluster_signals_evidence` column to `wallet_clusters` (JSONB) explaining each signal.
- Pattern library `historical_cluster_patterns` table for similarity matching.
- Add `address → clusters` index for reverse lookup.
- Bridge detection in `lib/services/bridgeDetection.ts`.

**Frontend changes:**
- Replace tabular cluster view with d3 force graph (re-use Bubble Map components).
- Evidence side panel.
- Address-search reverse lookup.

**New sub-features:**
- "Similar clusters across history" — find 5 historical clusters with comparable signatures.
- "Track this cluster" — alert when any member moves.

**Performance:**
- Move Birdeye to background; cache holder snapshots.
- Limit graph to 50 nodes by default; expand on demand.

**Mobile:**
- d3 force graph painful on mobile; provide a list fallback.

### D) Priority and Effort

- **Current score: 5/10.** Backend exists; UI undersells it.
- **Effort to 9/10: Medium (2 weeks).** Graph viz + evidence + pattern library.
- **Approach: Layer visualization + evidence on existing data layer.**
- **Blocks other features?** No — but enriches Bubble Map (F12) and Risk Scanner (F22).

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Force-directed cluster graph | `components/clusters/ClusterGraph.tsx` (new), reuse d3 from Bubble Map | None |
| Signal evidence panel | `components/clusters/EvidencePanel.tsx` (new) | Add `signal_evidence` JSONB column |
| Pattern library | `historical_cluster_patterns` table; matcher in `lib/cluster/matchHistorical.ts` | New table |
| Cluster alerting | `lib/jobs/cluster-watch-alerts.ts` (new) | Reuse alerts |
| Reverse lookup | `app/api/wallet-clusters/by-address/[addr]/route.ts` (new) | Index on `wallet_cluster_members.wallet_address` |
| Cross-chain clustering | `lib/services/bridgeDetection.ts` (new) | None |

**Acceptance criteria:** Graph view renders cluster members + edges with risk-colored hull; clicking a cluster shows evidence panel with named signals; historical similarity score displayed; reverse lookup returns all clusters for a given address.

---

## Feature 12 — Bubble Map

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/bubble-map/page.tsx](../app/dashboard/bubble-map/page.tsx) — 594 lines
- [app/api/intelligence/bubblemaps/[token]/route.ts](../app/api/intelligence/bubblemaps/[token]/route.ts) — backend
- [lib/intelligence/holderAnalysis.ts](../lib/intelligence/holderAnalysis.ts) — `loadHolderIntelligence` aggregator
- d3.js for the visualization

**Data sources:** Alchemy/Birdeye holder lists, Arkham entity labels, internal cluster detection, `smart_money_wallets`, `flagged_tokens`/`scammer` lists.

**Architecture pattern:**
- **Three view modes:** Holders / Network / Clusters.
- **`BubbleNode` typed:** token / exchange / whale / contract / unknown / scammer / dex / team.
- **`BubbleLink` typed** with direction (in / out / both).
- **Server returns** holder intelligence including: `bubbleMapData`, `composition` (token type breakdown), `safetyAnalysis`, `smartMoneyPresence`, `scammerAnalysis`, `lastUpdated`.

**Performance characteristics:**
- d3 force-directed simulation for ~50 holders is smooth on desktop, sluggish on low-end mobile.
- Multi-source aggregation makes initial load 2–4s.
- No streaming/progressive rendering — page locks until data ready.

**UX quality: 7/10.** Visually impressive — colored bubbles, force layout, clean transitions. Three view modes give flexibility. Entity labeling is integrated. Smart-money + scammer overlays add value. **Weakness:** no time-axis (the bubble map is always "now"; no playback of how holdings changed); no zoom-to-cluster; no "hide < $X" filter; no node search-and-highlight.

**Backend quality: 7/10.** `loadHolderIntelligence` does meaningful aggregation. Multi-signal output. Composition breakdown is actually useful.

**What works well:**
- Three view modes.
- Real entity labels.
- Smart money + scammer overlays.
- d3 force layout solid.
- Composition breakdown.

**What is weak or missing:**
- **No time-axis playback** — can't see how holdings changed over 30 days.
- **No exportable snapshot** — can't share or save a static image.
- **No "explain this concentration" inline VTX call.**
- **No comparison to peers** — "this token is 4x more concentrated than the average DeFi token."
- **Limited node count** — if a token has 10k holders, we show top 50; no "expand."
- **No mobile support practical** — d3 force on a 375px screen is unusable.
- **No url-shareable state** — can't link to "this token, network view, cluster X selected."
- **No CSV export of holder list.**
- **No "track this concentration" alert** — when top-10 holding crosses 50%, alert me.

**What feels half-built:**
- The 594-line page implies a lot of UI; the simpler tabular fallback is missing.
- "Maximize" / "Minimize" buttons exist but the fullscreen behavior is minimal.

### B) Industry Standard Comparison

**Bubblemaps.io:** The category creator. Their viz is more refined; they have time playback (premium feature); they have a brand. We are a credible competitor on functionality.

**Arkham entity graph:** Different framing — entity-relationship instead of token-holder. More general-purpose.

**Pattern:** Bubblemaps owns the holder-bubble-map UI; we shouldn't try to outdo them on aesthetics. We should differentiate via integration (one-click "explain via VTX," "alert on concentration change," "compare to peers").

### C) Next-Gen Recommendations

**Highest leverage:**
1. **Time-axis playback** — slider showing holder distribution over the last 30 days.
2. **VTX-explain integration.**
3. **Concentration peer comparison.**
4. **URL-shareable view state.**
5. **CSV export.**
6. **Alert on concentration change.**

**Backend changes:**
- `holder_snapshots` table (already in schema — verify) populated daily for tracked tokens.
- Concentration metric calculator.

**Frontend changes:**
- Time slider component.
- Export button.
- VTX explain button.
- Search-and-highlight.

**Mobile:**
- Tabular fallback for narrow screens.

### D) Priority and Effort

- **Current score: 7/10.** Strong feature, undersells via missing time + integrations.
- **Effort to 9/10: Medium (1.5 weeks).**
- **Approach: Layer time + integrations.**
- **Blocks other features?** No.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Time-axis slider | `components/bubble-map/TimeSlider.tsx` (new) | `holder_snapshots` |
| VTX explain inline | Reuse pattern | None |
| Peer comparison | `lib/services/concentrationPeers.ts` (new) | None |
| URL-shareable state | `app/dashboard/bubble-map/page.tsx` — sync state to query params | None |
| CSV export | Client-side | None |
| Concentration alert | Reuse alerts | None |
| Mobile fallback | `components/bubble-map/HolderTable.tsx` (new) | None |

**Acceptance criteria:** Time slider shows 30-day evolution; URL captures state; CSV export functional; mobile shows tabular fallback.

---

## Feature 13 — Smart Money

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/smart-money/page.tsx](../app/dashboard/smart-money/page.tsx) — 662 lines
- [app/api/smart-money/route.ts](../app/api/smart-money/route.ts) — 349 lines (Alchemy + DexScreener fan-out, archetype detection, convergence detection, risers)
- [supabase/seeds/smart_money_wallets.sql](../supabase/seeds/smart_money_wallets.sql) — 15 seeded entities

**Data sources:** Alchemy `alchemy_getAssetTransfers` for large transfers (≥50 ETH), DexScreener for token resolution, hardcoded entity list (Binance, Jump, DWF, a16z, Paradigm, etc).

**Architecture pattern:**
- **Single-shot aggregator** producing 4 outputs: `wallets[]`, `recentMoves[]`, `convergence[]`, `weeklyRisers[]`.
- **Archetype detection** via `detectArchetype(winRate, trades, pnlChange, avgHold)` → DIAMOND_HANDS / SCALPER / DEGEN / WHALE_FOLLOWER / HOLDER / INACTIVE / NEW_WALLET.
- **Convergence**: when ≥2 wallets buy the same token, surface.
- **Weekly Risers**: top movers by `weeklyPnlChange`.
- **Page polls every 60s.**
- **In-page convergence notifications** — new convergences fire `addLocalNotification`.
- **60s `Cache-Control` header** with `s-maxage=60, stale-while-revalidate=30`.

**Performance characteristics:**
- 60s poll fine for the cadence.
- Alchemy fan-out per request is the bottleneck (~1–3s).
- No reads from the seeded `smart_money_wallets` table — the whale set is computed live from large transfers.

**UX quality: 7/10.** The page is dense and informative. Convergence cards are clear. Archetype badges look right. Riser cards work.

**Backend quality: 6/10.** The aggregation is real and correctly classified. **Major issue:** the seeded `smart_money_wallets` table (15 named entities) is **not used by the live page** — the page computes a fresh set every minute from large transfers. So the whales we surface are anonymous addresses, not the labeled funds we seeded. Disconnect between data layer and UI.

**What works well:**
- 4 distinct outputs (wallets, moves, convergence, risers) make the page feel rich.
- Archetype taxonomy is interesting.
- Convergence detection is a real edge.
- Notifications fire on convergence signals.

**What is weak or missing:**
- **Seeded `smart_money_wallets` table not used.** Anonymous wallet addresses surface instead of labeled entities (Jump, a16z).
- **PnL is computed but unverified.** `winRate` and `pnlChange` come from rough heuristics, not real position-by-position accounting.
- **Convergence signals don't include time window.** Two wallets buying the same token a week apart isn't really convergence.
- **No "follow this whale" inline.** Despite Whale Tracker having follow, this page doesn't.
- **No archetype filter.** Can't see "all SCALPER wallets active today."
- **No drilldown to wallet intelligence.**
- **No leaderboard view** — top 100 by 30d PnL.
- **No tier gate.** Smart-money signals are arguably premium content.
- **No watchlist integration** — a token bought by 3 smart-money wallets isn't auto-added to watchlist suggestions.
- **No backtest / historical convergence** — "convergences from 30 days ago and what they predicted."

**What feels half-built:**
- Riser detection has the data plumbing but the UI section feels small.
- The seeded table existing but unused suggests intent that was never closed.
- `INACTIVE` and `NEW_WALLET` archetypes are defined but rarely surface — the page filters them out implicitly.

### B) Industry Standard Comparison

**Nansen Smart Money:** The category leader. Curated lists ("Smart NFT Trader," "Stablecoin Whale," "Top 100 SOL traders"). Per-list view. Per-token "smart money flows" ("smart money is net buying $WIF"). Massive value to users.

**Arkham Funds:** Per-fund pages (Polychain, Multicoin, Paradigm) with full position history. Identity-first.

**LookOnchain:** Manual curation of high-quality moves. Editorial flavor.

**Pattern:** Curation + identity + per-token flow. We have algorithmic detection + anonymous wallets + per-wallet pages. Different angle — could differentiate by leaning into algorithmic, but we should at least USE the seed data we created.

### C) Next-Gen Recommendations

**Highest leverage:**
1. **Use the seeded `smart_money_wallets` table.** Join detected wallets against the seed; render entity name + tier when matched.
2. **Per-token smart-money flow.** "Smart money net flow on $TOKEN over 24h: +$2.3M (3 buyers, 1 seller)."
3. **Curated lists.** "DeFi Smart Money," "Memecoin Hunters," "Stablecoin Whales."
4. **Real PnL per wallet** — depends on Wallet Intelligence (F8) PnL work.
5. **Time-windowed convergence** — only count buys in same 24h window.
6. **Follow + alert wiring.**
7. **Tier gating** — surface basic smart-money to free users; lists, real PnL, and historical convergences to Pro/Max.

**Backend changes:**
- Join `smart_money_wallets` in `app/api/smart-money/route.ts` aggregator.
- New `smart_money_lists` table + curated rows.
- Per-token flow aggregation endpoint.
- Convergence time window enforcement.

**Frontend changes:**
- Lists tab.
- Per-token flow widget on token detail page.
- Follow button on each smart-money card.
- Archetype filter pills.

**Mobile:**
- Card grid → list view.

### D) Priority and Effort

- **Current score: 7/10.** Better than most platforms; below Nansen.
- **Effort to 9/10: Medium (2 weeks).**
- **Approach: Connect seed data + add lists + leverage F8 PnL work.**
- **Blocks other features?** No.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Use seeded smart_money_wallets | `app/api/smart-money/route.ts` join | Existing seed |
| Per-token flow | `app/api/smart-money/flow/[token]/route.ts` (new), widget on token detail | None |
| Curated lists | `app/dashboard/smart-money/lists/[id]/page.tsx` (new) | `smart_money_lists` table |
| Time-windowed convergence | Algorithm in `app/api/smart-money/route.ts` | None |
| Follow + alert wiring | Reuse F10 follow infra | None |
| Tier gating | Read tier in route | Existing |

**Acceptance criteria:** Detected wallets show entity name when matched in seed; per-token flow widget appears on token detail page; ≥3 curated lists live; convergences only count moves within configurable time window.

---

## Feature 14 — Network Metrics

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/network-metrics/page.tsx](../app/dashboard/network-metrics/page.tsx) — 102 lines (smallest dashboard page on the platform)
- [app/api/network-metrics/route.ts](../app/api/network-metrics/route.ts) — backend

**Data sources:** Per-chain RPCs (gas price, block time, TPS).

**Architecture pattern:** Page fetches `/api/network-metrics` once on mount → renders `gas`, `tps`, `blocks` for the selected chain. 5 chains: Ethereum, Solana, Base, Polygon, Arbitrum.

**Performance characteristics:** Single endpoint, fast.

**UX quality: 4/10.** Three stats per chain, no chart, no comparison, no historical context. Looks like a placeholder. The 102-line page is the **smallest user-facing page on the platform** — it shows.

**Backend quality: 4/10.** Pulls live values; doesn't store, doesn't trend, doesn't compare.

**What works well:** Multi-chain selector. Live values.

**What is weak or missing:**
- **No charts.** Gas history over 24h is a one-line ask.
- **No comparison view** — Ethereum gas vs Base gas vs Polygon gas side-by-side.
- **No "best chain to swap right now"** decision aid.
- **No mempool stats.**
- **No fee market for L2s** (block-builder fees, sequencer fees).
- **No alert** ("notify me when ETH gas drops below 20 gwei").
- **No correlation** ("gas spikes when X token launches").

**What feels half-built:** The page itself feels half-built. 102 lines is not a feature.

### B) Industry Standard Comparison

**Etherscan Gas Tracker:** Slow / Average / Fast tiers. Last-blocks chart. Per-action gas estimates ("Uniswap swap: 45 gwei = $2.40").

**ETH Gas Station / Blocknative:** Mempool-based fee predictions. Push notifications.

**L2Beat:** Per-L2 stats with TVL, TPS, sequencer health, fees.

**Pattern:** Network metrics is a utility page. Etherscan Gas Tracker sets the bar — chart + tier + alert.

### C) Next-Gen Recommendations

**Highest leverage:**
1. **Add 24h gas chart per chain.**
2. **Tier display (Slow / Avg / Fast) with USD cost for common actions** (swap, transfer, NFT mint).
3. **"Best chain right now" badge.**
4. **Alert on gas threshold.**
5. **Mempool depth + pending tx count.**

**Backend changes:** `network_metrics_history` table populated by 1-min cron. Time-series queries.

**Frontend changes:** Add chart, action-cost grid, alert button.

### D) Priority and Effort

- **Current score: 4/10.** Underbuilt.
- **Effort to 9/10: Medium (1 week).**
- **Approach: Build out — currently a stub.**
- **Blocks other features?** No.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Gas history time series | `app/api/network-metrics/history/route.ts` (new), 1-min cron | `network_metrics_history` table |
| Gas chart UI | `components/network/GasChart.tsx` (new) | None |
| Action-cost grid | `components/network/ActionCostGrid.tsx` (new) | None |
| Best-chain badge | `lib/network/bestChain.ts` (new) | None |
| Gas alert | Reuse alerts | None |
| Mempool depth | `lib/services/mempool.ts` (new), Blocknative API | API key |

**Acceptance criteria:** Gas chart for each chain over 24h; per-action USD cost grid; "best chain to swap right now" badge; gas alert can be created.

---

## Feature 15 — Network Graph

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/network-graph/page.tsx](../app/dashboard/network-graph/page.tsx) — 771 lines
- [app/api/network-graph/route.ts](../app/api/network-graph/route.ts) — backend
- d3.js for force-directed visualization

**Data sources:** Alchemy asset transfers, classified into node types: high-activity / bridge / usdc / usdt / regular.

**Architecture pattern:**
- **Force-directed graph** of recent transfer activity.
- **Node typing** by behavior heuristic.
- **Filterable by node type.**
- Page accepts an optional address; without one, shows aggregate network activity.

**Performance characteristics:** d3 force on 100+ nodes is heavy on weaker devices. Server fan-out to Alchemy is moderate (1–3s).

**UX quality: 6/10.** Solid graph rendering. Legend is clear. The 5-node-type taxonomy works.

**Backend quality: 5/10.** Live computation; no persistence; no historical query.

**What works well:**
- Force layout with 5 typed colors.
- Legend.
- Filterable by type.

**What is weak or missing:**
- **No persistence** — every refresh recomputes.
- **No time-axis playback** — same as Bubble Map gap.
- **No entity overlay.**
- **No path-finding** — "show me how Alice and Bob are connected."
- **No save/share view state.**
- **No mobile fallback.**
- **Overlap with Bubble Map** in concept and code — should share more.
- **No alert** ("notify me when this network's hub wallet moves").
- **No drilldown to wallet intel.**

**What feels half-built:**
- The 771-line page is mostly d3 plumbing; the analytical surface is thin.
- Path-finding is the natural "killer feature" of a network graph and it's not there.

### B) Industry Standard Comparison

**Arkham entity graph:** Identity-first, manually labeled, supports path-finding (shortest path between two entities).

**Breadcrumbs / Chainalysis Reactor:** Compliance-grade. Path-finding, taint analysis, mixer detection.

**Maltego:** General-purpose graph intel. Pluggable transforms. Used by investigators.

**Pattern:** Graph products differentiate by **path-finding + identity + taint analysis**. We have rendering; not these.

### C) Next-Gen Recommendations

**Highest leverage:**
1. **Path-finding** between two addresses.
2. **Entity overlay** (Arkham labels).
3. **Taint analysis** — trace funds from a known scam address to current holders.
4. **Persistence** + URL-shareable state.
5. **Time-axis playback.**
6. **Mobile fallback (table).**

**Backend changes:**
- `address_graph_snapshots` table.
- Shortest-path algorithm via Dijkstra over transfer graph.
- Taint propagation algorithm.

### D) Priority and Effort

- **Current score: 6/10.** Visualization-only.
- **Effort to 9/10: Large (2.5–3 weeks).** Path-finding + taint = real algorithmic work.
- **Approach: Add analytical layer; share visualization code with Bubble Map.**
- **Blocks other features?** No.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Path-finding | `lib/graph/shortestPath.ts` (new), `app/api/network-graph/path/route.ts` (new) | None |
| Entity overlay | Reuse Arkham service | Existing |
| Taint analysis | `lib/graph/taintTrace.ts` (new) | `flagged_addresses` table for sources |
| Persist snapshots | `address_graph_snapshots` table | New table |
| URL-shareable | Sync state to query | None |
| Time playback | Slider component | Reuse from F12 |
| Mobile table | `components/network-graph/PathTable.tsx` (new) | None |

**Acceptance criteria:** Path-finding returns shortest transfer path between any two addresses in <2s; entity labels rendered for matched nodes; taint trace from scam source highlights current holders; URL captures view state.

---

## Feature 16 — On-Chain Trends

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/trends/page.tsx](../app/dashboard/trends/page.tsx) — 319 lines
- [app/api/intelligence/on-chain-trends/route.ts](../app/api/intelligence/on-chain-trends/route.ts) — backend with `TrendCard` + `TrendAlertItem` types
- [lib/services/defillama.ts](../lib/services/defillama.ts) — DefiLlama client

**Data sources:** DefiLlama (TVL per chain, global TVL, stablecoin metrics).

**Architecture pattern:**
- **TrendCard** model: chain + metric (TVL/Volume/Stablecoins/Gas/Addresses/Transactions) + value + 24h/7d % change + 14-pt sparkline + direction + hot flag + optional alert.
- **5-min cache** on the response.
- **Alert generation** when a metric moves significantly.
- Page polls and renders cards with sparklines.

**Performance characteristics:** DefiLlama API is reliable; 5-min cache amortizes well.

**UX quality: 7/10.** Sparklines look good. The card+alert layout works. The chain filter is functional.

**Backend quality: 6/10.** Source diversity is thin — DefiLlama only. No on-chain raw computation (active addresses, daily transactions).

**What works well:**
- DefiLlama integration is solid.
- Sparklines look clean.
- 5-min cache appropriate.

**What is weak or missing:**
- **Single source (DefiLlama).** Should incorporate Dune, Token Terminal, Artemis, blockchain-native metrics.
- **No protocol-level breakdown** — just chain-level.
- **No "what changed" narrative.** A 12% TVL drop on Solana should auto-explain via VTX.
- **No alerting.**
- **No comparison view.**
- **No historical depth** — just 14 sparkline points (~14 days).
- **No daily-active-address metric, no daily-tx metric** despite the type allowing them.
- **No screener** — "find chains with TVL up >20% week-over-week."

**What feels half-built:** The `metric` field allows 6 types but only TVL + Stablecoins are populated. Volume/Gas/Addresses/Transactions are stubs.

### B) Industry Standard Comparison

**Token Terminal:** Best-in-class fundamentals view. Revenue, fees, P/E ratios for protocols. Tier-gated.

**Artemis:** Multi-source aggregation (DefiLlama + Dune + native). Shareable dashboards. Chain comparison.

**DefiLlama:** Source we already use. Their site is more comprehensive than our derived view.

**Dune Dashboards:** Power-user. Custom SQL, fully customizable.

**Pattern:** The leaders aggregate multiple sources and offer protocol-level depth + sharing. We're a thin DefiLlama wrapper.

### C) Next-Gen Recommendations

**Highest leverage:**
1. **Add Dune Analytics + Token Terminal as sources.**
2. **Protocol-level breakdown.**
3. **VTX narrative explanation.**
4. **Alert on threshold.**
5. **Trend screener.**

**Backend changes:**
- New `lib/services/dune.ts`, `lib/services/tokenTerminal.ts`, `lib/services/artemis.ts`.
- Persistent `chain_metrics_history` for longer time series.

**Frontend changes:**
- Per-protocol drilldown.
- VTX-explain inline on card click.
- Screener form.

### D) Priority and Effort

- **Current score: 7/10.**
- **Effort to 9/10: Medium (1.5 weeks).**
- **Approach: Add sources + protocol depth.**
- **Blocks other features?** No.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Dune integration | `lib/services/dune.ts` (new) | Dune API key |
| Token Terminal integration | `lib/services/tokenTerminal.ts` (new) | TT API key |
| Protocol breakdown | `app/dashboard/trends/protocols/[id]/page.tsx` (new) | None |
| VTX narrative | Reuse explain pattern | None |
| Alert threshold | Reuse alerts | Add metric-alert column |
| Trend screener | `app/dashboard/trends/screener/page.tsx` (new) | None |
| Persistent history | `chain_metrics_history` table | New table |

**Acceptance criteria:** ≥3 sources contributing; per-protocol drilldown for top 50 protocols; VTX narrative auto-generated on significant moves; threshold alerts functional.

---

## Feature 17 — Security Center

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/security/page.tsx](../app/dashboard/security/page.tsx) — 581 lines
- `app/api/security/` — 7 sub-routes: approvals, check-wallet, contract-analyzer, domain-shield, scan-trade, signature-insight, threats
- [lib/security/goplusService.ts](../lib/security/goplusService.ts), [shadowGuardian.ts](../lib/security/shadowGuardian.ts), [walletReputation.ts](../lib/security/walletReputation.ts), [types.ts](../lib/security/types.ts)
- [lib/services/goplus.ts](../lib/services/goplus.ts) — GoPlus API client

**Data sources:** GoPlus (token security, address security, domain security, signature decode, tx simulation, dust tokens), DexScreener (price/market context).

**Architecture pattern:**
- **Hub page** at `/dashboard/security` with quick contract scan + sub-feature shortcuts.
- **`ScanResult` interface** with 25+ fields covering trust score, safety level, tax, ownership flags, LP holders.
- **Shadow Guardian** — internal service exposed as a singleton (`export const shadowGuardian = new ShadowGuardian()`).
- **Wallet reputation** — separate service likely scoring wallets for risk.

**Performance characteristics:** GoPlus is the bottleneck (~500ms–2s per scan).

**UX quality: 7/10.** The hub layout works. Quick scan is functional. The 25-field result is comprehensive but information-dense.

**Backend quality: 7/10.** Real GoPlus integration is the right move — they're the best in this space. Multiple sub-routes for different scan types is correct.

**What works well:**
- Real GoPlus integration.
- Comprehensive token security scan output.
- Multi-vector coverage (token, wallet, domain, signature, tx).
- Shadow Guardian abstraction.

**What is weak or missing:**
- **No persistent scan history** — every scan stands alone, no "recently scanned" list.
- **No "this token's security improved/worsened over time"** — single point in time.
- **No Shadow Guardian gate on swap.** Despite being labeled "AI-powered scam protection on all trades" in Settings, it's not enforced as a pre-swap check.
- **No allow/deny list** — users can't pre-approve safe tokens to skip scans.
- **No batch scan** — paste 20 addresses, scan all.
- **No alert** when a watchlist token's security score drops.
- **No "report this token"** community feedback loop.
- **GoPlus single-source dependency.** Quantstamp, Hacken, CertiK exist; GoPlus is fast but not always right.
- **No phishing-feed integration** — mempool address blacklists from PhishFort, ScamSniffer, etc.

**What feels half-built:**
- Shadow Guardian exists in code but its policy effects on the rest of the platform are unclear.
- The sub-features (Contract Analyzer, Domain Shield, Sig Insight, Approval Manager, Risk Scanner) all duplicate hub-page functionality and live as separate pages — feels redundant.
- Wallet Reputation service exists but isn't surfaced to users.

### B) Industry Standard Comparison

**De.Fi Scanner:** The category leader for retail. Comprehensive scan + simulation. Free tier generous.

**GoPlus (the data source we use):** Comprehensive but UI is basic.

**MetaMask Snaps (security snaps):** In-wallet security. Pre-tx warnings. The bar is "we stop the user before they lose money."

**Wallet Guard / Pocket Universe / Stelo:** Browser-extension security. Pre-sig analysis. Sub-second.

**Pattern:** Best-in-class is **pre-action** (warn before signing); we're **post-action** (let user scan after).

### C) Next-Gen Recommendations

**Highest leverage:**
1. **Make Shadow Guardian a hard pre-swap gate.** Block + warn before user signs a swap of a flagged token.
2. **Multi-source scanning** — combine GoPlus + De.Fi + community reports.
3. **Persistent scan history.**
4. **Alert on watchlist token security drop.**
5. **Batch scan.**
6. **Pre-sign simulation** (Tenderly) shared with Swap (F6).
7. **Phishing-feed ingestion** — auto-flag.

**Backend changes:**
- Persistent `security_scans` table.
- New `lib/services/defi.ts` (De.Fi scanner client).
- Phishing-feed ingestion job.
- Shadow Guardian policy hook in swap route.

**Frontend changes:**
- Pre-swap warning modal (block → warn → proceed).
- Recent scans sidebar.
- Batch scan input.

### D) Priority and Effort

- **Current score: 7/10.**
- **Effort to 9/10: Medium-Large (2 weeks).**
- **Approach: Wire Shadow Guardian into actions; add multi-source.**
- **Blocks other features?** Connects to Swap, Watchlist, Approval Manager.

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| Shadow Guardian pre-swap gate | `app/dashboard/swap/page.tsx`, `lib/security/shadowGuardian.ts` | None |
| Multi-source scanner | `lib/services/defi.ts` (new), aggregator | API key |
| Persistent scan history | `security_scans` table | New table |
| Watchlist security alert | Reuse alerts | None |
| Batch scan | `app/dashboard/security/batch/page.tsx` (new) | None |
| Phishing-feed ingestion | `lib/jobs/phishing-feed-ingest.ts` (new) | PhishFort feed |

**Acceptance criteria:** Swap blocks (with override) when target token is flagged HIGH RISK; multi-source scan returns combined verdict; recent scans persisted and listed; phishing-feed entries auto-flag in scan results.

---

## Feature 18 — Contract Analyzer

### A) Current State Deep Dive

**Files implementing it:**
- [app/dashboard/contract-analyzer/page.tsx](../app/dashboard/contract-analyzer/page.tsx) — 486 lines
- [app/api/security/contract-analyzer/route.ts](../app/api/security/contract-analyzer/route.ts) — backend
- [lib/services/contract-intelligence.ts](../lib/services/contract-intelligence.ts) — Etherscan/Alchemy contract code + ABI

**Data sources:** Etherscan/Alchemy (contract code, verified status, ABI), GoPlus (security flags), Anthropic (AI analysis layer).

**Architecture pattern:** Page accepts a contract address → fetches code + ABI + GoPlus → optionally calls Claude for plain-English analysis.

**Performance characteristics:** Etherscan API + GoPlus + optional Claude — 1–8s depending on whether AI analysis runs.

**UX quality: 6/10.** Useful but feels like a duplicate of Security Center's contract scan.

**Backend quality: 6/10.** Real data, real AI layer.

**What works well:**
- AI analysis layer reads contract code and explains.
- Verified status surfaced.
- Critical functions (mint, owner, fee setter) called out.

**What is weak or missing:**
- **Overlap with Security Center** — they should be merged or clearly differentiated.
- **No ABI explorer** ("call this read function with these args").
- **No diff view** — "this contract differs from standard ERC-20 in these ways."
- **No proxy-implementation chase** — Etherscan does this, we don't.
- **No upgrade history** — admin functions called over time.
- **No public source like Sourcify cross-check.**
- **No bytecode diff against known templates** (compare to OpenZeppelin baseline).

### B) Industry Standard Comparison

**Etherscan contract page:** ABI explorer, read/write tabs, source code, similar contracts. Free.

**OpenChain ABI decoder:** Decodes any tx via signature DB.

**Tenderly:** Simulation + state inspection.

**Slither / Mythril:** Static analyzers (developer tools).

**Pattern:** Etherscan owns the UI; differentiation is via AI analysis + simulation.

### C) Next-Gen Recommendations

**Highest leverage:**
1. **Merge with Security Center contract scan** OR clearly differentiate (Analyzer = developer-grade, Center = retail-grade).
2. **ABI explorer** (read functions callable in-app).
3. **Bytecode diff against templates.**
4. **Proxy chase.**
5. **VTX-driven explanation streaming.**

### D) Priority and Effort

- **Current score: 6/10.**
- **Effort to 9/10: Medium (1.5 weeks).**

### E) Session 5 Work Items

| Item | Files | APIs / Tables |
|---|---|---|
| ABI explorer | `components/contract/ABIExplorer.tsx` (new) | None |
| Bytecode diff | `lib/contract/bytecodeDiff.ts` (new) | OpenZeppelin baseline files |
| Proxy chase | `lib/contract/proxyChase.ts` (new) | None |
| Merge with Security Center | Decide on architecture | None |

**Acceptance criteria:** ABI read functions callable in-app; proxy implementation traced; bytecode similarity to known templates reported.

---
