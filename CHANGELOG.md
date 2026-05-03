# Changelog

All notable changes to Steinz Labs are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
where applicable. Entries are grouped by release; unreleased work lives at
the top.

## [Unreleased]

### Final deliverables (May 2026)

- `docs/architecture.md` — system-level architecture with request lifecycle, trust boundaries, observability, background work, and key architectural decisions (server-trusted tier, non-custodial invariant, address normalization, inflight-Map dedup, write-on-read snapshots, fail-closed webhooks).
- `docs/deployment-guide.md` — Vercel / Supabase setup runbook, env-var reference, CI overview, rollback, secret-rotation order, monitoring, incident response.
- `docs/api-reference.md` — internal route map (267 endpoints) plus a v1 public-API recommendation (zod → OpenAPI → Swagger).
- `docs/performance-baseline-2026-05-02.md` — Lighthouse / bundle / DB / API response-time capture template with targets and known performance characteristics from the 12-agent audit.
- `docs/file-structure-audit-2026-05-02.md` — verifies the layout and naming match the cleanup-spec template (13/13 dirs present, 0 kebab-case violations).
- `docs/repo-polish-review-2026-05-02.md` — the §6.7 final-pass checklist confirming the repo presents as senior-engineer solo work.
- `docs/final-deliverables-checklist-2026-05-02.md` — the §8 closing checklist with sign-off and the user-action items that remain (secret rotation, GitHub UI settings, leaked-password protection, perf capture, real-device smoke test, backup-tag deletion).

### History rewrite (Session D)

- Stripped `Co-Authored-By: Claude`, `🤖 Generated with Claude Code`, and related AI-attribution trailers from every commit on every branch.
- Remapped 4 non-canonical author identities (`Claude`, `Truckdriver-dev`, `phantomfcalls@replit`, `omojunioluwaseyifunmi@gmail`) to canonical `moderator29 <101205446+moderator29@users.noreply.github.com>`. Authors on origin now contain only `moderator29` and `dependabot[bot]`.
- 19 branches force-pushed with `--force-with-lease`. Backup tags `backup-history-rewrite-2026-05-02/*` retained on origin for rollback safety net.

### Documentation pass (May 2026)

- `docs/feature-documentation.md` — every live feature with tier requirement, how-it-works, data sources, limitations, and a feature × tier matrix at the bottom.
- `docs/pricing.md` — five tiers (Free / Mini / Pro / Max / NakaCult) with concrete numeric limits and support response targets.
- `docs/slash-commands.md` — Telegram (27 commands) + VTX in-app slash command reference.
- `docs/whitepaper.md` — markdown source-of-truth for the public whitepaper.
- `docs/supabase-architecture.md` — 117 tables grouped by domain, RLS convention, function inventory, cron-job overview, webhook table, backup strategy.
- `docs/security-audit-2026-05-02.md` — consolidated red-team report. 14 Critical findings with exploitation / impact / fix / commit references, threat model, attack chains, compliance notes (GDPR / CCPA / SOC 2 / financial regs).
- `docs/docs-audit-2026-05-02.md` — inventory of every doc with status (current / frozen / stale / missing) and action.
- README documentation index extended to link all new files.

### Repository polish (chore/repo-polish-files)

- Add `CONTRIBUTING.md` with branch / commit / DB / security guidelines.
- Add `LICENSE` (proprietary, all rights reserved).
- Add this `CHANGELOG.md`.
- Add `CODE_OF_CONDUCT.md`.
- Add `.github/PULL_REQUEST_TEMPLATE.md`.
- Add `.github/ISSUE_TEMPLATE/bug_report.md` and `feature_request.md`.
- Add `.github/workflows/ci.yml` with typecheck + build gates.
- Add `.github/dependabot.yml` for npm + GitHub Actions updates.
- Add `docs/github-ui-settings-checklist.md` for repo settings (branch
  protection, CODEOWNERS, secret scanning, banner) that have to be applied
  through the GitHub web UI.

### Cleanup branch (chore/repo-cleanup) — pending merge

The cleanup branch (commits `11bad46` → `fdcd4b0`) closes 13 of 14
Critical findings from the §1 12-agent codebase audit and resolves 33 of
36 Supabase advisor findings. See its commit history for the full list.
Highlights:

- **Supabase RLS cleanup.** Enable RLS + add policies on 26 unprotected
  public tables (whales, copy_trades, naka_trust_scores, smart money,
  bubblemap, etc.). Rebuild `pending_trades_active` view with
  `security_invoker = true`. Lock `set_updated_at` search_path. Revoke
  `EXECUTE` on `handle_new_user*` from anon/authenticated. Replace
  always-true policies on `engagement` and `waitlist`. Add `is_admin()`
  helper. Advisor goes 36 → 3.
- **API auth gaps closed.** Hardcoded admin password removed from
  `app/api/builder-submissions`. Auth added to `admin/coingecko-usage`.
  Mass-assignment fixed in `admin/featured-tokens`. Webhook signature
  verification fail-closes in production for both Alchemy and Helius
  (Helius now uses `crypto.timingSafeEqual`).
- **Sniper auth.** `app/api/sniper/execute` wraps in `withTierGate('pro')`
  and derives `user.id` from session, closing the cross-user
  execution-history pollution vector.
- **Address normalization.** Add `lib/utils/addressNormalize.ts` and
  route 6 known `.toLowerCase()` callsites through it (zerox,
  autoConnect, pendingSigner, goplusService, Cluster2DGraph,
  WhaleAvatar). Solana case-sensitivity bugs closed.
- **VTX prompt injection.** Allow-list `personality`, `language`,
  `riskAppetite`, `depth` before they touch the system prompt. Cap
  history length at 100 before slicing (DoS guard).
- **Auth tokens.** Drop deterministic-HMAC scheme in `lib/authTokens.ts`.
  Add `auth_tokens` table with random 32-byte tokens stored as SHA-256
  hashes, 30-min TTL for reset / 24-hour for verify, atomic single-use
  consume.
- **Admin server-side gate.** `middleware.ts` now verifies
  `profiles.role = 'admin'` before any `/admin/*` page renders.
- **Wallet hardening.** Remove broken XOR decryption fallback (3
  callsites). `walletSession.ts` rewritten with closure-private state,
  30-min sliding TTL, `pagehide` + `visibilitychange` clear.
- **Anthropic cache.** Remove `as Anthropic.Tool` cast on
  `tagToolsForCache` — current SDK supports `cache_control` natively.

Documentation added during the round:
- `CLAUDE.md` (project rules for Claude Code sessions)
- `SECURITY.md` (vulnerability disclosure policy)
- `.env.example` (full env-var reference)
- `TECHNICAL_DEBT.md` (deferred Medium / Low audit findings)
- `SECURITY_BACKLOG.md` (deferred Critical / High requiring owner action)
- `docs/cleanup-2026-05/audit-findings.md` (12-agent §1 audit verbatim)
- `docs/cleanup-2026-05/supabase-cleanup-log.md` (per-issue advisor table)

## Pre-2026-05-02

History before this changelog was started lives in `git log`. The
session-handoff documents in `docs/sessions/` summarize the major
phases:

- `HANDOFF-session-A.md` — initial platform build
- `HANDOFF-session-B.md` — security pass + 14-rule hardening
- `HANDOFF-session-C.md` — native charts, AppKit + SecurityGate, 6 live
  migrations, 10-agent audit
