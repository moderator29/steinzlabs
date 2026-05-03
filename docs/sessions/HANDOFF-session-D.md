# Session D Handoff — 2026-05-02

> Read this first if you are starting a new Claude Code session in `moderator29/steinzlabs`.

This is the canonical handoff for everything that happened in Session D (the "professionalization ramp"). Top-up to the prior Session-A / B / C handoffs — those are still valid for the platform-build context. This file covers what's new and what changed.

---

## §1 — How Phantomfcalls (the owner) works

### Identity

- GitHub: **`moderator29`**
- Canonical commit identity: **`moderator29 <101205446+moderator29@users.noreply.github.com>`**
- Brand: Naka Labs / Steinz Labs / NakaCult / `$NAKA`
- Production: https://nakalabs.xyz (Vercel auto-deploy from `main`)

### Working preferences

- **Casual tone, fast pace.** "bro", "fr fr", "quick", "wagwan" — match the energy. No corporate stiffness.
- **Picture-perfect bar.** "Top 1% MEVX/Nansen-grade." No mock data. Real APIs only. No half-finished implementations.
- **Always audit + commit per section.** Each section of work ships its own PR with a clear commit message.
- **WCAG AAA target.** Every UI surface aims for accessibility AAA where the design allows.
- **Real-data invariant.** Never introduce mock/fake/demo data. Wire to real APIs (CoinGecko, Alchemy, Helius, GoPlus, Jupiter, 0x, Anthropic, Supabase, Birdeye, LunarCrush, Arkham). If data is unavailable, return empty state with an error — never fabricate.
- **He merges, you don't.** Phantomfcalls reviews and merges every PR himself in the GitHub UI. Vercel auto-deploys from main, so direct pushes to main are forbidden.
- **PR style.** Push the branch and stop. Do not open the PR via `gh` — he opens it from the UI.

### Session-D-specific tells

- **He gets overwhelmed by long status updates.** Keep replies tight. When a checkpoint is needed, present it as a small table or a 5-line summary, not paragraphs.
- **He may say "push it" / "run it" / "go" as authorization** — treat these as explicit go-aheads for the most recent gated action.
- **He is the only collaborator.** No team. Anything that requires "two people" (PR review approvals, Code Owner reviews) creates a deadlock — never enable those branch-protection rules.

---

## §2 — What shipped in Session D (merge order)

Every PR below is now on `main`.

| # | PR / commit | What it did |
|---|-------------|-------------|
| 1 | `chore/repo-cleanup` | RLS migration (advisor 36→3), 13 of 14 §1 Critical fixes |
| 2 | `chore/repo-polish-files` | CONTRIBUTING, LICENSE, CHANGELOG, CoC, GH templates, CI, Dependabot |
| 3 | `docs/readme-rewrite` | Comprehensive senior-engineer README |
| 4 | `docs/slash-commands-pricing` | Telegram + VTX command reference, pricing tiers |
| 5 | `docs/whitepaper-supabase-arch` | Whitepaper markdown source, full Supabase architecture |
| 6 | `docs/security-audit-report` | Consolidated red-team report |
| 7 | `docs/feature-documentation` | Every live feature with tier, data sources, limits |
| 8 | `docs/audit-summary-and-index` | §4.1 docs audit, README index extension |
| 9 | `docs/schema-storage-realtime-audit` | 6 FK ON DELETE rules, storage bucket hardening |
| 10 | `chore/scrub-ai-footprints` | 62 prompt-paste files removed, gitignore rule added |
| 11 | `docs/final-deliverables` | architecture, deployment, API ref, perf baseline, file-structure audit, polish review, final checklist |
| 12 | `chore/codeowners` | `.github/CODEOWNERS` |

Plus: **§5 git history rewrite** — all 19 branches force-pushed, authors normalized. See §5 below.

---

## §3 — Live Supabase migrations applied this session

All applied via Supabase MCP and mirrored to `supabase/migrations/`.

| Migration name (live) | Repo file | What it does |
|----------------------|-----------|--------------|
| `session_d_part1_helpers_and_admin` | `2026_05_02_session_d_rls_advisor_cleanup.sql` | `is_admin()` helper, RLS on admin tables, `set_updated_at` search_path lock, revoke EXECUTE on `handle_new_user*`, rebuild `pending_trades_active` view as security_invoker |
| `session_d_part2_user_scoped_rls` | (same file) | RLS policies on user-scoped tables (whale_tracking, copy_trades, vtx_query_logs, etc.) |
| `session_d_part3_public_read_and_fix_always_true` | (same file) | RLS public-read policies on computed reference tables, replace always-true `engagement_insert_any` and `waitlist_insert_anyone` |
| `session_d_auth_tokens` | `2026_05_02_session_d_auth_tokens.sql` | New `auth_tokens` table for opaque server-stored reset/verify tokens |
| `session_d_schema_storage_audit_fixes` | `2026_05_02_session_d_schema_storage_audit_fixes.sql` | 6 FK ON DELETE rules, research-images bucket size + MIME limits |

**Live advisor went 36 → 3.** Remaining:
- `pg_trgm` extension in `public` schema (deferred — needs app-wide search_path audit)
- `is_admin()` SECURITY DEFINER warning (intentional, accepted)
- `auth_leaked_password_protection` (Supabase Dashboard config, owner action)

---

## §4 — New utilities and patterns introduced

### `lib/utils/addressNormalize.ts`

The canonical helper for cross-chain address comparisons. **Never call `.toLowerCase()` directly on an address.** EVM is case-insensitive; Solana base58 is case-sensitive. Helper exposes:

```ts
normalizeAddress(addr, chain?)   // chain-aware canonical form
addressesEqual(a, b, chain?)     // true if same on-chain account
isEvmAddress(addr)               // 0x + 40 hex chars
isSolanaAddress(addr)            // base58 32-44 chars
isEvmChain(chain)                // chain name → bool
```

CLAUDE.md project rule bans direct `.toLowerCase()` on addresses going forward.

### `lib/authTokens.ts` rewrite

Old design: deterministic HMAC, ~32-bit entropy, replayable, hour-bucketed. **Replaced with**: 32 random bytes, SHA-256 hashed in `auth_tokens` table, atomic single-use consume, 30-min TTL for reset / 24h for verify. Issuing a new token of the same kind invalidates the previous one.

Pattern is the template for any other server-stored short-lived secret (webhook auth headers, magic links, support session tokens, future API keys).

### Wallet session hardening (`lib/wallet/walletSession.ts`)

Module-level `let` replaced with closure-private state. 30-min sliding TTL. Cleared on `pagehide` and `visibilitychange→hidden`. Reduces XSS exfiltration window.

### XOR fallback removal

The legacy XOR decryption fallback for AES-GCM wallet keys was removed from 3 callsites (`lib/wallet/pendingSigner.ts`, `app/dashboard/swap/page.tsx`, `app/dashboard/wallet-page/page.tsx`). Affected wallets see a clear error directing them to re-import the seed phrase.

### VTX prompt-injection allow-list

`personality`, `language`, `riskAppetite`, `depth` are validated against fixed enums before they touch the system-prompt template. `HISTORY_HARD_CAP=100` blocks DoS via huge history arrays.

### Server-side admin gate

`middleware.ts` now verifies `profiles.role = 'admin'` before any `/admin/*` page renders. Non-admins land on `/dashboard?denied=admin`.

### Webhooks fail closed in production

`/api/webhooks/alchemy-whale` and `/api/webhooks/helius-whale` reject unsigned/unverified payloads in production. Local-dev escape requires explicit `ALCHEMY_WEBHOOK_DEV_BYPASS=true` or `HELIUS_WEBHOOK_DEV_BYPASS=true`.

---

## §5 — Git history rewrite (the big one)

**Every commit on every branch was rewritten.** Authors normalized; AI attribution stripped.

### What changed
- Stripped patterns: `Co-Authored-By: Claude`, `Co-Authored-By: ... noreply@anthropic.com`, `Co-Authored-By: ... Truckdriver`, `Generated with Claude Code`, `Generated by Claude`, `🤖 Generated…`.
- Author remap → canonical `moderator29 <101205446+moderator29@users.noreply.github.com>`:
  - `Claude <noreply@anthropic.com>`
  - `Truckdriver-dev <...moderator29@users.noreply.github.com>`
  - `phantomfcalls <...@users.noreply.replit.com>`
  - `moderator29 <omojunioluwaseyifunmi@gmail.com>`
- Authors on origin after rewrite: **`moderator29` + `dependabot[bot]` only**.
- 19 branches force-pushed with `--force-with-lease`.

### Backup safety net

Tags `backup-history-rewrite-2026-05-02/*` exist on origin (one per branch HEAD). To delete after Phantomfcalls confirms:

```bash
git tag -l 'backup-history-rewrite-2026-05-02/*' | xargs -I{} git push origin --delete {}
git tag -l 'backup-history-rewrite-2026-05-02/*' | xargs git tag -d
```

### Future-session contract

The §5 cleanup is **only durable if every future session honors CLAUDE.md**. The rules:

- All commits authored as `moderator29 <101205446+moderator29@users.noreply.github.com>`. Never anything else.
- Never add AI attribution trailers to commit messages.
- Never reference Claude / AI generation in code, comments, docs, or PR descriptions.
- Never use `claude/`, `ai/`, or `claude-code/` branch prefixes.
- Conventional Commits format only: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `style:`, `perf:`, `security:`.

If git config shows a different author, fix it before committing:

```bash
git config user.name "moderator29"
git config user.email "101205446+moderator29@users.noreply.github.com"
```

CLAUDE.md at the repo root encodes these rules and is auto-loaded by every Claude Code session in this repo.

---

## §6 — Open backlogs to read before starting new work

| File | What's in it |
|------|--------------|
| `TECHNICAL_DEBT.md` | Medium / Low findings from the §1 12-agent audit organized by audit agent |
| `SECURITY_BACKLOG.md` | Deferred Critical / High items needing owner action or larger architectural change |
| `docs/security-audit-2026-05-02.md` | Consolidated red-team report (14 Criticals with fix references, threat model, attack chains, compliance) |
| `docs/cleanup-2026-05/audit-findings.md` | Verbatim 12-agent §1 audit reports |
| `docs/cleanup-2026-05/supabase-cleanup-log.md` | Per-issue advisor cleanup ledger |
| `docs/cleanup-2026-05/schema-storage-realtime-audit-2026-05-02.md` | §3.3 audit (FK / storage / realtime) |
| `docs/cleanup-2026-05/scrub-ai-footprints-2026-05-02.md` | What was removed and what was kept |

---

## §7 — Critical Session-D-introduced gotchas

1. **`addressNormalize.ts` exists now** — use it everywhere. CLAUDE.md banned direct `.toLowerCase()` on addresses.
2. **`auth_tokens` table is the template** — any new short-lived server-stored token should follow the same atomic-consume + opaque-hash pattern.
3. **`is_admin()` SQL helper** — used inside RLS policies on admin-readable tables. Don't break it.
4. **Webhook signing keys are required in production** — adding a new chain to Alchemy webhooks means adding the new key to `ALCHEMY_WEBHOOK_SIGNING_KEYS` (comma-separated). Otherwise the webhook fails closed.
5. **`HISTORY_HARD_CAP = 100`** in VTX route — don't raise without a memory-cost analysis.
6. **`platform_settings.sniper_enabled`** is the live kill switch — toggleable without redeploy. Document any flip in `admin_audit_log`.
7. **Wallet session key is closure-private + TTL'd** — adding new wallet flows must NOT bypass `getWalletSessionKey()` / `clearWalletSessionKey()`.
8. **Backup tags `backup-history-rewrite-2026-05-02/*`** — do NOT delete until owner confirms the rewrite has settled across all his clones.

---

## §8 — Owner action items still open at handoff

These cannot be done by the AI session — they require Phantomfcalls in the GitHub UI / Vercel UI / Supabase Dashboard.

1. **Rotate every secret in `.env.local`** per `SECURITY_BACKLOG.md` #1 (Vercel dashboard). Order: `SUPABASE_SERVICE_ROLE_KEY` → `ANTHROPIC_API_KEY` → `ALCHEMY_API_KEY` → `HELIUS_*` → `JWT_SECRET` → everything else.
2. **GitHub branch protection on `main`** — require status checks (`typecheck`, `build`). **Do NOT enable** "Require approvals" or "Require Code Owner reviews" — solo maintainer, those create deadlocks.
3. **Secret scanning + push protection** in GitHub Settings → Code security.
4. **Leaked-password protection** in Supabase Dashboard → Authentication → Policies.
5. **Repo metadata** — Description / Website / Topics on the repo About widget (right sidebar of repo home page, click ⚙️). Topics must be entered one at a time, not as a comma-separated string.
6. **Capture real Lighthouse / bundle / DB / API numbers** against production per `docs/performance-baseline-2026-05-02.md`.
7. **Cross-device smoke test** — iPhone Safari, Android Chrome, desktop Chrome/Safari/Firefox.
8. **Delete backup history-rewrite tags** when comfortable.

---

## §9 — How to start the next session

```bash
cd "C:/Users/DELL LATITUDE 5320/dev/steinzlabs"
git checkout main
git pull --ff-only
git config user.name                   # confirm: moderator29
git config user.email                  # confirm: 101205446+moderator29@users.noreply.github.com
cat CLAUDE.md | head -30               # refresh the rules
cat docs/sessions/HANDOFF-session-D.md # this file
```

Then read what you need from `TECHNICAL_DEBT.md` / `SECURITY_BACKLOG.md` based on the day's task.

For Supabase work, **always verify against the live DB via MCP** (`mcp__supabase__list_tables`, `execute_sql`) before trusting migration files. Multiple past audits got tripped up by stale migration files.

---

## §10 — The "big build" coming

At handoff time, Phantomfcalls said:
> "i have a big work for you when we done with this all"
> "im about to start a very big build"

Scope not yet declared. When the next session starts, the first message will likely be the brief. Treat it as a fresh feature scope — read this handoff and CLAUDE.md before spinning up.

Whatever it is — start by reading the spec carefully, asking targeted clarifying questions only if something is genuinely ambiguous, then execute per §1 working preferences (casual tone, picture-perfect bar, real data only, push-and-stop branching workflow).

---

## §11 — Working state at end of Session D

| Surface | State |
|---------|-------|
| Production app on https://nakalabs.xyz | Live, healthy, no known regressions |
| TypeScript errors | 0 |
| Build errors | 0 |
| Supabase advisor | 3 (down from 36; all 3 are accepted/deferred) |
| Critical security findings | 13/14 fixed; 1 owner-action (secret rotation) |
| Authors on origin | `moderator29` + `dependabot[bot]` only |
| AI attribution in commits | 0 |
| `CLAUDE.md` enforcement file | In place at repo root |
| Open PRs | 0 (all merged) |
| Open backlogs | `TECHNICAL_DEBT.md` (~150 Med/Low items), `SECURITY_BACKLOG.md` (~10 deferred Crit/High) |

Repo presents as a senior-engineer solo build. Ready for the next phase.

— end Session D handoff —
