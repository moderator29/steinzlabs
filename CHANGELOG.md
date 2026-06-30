# Changelog

All notable changes to Steinz Labs are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
where applicable. Entries are grouped by release; unreleased work lives at
the top.

## [Unreleased]

### In-app "How it works" panels (June 2026)

- **Per-feature help button** — every feature in the side navigation and the bottom menu now carries a small "How it works" button tucked into its header. It opens a branded glass panel on the aurora canvas with four tabs: How it works, How to use it, Why it matters, and What's new. The panel is portaled to the body, traps focus, locks page scroll, and closes on Escape, backdrop click, or the close button.
- **Grounded, dash-free copy** — content for each feature was written from the real implementation (and the changelog) so it reflects what the feature actually does. Copy avoids dash punctuation, fabricated names, numbers, and dates, and never describes admin-only or operator internals. Surfaces covered include Dashboard, Portfolio, Notifications, Discover, Messages, Market, Swap, Transactions, DNA Analyzer, Wallet Intelligence, Wallet Clusters, On-Chain Trends, Smart Money, Network Metrics, Whale Tracker, Bubble Map, Security Center, Domain Shield, Signature Insight, Contract Analyzer, Approval Manager, Risk Scanner, Wallet, VTX Agent, Sniper Bot, Market Maker, Network Graph, Alerts, Research Lab, Archive, Pricing, and Profile.
- **Platform-wide What's new** — the side navigation footer gained a "What's new" button that opens a changelog-style panel grouping recent platform updates by period, matching the per-feature styling.
- **Shared primitives** — new `lib/howItWorks/types.ts` (content shape), `components/common/HowItWorks.tsx` (button + panel), and `components/common/GlobalWhatsNew.tsx`, with per-feature copy under `lib/howItWorks/content/`.

### Daily Research Brief engine (June 2026)

- **Automated daily market brief** — new `research-daily-brief` cron (daily dispatch group, 03:00 UTC) assembles a real market read from CoinGecko (top gainers/losers among the top 100 by cap, global market vibe, trending searches) and the platform's own `whale_activity` feed (biggest priced moves, last 24h), publishes it to Research Labs as a styled post, and emails a rich preview digest to every user who hasn't opted out (`notification_settings.email_enabled`). Idempotent per UTC day; publishes nothing when every data source is down (no empty shells, no fabricated numbers). Kill switch: `RESEARCH_DIGEST_EMAIL=false` publishes web-only.
- **Research Labs detail page** — added the missing `/research/[id]` route and `/api/research/[id]` endpoint; cards in the public list previously linked to a 404. Detail page renders the brief's HTML on the Naka aurora canvas with cover, category, read time, and a live view counter.
- **Schema fix** — `research_posts` was missing the `category` and `image_url` columns the admin + public routes read/write, so every insert/select errored and the table stayed empty. Added both additively (migration `2026_research_posts_add_category_image`), unblocking the whole subsystem.
- **Dash-free formatting** — brief and digest render negatives with ▲/▼ arrows and magnitudes (never a leading minus) and use middots as separators, per the product's no-dash rule.

### Wallet Intelligence next-gen surfaces (June 2026)

- **Realized PnL best/worst trade** — the FIFO realized-PnL card now highlights the single most profitable and most painful closed position; the worst slot shows a truthful "None in window" when the trader has no losers.
- **Activity heatmap** — buckets a wallet's real transaction timestamps into a 7-day × 4-block (6h) UTC grid so users can see when it trades; self-hides below 4 timestamped txs (no synthetic fill).
- **Multi-chain net worth** — new lazy `/api/wallet-intelligence/multichain` fans the EVM intelligence pipeline across all six supported chains (`allSettled`, cache-warm for the viewed chain) and sums priced balances into one figure plus a per-chain proportion bar.
- **Top counterparties** — derives who a wallet trades with most from its real recent transactions (inbound/outbound split), tagging known CEX/DEX/bridge/mixer entities from the on-chain registry.

### Whale Tracker revival + feed hardening (June 2026)

- **Whale ingestion restored** — the cost-sweep demand gate had scoped the poll/price crons to *followed* whales only; with near-zero follows, `whale_activity` ingestion went dark ~45 days ago and every `value_usd` was NULL (so every size filter excluded 100% of rows). The poll cron now rotates through **all** active whales (bounded by `WHALE_POLL_BATCH`), polls **both** transfer directions, and **prices `value_usd` at ingest** (CoinGecko/Birdeye, deduped per token). The price cron is now an ungated, recency-bounded safety net (never re-prices the multi-year backlog at today's prices). Webhooks (Alchemy/Helius) also price at ingest in their deferred `after()` block.
- **Realtime feed** — `whale_activity` was in no realtime publication, so the tracker's `postgres_changes` INSERT subscription never fired. Added it to `supabase_realtime`; the "N new whales" pill now lights up sub-second.
- **Whale alert dispatcher** — new `whale-alert-dispatcher` cron joins each alert-enabled follow to priced activity past a per-follow watermark, writes a durable in-app notification, and sends the (previously dead) `sendWhaleAlert` email when the follow opted into the email channel.
- **Tier honesty** — viewing the feed needs `mini` but following needs `pro`; mini users used to see live watch/add/bell controls that 403'd silently. The page is now tier-aware: a branded paywall below `mini`, working feed + Pro upsell for `mini`.
- **Action honesty** — the feed surfaces Received/Sent (`transfer_in`/`out`) instead of a flat "transfer", and the realtime indicator stopped dropping every transfer (raw-vs-canonical action mismatch). Removed 3 orphaned/duplicate whale component stacks.

### Context Feed + DM hardening (June 2026)

- **Auth** — `getAuthenticatedUser` trusted the `steinz_session` JWT *payload* without verifying the signature (forged-token impersonation across every route). Now verified via Supabase.
- **AI Market Pulse** — fixed an Anthropic thundering herd (every feed viewer raced to generate); generation is now claimed with one atomic DB update, losers serve the stale pulse, failures serve-stale + retry in ~10 min, empty feeds never call Anthropic.
- **Smart-money labels** — `applySmartMoneyLabels` hardcoded `'ethereum'` normalization, silently disabling Solana labeling; now chain-correct.
- **feed-alert-monitor** — 30-min anti-spam floor, trusted-config internal URL (not the Host header), per-alert error isolation, surfaced feed-fetch outages, chain-aware address keys, and metric-aware thresholds.
- **DMs** — declined-request history is hidden on per-thread read; a network send failure now surfaces an error instead of the message silently vanishing.
- **Feed alerts** — added a `PATCH` so the `active` toggle is reachable.

### Data-integrity & honesty fixes (June 2026)

- **Reputation** — `scorePortfolioPerformancePct` queried `swap_logs.pnl_usd`, a column that does not exist; the throw was swallowed and the portfolio axis silently dropped from every score. Now sources realized PnL from the real trade ledgers (`sniper_executions.pnl_usd` / `user_copy_trades.pnl_usd`).
- **Whale tracker** — dropped the synthetic 24h-volume fallback in Top Whales Today (portfolio × turnover presented as real volume). The feed action filter now matches real `transfer_out`/`transfer_in` rows, label pills bridge `whales.entity_type` → the `WhaleLabel` taxonomy (previously zero overlap → zero matches), and the "Live" badge only pulses when the newest activity is under 10 minutes old (otherwise "Delayed"/"Idle").
- **Market** — the DexScreener pair route no longer fabricates a 50/50 buy/sell split when txn data is missing (reports null); the Recent Trades rail shows "Idle" instead of a permanent "LIVE" pulse over an empty tape.
- **Copy-trade monitor** — the no-work guard probed a non-existent `copy_trade_rules` table (so it never short-circuited and rescanned every minute); pointed at the real `user_copy_rules`.
- **Naka Wallet** — replaced bare `.toLowerCase()` on token/wallet addresses with chain-aware `normalizeAddress` (Solana is case-sensitive); Add Custom Token now works end-to-end across chains (network selector, per-chain validation incl. Solana, chain-prefixed storage key the hydrator expects, GoPlus scan on the selected chain).
- **Social** — `/api/social/search` now returns real per-caller follow state and a "Follows you" hint instead of hardcoded `not_following`; surfaced on the discover list.
- **DMs** — the realtime websocket now authenticates via `realtime.setAuth` on session/refresh, so RLS stops dropping every `postgres_changes` event (messages previously appeared only on reload).
- **Profile** — the public `/u/[username]` header now shows the tier badge.

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
