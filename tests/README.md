# Playwright + security probes

End-to-end critical-flow specs for Section-10 and security probes.

## Layout

- `critical-flows/*.spec.md` — human-readable source of truth (Given / When / Then).
- `critical-flows/*.spec.ts` — runnable Playwright transcription of the same flows.
- `security/section-10-security.spec.md` — security spec source.
- `security/section-10-security.spec.ts` — HTTP-driven security assertions (S2, S3, S5, S6).
- `security/sql-probes.sql` — psql-driven RLS + DM-encryption checks (S1, S4).
- `fixtures/` — seeded users + auth helpers.

## Running locally

```bash
npm i -D @playwright/test playwright
npx playwright install --with-deps chromium
PLAYWRIGHT_BASE_URL=http://localhost:5000 npx playwright test
```

Set `TEST_USER_PASSWORD`, `TEST_ADMIN_TOKEN`, and `CRON_SECRET` in `.env.local` so the gated specs unblock. Without them the dependent assertions self-skip.

## CI

`.github/workflows/lighthouse.yml` runs `scripts/lighthouse-ci.mjs` against every PR. Playwright is intentionally **not** wired to PR CI yet — the Section-10 flows need a seeded test DB (`alice@test.naka` + `bob@test.naka`). Wire it once the seed migration lands.

## Seeding

`fixtures/test-users.ts` declares the two accounts the flows expect. Seed via the Supabase test branch with:

```sql
INSERT INTO auth.users (id, email) VALUES
  (gen_random_uuid(), 'alice@test.naka'),
  (gen_random_uuid(), 'bob@test.naka');
```

Then mark `profiles.onboarding_completed_at = now()` for both.

## Lighthouse

`scripts/lighthouse-ci.mjs` runs Lighthouse against the targets listed in the script. Exposed as `npm run perf:lighthouse`. Exits non-zero when any target falls below the published thresholds (cold load < 1.5s, warm < 500ms, TTI < 2s, performance score ≥ 90).
