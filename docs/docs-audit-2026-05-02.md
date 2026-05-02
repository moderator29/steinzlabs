# Documentation Audit — 2026-05-02

Inventory of every documentation file in the repo, its purpose, freshness, and what (if anything) needs updating. Run as part of the §4 documentation pass.

Format per row:

- **File** — path
- **Purpose** — what it covers
- **Status** — `current` (accurate as of audit date) / `stale` (outdated content) / `partial` (covers some but not all of its stated scope)
- **Action** — what to do, if anything

---

## Repo-root documentation

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `README.md` | Public landing page on GitHub. Overview, features by layer, tech stack, architecture, getting started, env vars, project structure, doc index, security pointer, license. | current | Doc index extended in this round to include all new files. |
| `SECURITY.md` | Vulnerability disclosure policy. Scope, safe harbor, severity priorities. | current | None. |
| `CONTRIBUTING.md` | Branch / commit / DB / security workflow. PR checklist. | current | None. |
| `CODE_OF_CONDUCT.md` | Standards, scope, conduct@nakalabs.xyz. | current | None. |
| `CHANGELOG.md` | Release notes (Keep-a-Changelog format). | current | Updated in this round to include the new doc commits. |
| `CLAUDE.md` | Rules for future Claude Code sessions in this repo. | current | None. |
| `LICENSE` | Proprietary, all rights reserved. | current | None. |
| `TECHNICAL_DEBT.md` | Medium / Low findings deferred from §1 audit. Organized by audit agent. | current | None. |
| `SECURITY_BACKLOG.md` | Deferred Critical / High items requiring owner action or larger architectural work. | current | None. |
| `.env.example` | Complete env-var reference with comments. | current | None. |

## docs/ — Product

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `docs/feature-documentation.md` | Every live feature with tier requirement, how it works, data sources, limitations. Feature × tier matrix at the bottom. | current | None. |
| `docs/pricing.md` | Tier breakdown with concrete numeric limits. Billing & cancellation policy. Support response targets. | current | None. |
| `docs/slash-commands.md` | Full Telegram + VTX command reference with args, defaults, error behavior. | current | None. |
| `docs/whitepaper.md` | Strategic narrative source-of-truth. Mission, product, architecture, security, tokenomics, partners, roadmap, disclaimers. | current | The public React presentation at `app/whitepaper/page.tsx` (~800 lines) should be aligned to this markdown over time — not done in this round. |
| `docs/TELEGRAM_BOT.md` | Bot deployment + webhook setup runbook. | current | None. |

## docs/ — Architecture

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `docs/supabase-architecture.md` | 117 tables grouped by domain, RLS convention, function inventory, cron-job overview, webhook table, backup strategy, schema gotchas. | current | None. |
| `docs/github-ui-settings-checklist.md` | Branch protection, repo metadata, secret scanning, CODEOWNERS sample, social preview. | current | None. Apply when ready. |

## docs/ — Audit

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `docs/security-audit-2026-05-02.md` | Consolidated red-team report. 14 Critical findings with exploitation / impact / fix / commit references. Threat model. Attack chains. Compliance notes. | current | None. |
| `docs/docs-audit-2026-05-02.md` | This file. | current | — |
| `docs/cleanup-2026-05/audit-findings.md` | Verbatim 12-agent §1 audit reports. | current | Frozen — historical record. |
| `docs/cleanup-2026-05/supabase-cleanup-log.md` | Per-issue Supabase advisor resolution table. | current | Frozen — historical record. |

## docs/sessions/ — Handoffs

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `docs/sessions/HANDOFF-session-A.md` | Initial platform build. | current | Frozen — historical record. |
| `docs/sessions/HANDOFF-session-B.md` | Security pass + 14-rule hardening. | current | Frozen — historical record. |
| `docs/sessions/HANDOFF-session-C.md` | Native charts, AppKit + SecurityGate, 6 live migrations, 10-agent audit. | current | Frozen — historical record. |

## docs/ — Older audit documents

The following pre-existed before this round. They are historical records of earlier session work; kept for reference but should be considered frozen.

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `docs/audit-session-4.md` | Session 4 audit notes. | frozen | Keep. |
| `docs/hotfix-investigation.md` | Hotfix triage notes. | frozen | Keep. |
| `docs/login-loop-audit.md` | Login-loop diagnosis. | frozen | Keep. |
| `docs/phase0.5b-market-audit.md` | Phase 0.5B market audit. | frozen | Keep. |
| `docs/phase05c-whale-seed-report.md` | Whale-seed report. | frozen | Keep. |
| `docs/session-5-deep-audit.md` | Session 5 deep audit. | frozen | Keep. |
| `docs/session-5a-complete-audit.md` | Session 5A complete audit. | frozen | Keep. |
| `docs/session-5a-final.md` | Session 5A final. | frozen | Keep. |
| `docs/session-5a-phase1-4-audit.md` | Session 5A phase 1–4 audit. | frozen | Keep. |

---

## Public Documentation Site

External docs at `docs.nakalabs.xyz` are referenced from the README but are out of scope for this audit round. They should be reviewed and updated against the in-repo `docs/feature-documentation.md` as the source of truth before next public launch.

---

## What's missing (not yet written)

These are documents the spec calls for that are intentionally not yet shipped, with notes on why and what would be required.

- **`docs/api-reference.md`** — full REST API reference. Scope: 266 endpoints. Recommendation: auto-generate from zod schemas + JSDoc rather than hand-write. Backlog.
- **`docs/architecture.md`** — system-level architecture (vs the Supabase-specific one). Most of the content already lives in `README.md` and `whitepaper.md`. Decide whether to extract or leave there.
- **`docs/deployment-guide.md`** — Vercel deployment, Supabase project setup, env-var rotation runbook, rollback. Recommendation: write next when secret rotation per [SECURITY_BACKLOG.md](../SECURITY_BACKLOG.md) #1 happens.
- **`docs/performance-baseline-{date}.md`** — Lighthouse scores per page, bundle analysis, DB query timings, API response-time percentiles. Required by §7 of the cleanup spec. Recommendation: capture in a controlled environment (not local dev) and commit alongside the next perf-focused PR.
- **`/privacy`** route — required by GDPR / CCPA per [SECURITY.md](../SECURITY.md). Counsel review recommended before publishing.

---

## Summary

- **Current** (fresh, accurate as of audit date): 21 files.
- **Frozen** (historical record, kept for reference): 12 files.
- **Stale** (needs update): 0.
- **Missing** (called for by spec, not yet written): 5.

Documentation posture is healthy. The biggest remaining gap is the public API reference (`docs/api-reference.md`) which is recommended as an auto-generation task rather than hand-writing.
