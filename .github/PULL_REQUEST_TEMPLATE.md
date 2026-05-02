<!--
Thanks for the PR. Fill in what's relevant; delete sections that don't apply.
-->

## Summary

<!-- One paragraph: what changed and why. -->

## Changes

- [ ] Code
- [ ] Database migration (mirrored in `supabase/migrations/`)
- [ ] Documentation
- [ ] Configuration / env vars
- [ ] Tests

## Screenshots / Demo

<!-- For UI changes, drop a screenshot or short Loom. Mobile + desktop both. -->

## Test plan

<!-- How did you verify this works? List the specific things you tried. -->

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` succeeds
- [ ] Smoke-tested the affected flow in dev
- [ ] (If migration) Verified the migration applied cleanly via `mcp__supabase__list_migrations`

## Risk

<!--
What's the blast radius if this breaks? Mention anything that touches:
  - shared DB state (RLS policies, schema changes)
  - auth / session flow
  - wallet signing path
  - tier gates
  - payments / treasury
  - VTX system prompt or tool definitions
-->

## Checklist

- [ ] Branch is up to date with `main`
- [ ] No new ESLint warnings
- [ ] No `console.log`, no commented-out code, no unjustified `any`
- [ ] No secrets / API keys in the diff
- [ ] If user-facing, copy reviewed for tone (no AI-generated phrasing)
- [ ] If a feature flag, kill-switch path documented
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] Linked to a tracking issue (if there is one)
