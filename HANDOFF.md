# Session Handoff — nakalabs.xyz (steinzlabs)

## Where things actually are
- **Repo:** `github.com/moderator29/steinzlabs`
- **On disk:** `/workspace/steinzlabs` (NOT `/home/user/Wegram-` — the env's default cwd is
  wrong for this project; always `cd /workspace/steinzlabs` first).
- **Working branch:** `claude/platform-audit-trust-wallet-bceep5`
- **Latest pushed commit:** `9fef2f0` — "Naka Predict: Quick Play one-tap UP/DOWN, daily free
  points, share-to-Wire wins"
- **Stack:** Next.js app-router + TypeScript + Tailwind + Supabase (RLS, SECURITY DEFINER RPCs).
- **Owner identity for commits:** `moderator29` / `Phantomfcalls@gmail.com`. NO AI trailers,
  NO model identifiers in commits/PRs/code.

## Verified state of the last wave (Naka Predict Quick Play)
- `npx tsc --noEmit` → **exit 0 (clean)**.
- Committed + pushed at `9fef2f0`.
- **NOT yet run:** full `npm run build`. A new session should run `npm run build` from
  `/workspace/steinzlabs` to confirm production build is green before further work.

## Hard rules the owner has repeated (do not violate)
1. **Real data only. Never fabricate** prices, odds, counts, or on-chain results.
2. **Non-custodial always.** Reuse the existing audited signer/relayer. Never create new custody.
3. **No em-dashes anywhere** in user-facing content, docs, or platform copy. `'—'` used purely
   as a no-value placeholder (e.g. `utils.ts`, `AnimatedPrice.tsx`) is the ONE allowed exception.
4. **The Wire** is the confirmed name of the social/compose surface (not "Feed").
5. Owner wants it **professional, clean, fast, "2030 standard."** Keep the aurora/glow motion
   (that was wanted); the slop that was removed was the 3D neon-blue icons, replaced by flat
   lucide icons.
6. Commit as the owner; push to the branch above; DO NOT open a PR unless explicitly asked.

## What is DONE and pushed (high level)
Full multi-wave build across the platform is committed on the branch. Recent commits:
- `9fef2f0` Naka Predict Quick Play + daily bonus + share-to-Wire
- `7def57c` Naka Predict "Breaking-Live" YES/NO game (odds model, crons, APIs, 2030 UI)
- `3e6b0a1` Audit-fleet bug fixes (alert token valuation, swap USD notional, portfolio hero,
  gift confirmation cron, watchlist coverage, cluster-radar seed, richer research brief)
- `393b1de` Copy Trading fully built + marketing (What's New, Shipped banner) + polish
- `e5b4c5b` Profile shows user's Wire posts/reposts/gifts
- `3021884` Dashboard restructure, The Wire compose+AI, Naka News, Telegram revamp,
  Robinhood bridge, nav/admin/help fixes

Task tracker (see the session): tasks #1–#85 are marked complete EXCEPT one duplicate —
#27 "Research Labs" shows pending but the same work is done under #81 (verify, then close #27).

## Naka Predict — file map (the current focus area)
- **UI:** `components/predict/` — `LivePredict.tsx` (board host), `FeaturedMarket.tsx`,
  `QuickPlay.tsx` (one-tap UP/DOWN hero), `DailyBonus.tsx`, `ShareToWire.tsx`,
  `ResultCelebration.tsx`, `MarketCard.tsx`, `PriceChart.tsx`, `Countdown.tsx`,
  `StakeControl.tsx`, `LeaderboardView.tsx`, `MyPredictionsView.tsx`, plus
  `types.ts / utils.ts / hooks.ts`.
- **Backend:** `app/api/predict/` — `markets`, `enter`, `me`, `leaderboard`, `price`, `daily`.
- **Libs:** `lib/predict/{odds.ts, priceFeed.ts, market.ts}`.
- **Crons:** `app/api/cron/predict-generate` (keeps short-horizon markets open) and
  `predict-resolve` (settles expired markets vs real price). Both registered in the
  `frequent` group of `app/api/cron/dispatch/[group]/route.ts`.
- **Odds model (lognormal/GBM):** for a "below K" outcome,
  `probYes = Φ((ln(K/S) − 0.5σ²T)/(σ√T))`; `multiplier = max(1.01, (1/p)*(1−edge))`, edge 0.06.
- **DB migration applied:** `naka_predict_quickplay_and_daily` adds `predict_markets.kind`
  ('direction' for Quick Play 60s UP/DOWN vs threshold markets),
  `predict_user_stats.last_daily_at` + `daily_streak`, and the `claim_daily_bonus` RPC.
- Price feeds: Pyth Hermes (keyless) primary; CoinGecko / DexScreener fallbacks.

## Owner to-dos that are NOT code (env/deploy config — cannot be changed from the repo)
1. Add `COVALENT_API_KEY` (GoldRush) in deploy env — integration is optional + has fallbacks,
   so it degrades honestly without it.
2. Allow `gamma-api.polymarket.com` in the **deploy network egress policy** so the Polymarket
   "World Events" board can reach live data. This is environment egress config, not repo code —
   it is blocked in the sandbox and must be allowed at the environment/deploy level.

## Suggested first moves for the new session
1. `cd /workspace/steinzlabs && git status` (should be clean at `9fef2f0`).
2. `npm run build` — confirm the last wave builds green in production mode.
3. Ask the owner what the next priority is. If continuing Predict: wire QuickPlay/DailyBonus/
   ShareToWire visibly into the Prediction sub-tab and playtest the full loop
   (one-tap → resolve → celebrate → share → claim daily). Confirm they render where expected.
