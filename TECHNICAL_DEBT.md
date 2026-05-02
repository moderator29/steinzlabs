# Technical Debt — 2026-05-02

Medium- and Low-severity findings from the §1 12-agent audit that were
deferred from the `chore/repo-cleanup` round. Critical and High findings
were fixed inline; this list is what's left.

Format: `[Priority] file:line — finding — suggested fix`

## Frontend (Agent 1)
- [Med] `app/admin/layout.tsx:48-51` — sessionStorage access without `typeof window` hydration guard. Now superseded by middleware-level admin gate, but client-side check should add the guard for SSR safety.
- [Med] App lacks `not-found.tsx` files. Add one at app root and inside dynamic-segment routes (`/share/[id]`, `/dashboard/token-preview/[id]`).
- [Med] Most dashboard routes have no `loading.tsx`. Add for high-traffic pages: market, swap, sniper, portfolio.
- [Med] 83 `'use client'` pages have no `Metadata` export. Convert auth/admin pages to server components or use `generateMetadata`.
- [Low] `app/layout.tsx:22,26` — hardcoded fallback `https://steinzlabs.vercel.app` (canonical is `nakalabs.xyz`).
- [Low] `app/auth/callback/page.tsx:68,80,91` — `window.location.href = '/dashboard'` should be `router.push()`.

## Components (Agent 2)
- [High] `components/common/TokenLogo.tsx:33,35` — `any[]` on Dexscreener pairs reduce/array. Add `TokenPair` interface.
- [High] `components/ContextFeed.tsx:75,285,298,311,431` — Event params typed `any` throughout. Add `Event | FeedEvent` union.
- [High] `components/clusters/ClusterGraph.tsx:91-97` — D3 selectors typed `any`. Add `GraphNode`, `GraphLink` interfaces.
- [High] `components/VtxAiTab.tsx:114,449,502,756,1028` — inline style objects on renders. Convert to Tailwind arbitrary values or CSS modules.
- [Med] `components/ProfileTab.tsx` — 1648 LOC, mixed concerns. Split into NotificationPanel / ChatPanel / PreferencesModal / SettingsModal.
- [Med] `components/ProfileTab.tsx:75` — SharePopup useEffect lacks fetch abort on cleanup; closure over `event` prop = stale captures. Wrap in useCallback / use AbortController.
- [Med] `components/ProfileTab.tsx:106` — multiple async state updates in notif loading without race guard. Add mounted flag or AbortController.
- [Med] `components/VtxAiTab.tsx:548,614` — no memoization on AudioContext chime generation or chart dynamic import.
- [Med] `components/ContextFeed.tsx` — chain filter tabs missing `aria-label`; share/bookmark missing `aria-pressed` (WCAG AAA gap).
- [Low] `hooks/market/useLivePrice.ts` — flash state update on price change with no debounce. Can spam re-renders.
- [Low] `components/i18n/LanguageSwitcher.tsx:41` — click-outside listener pattern duplicated. Extract `useClickOutside` hook.

## lib/services (Agent 3)
- [High] `lib/intelligence/holderAnalysis.ts` (629 LOC) — exceeds 500-line threshold; signal analysis 5+ nesting levels; no JSDoc on 15+ exported types.
- [High] `lib/services/cluster-detection.ts` (524 LOC) — duplicates scoring logic from `intelligence/holderAnalysis.ts`. Extract shared `signalScoring.ts`.
- [High] `lib/services/birdeye.ts` (456 LOC, 31 exports) — 3x error-handling duplication across balances/prices/holders.
- [Med] `lib/copy/matcher.ts` ↔ `lib/sniper/matcher.ts` — identical Pearson correlation + signal weights, no shared util.
- [Med] `lib/chain-explorer.ts:7-18` — hardcoded URLs for 11 block explorers, no fallback.
- [Med] `lib/services/alchemy-solana.ts:9-10` — RPC URL hardcoded fallback if env missing, no circuit breaker.
- [Med] `lib/agents/cluster-agent.ts:165`, `lib/agents/sniper-agent.ts:144` — hardcoded `http://localhost:3000` if `NEXT_PUBLIC_APP_URL` unset.
- [Med] `lib/email.ts:122` — same fallback `https://nakalabs.xyz` hardcoded.
- [Med] `lib/services/supabase.ts:99-206` — inconsistent error handling: returns null/boolean/silent. Standardize on `Result<T>` or throw.
- [Med] `lib/subscriptions/tierCheck.ts` + `lib/subscriptions/apiTierGate.ts` — tier logic inlined across 3 files; inconsistent.
- [Low] `lib/utils/detectDevice.ts:11-69` — `hasEthereumProvider()` + `hasMetaMaskExtension()` both check `window.ethereum`, redundant.
- [Low] `lib/services/goplus.ts` — `CHAIN_MAP` (L10-22) duplicated in zerox.ts.
- [Low] `lib/market/constants.ts` — no validation on exported magic numbers (slippage, fee bps).

## API Routes (Agent 4)
- [High] `app/api/admin/users/route.ts` — PII masking only on list view; full email leaks when admin opens single-user detail (`?reveal=1`). Mask in all response contexts.
- [High] `app/api/sniper-detect/route.ts` (webhook) — no rate limiting on Alchemy/Helius events. Add per-IP/chain throttle (~50/min).
- [High] `app/api/auth/signin/route.ts:103` — returns full user object. Mask sensitive fields, return only session token.
- [High] `app/api/telegram/webhook/route.ts:167` — callback_query `ack` before tier-gate check on snipe cmd. Check tier first.
- [High] `app/api/copy-trading/execute/route.ts:109-116` — IDOR: guards exist but fail silently when no source rule matches. Hard 403.
- [High] `app/api/admin/sniper-executions/route.ts` — returns 100 recent without pagination, no per-user scope.
- [High] `app/api/sniper/route.ts:120` POST — accepts chain + address with minimal validation. Enum chain, checksum/base58 addr.
- [Med] `app/api/ca-lookup/route.ts:136` — public GET, no auth, leaks raw GoPlus payload. Redact internal field names.
- [Med] `app/api/alerts/route.ts` — no type validation on `target_price`. `number ∈ [0, 1e9]`.
- [Med] `app/api/alerts/route.ts` DELETE — IDOR on `id`; relies on RLS only. Add `.eq('user_id')`.
- [Med] `app/api/auth/reset-password/route.ts` — no timing-safe compare on token. Use `crypto.timingSafeEqual`.
- [Med] `app/api/wallet/send/route.ts` — does not verify signed tx is signed by user's wallet. Add `tx.from === user.wallet_address` check before broadcast.
- [Med] `app/api/sniper/route.ts` — sniper /execute path bypasses tier gate (cron auto-execute). Enforce in execute path.
- [Med] All cron routes — no `X-Vercel-Cron` / `Vercel-Cron-Signature` validation. Add header check on `cron/**`.
- [Low] `app/api/telegram/webhook/route.ts:57` — dev mode returns true on missing secret. Require secret even locally.
- [Low] `app/api/admin/users/route.ts` — `sanitizeSearchTerm` blocks `,():%` not SQL wildcards. Allowlist alphanumeric+`-_`.
- [Low] `app/api/sniper/route.ts` POST — error responses leak GoPlus status enum. Generic "failed security check".

## DB / Migrations (Agent 5)
- [Med] `whale_transactions` foreign keys (from copy_trades, whale_tracking, whale_submissions) inherit default RESTRICT on delete. Decide on CASCADE vs SET NULL and document.
- [Note] `pending_trades_active` is a VIEW not a table — Agent 5's "constraint mismatch" claim was a false positive. View column nullability is independent of underlying table.
- [Note] `user_wallets_v2` JSONB address — application-layer parsing only, no DB-level format validation. Acceptable given JSONB schema flexibility.

## Auth / Session (Agent 6)
- [High] `app/api/auth/forgot-password/route.ts` — no rate limit on password-reset emails. Add max 3 resets per email per 30min via `check-rate-limit`.
- [High] Middleware `SESSION_MAX_AGE = 1h` caps cookie maxAge but doesn't shorten Supabase JWT TTL. Verify Supabase auth config matches 1h.
- [High] `lib/hooks/useAuth.ts` signOut — does not call `getAppKit()?.disconnect()`, leaving WalletConnect session connected.
- [High] SignOut path doesn't clear SWR/TanStack Query caches. Add `queryClient.clear()` on logout.
- [Med] `lib/authTokens.ts` — fixed in cleanup round (server-stored tokens). Confirm no other email/verification flows still use the legacy HMAC pattern.
- [Med] `app/api/auth/check-rate-limit/route.ts:108-111` — fail-open on DB unavailability for auth endpoints. Switch to fail-closed or fast in-memory cache fallback.
- [Med] Wallet nonce should include chain in signed message and validate server-side. Already partially done — verify enforcement.
- [Med] `app/api/auth/verify-turnstile/route.ts:16-20` — `'dev-bypass'` token accepted in dev. Gate behind explicit env var.
- [Med] No client IP validation on wallet nonce. Record `client_ip` in `auth_wallet_nonces` and validate on verification.
- [Low] Middleware aggressive cookie rewrite (every request to /dashboard or /admin). Justified by cookie-budget defense; observe-only.
- [Low] `app/api/auth/confirm-user/route.ts` — public endpoint, no rate-limit, can confirm any email. Either delete (looks unused) or admin-gate.

## Wallet (Agent 7)
- [High] `app/api/wallet/sync/route.ts:43-47` — GET returns raw encrypted wallet keys without rate limit. Add per-user rate limit (3/hour) and require additional verification (TOTP / passphrase).
- [High] `lib/wallet/pendingSigner.ts:129,139` — Solana pubkey stored in localStorage. Move to sessionStorage with auto-clear on page unload.
- [High] `app/api/wallet/approvals/route.ts:6-18` — GET takes `?wallet=&chain=` without auth. Require `wallet` matches authenticated user's wallet or trusted contact list.
- [High] `lib/wallet/wallet-storage.ts:18-36` — no minimum password strength. Enforce 16+ chars with entropy check; show strength meter; warn on <20-bit entropy.
- [High] `pendingSigner.ts:204` — decrypted private key held as plain string in memory. Wrap in `Uint8Array`, overwrite with `crypto.getRandomValues()` after use.
- [Med] `app/api/wallet/send/route.ts:42-48` — buggy RPC URL check (double-negative tautology). Simplify and validate all RPCs at startup.
- [Med] `app/api/wallet/sync/route.ts:95-100` — merge logic doesn't validate incoming encrypted payload structure. Parse and validate before merge.
- [Med] `lib/hooks/useWallet.ts:59-61` — balance fetch reads `localStorage.wallet_address` without checksum validation.
- [Low] `lib/wallet/deeplink.ts:44-65` — Phantom deeplink `dapp_encryption_public_key` set to URI itself, not the ephemeral key.
- [Low] `components/wallet/AppKitBridge.tsx:42` — provider detection uses CAIP-2 namespace alone; mislabels Glow/Marinade as 'phantom'.

## VTX / AI (Agent 8)
- [High] `app/api/vtx-ai/route.ts:549-587` — `executeWhaleProfile` queries whales table with admin privileges, no tier gate. Free users can enumerate Pro+ whale data. Add tier check in tool executor.
- [High] No per-conversation token cap. `vtxQuery` loops up to 5 iterations × 4096 tokens. Track cumulative tokens per user per day; reduce Advisor `max_uses` to 1 for free/mini.
- [Med] `app/api/vtx-ai/route.ts:1042-1044` — tier-check failure silently falls through to free. Log to Sentry with user_id.
- [Med] History array DoS — fixed in cleanup round (HISTORY_HARD_CAP=100).
- [Low] Response post-processing strips markdown but doesn't HTML-escape. Currently safe (returned as JSON, frontend renders as text), but document and add a test.

## Whale / Sniper / Copy (Agent 9)
- [Med] `lib/sniper/autosell.ts:37-67` — entry_price_usd NULL handling. Cron must check IS NOT NULL before evaluatePosition().
- [Med] `app/api/whales/submissions/route.ts:36-64` — no admin verification on whale submissions. Add submission approval queue (status='pending'); admin review before whales-table insert; rate-limit per user.
- [Med] `app/api/admin/whales/verify/route.ts:38-76` — RPC errors silently mark whales "alive". Add exponential backoff retry; soft-flag as "unverifiable" after N failures.
- [Med] `app/api/copy-trading/execute/route.ts:124` — `body.token_address.toLowerCase()` vs mixed-case rule blacklist. Use `addressNormalize`.

## Admin Panel (Agent 10)
- [High] `app/api/admin/research/route.ts:5-10` — uses custom `verifyAdmin()` instead of `verifyAdminRequest()`. POST/PATCH/DELETE have no audit logging. Standardize.
- [High] `app/api/admin/research/upload/route.ts:9-14` — same custom auth pattern, no audit log on uploads.
- [High] `app/api/admin/announcements/route.ts:29-112` — no audit logging on POST/PATCH/DELETE. Add admin_audit_log entries.
- [High] `app/api/admin/email-templates/route.ts:29-121` — no audit logging on email template mutations.
- [High] `app/api/admin/support-tickets/reply/route.ts:90-150` — no audit log when admin replies. Log the reply post.
- [High] `app/api/admin/whale-submissions/route.ts:69-163` — no audit log on approve/reject.
- [Med] `app/api/admin/users/route.ts:154-174` — email mask pattern leaks domain. Consider rate-limiting mass exports.
- [Med] `app/api/admin/broadcast/route.ts:19-22` — queries `profiles.email` directly without sanitization. Add audit trail for broadcast sends.
- [Med] `app/api/admin/settings/route.ts:25-30` — platform_settings upserts have no audit logging.
- [Med] `app/api/admin/verify/route.ts:1-13` — appears unused. Verify and remove if truly unused.
- [Low] `app/api/admin/stats/route.ts:22` — recent users list returned with unmasked email.
- [Low] `app/api/admin/treasury/route.ts` — confirm HTTPS-only enforcement in prod.

## Config / Env (Agent 11)
- [Med] `next.config.js:23,26` — `ignoreDuringBuilds: true`, `ignoreBuildErrors: true`. Set to false; treat build as hard error in CI.
- [Med] `sentry.client.config.ts:15-20` — `beforeSend` only clears cookies. Extend to scrub wallet addresses in URLs/breadcrumbs, request bodies, tx hashes, emails.
- [Med] Server-side API routes use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY` where service role would be appropriate. Audit and switch where needed.
- [Med] `vercel.json` — no security headers. Headers in middleware.ts only; edge functions don't inherit. Add CSP, X-Frame-Options to vercel.json.
- [Low] `JWT_SECRET="steinzlabs-stainlessomojuni-2026"` is predictable. Generate cryptographically random 32+ char secret.
- [Low] Unused env vars in `.env.local` (ADMIN_PASSWORD, TURBO_*, VERCEL_GIT_*, NX_DAEMON). Remove.

## Build / Deps (Agent 12)
- [Low] `@wagmi/core@2.22.1` (installed) vs `2.21.2` (declared by @wagmi/connectors@5.11.2) — minor version drift, build passes. Patch @wagmi/connectors or upgrade.
- [Low] `@emnapi/runtime@1.9.2` extraneous. `npm remove @emnapi/runtime`.
- [Low] No `engines` field in package.json. Add `"engines": { "node": ">=20.0.0" }`.
- [Low] `depcheck` failed due to webpack issue in next-intl plugin — investigate and re-run.

## Address Normalization (post-fix #14 follow-up)
The §1 audit flagged 6 specific callsites which are now patched. A repo-wide
sweep for any remaining `.toLowerCase()` on a string that holds an address
should run and route through `lib/utils/addressNormalize.ts`. Not Critical;
known callsites are fixed.
