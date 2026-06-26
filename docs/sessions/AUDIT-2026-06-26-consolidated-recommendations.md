# Naka Labs — Consolidated Audit & Industry-Standard Recommendations (2026-06-26)

Four deep audits this session (WalletConnect, NakaCult frontend, NakaCult backend, responsiveness)
plus a live cron diagnosis. Verification legend: **PROVEN** = checked against live prod/DB this
session; **CODE** = read in the repo, not runtime-tested; **tsc** = compiles clean only.

---

## 0 · CRON SCHEDULER — root cause PROVEN (the #1 blocker)

- The 53→5 dispatcher merge (#637) **worked**: Vercel's scheduler IS firing — `dispatch/frequent`
  runs every 2 minutes (PROVEN via Vercel runtime logs). Plan is adequate; the count limit is solved.
- **Every cron returns `500 "CRON_SECRET not configured"`** — PROVEN by curling
  `https://nakalabs.xyz/api/cron/dispatch/frequent` (HTTP 500, body = that string) repeatedly. The
  route 500s at the auth gate *before* any handler runs or writes `cron_execution_log`, which is why
  the log is still frozen at 2026-05-13.
- **Fix (human, ~1 min):** the live build does not see `CRON_SECRET`. Either it was added *after* the
  current production deploy (Vercel bakes env at build time — needs a **redeploy**), is scoped to
  Preview/Dev only (must tick **Production**), or has a name typo. After setting it, **redeploy**, then
  the dispatch curl should return 200 and `cron_execution_log` should get fresh rows within ~2 min.
- **Shipped this session:** `chore/cron-observability-secret-guard` — a missing `CRON_SECRET` now pages
  Sentry at `fatal` (was a silent info-level 500), and each dispatcher writes its own
  `cron_execution_log` row, so this can never be an invisible outage again.

---

## 1 · WalletConnect — treat as NON-FUNCTIONAL until verified (P0)

- **P0 (CODE):** `useAppKit()` is called in component render bodies (`swap`, `login/signup`,
  `EnterNakaCultButton`, VTX `SwapCard`) while `createAppKit` runs only inside a `useEffect` in
  `app/wallet-providers.tsx`. Reown's hook throws if the modal isn't registered → first-paint / SSR of
  those routes can crash. **Fix:** register `createAppKit` at module scope (Reown's documented pattern),
  guarded by `HAS_APPKIT`. ⚠ Must be runtime-verified on a preview — module-scope init can hit
  `window` during SSR, which is *why* it was deferred; verify the build + a real device load.
- **P0 (UNVERIFIABLE here):** no `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in committed env. Confirm it's
  set in Vercel for Prod/Preview and the prod domain is whitelisted in cloud.reown.com. Add it to
  `.env.example` and fail the build loudly if missing in prod.
- **P1 (CODE):** connect goes through AppKit/wagmi but signing reads raw `window.ethereum`/`window.solana`
  (`useSwapBroadcast`). Mobile WalletConnect has no injected provider → connected-but-can't-sign. Route
  signing through wagmi's `useSendTransaction` / the AppKit Solana provider.
- **Confirmed GOOD (CODE):** SIWE/SIWS backend, nonce single-use binding, non-custodial browser-side
  signing, `addressNormalize` usage, and the NakaCult connect CTA wiring are solid.
- **Recommendation:** add a Playwright smoke test that hard-loads `/login`, `/signup`,
  `/dashboard/swap`, `/naka-cult` with and without the projectId — would have caught the P0 instantly.

---

## 2 · NakaCult frontend — polish on one card pattern, NOT a 2030 rebuild (honest status)

- Truth: features are **real and wired** (every chamber hits real `/api/cult/*`, empty states are
  honest em-dashes — genuinely good). But the visual system is **one repeated glass-card pattern**
  (`rounded-2xl border-white/10 bg-[#070A16]/80`) across all 8 surfaces; the "3D" sigils are flat SVG on
  CSS pedestals (no real depth/lighting/branded art); typography is plain Inter with ad-hoc arbitrary
  sizes; **there is no in-vault nav/menu or member profile** (IdentityStrip is a single pill); Commons
  tiles even mix raw lucide icons with the bespoke sigils. Calling it "all done, 2030 industry-standard"
  overstates the visual/structural work by a wide margin.
- **Shipped:** removed the remaining "Chosen" UI leaks (VoteOrbs gold ring/tooltip, EchoChamber error
  string, `.vault-identity--chosen` CSS, AnnalsPanel type).
- **Recommendations, prioritized:** (1) build a real in-vault nav rail + member profile; (2) commission
  true 3D/branded sigil assets and drop lucide from Commons tiles; (3) give Conclave a real vote-power
  panel + quorum meter + countdown (currently a text string); (4) adopt a tokenized type/spacing scale
  + a display face; (5) swap `setInterval` polling (Hall/Ape/Pulse) for the Supabase realtime pattern
  already proven in Conclave; (6) delete the superseded CultPlayer CSS generation.

---

## 3 · NakaCult backend — partially honest; trust scores were the dangerous gap (now fixed)

- **Shipped:** deleted the 4 fabricated symbol-keyed `naka_trust_scores` rows (constant 41) and the
  route now 400s on non-address input (`fix/trust-score-reject-symbols`, PROVEN against live DB — only
  the 1 real contract row remains).
- **Confirmed FIXED (CODE/DB):** Echo "E2E DM" label gone, Sage uses a valid model + makes no streaming
  claim, `cult_stats.active_members` reads `cult_member` (=3), `chosen_count` dropped, 9 cult tables in
  the realtime publication, treasury cron honestly env-gated.
- **Still hollow / open (CODE/DB):** achievements have **no earning pipeline** (0 rows, only a manual
  grant — which has an **authz bug**: claims "Chosen-only" but enforces only `allowed`, so any member can
  self-grant); loadouts are write-only; 17 cosmetics all have `asset_url=NULL`; `total_naka_held` is
  hardcoded NULL; treasury needs `NAKA_TOKEN_CONTRACT` + `NAKA_TREASURY_WALLET` env.
- **Recommendations:** fix the annals grant authz; build server-side achievement-earning hooks at action
  sites and render equipped cosmetics on profiles, OR gate Annals/Mantle behind an honest "coming soon";
  set the treasury env and wire `total_naka_held` to the snapshot.

---

## 4 · Responsiveness — B-: good foundations, inconsistent discipline

- **Shipped:** vault mobile safe-area P0 (CultPlayer orb + `.vault-main` now use
  `env(safe-area-inset-bottom)` — no more home-indicator collision); copy-trading + wallet-compare
  tables now scroll horizontally on mobile instead of clipping.
- **Still open (CODE):** the **768–1024px tablet band** is the neglected middle — landing's fixed-count
  grids (`repeat(4,1fr)` stats, `repeat(3,1fr)` features) jump straight from desktop to 2-col mobile;
  convert to the `auto-fit minmax()` pattern `.nakacult-pillars` already uses. Six ad-hoc breakpoints in
  one stylesheet (520/560/640/720/900) — unify on one scale. `LivingSigil` hard-codes `360px` + an
  `!important` override; use `min(360px, 70vw)`. ~3 more dashboard tables (sniper-bot, wallet-clusters)
  still need the overflow sweep.

---

## Branches shipped this session (all `moderator29`, zero AI attribution, tsc-clean; NOT runtime-verified)

1. `chore/cron-observability-secret-guard` — Sentry-alert on missing CRON_SECRET + dispatcher self-log
2. `fix/trust-score-reject-symbols` — reject non-address input + purge fabricated rows (DB-verified)
3. `fix/vault-chosen-leaks-and-mobile-safe-area` — Chosen UI purge + safe-area insets
4. `fix/landing-cards-shrink-and-legal-disclaimer` — slimmer cards, 0.5% fee honesty, legal disclaimer
5. `fix/dashboard-table-mobile-overflow` — horizontal-scroll table wrappers

## Owner-gated (only you can do these)
- **Set/redeploy `CRON_SECRET`** in Vercel prod — unblocks the entire data plane.
- Confirm `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in Vercel + Reown domain allowlist.
- Set `NAKA_TOKEN_CONTRACT` + `NAKA_TREASURY_WALLET` for treasury.
- Provide real Ddergo audio files before the first-party player can be built.
