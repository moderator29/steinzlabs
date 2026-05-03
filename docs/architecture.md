# Architecture

System-level architecture for Steinz Labs. Sibling docs:
- [supabase-architecture.md](./supabase-architecture.md) — DB-specific (tables, RLS, functions, cron, webhooks)
- [feature-documentation.md](./feature-documentation.md) — what every user-facing feature does
- [security-audit-2026-05-02.md](./security-audit-2026-05-02.md) — security posture

## Stack

- **Runtime:** Vercel (Next.js 16 on Node 20)
- **Frontend:** Next.js 16 App Router · React 18 · TypeScript · Tailwind
- **Backend:** Next.js Route Handlers · Edge middleware
- **Database:** Supabase Postgres 17 (RLS on every public table)
- **Auth:** Supabase SSR + SIWE wallet auth
- **AI:** Anthropic Claude (Sonnet executor + Opus advisor)
- **Blockchain:** Alchemy (EVM) · Helius (Solana) · 0x Protocol · Jupiter · GoPlus · Arkham
- **Cache / rate limit:** Upstash Redis with in-process Map fallback
- **Observability:** Sentry · PostHog
- **Email:** Resend
- **Bot protection:** Cloudflare Turnstile

## Request lifecycle

```
   Browser
     │
     │  HTTPS
     ▼
   Vercel Edge
     │   ── middleware.ts
     │      · Cookie-budget guard (redirect to /auth/clear if >8KB)
     │      · Supabase auth.getUser()
     │      · profiles.role = 'admin' check on /admin/*
     │      · Security headers: HSTS, X-Frame-Options, X-CTO, CSP, Permissions-Policy
     ▼
   Next.js Route Handler
     │   ── withTierGate(tier, handler)
     │      · 401 if unauth
     │      · 403 if tier insufficient
     │   ── zod schema validation on body / query
     │   ── verifyAdminRequest() on /api/admin/*
     ▼
   Service Layer  (lib/services, lib/auth, lib/security, lib/wallet, lib/intelligence, lib/trading)
     │   ── outbound: Anthropic, Alchemy, Helius, 0x, Jupiter,
     │                GoPlus, Arkham, CoinGecko, Birdeye, LunarCrush
     │   ── rate-limited per provider
     │   ── HMAC verification on inbound webhooks
     ▼
   Supabase Postgres 17
     │   ── Row-Level Security on every public table
     │   ── service_role from server side bypasses RLS
     │   ── auth_tokens, admin_audit_log, whale_activity, etc.
     ▼
   Browser
     │   ── wallet seed: AES-256-GCM at rest in localStorage
     │   ── session key: closure-private with 30-min TTL,
     │      cleared on pagehide / visibilitychange→hidden
```

## Key architectural decisions

### Server-trusted tier

Every Pro+ feature passes through `withTierGate(tier, handler)` which:
1. Reads the authenticated user from Supabase SSR.
2. Looks up `profiles.tier` and `profiles.tier_expires_at`.
3. Compares against the required tier with `checkTier()`.
4. Returns 403 `upgrade_required` if insufficient.

The client cannot bypass — the gate runs on the server before the handler executes. Admins (`profiles.role = 'admin'`) bypass tier checks.

### Non-custodial invariant

Internal wallet keys live only in the browser. They are AES-256-GCM-encrypted at rest in `localStorage` with PBKDF2/100k/SHA-256 key derivation. The server never sees the key — only signed transaction payloads broadcast through the user's wallet.

The session password is held in a closure-private variable inside `lib/wallet/walletSession.ts` with a 30-minute sliding TTL. It evicts on `pagehide` (tab close, navigation, bfcache) and on `visibilitychange → hidden` (tab background).

### Address normalization

EVM addresses are case-insensitive at the protocol level; Solana addresses are case-sensitive. The canonical helper at `lib/utils/addressNormalize.ts` exposes `normalizeAddress(addr, chain?)` and `addressesEqual(a, b, chain?)` — every address comparison should go through it. Direct `.toLowerCase()` on an address is banned by [CLAUDE.md](../CLAUDE.md).

### Inflight-Map dedup

Concurrent requests for the same expensive computation (e.g., bubble-map graph build, AI summary generation) share a single in-flight promise. Pattern:

```ts
const inflight = new Map<string, Promise<T>>();
function get(key: string): Promise<T> {
  let p = inflight.get(key);
  if (!p) {
    p = compute().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}
```

### Write-on-read snapshots

Daily snapshots (e.g., `holder_snapshots`) materialize the first time a route is hit and are reused for the rest of the day. The first hit pays the latency, every subsequent hit reads cached state.

### Audit log fire-and-forget

Every admin mutation writes to `admin_audit_log` without blocking the response. If the audit insert fails, the user-visible action still completes; the failure is captured in Sentry.

### Webhook fail-closed in production

Alchemy webhooks verify HMAC-SHA256 against `ALCHEMY_WEBHOOK_SIGNING_KEYS` (comma-separated for multi-chain). Helius webhooks verify the Authorization header with `crypto.timingSafeEqual`. **In production**, missing signing keys cause requests to fail closed (401). Local-dev escape hatches require explicit `ALCHEMY_WEBHOOK_DEV_BYPASS=true` or `HELIUS_WEBHOOK_DEV_BYPASS=true`.

### Opaque server-stored auth tokens

Password reset and email-verify tokens are 32 random bytes (256-bit entropy), returned to the caller as base64url, stored as SHA-256 hashes in `auth_tokens`. Validation is an atomic `UPDATE ... consumed_at WHERE token_hash=? AND consumed_at IS NULL AND expires_at > now() RETURNING id` — single DB roundtrip closes the check-and-mark race window. TTLs: 30 minutes for reset, 24 hours for verify. See [SECURITY.md](../SECURITY.md) and `lib/authTokens.ts`.

## Trust boundaries

```
[ public Internet ]
       │  ── HSTS / sec headers
       ▼
[ Edge / Middleware ]    ← anyone can reach this
       │  ── Supabase auth check
       │  ── /admin/* role gate
       ▼
[ API Route Handlers ]   ← user identity is set
       │  ── withTierGate
       │  ── zod
       │  ── verifyAdminRequest on /api/admin/*
       ▼
[ Service Layer ]        ← server-only secrets allowed
       │  ── outbound HMAC, rate-limited
       ▼
[ External APIs ]        ← untrusted data returns
       │  ── input validated again on the way back
       ▼
[ Supabase Postgres ]    ← RLS is the last line
       │  ── service_role bypasses RLS, server-side only
       ▼
[ Browser (wallet seed) ] ← AES-256-GCM at rest, never leaves browser
```

## Observability

- **Sentry**: client + server error tracking. `beforeSend` already strips cookies; pending extension to scrub wallet addresses and emails (see [SECURITY_BACKLOG.md](../SECURITY_BACKLOG.md) #10).
- **PostHog**: product analytics. PII-aware property allow-list.
- **`api_logs`** table: per-API call audit (status, response time, errors).
- **`activity_log`**: per-user activity timeline.
- **`cron_execution_log`**: every cron run captured with start/end/result (7,869 rows live as of audit).
- **`health_check_state`**: live infra heartbeat for Upstash, Supabase, CoinGecko, DexScreener, Anthropic.

## Background work

Vercel Cron schedules in `vercel.json`. See [supabase-architecture.md §4](./supabase-architecture.md) for the current cron set. Common patterns:

- **Whale activity backfill** — USD pricing of recent webhook events
- **Whale verification** — RPC liveness check
- **Naka Trust Score refresh** — every 6h
- **Token popularity rollup** — daily
- **Holder snapshot** — daily
- **Auth token janitor** — `prune_auth_tokens()` weekly
- **Health check** — every 5 minutes
- **Sniper auto-execute** — minute-level scan of `pending_trades`
- **Limit / stop-loss / take-profit matching** — minute-level

## Deployment

Vercel auto-deploys from `main`. PRs deploy to preview URLs. Rollback is one-click via the Vercel dashboard or by reverting the last main commit.

For full deployment runbook see [deployment-guide.md](./deployment-guide.md).

## See also

- [README.md](../README.md) — overview, getting started
- [whitepaper.md](./whitepaper.md) — strategic narrative
- [supabase-architecture.md](./supabase-architecture.md) — DB-specific
- [feature-documentation.md](./feature-documentation.md) — per-feature data flow
- [security-audit-2026-05-02.md](./security-audit-2026-05-02.md) — security posture
- [api-reference.md](./api-reference.md) — REST API reference
