# Deployment Guide

How to deploy, configure, and operate Steinz Labs in production.

## Hosting

- **Frontend + API**: Vercel (region: `iad1` default; can pin per route).
- **Database**: Supabase (project `phvewrldcdxupsnakddx`, region `eu-west-1`).
- **Cache + rate limit**: Upstash Redis (REST API, region of your choice).
- **Email**: Resend.

## First-time setup

### 1. Clone + install

```bash
git clone https://github.com/moderator29/steinzlabs.git
cd steinzlabs
npm install --legacy-peer-deps
cp .env.example .env.local
```

Fill `.env.local` with the dev values you want. Production values live in Vercel — never copy the prod `.env.local` to disk.

### 2. Local verify

```bash
npx tsc --noEmit                  # 0 errors
npx next build                    # 0 errors
npm run dev                       # http://localhost:3000
```

### 3. Vercel project

Connect the GitHub repo at https://vercel.com/new. Import `moderator29/steinzlabs`. Framework preset: Next.js. Root directory: `./`.

Add every environment variable from `.env.example` — the variables marked `NEXT_PUBLIC_*` are exposed to the browser; the rest are server-only.

Branches:
- `main` → auto-deploys to production at `nakalabs.xyz`
- Every other branch → preview URL

### 4. Supabase project

Use the existing project (`phvewrldcdxupsnakddx`) or create a new one and copy the schema:

```bash
supabase link --project-ref <ref>
supabase db push  # applies all SQL in supabase/migrations/
```

The migrations are idempotent — running them on an existing schema is safe.

### 5. DNS

Point `nakalabs.xyz` (apex) and `www.nakalabs.xyz` to Vercel. Vercel auto-issues TLS via Let's Encrypt.

### 6. Webhooks

- **Alchemy**: register one ADDRESS_ACTIVITY webhook per chain (Ethereum, Polygon, Base, Arbitrum, Optimism, BNB) targeting `/api/webhooks/alchemy-whale`. Capture each webhook's signing key into `ALCHEMY_WEBHOOK_SIGNING_KEYS` as a comma-separated list.
- **Helius**: register one Enhanced-Transaction webhook for SWAP + TRANSFER targeting `/api/webhooks/helius-whale`. Set the custom Authorization header value into `HELIUS_WEBHOOK_SECRET`.
- **Telegram**: set webhook URL via:
  ```
  curl -F "url=https://nakalabs.xyz/api/telegram/webhook" \
       -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
       https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
  ```

## Environment variables

Every var documented in [.env.example](../.env.example). Critical ones:

| Var | Where | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | both | Public-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | both | Public-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **Bypasses RLS — never expose** |
| `ANTHROPIC_API_KEY` | server | VTX cost vector — rotate carefully |
| `ALCHEMY_API_KEY` | server | Server-side only; do not bundle |
| `ALCHEMY_WEBHOOK_SIGNING_KEYS` | server | Comma-separated, per-chain |
| `HELIUS_API_KEY` | server | |
| `HELIUS_WEBHOOK_SECRET` | server | Custom Auth header value |
| `JWT_SECRET` | server | `openssl rand -base64 32` |
| `ADMIN_BEARER_TOKEN` | server | Static admin layout token |
| `CRON_SECRET` | server | Vercel auto-injects on cron calls |

## CI

`.github/workflows/ci.yml` runs on every push and PR:
1. `tsc --noEmit` — must be 0 errors.
2. `next build` — must succeed.
3. `npm audit --audit-level=high` — informational, not blocking.

## Cron

Schedules live in `vercel.json`. Each route under `/api/cron/*` should:
- Reject requests without `Vercel-Cron-Signature` header (TODO — see [SECURITY_BACKLOG.md](../SECURITY_BACKLOG.md) #9).
- Log to `cron_execution_log` (start, end, result, payload).
- Fail-loud: throw on unrecoverable errors so Sentry catches it.

## Rollback

### Quick rollback (last deploy)

Vercel dashboard → Deployments → previous deploy → "Promote to Production".

### Rollback by commit

```bash
git checkout main
git revert <bad-sha>
git push origin main
```

Vercel auto-deploys the revert.

### Schema rollback

Supabase migrations are forward-only. To "rollback" a schema change, write a new migration that reverses it:

```bash
# 1. Create new migration
echo "ALTER TABLE x DROP COLUMN y;" > supabase/migrations/<timestamp>_revert_y.sql
# 2. Apply via MCP or supabase db push
# 3. Commit
```

For destructive changes (DROP TABLE, DROP COLUMN with data), capture a backup first via Supabase Dashboard → Database → Backups → Manual Backup.

## Secret rotation

Documented in [SECURITY_BACKLOG.md](../SECURITY_BACKLOG.md) #1. Order matters:
1. `SUPABASE_SERVICE_ROLE_KEY` (full RLS bypass)
2. `ANTHROPIC_API_KEY`
3. `ALCHEMY_API_KEY` + chain-specific webhook signing keys
4. `HELIUS_API_KEY` + `HELIUS_WEBHOOK_SECRET`
5. `JWT_SECRET` (forces all sessions to expire — coordinate timing)
6. Everything else

After rotating, update Vercel env vars, trigger a redeploy, then regenerate `.env.local` from the new values or delete it entirely.

## Monitoring

- **Vercel logs**: per-deployment runtime + build logs.
- **Sentry**: client + server errors. Alerts on new error fingerprints.
- **PostHog**: product analytics dashboards.
- **Supabase Dashboard**: query performance, row-count growth, advisor warnings.
- **`/admin/api-health`**: in-app health board for Upstash, Supabase, CoinGecko, DexScreener, Anthropic.

## Incident response

1. **Confirm the incident** — Sentry, Vercel logs, social signal.
2. **Snap a write barrier** if user funds at risk:
   - Sniper: toggle `platform_settings.sniper_enabled = false` (server-enforced kill switch).
   - Copy trading: disable specific chain via cron pause.
   - Wallet: emergency `/api/wallet/freeze` (TODO — backlog).
3. **Rollback** to last known-good deploy (Vercel one-click).
4. **Post-mortem**: file an incident in `/admin/incidents` (TODO — currently in `admin_notes`).
5. **Backlog the fix** in `SECURITY_BACKLOG.md` or `TECHNICAL_DEBT.md`.

## See also

- [README.md](../README.md) — overview, getting started
- [SECURITY.md](../SECURITY.md) — vulnerability disclosure
- [supabase-architecture.md](./supabase-architecture.md) — DB-specific
- [github-ui-settings-checklist.md](./github-ui-settings-checklist.md) — repo-level GitHub config
