# Schema, Storage, Realtime Audit — 2026-05-02

The §3.3 deliverable: live-DB checks for schema hygiene, storage configuration, and realtime exposure. Run via Supabase MCP against project `phvewrldcdxupsnakddx`.

Companion to [supabase-architecture.md](../supabase-architecture.md) (table inventory + RLS) and [supabase-cleanup-log.md](./supabase-cleanup-log.md) (advisor 36→3 round).

---

## §3.3a Schema audit

### Naming conventions

Verified by hand against `mcp__supabase__list_tables`. **No tables** use `tbl_` prefixes or other abbreviations. **All names** are descriptive (`whale_transactions`, `pending_trades_active`, `auth_tokens`, etc.).

### Primary keys

```sql
SELECT t.table_schema, t.table_name
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints c
  ON c.table_schema = t.table_schema
 AND c.table_name = t.table_name
 AND c.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND c.constraint_name IS NULL;
```

**Result:** 0 rows. Every public base table has a primary key.

### Timestamp types

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('timestamp without time zone', 'time without time zone');
```

**Result:** 0 rows. Every timestamp column uses `timestamptz` (timestamp with time zone). The handoff §8 column-type rule is upheld across the schema.

### Foreign-key ON DELETE behavior

```sql
SELECT tc.table_name, kcu.column_name, rc.delete_rule, ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu USING (constraint_name)
JOIN information_schema.referential_constraints rc USING (constraint_name)
JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND rc.delete_rule IN ('NO ACTION', 'RESTRICT');
```

**Result:** 6 rows defaulted to `NO ACTION` (effectively `RESTRICT`):

| Table | Column | References | Resolution |
|-------|--------|------------|------------|
| `copy_trades` | `whale_id` | `whale_wallets(id)` | `ON DELETE SET NULL` — preserve the user's trade history if a whale is later removed. |
| `copy_trades` | `whale_transaction_id` | `whale_transactions(id)` | `ON DELETE SET NULL` — same reasoning. |
| `platform_fees` | `transaction_id` | `transactions(id)` | `ON DELETE CASCADE` — a fee row without its parent transaction has no meaning. |
| `sniper_match_events` | `pending_trade_id` | `pending_trades(id)` | `ON DELETE CASCADE` — match events are meaningless if the trade they reference is gone (and pending_trades get pruned by cron on expiry). |
| `whale_tracking` | `whale_id` | `whale_wallets(id)` | `ON DELETE CASCADE` — a user's tracking config for a deleted whale is dead config. |
| `whale_transactions` | `whale_id` | `whale_wallets(id)` | `ON DELETE CASCADE` — transactions keyed to a whale; without the whale the row is an orphan that breaks downstream joins. |

**Migration:** `2026_05_02_session_d_schema_storage_audit_fixes.sql` (live + repo).

### updated_at triggers

Most tables that track `updated_at` use the `set_updated_at()` trigger from the §3 cleanup migration. Spot-check confirms `profiles`, `support_tickets`, `featured_tokens`, and others. A repo-wide enforcement audit (every table with `updated_at` MUST have the trigger) is deferred to TECHNICAL_DEBT — the gap is small-blast-radius (worst case: `updated_at` does not auto-update on a row update, surfacing as stale UI timestamps).

---

## §3.3d Storage audit

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets;
```

**Result:** 1 bucket.

| Bucket | Public | Pre-fix | Post-fix |
|--------|--------|---------|----------|
| `research-images` | true | no size limit, no MIME allow-list | 5 MB cap, image MIME types only (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`) |

**Why public:** research articles render server-rendered images and the public flag avoids the per-request signed-URL roundtrip.

**Hardening rationale:**
- **Size limit (5 MB):** caps storage cost and blocks the trivial DoS of uploading 1 GB files.
- **MIME allow-list:** rejects non-image uploads (executables, archives, scripts) at the storage layer; defense-in-depth on top of any application-side validation.
- **SVG inclusion:** kept because some research articles use vector diagrams. Note: SVG can carry script payloads; render via `<img>` (which sandboxes) rather than inlining as `<svg>` to avoid XSS.

**Migration:** same file as the FK fix.

**Storage RLS:** Supabase Storage applies the same RLS model as Postgres tables. Default policy on a public bucket allows anonymous SELECT; INSERT/UPDATE/DELETE require authentication. For `research-images` we keep public SELECT (intentional for article rendering) and rely on the application layer (admin-only research uploads) for write control.

---

## §3.3e Realtime audit

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

**Result:** 0 rows.

The `supabase_realtime` publication has **no tables** in it. This is the correct posture by default: nothing broadcasts to subscribed clients; the platform's "live" features (whale activity feed, context feed, alert push) are served via custom Server-Sent Events endpoints (`/api/whale-activity/stream`, etc.) instead of Supabase Realtime.

**Why this matters:** if `profiles` or any user-scoped table were in the realtime publication, every row change would broadcast to subscribed clients. RLS applies to the broadcast (Supabase respects per-row policies), but the surface is still a possible side channel — better to avoid the publication entirely on sensitive tables.

**Recommendation:** keep the publication empty. If a future feature needs realtime, add **only the specific table** with explicit RLS that scopes the broadcast to the right audience. Document the addition in `supabase-architecture.md`.

---

## Summary

| Check | Status |
|-------|--------|
| Primary keys | All present |
| Timestamp types | All `timestamptz` |
| FK ON DELETE | 6 fixed (SET NULL × 2, CASCADE × 4) |
| Storage buckets | 1 hardened (size limit + MIME allow-list) |
| Realtime publication | Empty (intentional) |
| Naming | All descriptive |

Live DB matches repo migration files after this round.

---

## See also

- [supabase-architecture.md](../supabase-architecture.md) — full table inventory grouped by domain
- [supabase-cleanup-log.md](./supabase-cleanup-log.md) — §3.1 + §3.2 advisor cleanup (36→3)
- [security-audit-2026-05-02.md](../security-audit-2026-05-02.md) — consolidated red-team report
