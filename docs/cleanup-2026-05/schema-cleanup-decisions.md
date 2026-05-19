# Schema cleanup — H10 decisions

Companion to `docs/sessions/SESSION-Q-KICKOFF.md` §3 H10.

## Dead-table audit result

The 20-agent audit (Agent 21) flagged three tables as "never referenced
by app/lib code":

- `cult_ambient_tracks`
- `cult_cosmetics`
- `cult_member_loadouts`

**Re-audit on 2026-05-17 finds the flag is incorrect.** All three are
referenced by the cult sanctum routes:

| Table | Referenced in |
|---|---|
| `cult_ambient_tracks` | `app/api/cult/sanctum/library/route.ts`, `app/api/cult/sanctum/library/[id]/route.ts`, `app/api/cult/sanctum/library/reorder/route.ts` |
| `cult_cosmetics` | `app/api/cult/sanctum/mantle/route.ts` |
| `cult_member_loadouts` | `app/api/cult/sanctum/mantle/route.ts` |

**Decision: keep all three.** Update the audit doc to reflect the
correction so we don't flag them again on the next pass.

## Migration naming hygiene

Six migrations share the `2026_05_02_*` prefix:
- `2026_05_02_conclave.sql`
- `2026_05_02_naka_cult_tier.sql`
- `2026_05_02_session_d_auth_tokens.sql`
- `2026_05_02_session_d_rls_advisor_cleanup.sql`
- `2026_05_02_session_d_schema_storage_audit_fixes.sql`
- `2026_05_02_vault_foundation.sql`

**Decision: do not rename.** The Supabase migration runner keys
applied migrations by filename hash; renaming live migrations forces a
manual `supabase migration repair --status applied <new>` for every
environment, which is risky and the gain (alphabetical ordering
clarity) is purely cosmetic. The repo timestamp + git history are
already authoritative.

Future migrations are named with an incrementing date prefix
(`2026_05_NN_*`) and an action-verb body — that's the standard going
forward; we don't retrofit history.

## Migration history clarity

The full chronology lives in `supabase/migrations/` and can be derived
with:

```bash
ls -1 supabase/migrations/ | sort
```

For dates beyond a single file's prefix granularity, `git log
--diff-filter=A -- 'supabase/migrations/*.sql'` gives commit ordering.
