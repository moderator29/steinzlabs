# API Reference

Steinz Labs exposes 267 internal route handlers under `/api/*`. They are not currently a public, documented API — they are the platform's internal back-end. This file is a high-level map; for full request/response schemas, see the source.

## Recommended approach

Hand-maintaining 267 endpoint signatures will rot fast. The right approach for a public API surface is to:

1. **Define every input with zod**, which most routes already do.
2. **Auto-generate OpenAPI spec** from the zod schemas (`@asteasolutions/zod-to-openapi` or similar).
3. **Render the OpenAPI as Swagger / Redoc** at `/api/docs`.

That is the recommended migration path for a v1 public API. This file documents the route map at a level useful for new contributors.

## Authentication

| Mechanism | Used by |
|-----------|---------|
| Supabase SSR cookie | Most user-facing routes |
| `Authorization: Bearer <admin>` | All `/api/admin/*` (`verifyAdminRequest`) |
| Custom header signature | Webhook routes (Alchemy HMAC, Helius header) |
| `Vercel-Cron-Signature` | `/api/cron/*` (TODO — backlog) |

Any state-changing request without the right credential gets `401 unauthorized` (HTTP) or `403 upgrade_required` (tier).

## Tier gates

`withTierGate(tier, handler)` from `lib/subscriptions/apiTierGate.ts` wraps any route that requires a paid tier. Returns:

```json
{ "error": "upgrade_required", "currentTier": "free", "requiredTier": "pro", "expired": false }
```

with HTTP 403 if the user is below the required tier.

## Route categories

| Category | Path prefix | Notes |
|----------|-------------|-------|
| Auth | `/api/auth/*` | signin, signup, signout, forgot-password, reset-password, verify-email, wallet-nonce, wallet-verify, check-rate-limit, verify-turnstile |
| User profile | `/api/user/*`, `/api/account/*` | profile read/write, account delete, preferences |
| Wallet | `/api/wallet/*` | sync (encrypted blob round-trip), send, balance, approvals |
| VTX Agent | `/api/vtx-ai`, `/api/vtx-ai/share`, `/api/vtx-ai/conversations/*` | chat handler, streaming, conversation history |
| Market | `/api/market/*`, `/api/coins/*`, `/api/tokens/*` | token detail, charts, holders, gainers, trending |
| Whale | `/api/whales/*` | directory, profile, follow/unfollow, AI summary, logo |
| Smart Money | `/api/smart-money/*` | wallet list, convergence events |
| Wallet Intel | `/api/wallet-intelligence/*`, `/api/clusters/*` | scan, alpha report, cluster graph |
| Trends | `/api/trends/*`, `/api/trend-alerts/*` | metric snapshots, user alert config |
| Trading | `/api/swap/*`, `/api/sniper/*`, `/api/copy-trading/*`, `/api/limit-orders/*`, `/api/dca/*`, `/api/positions/*` | quote, prepare, execute, queue management |
| Pending trades | `/api/pending-trades/*` | quote sign + broadcast loop |
| Security | `/api/security/*`, `/api/ca-lookup`, `/api/contract-analyze/*`, `/api/domain-shield/*` | scan flows |
| Alerts | `/api/alerts/*`, `/api/notifications/*`, `/api/push/*` | alert config + delivery |
| Telegram | `/api/telegram/webhook`, `/api/telegram/connect/*` | bot webhook + pairing |
| Webhooks (inbound) | `/api/webhooks/*` | alchemy-whale, helius-whale, sniper-detect, supabase |
| Cron | `/api/cron/*` | scheduled jobs (whale backfill, snapshots, score refresh, etc.) |
| Admin | `/api/admin/*` | every admin mutation; gated by `verifyAdminRequest` |

## Response conventions

- **Success**: `200 OK` with `{ "data": ... }` or feature-specific shape.
- **User error**: `400 Bad Request` with `{ "error": "<reason>" }`.
- **Auth fail**: `401 unauthorized` with `{ "error": "unauthorized" }`.
- **Tier fail**: `403 upgrade_required` (see above).
- **Admin gate fail**: `401` from `unauthorizedResponse()`.
- **Server error**: `500` with `{ "error": "internal_error" }` — full detail captured in Sentry, never sent to client.

## Rate limits

- **Free VTX**: 25 messages/day per IP (Upstash with in-process fallback).
- **Auth**: per-email + per-IP via `auth_rate_limits` table.
- **Telegram**: 10 commands/60s per chat_id, in-memory.
- **Most other endpoints**: protected by Vercel's default rate limit + Cloudflare in front.

## Webhook signatures

| Endpoint | Verification |
|----------|--------------|
| `/api/webhooks/alchemy-whale` | HMAC-SHA256 of raw body, key from `ALCHEMY_WEBHOOK_SIGNING_KEYS` (comma-separated for multi-chain). Fail-closed in prod. |
| `/api/webhooks/helius-whale` | Authorization header compared to `HELIUS_WEBHOOK_SECRET` with `crypto.timingSafeEqual`. Fail-closed in prod. |
| `/api/telegram/webhook` | `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`. |

## Notes for v1 public API

When opening a public API (separate from the internal back-end above), recommended scope for v1:

- `GET /v1/whales` — directory listing (paginated)
- `GET /v1/whales/{address}` — profile + activity
- `GET /v1/tokens/{chain}/{address}` — Naka Trust Score + market data
- `GET /v1/contract-scan/{chain}/{address}` — security scan
- `POST /v1/vtx/query` — VTX one-shot (Pro+ required, API-key auth)

Each public endpoint should be:
- Authenticated by API key (`Authorization: ApiKey <key>`), with the key stored hashed in `auth_tokens` (kind='api_key').
- Tier-gated (Pro+).
- Rate-limited per key.
- Versioned in the URL (`/v1/...`).

## See also

- [supabase-architecture.md](./supabase-architecture.md) — table inventory each route reads/writes
- [feature-documentation.md](./feature-documentation.md) — what every user-facing feature does
- [architecture.md](./architecture.md) — request lifecycle and trust boundaries
- [security-audit-2026-05-02.md](./security-audit-2026-05-02.md) — security posture per category
