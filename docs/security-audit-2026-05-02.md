# Steinz Labs — Security Audit Report

**Date:** 2026-05-02
**Methodology:** §1 12-agent codebase audit (read-only specialist agents) + §2 red-team threat-model synthesis + live Supabase advisor verification.
**Scope:** Frontend, backend APIs, authentication / authorization, database & storage, infrastructure & deployment, third-party integrations & dependencies.
**Auditor:** Internal — Naka Labs.

---

## 1. Vulnerability Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 14 | 13 fixed in repo / 1 owner action required (secret rotation) |
| High | 30+ | tracked in TECHNICAL_DEBT.md and SECURITY_BACKLOG.md |
| Medium | 60+ | TECHNICAL_DEBT.md |
| Low | 25+ | TECHNICAL_DEBT.md |

**Supabase advisor**: 36 findings → 3 (1 deferred extension move, 1 accepted is_admin SECURITY DEFINER for RLS helpers, 1 dashboard-only leaked-password-protection toggle).

**TypeScript / build**: 0 errors after fixes.

---

## 2. Threat Model

### 2.1 Attacker Profiles

| Profile | Capabilities | Primary targets |
|---------|--------------|-----------------|
| **Anonymous user** | Browses public routes, no account. | Public APIs (whales, pricing), webhook endpoints, signup flows. |
| **Authenticated user** | Holds an account, may have a wallet linked, lives at any tier. | Other users data (IDOR), tier bypass, sniper / copy abuse, prompt injection. |
| **Insider (admin / team)** | Elevated privileges. Compromised account = catastrophic. | Mass-assignment on admin endpoints, audit-log gaps, unmasked PII exposure. |
| **API consumer** | Programmatic access. | Rate-limit bypass, scraping, automation of abuse. |
| **Sophisticated attacker** | Combines techniques, automated tooling, sustained pressure. | Multi-step exploit chains, supply-chain entry, secret exfiltration. |

### 2.2 Trust Boundaries

```
[ public Internet ]
       |
       |  -- HSTS / sec headers -- (middleware.ts)
       v
[ Edge / Middleware ]    <- trust boundary 1: anyone can reach this
       |  -- Supabase auth check --
       |  -- /admin/* role gate (NEW) --
       v
[ API Route Handlers ]   <- trust boundary 2: authenticated user identity is set
       |  -- withTierGate(...) --
       |  -- zod validation --
       |  -- verifyAdminRequest(...) on /api/admin/* --
       v
[ Service Layer ]        <- trust boundary 3: server-only secrets allowed
       |  -- outbound HMAC signatures (webhooks) --
       |  -- rate-limited per provider --
       v
[ External APIs ]        <- trust boundary 4: untrusted data returns
       |  -- input validated again on the way back --
       v
[ Supabase Postgres ]    <- trust boundary 5: RLS is the last line
       |  -- service_role bypasses RLS, server-side only
       v
[ Browser (wallet seed) ] <- trust boundary 6: AES-256-GCM at rest
                             keys never leave the browser
```

### 2.3 Sensitive Assets

- **User funds.** Self-custodial — keys live in the browser, encrypted. The platform never holds them.
- **Seed phrases / private keys.** AES-256-GCM at rest, PBKDF2/100k/SHA-256, never logged, never sent to the server.
- **Auth credentials.** Passwords (Supabase-managed bcrypt), session JWTs (httpOnly + secure), reset/verify tokens (server-stored, hashed, single-use).
- **PII.** Email addresses, IP addresses (in `activity_log`), wallet addresses (cross-chain), Telegram chat IDs.
- **Platform tokens / quotas.** Anthropic input/output token cost, Alchemy / Helius quota, GoPlus quota.
- **Whale data.** 449 verified whale wallets + 36k+ activity rows. Mostly public on-chain data, but the curation is platform IP.

---

## 3. Detailed Findings

Format: **[ID]** Severity — Component — Description / Exploitation / Impact / Recommended fix / Status.

Status legend: shipped (commit referenced) / owner action required / documented in backlog / accepted risk.

### 3.1 Critical

**[C-01]** Critical — `app/api/builder-submissions/route.ts` — Hardcoded admin password
- *Description:* The literal string `195656` was the only authentication for admin_approve / admin_reject / approve_milestone mutations on builder applications and project funding state.
- *Exploitation:* Anyone with the URL and the password (likely already leaked given how it was checked) could approve any builder, change any project funding state, mark any milestone complete.
- *Impact:* Reputation damage, fraudulent project listings, milestone-based fund release manipulation.
- *Fix:* Replaced with verifyAdminRequest() (Supabase JWT + role check). Added input validation on apply_builder / submit_project (wallet address regex, URL regex, length caps, milestone/tag/skill sanitization, goal range).
- *Status:* Shipped in `eec6cb5`.

**[C-02]** Critical — `app/api/sniper/execute/route.ts` — Unauthenticated sniper execution + arbitrary user_id
- *Description:* The POST handler accepted an optional `userId` field with zero authentication and no tier gate.
- *Exploitation:* Attacker POSTs with any victim user_id. sniper_executions row is logged against the victim, polluting their trade history and stats. Free-tier users could run unlimited Pro-only sniper safety checks.
- *Impact:* Cross-user data pollution, free-tier bypass, audit-trail contamination.
- *Fix:* Wrapped in `withTierGate('pro')`. user_id derived from authenticated session. Client-supplied userId removed from zod schema.
- *Status:* Shipped in `9bdeb1d`.

**[C-03]** Critical — `app/api/vtx-ai/route.ts:1098-1130` — VTX prompt injection
- *Description:* personality, language, riskAppetite, depth from the request body were trim()ed and typeof-checked but otherwise interpolated raw into the system-prompt template via .replace().
- *Exploitation:* personality set to a string containing override instructions lands verbatim in the system prompt and can override tier-gating, tool-use rules, or coax the model into leaking the system prompt itself.
- *Impact:* System-prompt leak, tier-gating override, tool-use redirection, cost amplification (forced expensive Opus loops).
- *Fix:* Each of the four fields validated against an explicit allow-list (PERSONALITIES, LANGUAGES, RISKS, DEPTHS) before interpolation. Plus HISTORY_HARD_CAP=100 to prevent DoS via huge history arrays.
- *Status:* Shipped in `1714594`.

**[C-04]** Critical — `lib/wallet/pendingSigner.ts` + `app/dashboard/swap/page.tsx` + `app/dashboard/wallet-page/page.tsx` — XOR fallback on wallet decryption
- *Description:* Three callsites had a legacy XOR fallback (key XORed against the password keystream) used when the AES-GCM iv was missing from the stored wallet blob.
- *Exploitation:* XOR with a password keystream is a classic stream-cipher mistake. Known-plaintext attack recovers the password directly given any portion of plaintext (which includes BIP39 word patterns).
- *Impact:* Recovery of seed phrase from any pre-migration wallet ciphertext + password.
- *Fix:* Removed all three fallback paths. Affected wallets see a clear error directing them to re-import the seed phrase, which writes back in AES-256-GCM (PBKDF2/100k/SHA-256).
- *Status:* Shipped in `2baf0c8`.

**[C-05]** Critical — `app/api/admin/coingecko-usage/route.ts` — Zero auth on admin GET
- *Description:* GET endpoint returned the in-memory CoinGecko call counter to anyone.
- *Exploitation:* Reveals internal API call patterns and potentially helps time exploit attempts.
- *Impact:* Information disclosure, low blast radius but pattern of unauthenticated admin endpoints.
- *Fix:* Added verifyAdminRequest() gate.
- *Status:* Shipped in `eec6cb5`.

**[C-06]** Critical — `app/api/admin/featured-tokens/route.ts:75` — Mass assignment on PATCH
- *Description:* PATCH handler did .update(body) with raw request body, no field whitelist.
- *Exploitation:* CSRF or compromised admin UI could write to any column on featured_tokens, including unintended fields.
- *Impact:* Schema integrity violation, persistence layer corruption.
- *Fix:* Explicit field whitelist (symbol, name, chain, address, display_order, active, badge). Reject empty updates with 400.
- *Status:* Shipped in `eec6cb5`.

**[C-07]** Critical — `app/api/webhooks/alchemy-whale/route.ts:76` — Dev-mode signature bypass
- *Description:* `if (keys.length === 0) return true` allowed unsigned webhook payloads when no signing keys were configured.
- *Exploitation:* Attacker POSTs forged Alchemy ADDRESS_ACTIVITY payload. Rows insert into whale_activity. SSE stream broadcasts fake activity to all watchers. Copy-trade matcher fan-outs trigger user trades.
- *Impact:* Whale data pollution, false copy-trade triggers (potential user fund loss).
- *Fix:* In production (NODE_ENV === 'production') the absence of signing keys fails closed. Local-dev escape hatch requires explicit ALCHEMY_WEBHOOK_DEV_BYPASS=true.
- *Status:* Shipped in `eec6cb5`.

**[C-08]** Critical — `app/api/webhooks/helius-whale/route.ts:64` — Non-timing-safe header compare
- *Description:* `req.headers.get('authorization') === expected` is plain string equality. Vulnerable to timing attack.
- *Exploitation:* Attacker brute-forces the secret one character at a time using response-time analysis.
- *Impact:* Webhook auth bypass — same impact as [C-07] for Solana side.
- *Fix:* Replaced with crypto.timingSafeEqual with prior length check. Same prod fail-closed posture as [C-07].
- *Status:* Shipped in `eec6cb5`.

**[C-09]** Critical — `lib/wallet/walletSession.ts` — Module-level wallet session key
- *Description:* `let _walletSessionKey: string | null = null` at module scope, exported via getter. Any XSS payload could read it.
- *Exploitation:* XSS payload imports the module and calls getWalletSessionKey() to send the key off-domain. Wallet decryption follows on the user own tab.
- *Impact:* Wallet exfiltration on XSS.
- *Fix:* Closure-private state, 30-min sliding TTL, evicted on pagehide and on visibilitychange-to-hidden.
- *Status:* Shipped in `2baf0c8`.

**[C-10]** Critical — `lib/services/anthropic.ts:323-334` — Anthropic Tool cast hiding cache
- *Description:* `as Anthropic.Tool` cast on tagToolsForCache return was masking a real-or-phantom type error and made the audit suspect prompt cache was not actually applying.
- *Exploitation:* Not directly exploitable, but high-cost: prompt cache failure roughly 5x Claude API spend per request.
- *Impact:* Cost amplification (financial, not security per se).
- *Fix:* Removed the cast. Current Anthropic SDK supports cache_control natively on Tool. Wire payload unchanged, types now honest.
- *Status:* Shipped in `2baf0c8`.

**[C-11]** Critical — `lib/authTokens.ts` — Predictable HMAC reset/verify tokens
- *Description:* Reset tokens were base64url(userId.slice(0,8) + sha256(userId:email:reset:hour).slice(0,8) + 'reset'). About 32 bits of entropy, hour-bucketed (2h validity window), replayable, no server-side revocation.
- *Exploitation:* 32 bits is roughly 4 billion values, brute-forceable without per-user rate limit. Replay possible within the bucket. No way to invalidate a stolen token.
- *Impact:* Account takeover via reset-token forgery.
- *Fix:* Replaced with 256-bit random tokens (crypto.randomBytes), SHA-256 hashed in auth_tokens table, atomic UPDATE-RETURNING for single-use consume, 30-min TTL for reset / 24h for verify, issuing a new token of the same kind invalidates the prior one.
- *Status:* Shipped in `1714594`.

**[C-12]** Critical — `.env.local` — Live secrets on disk
- *Description:* The file is gitignored (verified) and was never committed (`git log --all --diff-filter=A` clean), but the on-disk plaintext means any process or backup that touches it holds production credentials.
- *Exploitation:* Local exfiltration via malware, backup software, OS-level file leak.
- *Impact:* Full RLS bypass via SUPABASE_SERVICE_ROLE_KEY, AI cost via ANTHROPIC_API_KEY, RPC quota via Alchemy/Helius keys.
- *Fix (owner action):* Rotate every secret in Vercel dashboard in this order: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, ALCHEMY_API_KEY, HELIUS keys, JWT_SECRET (forces all sessions to expire), everything else. After rotation, regenerate .env.local from the new values or delete it entirely.
- *Status:* Owner action — documented in SECURITY_BACKLOG #1.

**[C-13]** Critical — `app/admin/layout.tsx` — Frontend-only admin auth
- *Description:* Admin pages were guarded only by a sessionStorage admin_token check inside the layout. Pages were reachable without it. Only API endpoints rejected unauthenticated requests.
- *Exploitation:* Direct navigation to /admin/* rendered the page (with empty data). APIs blocked the data calls but page-level access was de facto granted.
- *Impact:* Information leakage via empty-state inspection, layout/UX of admin features visible.
- *Fix:* middleware.ts now verifies profiles.role = 'admin' before any /admin/* page renders. Non-admins redirect to /dashboard?denied=admin.
- *Status:* Shipped in `2baf0c8`.

**[C-14]** Critical — Cross-cutting — Address normalization (Solana case-sensitivity)
- *Description:* 6 callsites called .toLowerCase() directly on addresses. EVM is case-insensitive (lowercasing is fine), but Solana base58 is case-sensitive (lowercasing breaks lookups). Affected: lib/services/zerox.ts, lib/wallet/autoConnect.ts, lib/wallet/pendingSigner.ts, lib/security/goplusService.ts, components/clusters/Cluster2DGraph.tsx, components/whales/WhaleAvatar.tsx.
- *Exploitation:* Solana wallet operations silently fail or match wrong addresses. In pendingSigner the active built-in wallet lookup could miss a Solana wallet stored with mixed case, leading to wallet-not-found when the user has the right wallet.
- *Impact:* Bug class, not direct attack. But repeated bug class in a security-sensitive codebase is itself a risk.
- *Fix:* Added canonical lib/utils/addressNormalize.ts with normalizeAddress, addressesEqual, isEvmAddress, isSolanaAddress, isEvmChain. Routed all 6 callsites through it. CLAUDE.md project rule now bans direct .toLowerCase() on addresses going forward.
- *Status:* Shipped in `9bdeb1d`. Repo-wide sweep deferred to TECHNICAL_DEBT.md.

### 3.2 High — Status Summary

30+ High findings across the 12 audit agents. Documented individually in [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md). Notable categories:

- **Account enumeration via differing signup/lookup/resend errors.** Industry-standard fix: uniform "if this email exists, we sent a link" response. Backlogged.
- **Forgot-password endpoint missing rate limit.** Email-bombing vector. Backlogged.
- **Wallet sync GET returns ciphertext without rate limit.** Hardening backlog.
- **Wallet password no minimum entropy enforcement.** Hardening backlog.
- **whale_profile VTX tool has no tier gate.** Premium data enumerable. Backlogged.
- **VTX no per-user-per-day token budget.** Cost amplification possible up to roughly 1M tokens/day per malicious user. Backlogged.
- **Admin endpoints with missing audit logging:** research, announcements, email-templates, support-tickets reply, whale-submissions, settings, broadcast, featured-tokens. Backlogged.
- **Cron routes missing Vercel-Cron-Signature header check.** Backlogged.
- **Custom dev-bypass tokens left in code paths** (Turnstile, Telegram secret missing). Backlogged.

### 3.3 Medium / Low

Aggregated in [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md).

---

## 4. Attack Chains

Multi-step exploits combining individual findings.

### 4.1 Chain A — Free-tier sniper abuse, cross-user history pollution, reputation manipulation

1. Attacker creates a free account ([C-02], pre-fix).
2. Attacker calls /api/sniper/execute with userId set to a high-reputation user.
3. Sniper safety flow runs (5 steps), execution row inserts into sniper_executions against the victim user_id.
4. Victim public profile shows fabricated sniper executions, including loss-making ones the attacker cherry-picked.

**Mitigation:** [C-02] fix (server-derived user_id from session) breaks step 2.

### 4.2 Chain B — Webhook forgery, fake whale event, automated copy-trade trigger

1. Attacker discovers ALCHEMY_WEBHOOK_SIGNING_KEYS is missing in production ([C-07], pre-fix).
2. Attacker POSTs forged Alchemy ADDRESS_ACTIVITY payload to /api/webhooks/alchemy-whale.
3. Row inserts into whale_activity for a tracked whale.
4. matchCopyEvent() fans out to user copy rules. Users with auto-copy on that whale execute trades against an attacker-controlled token.
5. Attacker (who owns the LP) drains incoming buys.

**Mitigation:** [C-07] fail-closed in production breaks step 2.

### 4.3 Chain C — Reset-token forgery, account takeover, wallet exfiltration

1. Attacker enumerates valid emails via signup/lookup error differences (Backlog item).
2. For a target user, attacker brute-forces the 32-bit reset token within the 2-hour bucket ([C-11], pre-fix).
3. Reset succeeds. Attacker sets a new password and logs in.
4. Attacker uses the in-app wallet password (set during reset, or social-engineered) to attempt wallet decryption. Fails AES, but pre-fix could fall through to XOR decrypt ([C-04], pre-fix).
5. Seed phrase recovered.

**Mitigation:** [C-11] (256-bit random + atomic single-use) breaks step 2. [C-04] (XOR removal) breaks step 4. Account-enumeration fix (backlog) breaks step 1.

### 4.4 Chain D — Compromised admin, mass-assignment, silent feature-flag flip

1. Admin token leaks (phishing, dev machine, etc.).
2. Attacker calls PATCH /api/admin/featured-tokens?id=X with a body that writes to columns the UI does not expose ([C-06], pre-fix).
3. Mass assignment writes to columns that should not be writable.
4. (Combined) Attacker calls another admin endpoint missing audit logging (backlog item) to make the change leave no trace.

**Mitigation:** [C-06] (field whitelist) breaks step 3. Audit-log gaps (backlog) need closing for step 4.

---

## 5. Secure Design Recommendations

These are architectural improvements that go beyond fixing individual findings.

1. **Defense-in-depth on tier checks.** Every Pro+ feature should pass through withTierGate() AND check tier server-side a second time at the action boundary (not at the route boundary). Some routes still rely on a single check.
2. **Tokenize all server-stored short-lived secrets.** The auth_tokens pattern (lib/authTokens.ts) should be the template for any other place we issue a token: webhook auth headers, magic links, support session tokens. Atomic-consume + TTL + opaque hash storage.
3. **Constant-time everywhere.** Audit grep for `===` against any user-supplied secret-shaped input (token, signature, secret header). Replace with crypto.timingSafeEqual after a length check.
4. **PII scrubbing in observability.** Sentry already drops cookies. Extend beforeSend to scrub wallet addresses in URL params, request bodies, error messages, breadcrumb data. Same for PostHog properties.
5. **Webhook rate limits.** Signature verification is in place but no per-IP / per-chain rate limit. A compromised signing key would let an attacker spam events. Rate limits cap that blast radius.
6. **WebAuthn for wallet decryption (long-term).** The browser-memory wallet session key, even with sliding TTL, is reachable by any same-origin script. WebAuthn-gated decryption (or service-worker isolation) eliminates the XSS-exfiltration class entirely.
7. **CODEOWNERS + branch protection.** Already documented in the GitHub UI checklist. Apply when ready. Auth, wallet, security, and migration paths should require maintainer review.
8. **Secret scanning + push protection.** GitHub secret scanning + push protection should be enabled (UI checklist). Catches secrets before they hit the remote.
9. **Sniper kill switch as deploy-independent toggle.** The kill switch lives in platform_settings.sniper_enabled (good — toggleable without redeploy). Document a runbook for "how to flip the switch" so it is actually used in incidents.
10. **Server-side audit log on every admin mutation.** Several admin endpoints do not write admin_audit_log rows. Make it impossible to ship a new admin endpoint without an audit-log call (lint rule or shared wrapper).

---

## 6. Compliance Notes

### GDPR / CCPA

- **Data captured:** email, IP (activity_log.ip_address), wallet addresses, Telegram chat IDs, VTX conversation history, login activity. Profile photos optional.
- **Data deletion:** /api/account/delete exists. Verify cascade across all user-scoped tables. Most have ON DELETE CASCADE on the user_id FK. Spot-check support_tickets, whale_tracking, notifications, vtx_conversations, feature_usage, search_logs, activity_log.
- **Data export:** A self-service export endpoint is not currently implemented. Required for GDPR Article 20 (data portability) and CCPA equivalent.
- **Cookie banner / consent:** Required if serving EU/CA users. Current state: not implemented; only essential cookies are set (auth, no advertising).
- **Privacy policy:** Required at the application boundary. Should link to /privacy from the footer.
- **Data Processing Addendums (DPAs):** Required with sub-processors — Supabase, Anthropic, Alchemy, Helius, Sentry, Resend. Each provider has a public DPA. Confirm signed/accepted state.

### SOC 2

- **Not currently in scope.**
- The audit-logging table (admin_audit_log) and the per-cron logging (cron_execution_log) are foundations. Full SOC 2 readiness requires:
  - Documented access reviews (90-day cadence)
  - Documented change-management process (covered by GitHub PR + branch protection once applied)
  - Documented incident response runbook
  - Encryption-at-rest and -in-transit attestations from sub-processors (provided by Supabase / Vercel)
  - Vendor risk-management process for sub-processor changes
  - 12+ months of evidence collection before audit

### Financial Regulations

Steinz Labs facilitates **non-custodial** swaps via 0x and Jupiter and **does not custody user funds**. Most consumer-financial regulations key on custody, but jurisdiction-specific rules apply:

- **U.S. — Money Transmission / FinCEN.** Non-custodial software is generally outside the MSB definition (FinCEN 2019 guidance), but state regulators (NY, CA, etc.) have varying interpretations. Treasury / vault and any future fiat on-ramp would change the analysis.
- **EU — MiCA.** Crypto-asset service providers (CASPs) are scoped under MiCA. Non-custodial swap tooling has been argued out of scope, but MiCA "operating a trading platform" definition is broad. Counsel review recommended before EU launch.
- **U.K. — FCA.** Crypto-asset financial promotions rules apply to advertising. The public site language and the whitepaper should be reviewed against FCA rules.
- **Sanctions screening.** OFAC / UK / EU sanctions list screening on user wallets is the standard practice for crypto platforms with U.S. users. Currently not implemented.

**Bottom line:** as long as the platform stays strictly non-custodial and avoids fiat on-ramps, the regulatory posture is manageable. The moment custody, fiat, or yield products land, full counsel review is required.

---

## 7. Status Index

- `chore/repo-cleanup` (merged) — 13 of 14 Critical fixes from §1.
- `supabase/migrations/2026_05_02_session_d_rls_advisor_cleanup.sql` (merged) — 33 of 36 Supabase advisor findings.
- `supabase/migrations/2026_05_02_session_d_auth_tokens.sql` (merged) — opaque server-stored tokens.
- `chore/repo-polish-files` (merged) — CLAUDE.md, SECURITY.md, .env.example, CONTRIBUTING.md, TECHNICAL_DEBT.md, SECURITY_BACKLOG.md, GitHub UI checklist.
- `docs/readme-rewrite` (merged) — comprehensive README.
- [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) — Medium / Low items, organized by audit agent.
- [SECURITY_BACKLOG.md](../SECURITY_BACKLOG.md) — deferred Critical / High items requiring owner action or larger architectural change.
- [docs/cleanup-2026-05/audit-findings.md](./cleanup-2026-05/audit-findings.md) — verbatim 12-agent audit reports.
- [docs/cleanup-2026-05/supabase-cleanup-log.md](./cleanup-2026-05/supabase-cleanup-log.md) — per-issue Supabase advisor resolution table.
