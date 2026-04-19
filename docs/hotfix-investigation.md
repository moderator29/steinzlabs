# Session 5A.1 Hotfix — Investigation Log

Date: 2026-04-18
Branch: session-5a-hotfix
DB: phvewrldcdxupsnakddx (EU West 1)

## Accounts in scope

| email | user_id | created | auth_meta.tier |
|---|---|---|---|
| omojunioluwaseyifunmi@gmail.com | `d668bbcb-6b75-4dae-b8ab-22ab97423bac` | 2026-04-06 10:49 | `null` |
| phantomfcalls@gmail.com | `426400fa-dd08-4678-8d93-28e87652cd18` | 2026-04-06 11:19 | `"max"` |

## profiles table

| id | username | display_name | tier | verified_badge |
|---|---|---|---|---|
| 426400fa... (phantomfcalls) | null | null | **max** | **gold** |
| d668bbcb... (omojuni) | null | null | free | null |

✅ Tier upgrade **is** persisted. Column is `profiles.tier` (not `subscription_tier`). Bug is a **client-read mismatch** — UI reads from wrong field name.

## Wallet tables

- `user_wallets`: **0 rows** for either user
- `wallet_identities`: **0 rows** for either user

⚠️ Conclusion: any wallet the user sees in the UI lives in **localStorage only** — it's never been persisted to DB. Cross-account leak is 100% client-side (stale localStorage not cleared on SIGNED_IN). No DB-level user-id mismatch exists.

## Watchlist

- phantomfcalls: 3 rows
- omojuni: 0 rows

No cross-account contamination in DB.

## RLS audit

All user-scoped policies correct — `auth.uid() = user_id` / `auth.uid() = id`. No `USING (true)` leaks on user tables. Service-role policies expected and safe (server-side only).

```
profiles        → (auth.uid() = id) for SELECT/UPDATE
user_wallets    → (auth.uid() = user_id) for ALL
wallet_identities → (user_id = auth.uid()) for ALL
watchlist       → (auth.uid() = user_id) for ALL
```

## Schema notes (divergences from prompt)

- `profiles.id` (not `user_id`) — FK to auth.users
- `profiles.tier` (not `subscription_tier`)
- `user_wallets.wallet_address` (not `address`)
- No `wallets` table — only `user_wallets` + `wallet_identities`

## Root-cause summary

1. **Cross-account wallet leak** → client-side: stale localStorage survives user switch. Fix: wipe prefixed keys on SIGNED_IN when user_id changes.
2. **Tier UI shows "Upgrade" despite Max** → client reads wrong field. Fix: `useTier` hook that hits `/api/user/tier` resolving from `profiles.tier`.
3. **Verified badge missing** → already stored (`verified_badge='gold'`), UI not reading it. Fix in same pass as tier.
