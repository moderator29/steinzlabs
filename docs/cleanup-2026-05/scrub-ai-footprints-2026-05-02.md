# Scrub AI Footprints — 2026-05-02

The §6.2 deliverable: scrub Claude / AI attribution from source code. Audit pass + actions.

## What was removed

### 1. 62 prompt-paste files in `attached_assets/`

`attached_assets/Pasted-*.txt` — each one a copy-paste of a prompt sent to Claude during earlier sessions. Useful at the time, noise now. None of them are referenced by any source file.

```bash
git rm attached_assets/Pasted-*.txt
# 62 files removed
```

Real product images in `attached_assets/` (`IMG_*.png`, `IMG_*.jpeg`) are kept — those are screenshots used by docs / app pages.

### 2. The `🤖 Generated with [Claude Code]` trailer

One instance: `docs/session-5a1-final-audit.md:296`. Removed.

Other session-5* docs were spot-checked and clean.

### 3. `.gitignore` rule to prevent re-introduction

Added:

```gitignore
# Replit / IDE prompt-paste cruft. Real product images keep their
# IMG_*.{png,jpeg} names; the auto-generated text pastes are noise.
attached_assets/Pasted-*.txt
```

So the next time the IDE auto-saves a prompt paste, it gets ignored.

## What was kept (legitimate references)

These hits showed up in the AI-footprint sweep but are intentional and correct.

| File:Line | What | Why kept |
|-----------|------|----------|
| `CLAUDE.md` (multiple) | The rules file itself — lists banned patterns to ban them. | Self-referential by design. |
| `.github/PULL_REQUEST_TEMPLATE.md:48` | Checklist item: "copy reviewed for tone (no AI-generated phrasing)". | Reminder to reviewers; intentional. |
| `CHANGELOG.md:78` | Describes the cleanup process in a release-note entry. | Historical record. |
| `README.md:244` | Links to CLAUDE.md from the doc index. | Necessary navigation. |
| `lib/agents/cluster-agent.ts:263,294` | `model: 'claude-sonnet-4-6'` | The Anthropic model identifier — required as the API parameter. |
| `lib/agents/cluster-agent.ts:52` | Comment: `summary: string; // AI-generated narrative` | Describes what the field contains (the cluster's AI narrative, a product feature). |
| `app/dashboard/wallet-clusters/page.tsx:5` | Comment describing the cluster agent product feature. | Describes the user-facing feature, not the codebase. |
| `app/dashboard/wallet-clusters/layout.tsx:14` | Marketing copy: "Community + AI-generated cluster labels". | Describes the product to the user. |
| `app/whitepaper/page.tsx:737` | Marketing copy: "AI-generated research reports". | Describes the product to the user. |
| `app/terms/page.tsx:52,70` | Legal disclaimers about AI-generated content. | Required legal language about the AI feature. |
| `app/api/market/[address]/intelligence/route.ts` | API code involving Anthropic integration. | Production code; "Claude" here refers to the Anthropic model. |
| `scripts/phase1-schema.sql:174` | SQL comment: "VTX AI-generated research". | Describes what `research_posts` holds. |
| `docs/sessions/HANDOFF-session-*.md` and `docs/session-*-audit.md` | Frozen historical records. | Per `docs/docs-audit-2026-05-02.md` these are historical records; do not modify. |

The pattern: any reference to "Anthropic Claude" or "Claude (the model)" is a correct technical attribution. Any reference to "Claude Code", "AI-assisted", or trailer-style attribution about the codebase is what we strip. The product feature is allowed to describe itself as "AI-generated" because that is what users see and what legal language must disclose.

## Tooling for next time

- The CLAUDE.md rules at the repo root continue to enforce the prohibition for future Claude Code sessions in this repo.
- The new gitignore rule prevents `attached_assets/Pasted-*.txt` from being committed even by accident.
- GitHub secret scanning + push protection (per `docs/github-ui-settings-checklist.md`) catch credentials before they hit the remote.
- Conventional Commits + `CONTRIBUTING.md` PR checklist remind reviewers to scrub AI-style phrasing.

## Verification

```bash
# Trailer search
git grep -i "Generated with \[Claude Code\]"
git grep -i "🤖 Generated with"
git grep -i "Co-Authored-By: Claude"
git grep -i "noreply@anthropic.com"
# Expected for each: 0 results outside CLAUDE.md.

# Cruft search
ls attached_assets/Pasted-*.txt 2>/dev/null
# Expected: no such files.
```

## Out of scope for this round

- **Git history rewrite** — §5 of the spec. Still gated on the user's "push it" approval. The 62 paste files and the trailer line still exist in historical commits; only the working tree is clean. A `git filter-repo` pass over the branch will land that piece next.
- **AI-style comments in code** — there is no robust automated way to detect "this comment sounds like an AI wrote it"; it is judgment-driven. Spot reviews of high-traffic files (large components, new utility files) during normal PR review catches these. Not blocking.
