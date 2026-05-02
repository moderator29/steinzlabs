# Steinz Labs §1 Audit Findings — 2026-05-02

Running log. Agents 1-12 reports captured verbatim. Critical+High gets fixed inline; Medium+Low rolls into TECHNICAL_DEBT.md.

---

## Agent 1 — Frontend Routes (app/)

**Critical**
- `app/terms/page.tsx` ~L30 — dead link to `/pricing` (route does not exist) → create page or change href to `/dashboard/pricing`

**High**
- `app/admin/layout.tsx` L1 — admin panel not wrapped in SecurityGate (Session-C §5 requirement)
- 83 `'use client'` pages have no `Metadata` export → convert auth/admin to server components or use `generateMetadata`

**Medium**
- 0 `not-found.tsx` files in entire codebase; dynamic routes (`/share/[id]`, `/dashboard/token-preview/[id]`) have no 404 handler
- Only 2 `loading.tsx` files; 40+ dashboard pages lack loading states
- `app/admin/layout.tsx` L48-51 — sessionStorage access without `typeof window` hydration guard

**Low**
- `app/layout.tsx` L22, L26 — hardcoded fallback `https://steinzlabs.vercel.app` (canonical is `nakalabs.xyz`)
- `app/auth/callback/page.tsx` L68, L80, L91 — `window.location.href = '/dashboard'` should be `router.push()`

---

## Agent 2 — Components & Hooks

**Critical**
- `components/clusters/Cluster2DGraph.tsx:62` — `.toLowerCase()` on Solana address bypasses `lib/utils/addressNormalize.ts`
- `components/whales/WhaleAvatar.tsx:31,51` — same
- `components/ProfileTab.tsx` — 1648 LOC, mixed concerns (auth, notifications, chat, preferences) → split into NotificationPanel/ChatPanel/PreferencesModal/SettingsModal

**High**
- `components/common/TokenLogo.tsx:33,35` — `any[]` on Dexscreener pairs reduce/array → add `TokenPair` interface
- `components/ContextFeed.tsx:75,285,298,311,431` — Event params typed `any` throughout → `Event | FeedEvent` union
- `components/clusters/ClusterGraph.tsx:91-97` — D3 selectors typed `any` → add `GraphNode`, `GraphLink` interfaces
- `components/VtxAiTab.tsx:114,449,502,756,1028` — inline style objects on renders → Tailwind arbitrary values or CSS modules

**Medium**
- `components/ProfileTab.tsx:75` — SharePopup useEffect lacks fetch abort on cleanup; closure over `event` prop = stale captures → wrap in useCallback
- `components/ProfileTab.tsx:106` — multiple async state updates in notif loading without race guard → mounted flag or AbortController
- `components/VtxAiTab.tsx:548,614` — no memoization on AudioContext chime generation or chart dynamic import
- `components/ContextFeed.tsx` — chain filter tabs missing `aria-label`; share/bookmark missing `aria-pressed` (WCAG AAA gap)
- `components/markets/Markets.tsx:62,101,102,146` — symbol `.toLowerCase()` for keys is OK, but L62 fallback duplicates L146 (DRY)

**Low**
- `hooks/market/useLivePrice.ts` — flash state update on price change with no debounce → can spam re-renders
- `components/ProfileTab.tsx:1617` — ProfileRow icon prop should be `React.ReactNode` not `React.ElementType`
- `components/i18n/LanguageSwitcher.tsx:41` — click-outside listener pattern duplicated in ThemeToggle → extract `useClickOutside` hook

---

## Agent 3 — lib/services

**Critical**
- `lib/services/zerox.ts:39,294` — `.toLowerCase()` on address for native token / chain lookup; bypasses `normalizeAddress`
- `lib/wallet/autoConnect.ts:64-65` — `.toLowerCase()` comparison on stored address; risk: case-sensitive Solana addresses treated equivalent to EVM
- `lib/wallet/pendingSigner.ts:199` — same
- `lib/security/goplusService.ts:79,25` — `.toLowerCase()` on contract address (note: GoPlus requires exact case for Solana, lowercase for EVM — must branch via `normalizeAddress`)
- `lib/services/supabase.ts:99-206` — inconsistent error handling: returns null/boolean/silent — standardize on `Result<T>` or throw

**High**
- `lib/intelligence/holderAnalysis.ts` (629 LOC) — exceeds 500-line threshold, signal analysis 5+ nesting levels, no JSDoc on 15+ exported types
- `lib/services/cluster-detection.ts` (524 LOC) — duplicates scoring logic from `intelligence/holderAnalysis.ts` (L70-77)
- `lib/services/anthropic.ts:323-334` — `tagToolsForCache()` mutates with `cache_control` violating `Anthropic.Tool` type; L334 `as Anthropic.Tool` cast → cache may not actually apply (CRITICAL for cost; verify cache hit rate)
- `lib/services/birdeye.ts` (456 LOC, 31 exports) — 3x error-handling duplication across balances/prices/holders
- `lib/services/index.ts` — no JSDoc on barrel exports

**Medium**
- `lib/copy/matcher.ts` ↔ `lib/sniper/matcher.ts` — identical Pearson correlation + signal weights, no shared util
- `lib/chain-explorer.ts:7-18` — hardcoded URLs for 11 block explorers, no fallback
- `lib/services/alchemy-solana.ts:9-10` — RPC URL hardcoded fallback if env missing, no circuit breaker
- `lib/agents/cluster-agent.ts:165`, `lib/agents/sniper-agent.ts:144` — hardcoded `http://localhost:3000` if `NEXT_PUBLIC_APP_URL` unset
- `lib/email.ts:122` — same fallback `https://nakalabs.xyz` hardcoded
- `lib/subscriptions/tierCheck.ts` + `lib/subscriptions/apiTierGate.ts` — tier logic inlined across 3 files; inconsistent

**Low**
- `lib/utils/detectDevice.ts:11-69` — `hasEthereumProvider()` + `hasMetaMaskExtension()` both check `window.ethereum`, redundant
- `lib/telegram/commands/resolveSymbol.ts` — manual symbol mapping unmaintained
- `lib/services/goplus.ts` — `CHAIN_MAP` (L10-22) duplicated in zerox.ts
- `lib/market/constants.ts` — no validation on exported magic numbers (slippage, fee bps)

---

## Agent 4 — API Routes

266 routes audited.

**Critical**
- `app/api/builder-submissions/route.ts` — hardcoded password `'195656'` for admin approval → remove inline auth, use `verifyAdminRequest()`
- `app/api/builder-submissions/route.ts` POST — zero input validation on apply_builder/submit_project (no zod, sanitize on search only) → validate wallet addr, URLs, portfolio URLs

**High**
- `app/api/admin/users/route.ts` — PII masking only on list view; full email leaks when admin opens single-user detail (`?reveal=1`) → mask in all response contexts
- `app/api/sniper-detect/route.ts` (webhook) — no rate limiting on Alchemy/Helius events → per-IP/chain throttle (50/min)
- `app/api/auth/signin/route.ts:103` — returns full user object → mask sensitive fields, return only session token
- `app/api/telegram/webhook/route.ts:167` — callback_query `ack` before tier-gate check on snipe cmd → check tier first
- `app/api/copy-trading/execute/route.ts:109-116` — IDOR: guards exist but fail silently when no source rule matches → hard 403
- `app/api/admin/sniper-executions/route.ts` — returns 100 recent without pagination, no per-user scope → add limit + admin-managed-users scope
- `app/api/sniper/route.ts:120` POST — accepts chain + address with minimal validation → enum chain, checksum/base58 addr

**Medium**
- `app/api/ca-lookup/route.ts:136` — public GET, no auth, leaks raw GoPlus payload → redact internal field names
- `app/api/alerts/route.ts` — no type validation on `target_price` → `number ∈ [0, 1e9]`
- `app/api/alerts/route.ts` DELETE — IDOR on `id`; relies on RLS only → add `.eq('user_id')`
- `app/api/auth/reset-password/route.ts` — no timing-safe compare on token → use `crypto.timingSafeEqual`
- `app/api/wallet/send/route.ts` — does not verify signed tx is signed by user's wallet → `tx.from === user.wallet_address` check before broadcast
- `app/api/sniper/route.ts` — sniper /execute path bypasses tier gate (cron auto-execute) → enforce in execute path
- All cron routes — no `X-Vercel-Cron` / `Vercel-Cron-Signature` validation → header check on `cron/**`

**Low**
- `app/api/telegram/webhook/route.ts:57` — dev mode returns true on missing secret → require secret even locally
- `app/api/admin/users/route.ts` — `sanitizeSearchTerm` blocks `,():%` not SQL wildcards → allowlist alphanumeric+`-_`
- `app/api/sniper/route.ts` POST — error responses leak GoPlus status enum → generic "failed security check"

**Counts:** 266 audited / 2 missing auth / 5 missing input validation / 6 tier-gated / 3 rate-limited

---

(Agents 5–12 results appended as they complete)
