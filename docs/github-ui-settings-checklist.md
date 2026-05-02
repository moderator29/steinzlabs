# GitHub UI Settings Checklist

These settings can't be applied via code or the `gh` CLI as a one-shot — they live in the GitHub web UI under repository or organization settings. Apply them manually after the next push to `chore/repo-polish-files`.

Repository: https://github.com/moderator29/steinzlabs

## Branch Protection (Settings → Branches)

For `main`:
- [ ] Require a pull request before merging
- [ ] Require approvals: 1 (set to "code owners only" if a CODEOWNERS file is committed; otherwise any approver works for a solo project)
- [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] Require status checks to pass before merging
  - [ ] Require branches to be up to date before merging
  - [ ] Required checks: `typecheck`, `build` (these come from `.github/workflows/ci.yml`)
- [ ] Require conversation resolution before merging
- [ ] **Do not** allow force pushes
- [ ] **Do not** allow deletions
- [ ] Restrict who can push to matching branches: limit to `moderator29`

## Repository Settings (Settings → General)

- [ ] Description: "Multi-chain crypto intelligence and trading platform — non-custodial wallet, whale tracker, sniper, copy trading, AI agent."
- [ ] Website: `https://nakalabs.xyz`
- [ ] Topics (comma-separated, lowercase): `crypto`, `defi`, `nextjs`, `typescript`, `whale-tracker`, `sniper-bot`, `copy-trading`, `web3`, `solana`, `ethereum`, `non-custodial-wallet`, `ai-agent`, `supabase`
- [ ] Default branch: `main`
- [ ] Features:
  - [ ] Issues — on
  - [ ] Discussions — off (use email for support)
  - [ ] Projects — optional
  - [ ] Wiki — off
  - [ ] Sponsorships — off
- [ ] Pull Requests:
  - [ ] Allow squash merging — on (default merge commit message: PR title + description)
  - [ ] Allow rebase merging — on
  - [ ] Allow merge commits — off
  - [ ] Always suggest updating pull request branches — on
  - [ ] Automatically delete head branches — on
- [ ] Pushes: limit who can push to non-protected branches (org-level, optional)

## Security (Settings → Code security and analysis)

- [ ] Dependency graph — on
- [ ] Dependabot alerts — on
- [ ] Dependabot security updates — on
- [ ] Dependabot version updates — on (config already in `.github/dependabot.yml`)
- [ ] Secret scanning — on
- [ ] Push protection for secrets — on (rejects pushes that contain detected secrets before they hit the remote)
- [ ] Code scanning (CodeQL) — on (set to default config; the workflow file is auto-generated)

## CODEOWNERS

If you want code-owner reviews, create `.github/CODEOWNERS` with:

```
# Default owner for everything not matched below
*       @moderator29

# Auth, wallet, and security areas demand the maintainer's eye
/middleware.ts                          @moderator29
/lib/auth/                              @moderator29
/lib/authTokens.ts                      @moderator29
/lib/wallet/                            @moderator29
/app/api/auth/                          @moderator29
/app/api/admin/                         @moderator29
/app/api/webhooks/                      @moderator29
/supabase/migrations/                   @moderator29
SECURITY.md                             @moderator29
CLAUDE.md                               @moderator29
```

Then turn on "Require review from Code Owners" in branch protection.

## Webhooks (Settings → Webhooks)

- [ ] Vercel deployment webhook — already configured (verify URL)
- [ ] Sentry release tracking — already configured (verify)
- [ ] Slack / Discord notifications — optional

## Banner / Social Preview (Settings → General → Social preview)

- [ ] Upload a 1280×640 PNG that shows the Naka Labs wordmark + tagline
- [ ] Filename in repo: `public/og-image.png` (already used for OpenGraph)

## Notifications (Account-level, but applies here)

- [ ] You watch the repo at "All Activity" so security alerts and PR reviews don't get missed.

## Verification

After applying:
- [ ] Open a junk PR against `main` and confirm it can't be merged without the typecheck + build checks passing.
- [ ] Try to push directly to `main` from a clone — should be rejected.
- [ ] Try to push a file containing a fake-but-realistic API key (e.g., `sk-ant-test...`) — secret scanning should reject it.
- [ ] Check Dependabot opens its first PR within a week.
