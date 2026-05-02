# Security Backlog — 2026-05-02

Security findings deferred from the `chore/repo-cleanup` round. The
Critical and High items below were left because either:
  (a) they require changes outside this repo (secret rotation in Vercel
      dashboard, Supabase Auth config, GitHub UI settings), or
  (b) they are deeper architectural changes that warrant their own
      design pass rather than being squeezed into a cleanup PR.

For the full set of medium/low operational findings, see
`TECHNICAL_DEBT.md`.

---

## Critical — Owner action required

### 1. Rotate every secret in `.env.local`
The repository's `.gitignore` blocks `.env*` and the file has not been
committed (verified via `git log --all --diff-filter=A --name-only`).
However, the on-disk secrets live in plaintext, so any process or backup
that reads the file holds production credentials.

Rotate in this order:
1. `SUPABASE_SERVICE_ROLE_KEY` — full RLS bypass, highest blast radius.
   Supabase Dashboard → Project Settings → API → Reset.
2. `ANTHROPIC_API_KEY` — VTX agent cost vector.
   console.anthropic.com → API Keys → Rotate.
3. `ALCHEMY_API_KEY` and any chain-specific Alchemy keys.
4. `HELIUS_API_KEY` and `HELIUS_WEBHOOK_SECRET`.
5. `JWT_SECRET` — must be regenerated as cryptographically random
   (`openssl rand -base64 32`). All issued sessions and reset tokens
   become invalid; users sign in again.
6. Everything else: `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`,
   `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_AUTH_TOKEN`, `LUNARCRUSH_API_KEY`,
   `ARKHAM_API_KEY`, `BIRDEYE_API_KEY`, `COINGECKO_API_KEY`,
   `GOPLUS_API_KEY`, `ZX_API_KEY`, `ADMIN_BEARER_TOKEN`,
   `TURNSTILE_SECRET_KEY`, `CRON_SECRET`.

After rotating, update Vercel project env vars and trigger a redeploy.
The on-disk `.env.local` should then be regenerated from the new values
or deleted entirely (preferred — local dev can run against a separate
"dev" Supabase project).

### 2. `NEXT_PUBLIC_ALCHEMY_API_KEY` is bundled into the client
Public-facing keys are inherently rate-limit-bypassable by anyone who
inspects the JS bundle. Migrate Alchemy reads to a server-side proxy
endpoint and remove the `NEXT_PUBLIC_` variant.

---

## High — Architectural

### 3. Supabase Auth: enable Leaked Password Protection
Supabase advisor flagged this. Cannot be set via SQL.
Dashboard → Authentication → Policies → enable "Leaked Password
Protection" (HaveIBeenPwned check at signup/password change).

### 4. Move `pg_trgm` extension out of `public` schema
Supabase advisor (`extension_in_public`). Deferred from the
RLS migration round because moving it requires:
1. `CREATE SCHEMA extensions;`
2. `ALTER EXTENSION pg_trgm SET SCHEMA extensions;`
3. Audit every caller — full-text search uses GIN/GiST indexes that
   reference `pg_trgm` operators by schema-qualified name. Existing
   indexes need to be dropped and recreated against the new schema.
4. Update `search_path` in any function that uses `%` similarity ops.

### 5. wallet_session XSS exposure (mitigated, not eliminated)
The session-key hardening in `lib/wallet/walletSession.ts` shrank the
exposure window (30-min TTL, visibility-change clear) but the key still
lives in JS memory accessible to same-origin scripts. The only complete
mitigation is moving to WebAuthn-gated decryption or a service worker
with isolated heap. Tracked as architectural follow-up.

### 6. Wallet sync GET returns ciphertext without rate limit
`app/api/wallet/sync/route.ts` returns the encrypted wallet blob to the
client. The encryption is sound, but the ciphertext is targetable. Add
per-user rate limit (3/hour) and consider gating behind a re-auth step
(TOTP or password re-entry).

### 7. RPC URL check in wallet/send is buggy
`if (!url.includes('undefined') === false && !url)` is a double-negative
tautology that always evaluates false. Simplify; validate all chain RPC
URLs at startup so misconfiguration surfaces immediately.

### 8. Webhook rate limiting (Alchemy / Helius)
Signature verification is in place (and was hardened in this round) but
there is no per-IP / per-chain throttle. A compromised signing key would
let an attacker spam events. Add Upstash-backed rate limit (50/min per
chain) on `/api/webhooks/alchemy-whale` and `/api/webhooks/helius-whale`.

### 9. Cron route auth
Cron routes do not verify the `Vercel-Cron-Signature` header. Anyone
with the URL can trigger them. Add header check (compare against
`CRON_SECRET` with `crypto.timingSafeEqual`).

### 10. Sentry PII scrubbing
`sentry.client.config.ts` `beforeSend` only clears cookies. Extend to
scrub:
- Wallet addresses in URL params and breadcrumb data
- Request bodies (could contain user wallet data, transaction details)
- Email addresses in error messages
- Transaction hashes (low-risk but irrelevant noise)

---

## Compliance Notes

- **GDPR / CCPA:** Profile data (email, IP via `activity_log.ip_address`)
  is captured. A data-export and account-deletion flow exists at
  `/api/account/delete`. Verify it cascades to all user-scoped tables
  (search_logs, vtx_query_logs, feature_usage, whale_tracking,
  copy_trades, etc. — most have ON DELETE CASCADE on the user_id FK).
- **Financial regulations:** Steinz Labs facilitates self-custodial swaps
  via 0x and Jupiter and is non-custodial throughout. Treasury, voting,
  and tier-gated paid features are the surfaces that intersect financial
  regulations. Get jurisdiction-specific counsel before adding fiat
  on-ramps or asset custody.
- **SOC 2:** Not currently scoped. The audit logging table
  (`admin_audit_log`) is the foundation; full SOC 2 readiness requires
  retention policies, access reviews, and change-management
  documentation that don't exist yet.

---

## How To Use This File

When a backlog item ships, move it to `CHANGELOG.md` with the commit
hash and remove from this file. Reorder by severity if priorities shift.
Add new findings to the appropriate severity bucket as the audit
program continues.
