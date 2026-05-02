# Contributing to Steinz Labs

Thanks for taking the time to help. This is a private repository — most contributions come from team members. The same workflow applies if you've been invited as a collaborator or are a contractor working against an issue.

## Workflow

1. Cut a feature branch from `main`. Never commit to `main`.
   ```bash
   git checkout main
   git pull --ff-only
   git checkout -b feat/<short-name>
   ```
2. Make focused commits using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `refactor:` code change without behavior change
   - `chore:` tooling, deps, maintenance
   - `docs:` documentation only
   - `test:` test changes only
   - `perf:` performance
   - `security:` security fix
3. Push the branch and open a PR via the GitHub UI. The repository owner reviews and merges. Vercel auto-deploys on merge to `main`.
4. Do not force-push to `main`. If you need to rewrite history on a feature branch, use `--force-with-lease` and coordinate with anyone else who pulled it.

## Code Style

- TypeScript strict mode is on. No `any` unless you can defend it in review.
- No `console.log` in production code. Use Sentry for error capture and the existing logger utilities for diagnostics.
- No commented-out code. Delete it; git remembers.
- No empty `try/catch`. Either handle the error or let it propagate.
- Functions over 50 lines should have a brief docstring explaining the why.
- Files over 500 lines are a refactor candidate.
- Address comparisons go through `lib/utils/addressNormalize.ts`. Never call `.toLowerCase()` on a wallet/token address — Solana is case-sensitive at the protocol level.
- No mock or fake data. The platform is wired to real APIs (CoinGecko, Alchemy, Helius, GoPlus, Jupiter, 0x, Anthropic, Supabase). If data isn't available, return empty state with an error.

## Tests

The codebase does not currently maintain a unit test suite for application code. When adding tests, colocate them next to the file under test (`foo.test.ts` next to `foo.ts`) and run via `vitest` or whichever runner is in `package.json` at the time. Don't ship a flaky test — if it can't run reliably in CI, fix it or don't merge it.

## Database Changes

Schema changes go through Supabase migrations:
1. Apply via the Supabase MCP (`apply_migration`) or `supabase db push` for local dev.
2. Mirror the SQL into `supabase/migrations/` so the repo and live DB stay in sync.
3. The commit message should include the migration name and a short description.

For RLS policy changes:
- Every public table needs RLS enabled and at least one policy.
- Convention: `service_role_<table>` catch-all + scoped policies (`<table>_users_own`, `<table>_admin_*`, `<table>_public_select` depending on category).
- Use `(SELECT auth.uid())` in policy expressions for query-plan inlining.

For function changes:
- Always set explicit `SECURITY DEFINER` or `SECURITY INVOKER`.
- Always set `SET search_path = public, pg_temp` (or whichever schema is intended).

## Security

- Never commit secrets. The repo's `.gitignore` blocks `.env*` and `.vercel/`.
- Never log private keys, seed phrases, raw JWTs, or full email/IP combinations.
- Server-validate all inputs. RLS is defense in depth, not your only defense.
- Found a vulnerability? Email **security@nakalabs.xyz** instead of opening an issue. See [SECURITY.md](./SECURITY.md).

## Pull Request Checklist

Before requesting review:
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] No new ESLint warnings introduced
- [ ] No `console.log`, no commented-out code, no `any` without justification
- [ ] Migrations (if any) are mirrored in `supabase/migrations/`
- [ ] User-facing changes have a screenshot or short Loom in the PR body
- [ ] Breaking changes are flagged in the PR title (`feat!:` or `fix!:`)
- [ ] Documentation updated if behavior, env vars, or setup steps changed

## Releasing

`main` is the deployment branch — every merge to `main` ships to production via Vercel. There is no separate staging environment. If you're shipping a risky change, use a feature flag in `platform_settings` so the kill switch is server-side and reversible without a redeploy.
