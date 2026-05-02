# Supabase Architecture — 2026-05-02

Project ID: `phvewrldcdxupsnakddx` · Region: `eu-west-1` · Postgres 17.

This document is the source of truth for the Steinz Labs Supabase
schema. Verified against the live DB via `mcp__supabase__list_tables`
on 2026-05-02. **117 public tables. All have Row-Level Security
enabled** (post the §3 advisor cleanup).

For per-issue advisor resolution, see
[cleanup-2026-05/supabase-cleanup-log.md](./cleanup-2026-05/supabase-cleanup-log.md).

---

## 1. Tables by Domain

Counts marked "rows" reflect the snapshot at audit time. Empty tables
are scaffolded for features not yet in production traffic.

### 1.1 Identity & Auth

| Table | Purpose |
|-------|---------|
| `profiles` | App-level user record, joined to `auth.users` by id. Holds tier, role, verified flag, display name. |
| `users` | Legacy user table (kept for backwards compat with older code paths). |
| `user_telegram_links` | Telegram chat ↔ Steinz account pairing. |
| `auth_tokens` | Server-stored opaque reset/verify tokens (SHA-256-hashed, single-use, TTL'd). Replaces the legacy HMAC scheme. |
| `auth_rate_limits` | Per-email + per-IP rate-limit counters for auth endpoints. |
| `auth_wallet_nonces` | SIWE nonce store, one-time-use, scoped to chain. |
| `login_activity` | Login event log for security audit. |

### 1.2 Wallets

| Table | Purpose |
|-------|---------|
| `user_wallets_v2` | JSONB-keyed wallet store. `wallets` JSON + separate `default_address`. |
| `user_wallets` | Legacy wallets table. Read-only at this point. |
| `wallet_accounts` | Per-account metadata (label, chain, owner). |

### 1.3 Whale Tracking

| Table | Rows | Purpose |
|-------|------|---------|
| `whales` | 449 | Verified whale directory. Note: column is `label`, not `name`. |
| `whale_addresses` | — | Address membership for whales (multi-address whales). |
| `whale_activity` | 36,881 | Inbound transfer events from Alchemy + Helius webhooks. |
| `whale_transactions` | — | Decorated transactions with USD value, action classification. |
| `whale_tracking` | — | User → whale follow relationships (per-user alerts config). |
| `whale_watchlist` | — | Curated whale lists (admin-managed). |
| `whale_submissions` | — | User-submitted whale candidates pending admin verification. |
| `whale_ai_summaries` | — | Generated AI profile cards (sentiment, style, copy mode). |
| `whale_wallets` | — | Featured whale spotlight (admin-curated). |
| `user_whale_follows` | 3 | User-side follows table (mirrors whale_tracking; legacy). |

### 1.4 Copy Trading & Sniper

| Table | Purpose |
|-------|---------|
| `user_copy_rules` | User-configured copy rules (whale, allocation, slippage, blacklist). |
| `copy_trades` | Per-event copy-trade records. |
| `user_copy_trades` | Mirror table for legacy compat. |
| `sniper_criteria` | User sniper config (min trust score, max tax, etc.). |
| `sniper_executions` | Sniper queue + execution log. |
| `sniper_match_events` | Match audit (which whale event triggered which rule). |
| `platform_sniper_state` | Global sniper state (kill switch, kill reason). |

### 1.5 Trading & Orders

| Table | Purpose |
|-------|---------|
| `pending_trades` | Quoted-but-unsigned trades awaiting user signature. |
| `pending_trades_active` | View of `pending_trades` filtered to status='pending' AND expires_at > now(). Rebuilt as `security_invoker = true` in May 2026 cleanup. |
| `swap_logs` | Successful swap broadcasts. |
| `swap_route_analytics` | Aggregator route performance tracking (0x vs Jupiter). |
| `transactions` / `transaction_history` | User-visible transaction list (synced from chain). |
| `positions` | Open positions for sniper / copy / manual buys. |
| `limit_orders` | User-set limit orders (off-chain orderbook). |
| `stop_loss_orders` / `take_profit_orders` | TP/SL configuration per position. |
| `dca_bots` / `dca_executions` / `dca_configs` | Dollar-cost-average bot system. |
| `chart_price_alerts` | Chart-level price triggers. |
| `price_alerts` | User price alerts (column is `price`, not `target_price`). |

### 1.6 Wallet Intelligence

| Table | Rows | Purpose |
|-------|------|---------|
| `wallet_profiles` | — | Computed wallet archetype + behavioral fingerprint. |
| `wallet_clusters` | — | Cluster groups (head row). |
| `wallet_cluster_members` | — | Cluster membership rows. |
| `wallet_cluster_connections` | — | Edge metadata between cluster members. |
| `cluster_cache` | — | Computed cluster results, TTL'd. |
| `cluster_labels` | — | User-submitted cluster labels (e.g., "Wintermute"). |
| `cluster_label_votes` | — | Community votes on label proposals. |
| `wallet_edges` | 18,095 | Raw on-chain edges driving cluster algorithms. |
| `wallet_alpha_reports` | — | Alpha Intelligence Report cache. |
| `wallet_identities` | — | ENS / Solana name resolution cache. |
| `entity_cache` | — | Arkham entity-label cache. |

### 1.7 Smart Money

| Table | Purpose |
|-------|---------|
| `smart_money_wallets` | Curated set of consistently profitable wallets. |
| `smart_money_rankings` | Rolling rank by P&L / win rate / capital. |
| `smart_money_follows` | Per-user follows on smart-money wallets. |
| `smart_money_convergence` | Detected events where N+ smart wallets bought same asset. |
| `convergence_events` | Generic convergence detection across whale + smart-money sets. |

### 1.8 Trends & Market

| Table | Rows | Purpose |
|-------|------|---------|
| `market_stats_history` | 385 | Daily aggregate market stats. |
| `trend_metrics_cache` | — | Per-chain trend metrics with 7d/30d history. |
| `trend_alerts` | — | User-set trend-metric alerts. |
| `token_popularity_history` | — | Token-of-the-week / token-of-the-day records. |
| `token_risk_scores` | — | Computed risk scores per token. |
| `naka_trust_scores` | — | Naka Trust Score per token (0-100, 5-layer). |
| `featured_tokens` | — | Admin-curated featured tokens for the dashboard. |

### 1.9 VTX Agent / AI

| Table | Rows | Purpose |
|-------|------|---------|
| `vtx_conversations` | 60 | Chat conversation history per user. |
| `vtx_query_logs` | — | Per-query usage log (input/output tokens, advisor usage, success). |
| `vtx_shared_conversations` | — | Public-link-shared conversations. |
| `naka_prompts` | 7 | System-prompt templates for VTX (versioned). |
| `user_vtx_prompt_favorites` | — | User-saved prompts. |
| `bubblemap_cache` | — | Bubble map computed graphs (TTL'd). |
| `bubblemap_conversations` | — | VTX Q&A specifically about a bubble map. |

### 1.10 Security

| Table | Purpose |
|-------|---------|
| `security_scan_history` | Token / domain / contract scan history. |
| `scans` | Generic scan record table. |
| `threats` | Detected security threats (phishing, malicious contracts). |
| `token_approvals` | Tracked token approvals per user wallet. |
| `holder_snapshots` | Daily snapshots of holder lists for diff alerts. |

### 1.11 Notifications & Alerts

| Table | Rows | Purpose |
|-------|------|---------|
| `alerts` | — | Generic user alert configurations. |
| `notifications` | — | Server-generated notifications awaiting delivery. |
| `notification_settings` | 8 | Per-user notification preferences. |
| `push_subscriptions` | — | Web Push subscription endpoints. |
| `push_delivery_log` | — | Push delivery audit. |
| `user_wallet_alerts` | — | Wallet-activity alerts. |
| `email_templates` | — | Admin-managed email templates. |
| `newsletter_sends` | — | Newsletter send audit. |
| `broadcasts` / `broadcast_templates` | — | Platform-wide announcement infrastructure. |
| `announcements` | — | In-app announcements. |

### 1.12 User-Facing Settings & Preferences

| Table | Rows | Purpose |
|-------|------|---------|
| `user_preferences` | 1 | Generic user preferences (theme, units). |
| `user_display_preferences` | — | Display options (cards, density). |
| `user_security_preferences` | — | Per-user security toggles. |
| `user_security_subscriptions` | — | Subscription to security alert channels. |
| `user_trading_preferences` | — | Trading defaults (slippage, chain). |
| `user_chart_drawings` | — | Saved chart annotations. |
| `privacy_settings` | — | Privacy toggles (e.g. profile visibility). |
| `user_reputation` | — | Community reputation score. |

### 1.13 Research, Discovery & Engagement

| Table | Purpose |
|-------|---------|
| `research_posts` | Long-form research articles (admin-published). |
| `research_views` | Per-user view records (count + last-viewed). |
| `engagement` | Generic engagement events (likes, shares). |
| `watchlist` | Generic user watchlist (4 rows live). |
| `contacts` | User contacts (DM-style social graph). |
| `followed_entities` | Generic follow-anything table. |

### 1.14 Support & Operations

| Table | Purpose |
|-------|---------|
| `support_tickets` | User-submitted support tickets. |
| `support_conversations` | Threaded reply log per ticket. |
| `health_check_state` | Live infra health (Upstash, Supabase, CoinGecko, etc.). |
| `health_alert_recipients` | Recipients of health-state alerts. |
| `cron_execution_log` | 7,869 rows. Audit log for every cron run. |
| `api_logs` | API call audit (status, response time, errors). |
| `feature_usage` | Per-user feature usage counts (analytics). |
| `search_logs` | User search query log. |

### 1.15 Admin & Audit

| Table | Purpose |
|-------|---------|
| `admin_audit_log` | Every admin mutation (action, target_user_id, details). |
| `admin_notes` | Admin-only notes per user. |
| `settings_audit_log` | Audit of platform_settings changes. |
| `platform_settings` | Single-row platform-wide flags (sniper kill switch, feature flags). |
| `platform_pages` | CMS-style page registry. |
| `wallet_labels` | Admin-curated wallet labels (publicly readable). |

### 1.16 Treasury & Billing

| Table | Purpose |
|-------|---------|
| `revenue_records` | Per-event revenue records. |
| `fee_revenue` | Aggregated fee revenue snapshots. |
| `platform_fees` | Per-feature platform fee config. |
| `trade_analytics_cache` | Aggregated trading analytics for admin views. |

### 1.17 Misc

| Table | Purpose |
|-------|---------|
| `waitlist` | Public-insert waitlist (validated email regex). |

---

## 2. Row-Level Security

**Every public table has RLS enabled** (verified 2026-05-02). The
codebase convention is:

```
service_role_<table>             FOR ALL    TO service_role        USING (true) WITH CHECK (true)
<table>_users_own_*              FOR SELECT/INS/UPD/DEL TO authenticated USING ((SELECT auth.uid()) = user_id)
<table>_admin_*                  FOR SELECT/ALL TO authenticated USING (public.is_admin())
<table>_public_select            FOR SELECT TO anon, authenticated USING (true)
```

Special policies:

- **`engagement_users_own_insert`** — `WITH CHECK ((SELECT auth.uid()) = user_id)` (replaced `engagement_insert_any` which was always-true).
- **`waitlist_insert_validated`** — public insert allowed but `WITH CHECK` enforces RFC-shape email regex + length caps.
- **`waitlist_admin_select`** — admin readback for the waitlist.
- **`wallet_labels_public_select`** — admin-curated reference data, public read, admin write.

Verification query (run anytime):

```sql
SELECT schemaname, tablename, rowsecurity, count(*) FILTER (WHERE p.policyname IS NOT NULL) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p USING (schemaname, tablename)
WHERE schemaname = 'public'
GROUP BY 1, 2, 3
HAVING NOT rowsecurity OR count(p.policyname) = 0
ORDER BY 2;
```

Expected: empty result.

---

## 3. Functions

### 3.1 Triggers

| Function | Purpose |
|----------|---------|
| `handle_new_user()` | AFTER INSERT trigger on `auth.users` — inserts a `profiles` row. SECURITY DEFINER, locked search_path, EXECUTE revoked from anon/authenticated (callable only as a trigger). |
| `handle_new_user_notification_settings()` | AFTER INSERT trigger on `auth.users` — inserts a default `notification_settings` row. Same hardening as above. |
| `set_updated_at()` | Generic `BEFORE UPDATE` trigger that updates `updated_at` to `now()`. Locked search_path. |

### 3.2 Helpers

| Function | Purpose |
|----------|---------|
| `is_admin()` | Returns boolean: `true` if `auth.uid()` has `profiles.role = 'admin'`. SECURITY DEFINER, locked search_path. Used inside RLS policies on admin-readable tables. |
| `prune_auth_tokens()` | Janitor: deletes `auth_tokens` rows older than 7 days. SECURITY DEFINER, locked search_path, service_role-only EXECUTE. |

---

## 4. Cron Jobs

The platform runs scheduled jobs through Vercel Cron, not Supabase
pg_cron, so the schedule lives in `vercel.json`. The `cron_execution_log`
table records every run. Current scheduled paths under `/api/cron/`
include (subject to change):

- whale activity backfill (USD pricing of recent webhook events)
- whale verification (RPC liveness check)
- naka trust score refresh
- token popularity rollup
- holder snapshot generation
- auth token janitor (`prune_auth_tokens()`)
- health check state refresh
- DCA bot execution
- limit / stop-loss / take-profit order matching

For the live current set, `git grep "/api/cron/" vercel.json`.

---

## 5. Webhooks

| Source | Endpoint | Verification |
|--------|----------|--------------|
| Alchemy ADDRESS_ACTIVITY | `/api/webhooks/alchemy-whale` | HMAC-SHA256 over raw body, key from `ALCHEMY_WEBHOOK_SIGNING_KEYS` (comma-separated for multi-chain). Fails closed in production. |
| Helius enhancedTransaction | `/api/webhooks/helius-whale` | Custom Authorization header, compared with `crypto.timingSafeEqual` against `HELIUS_WEBHOOK_SECRET`. Fails closed in production. |
| Sniper detection | `/api/sniper-detect` | Internal — chain via Alchemy/Helius events. |
| Telegram bot | `/api/telegram/webhook` | `X-Telegram-Bot-Api-Secret-Token` header compared against `TELEGRAM_WEBHOOK_SECRET`. |
| Supabase auth events | `/api/webhooks/supabase` (if used) | `SUPABASE_WEBHOOK_SECRET`. |

---

## 6. Backup Strategy

- **Daily automatic backups** are managed by Supabase (Pro tier and
  above; the project is on the team's plan — verify in dashboard).
- **Point-in-time recovery** is available at the Supabase plan level
  the project is on.
- **Manual export** for migration or disaster recovery: `pg_dump`
  via the connection string in the dashboard. Do not commit dumps.
- **Migration mirror.** Every applied DDL is mirrored into
  `supabase/migrations/`. Confirm parity with
  `mcp__supabase__list_migrations` after any out-of-band change.

---

## 7. Schema Gotchas

These are non-obvious column names and shapes that have tripped
audits before. Always verify against the **live DB** via the
Supabase MCP, never trust migration files alone.

- `whales.label` — not `whales.name`.
- `price_alerts.price` — not `price_alerts.target_price`.
- `user_wallets_v2.wallets` — JSONB. Addresses live inside the JSON.
  `user_wallets_v2.default_address` is a separate text column.
- `pending_trades_active` is a **view** on `pending_trades`, not a
  table. Column nullability of the view is independent of the
  underlying table; do not flag as drift.
- `whale_transactions` foreign keys (from `copy_trades`,
  `whale_tracking`, `whale_submissions`) inherit RESTRICT on delete.
  Decide CASCADE vs SET NULL before any whale-deletion flow.

---

## 8. References

- [Cleanup log](./cleanup-2026-05/supabase-cleanup-log.md) — per-issue advisor resolution
- [Audit findings](./cleanup-2026-05/audit-findings.md) — raw 12-agent audit reports
- [Security backlog](../SECURITY_BACKLOG.md) — deferred items requiring owner action
- [Technical debt](../TECHNICAL_DEBT.md) — Medium/Low findings deferred from §1
