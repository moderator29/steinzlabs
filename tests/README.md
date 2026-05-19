# Tests

Two directories live here:

- `critical-flows/` — the 20 Section-10 critical flows from
  `docs/sessions/SESSION-Q-KICKOFF.md` §3 H10. Each `.spec.md` is a
  Playwright-runnable script written in a structured "Given / When /
  Then" form so a human or a CI agent can execute step-by-step until
  Playwright is wired.
- `security/` — the 6 Section-10 security tests covering DM end-to-end
  encryption, RLS isolation, blocked-user gating, private-account
  approval flow, rate-limit kick-in, and reporter-identity privacy.

## Running

Until Playwright is in `package.json`, these specs are executed manually
or by a smoke-test agent. Each spec begins with the env it needs (logged-
in user / two users / a private account, etc.) and includes the exact
URLs + selectors to drive.

To wire Playwright later:

```bash
npm i -D @playwright/test
npx playwright install
npx playwright test tests/
```

Each spec already uses Playwright-compatible selectors so the conversion
is mechanical (just transcribe the bullet list into `test.step()` calls).

## Lighthouse

`scripts/lighthouse-ci.mjs` runs Lighthouse against the targets listed in
the script. Defined as `npm run perf:lighthouse`. Exits non-zero when any
target falls below the published thresholds (cold load < 1.5s, warm <
500ms, TTI < 2s, performance score ≥ 90).
