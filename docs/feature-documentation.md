# Steinz Labs — Feature Documentation

Reference for every live feature on the platform. Each entry follows the same template:

- **What it does** — plain-English description.
- **How to access** — user-facing path.
- **Tier required** — Free / Mini / Pro / Max / NakaCult.
- **How it works** — technical overview (data sources, pipeline).
- **Limitations** — known caps, rate limits, known gaps.

For pricing details see [pricing.md](./pricing.md). For slash-commands see [slash-commands.md](./slash-commands.md).

---

## Intelligence Layer

### 1. Dashboard

- **What it does:** Landing surface after login. Shows top gainers, trending tokens, market stats, news feed, featured tokens, and a context-feed snapshot.
- **How to access:** `/dashboard`.
- **Tier:** Free.
- **How it works:** Aggregates data from CoinGecko (majors), DexScreener (memes / pump.fun), `featured_tokens` table (admin-curated), `market_stats_history` snapshots, and a write-on-read trending cache. SSR with client hydration for live tickers.
- **Limitations:** Refresh cadence is 30s on Free, 5s on Pro+. Featured tokens are admin-managed and may lag the curve.

### 2. Context Feed

- **What it does:** AI-curated on-chain news stream. Every event tagged BULLISH / HYPE / BEAR / NEUTRAL with a Trust Score.
- **How to access:** `/dashboard/context-feed`.
- **Tier:** Free (read-only). Bookmarks and history Free+. Filters Mini+.
- **How it works:** Aggregates whale-activity, smart-money convergence, on-chain trend, and security-scan events. VTX classifies and tags. Renders via SSE so new events appear without refresh.
- **Limitations:** Free tier sees the public-curated stream; Pro+ unlocks personalization based on followed wallets and watchlist tokens.

### 3. Market

- **What it does:** Multi-chain token browsing. Tabs: Majors, DeFi, Layer 1, Pump.fun, Memes. Token detail pages with charts, holders, security, social.
- **How to access:** `/dashboard/market` and `/dashboard/market/[chain]/[address]`.
- **Tier:** Free.
- **How it works:** CoinGecko for majors, DexScreener for everything else. Token detail page joins data from `naka_trust_scores`, `bubblemap_cache`, `holder_snapshots`, and live RPC reads via Alchemy / Helius.
- **Limitations:** Pump.fun coverage depends on DexScreener indexing latency.

### 4. VTX Agent

- **What it does:** AI analyst with live on-chain context. Natural-language queries about tokens, wallets, market conditions. Slash commands for high-frequency lookups (see slash-commands.md).
- **How to access:** `/dashboard/vtx-ai` and the chat panel embedded in token / wallet pages.
- **Tier:** Free (25 msg/day), Mini (150), Pro (400 + Opus advisor), Max (unlimited fair-use).
- **How it works:** Anthropic Claude Sonnet as executor; Opus as advisor on hard decisions (Pro+). System prompt + tool list cached via `cache_control: ephemeral`. Tools: `whale_profile`, `token_security`, `market_data`, `wallet_intel`, `swap_quote`, etc. Full pipeline at `app/api/vtx-ai/route.ts`.
- **Limitations:** Tier-gated input. History capped at last 10 messages per session (HISTORY_HARD_CAP=100 before slice). VTX cannot sign transactions — it can only quote them; signing happens in the user's wallet.

### 5. Bubble Map

- **What it does:** Token ecosystem visualization. Shows holder concentration, suspicious clusters, and an embedded VTX risk read.
- **How to access:** `/dashboard/bubble-map?token=<address>&chain=<chain>`.
- **Tier:** Pro+.
- **How it works:** Computes graph (nodes = holders, edges = transfers / co-funding) from on-chain data, caches in `bubblemap_cache` with 6-hour TTL. VTX summary generated once per cache entry. Conversation about the bubble persisted in `bubblemap_conversations`.
- **Limitations:** Top-N holders only (default 50). Pure tokens with single-source liquidity may have sparse graphs.

### 6. Wallet Intelligence

- **What it does:** Drop any address, get archetype classification, P&L, win-rate, and an Alpha Intelligence Report.
- **How to access:** `/dashboard/wallet-intelligence?address=<addr>&chain=<chain>`.
- **Tier:** Free (lookup-only). Pro+ for the Alpha Report and saved scans.
- **How it works:** Pulls transactions via Alchemy (EVM) / Helius (Solana). Computes archetype via `lib/intelligence/holderAnalysis.ts`. Caches in `wallet_profiles` + `wallet_alpha_reports`.
- **Limitations:** P&L windows: Free 24h only; Mini+ 7d/30d/45d.

### 7. Wallet Clusters

- **What it does:** Identify connected wallet groups via 5 clustering algorithms (direct transfer, common funding, coordinated trading, behavioral fingerprint, Sybil pattern).
- **How to access:** `/dashboard/clusters?root=<addr>&chain=<chain>`.
- **Tier:** Pro+.
- **How it works:** Algorithms in `lib/services/cluster-detection.ts`. Edges in `wallet_edges` (18k+ rows live). Cluster results in `wallet_clusters` + `wallet_cluster_members`. D3 force-directed graph rendered via `components/clusters/Cluster2DGraph.tsx`.
- **Limitations:** Compute is expensive. First-time clusters can take 30–60s; cached afterward.

### 8. On-Chain Trends

- **What it does:** Real-time narrative and trend detection across chains. Tracks metrics like active addresses, gas burn, stablecoin inflows, NFT volume.
- **How to access:** `/dashboard/trends`.
- **Tier:** Free.
- **How it works:** Cron-rolled metrics in `trend_metrics_cache` with 7d/30d history and 30d percentile rank. User trend alerts in `trend_alerts`.
- **Limitations:** Metric set is the platform-curated set; no custom-metric support today.

### 9. Smart Money

- **What it does:** Curated set of consistently profitable on-chain wallets with full transaction fingerprints and convergence alerts.
- **How to access:** `/dashboard/smart-money`.
- **Tier:** Pro+ for convergence alerts. Free can browse the wallet list.
- **How it works:** `smart_money_wallets` + `smart_money_rankings`. Convergence detector scans for N+ smart wallets buying the same asset within a window; emits to `smart_money_convergence`.
- **Limitations:** Smart money set is platform-curated. Submission flow not currently exposed publicly.

### 10. Network Metrics

- **What it does:** Chain health dashboard. Gas, mempool, block times, infrastructure status.
- **How to access:** `/dashboard/network-metrics`.
- **Tier:** Free.
- **How it works:** RPC reads via Alchemy / Helius. Cached in-memory with 30s TTL. Health check state in `health_check_state`.
- **Limitations:** EVM coverage strong; Solana metrics limited to slot height + average TPS.

### 11. Whale Tracker

- **What it does:** Live feed of 15K+ verified whale wallets across 8 chains. Profiles, watchlist, AI summary cards, copy-trading deeplink.
- **How to access:** `/dashboard/whales`. Detail at `/dashboard/whales/[address]`.
- **Tier:** Free (top-20 + profiles). Mini+ for watchlist (`/follow`). Pro+ for AI summaries and copy-trade prefill.
- **How it works:** Inbound webhook events from Alchemy (EVM) and Helius (Solana) — see [supabase-architecture.md §5](./supabase-architecture.md). `whale_activity` (36k+ rows live), `whale_transactions`, `whale_ai_summaries`. SSE stream at `/api/whale-activity/stream`.
- **Limitations:** Webhook coverage limited to chains we have signing keys for (`ALCHEMY_WEBHOOK_SIGNING_KEYS`).

### 12. Bubble Map → see Feature 5

### 13. Naka Trust Score

- **What it does:** Proprietary 0–100 token rating from five layers: security, liquidity, holders, market, social.
- **How to access:** Surfaces on every token page; standalone at `/dashboard/trust-score?token=<address>`.
- **Tier:** Free.
- **How it works:** Five layer scores computed from GoPlus security, DexScreener / Birdeye liquidity, holder concentration, market metrics, LunarCrush social. Aggregated in `naka_trust_scores` with 24h TTL.
- **Limitations:** Limited LunarCrush coverage on freshly-launched tokens depresses the social layer; the formula floors social to 50 in the absence of data so it is not heavily weighted in that case.

---

## Trading Layer

### 14. Multi-Chain Swap

- **What it does:** Trade across 8 chains. 5-step safety flow runs before every swap.
- **How to access:** `/dashboard/swap`. Inline drawer from any token page.
- **Tier:** Free up to $500/trade. Mini+ to $5k. Pro+ to $50k. Max+ unlimited.
- **How it works:** EVM via 0x Protocol (Swap + Gasless). Solana via Jupiter Aggregator. Quote → safety check (GoPlus + Naka Trust Score) → user signs in wallet → broadcast. `pending_trades` holds the unsigned quote; `swap_logs` records the broadcast.
- **Limitations:** Cross-chain not yet supported (no bridge integration). Slippage default 1%, max 50%.

### 15. Sniper Bot

- **What it does:** Sub-2-second multi-chain execution on token launches, with anti-MEV protection and a 5-step safety flow.
- **How to access:** `/dashboard/sniper`. Telegram via `/snipe`.
- **Tier:** Pro+.
- **How it works:** Cron polls new pairs from DexScreener; rules in `sniper_criteria` match against incoming events; matches insert into `sniper_executions` queue. Per-snipe budget cap $500. Server-enforced kill switch via `platform_settings.sniper_enabled`.
- **Limitations:** Coverage limited to chains with adequate webhook + RPC SLA: Ethereum, Base, BNB, Polygon, Solana.

### 16. Copy Trading

- **What it does:** Three modes — Alerts, One-Click, Auto-Copy. Configurable allocation, slippage, per-token blacklists.
- **How to access:** `/dashboard/copy-trading`. Telegram via `/follow` + alert pings.
- **Tier:** Pro+ for Alerts and One-Click. Max+ for Auto-Copy.
- **How it works:** User config in `user_copy_rules`. Whale activity events (Alchemy/Helius webhooks) pass through `lib/copy/matcher.ts`; matches insert into `copy_trades` and (Auto-Copy mode) push a row into `pending_trades` for execution.
- **Limitations:** Auto-Copy hard-capped per rule (daily_cap_usd, max_per_trade_usd). Token blacklist is per-rule. Cross-chain copy not supported.

### 17. DNA Analyzer

- **What it does:** Behavioral fingerprinting that classifies wallet style and recommends a copy mode.
- **How to access:** `/dashboard/dna?address=<addr>&chain=<chain>`.
- **Tier:** Pro+.
- **How it works:** Pulls 90 days of transactions, scores style indicators (frequency, hold time, average position size, win-rate, response to volatility), classifies into archetype (Scalper / Swing / Position / Sniper / Yield Farmer / Bot / Whale / Retail). Output cached in `wallet_profiles`.
- **Limitations:** Accurate after roughly 50+ transactions. Sparse-history wallets default to "insufficient data".

### 18. Internal Wallet

- **What it does:** Self-custodial in-browser wallet. Create, import, send, receive, swap.
- **How to access:** `/dashboard/wallet-page`.
- **Tier:** Free.
- **How it works:** BIP39 mnemonic generation. Encryption: AES-256-GCM with PBKDF2/100k/SHA-256 key derivation. Stored in `localStorage.steinz_wallets` (encrypted). Session password held closure-private in memory with 30-min sliding TTL; cleared on `pagehide` / tab background.
- **Limitations:** Single-device by default — moving to a new device requires re-import. The platform never holds the key.

### 19. Swap Engine → see Feature 14

### 20. Approval Manager

- **What it does:** Token approval monitoring + revoke flow.
- **How to access:** `/dashboard/security-center` → Approvals tab.
- **Tier:** Pro+.
- **How it works:** Pulls current ERC-20 / ERC-721 approvals via Alchemy. Risk-flags spenders against a known-malicious list. Revoke = signed `approve(spender, 0)` transaction sent through the user's wallet.
- **Limitations:** EVM-only. Solana token approvals model differs and is not currently surfaced.

### 21. Signature Insight

- **What it does:** Pre-sign transaction analysis. Decodes calldata, labels intent, attributes value flow.
- **How to access:** Inline in every signing flow (swap, approve, sniper, copy).
- **Tier:** Free.
- **How it works:** Decodes transaction via `viem` ABI lookups + Etherscan / Solscan signature DB. Heuristics flag dangerous patterns (max approval, hidden taxes, ownership transfer, etc.).
- **Limitations:** Decoding requires ABI availability. Closed-source contracts return "unable to decode" — user sees a warning.

### 22. Alerts

- **What it does:** Custom alert system over price, whale activity, on-chain trend metrics.
- **How to access:** `/dashboard/alerts`. Telegram `/setalert`, `/alerts`.
- **Tier:** Free (3 alerts max). Mini+ (15). Pro+ (50). Max+ (unlimited within fair use).
- **How it works:** Price alerts evaluated by cron; whale + trend alerts triggered by webhook events. Delivery via push (`push_subscriptions`), email (Resend), or Telegram.
- **Limitations:** Push requires browser permission. Email subject to Resend deliverability.

---

## Security Layer

### 23. Security Center

- **What it does:** Combined dashboard surfacing every active risk on the connected wallet.
- **How to access:** `/dashboard/security-center`.
- **Tier:** Free for the panel. Pro+ for the Risk Scanner subfeature.
- **How it works:** Aggregates Approval Manager, Risk Scanner, Domain Shield reports, and recent Naka Trust Score reads on held tokens.
- **Limitations:** Pulls only on demand — closing and reopening the page re-runs reads. No background polling on Free.

### 24. Domain Shield

- **What it does:** Phishing detection. Real-time URL scanning against scam databases with community reporting.
- **How to access:** Browser extension (separate) and inline on dashboard links.
- **Tier:** Free.
- **How it works:** GoPlus domain-security API + community-reported scam list. Verdict cached 1h. Returns SAFE / SUSPICIOUS / PHISHING with reason codes.
- **Limitations:** Brand-new domains may have low signal — "INSUFFICIENT DATA" rather than SAFE.

### 25. Signature Insight → see Feature 21

### 26. Contract Analyzer

- **What it does:** Smart contract risk analysis. VTX reads bytecode and explains what it does in plain English.
- **How to access:** `/dashboard/contract-analyzer?address=<addr>&chain=<chain>`.
- **Tier:** Pro+.
- **How it works:** Pulls verified source via Etherscan / Solscan. If unverified, decompiles bytecode. Sends to VTX with a constraint-bound system prompt (must flag dangerous functions, owner privileges, mint/burn, hidden taxes, transfer tax).
- **Limitations:** Unverified Solana programs are harder to analyze; output flagged as low-confidence.

### 27. Risk Scanner

- **What it does:** Continuous wallet-portfolio risk monitoring with exposure breakdown by chain, sector, and concentration.
- **How to access:** `/dashboard/security-center` → Risk Scanner tab.
- **Tier:** Max+.
- **How it works:** Cron rebuilds the user's holding map nightly; computes concentration (top-1, top-5), sector exposure (DeFi / meme / stable / NFT / yield), chain exposure. Outliers flagged. Stored in `token_risk_scores`.
- **Limitations:** Refresh runs nightly, not in real time. Manual refresh is button-driven.

### 28. Naka Trust Score → see Feature 13

---

## Cult Layer

### 29. NakaCult & The Vault

- **What it does:** Token-gated experience for $NAKA holders. Includes The Vault (cinematic), The Conclave (NAKA-weighted DAO), The Oracle (daily intelligence + exclusive AI + anonymous alpha network).
- **How to access:** `/cult` (auto-detected when wallet has ≥600,000 $NAKA or any Naka Labs NFT).
- **Tier:** NakaCult.
- **How it works:** Holding check runs on every login + once daily via cron. Drop below threshold → access auto-revokes at next sync. Vault / Conclave / Oracle are React experiences; data flows through the same service layer with stricter tier gates.
- **Limitations:** Only the holdings on the *verified* wallet count. Multi-wallet aggregation not currently supported.

---

## Other Features

### 30. Profile

- **What it does:** User profile, settings, preferences. Notification settings, display preferences, privacy settings, security preferences, trading preferences.
- **How to access:** `/profile`, `/dashboard/settings`.
- **Tier:** Free.
- **How it works:** Settings split across `profiles`, `user_preferences`, `user_display_preferences`, `user_security_preferences`, `user_trading_preferences`, `notification_settings`, `privacy_settings`. Updates write-through with audit-log entries on sensitive changes.
- **Limitations:** Profile photo upload limited to 2MB. Username changes rate-limited to 1/30 days.

### 31. Research

- **What it does:** Long-form research articles on protocols, sectors, market structure.
- **How to access:** `/dashboard/research`.
- **Tier:** Free for free-tier articles; Max+ for premium reports.
- **How it works:** `research_posts` table. View tracking via `research_views` (one row per user per post; auto-counts unique views).
- **Limitations:** Article catalog is admin-curated; no community contributions.

### 32. Network Graph

- **What it does:** Interactive visualization of wallet relationships, fund flows, entity clustering.
- **How to access:** `/dashboard/network-graph?root=<addr>&chain=<chain>`.
- **Tier:** Pro+. Max+ for export (JSON / CSV).
- **How it works:** Same `wallet_edges` substrate as Wallet Clusters but rendered as a force-directed graph at unbounded depth. Performance-tuned to handle ~1k nodes before degrading.
- **Limitations:** Beyond ~1k nodes the layout becomes hard to read; UI auto-prunes by edge weight.

### 33. Telegram Bot

- **What it does:** Feature parity for the most-used flows. 27 slash commands across account, market, whales, portfolio, alerts, trading.
- **How to access:** `@SteinzLabsBot` on Telegram. `/connect` to pair.
- **Tier:** Free–Max+ depending on command. See [slash-commands.md](./slash-commands.md).
- **How it works:** Webhook handler at `/api/telegram/webhook` with `X-Telegram-Bot-Api-Secret-Token` header verification. Symbol resolution shared with VTX via `lib/telegram/commands/resolveSymbol.ts`. Tier gates use `withTierGate()` so the same enforcement runs in HTTP routes and Telegram callbacks.
- **Limitations:** Telegram per-chat rate limit 30 commands/minute. Inline buttons subject to Telegram MarkdownV2 escaping.

---

## Feature ↔ Tier Matrix

Quick lookup. F = Free, Mi = Mini, P = Pro, Mx = Max, NC = NakaCult.

| Feature | F | Mi | P | Mx | NC |
|---------|:-:|:--:|:-:|:--:|:--:|
| Dashboard | y | y | y | y | y |
| Context Feed (read) | y | y | y | y | y |
| Context Feed personalize | — | — | y | y | y |
| Market | y | y | y | y | y |
| VTX Agent (msg/day) | 25 | 150 | 400 | unlim | unlim |
| VTX Opus advisor | — | — | y | y | y |
| Bubble Map | — | — | y | y | y |
| Wallet Intelligence (lookup) | y | y | y | y | y |
| Alpha Intelligence Report | — | — | y | y | y |
| Wallet Clusters | — | — | y | y | y |
| On-Chain Trends | y | y | y | y | y |
| Smart Money (browse) | y | y | y | y | y |
| Smart Money convergence | — | — | y | y | y |
| Network Metrics | y | y | y | y | y |
| Whale Tracker (top-20) | y | y | y | y | y |
| Whale watchlist (`/follow`) | — | y | y | y | y |
| Whale AI summary | — | — | y | y | y |
| DNA Analyzer | — | — | y | y | y |
| Naka Trust Score | y | y | y | y | y |
| Domain Shield | y | y | y | y | y |
| Signature Insight | y | y | y | y | y |
| Contract Analyzer | — | — | y | y | y |
| Approval Manager | — | — | y | y | y |
| Risk Scanner | — | — | — | y | y |
| Internal Wallet | y | y | y | y | y |
| Multi-Chain Swap | y | y | y | y | y |
| Per-trade cap | $500 | $5k | $50k | unlim | unlim |
| Sniper Bot | — | — | y | y | y |
| Copy Trading (Alerts/One-Click) | — | — | y | y | y |
| Copy Trading Auto-Copy | — | — | — | y | y |
| Custom alert webhooks | — | — | — | y | y |
| Multi-account (5 wallets) | — | — | — | y | y |
| Research (free) | y | y | y | y | y |
| Research (premium) | — | — | — | y | y |
| Network Graph | — | — | y | y | y |
| Network Graph export | — | — | — | y | y |
| NakaCult / Vault / Conclave / Oracle | — | — | — | — | y |
| Telegram (read commands) | y | y | y | y | y |
| Telegram (trade commands) | — | y | y | y | y |
| Telegram (snipe command) | — | — | y | y | y |

---

## See also

- [pricing.md](./pricing.md) — full per-tier pricing breakdown
- [slash-commands.md](./slash-commands.md) — every Telegram + VTX command with args, defaults, error behavior
- [supabase-architecture.md](./supabase-architecture.md) — per-feature data tables
- [whitepaper.md](./whitepaper.md) — strategic narrative
- [security-audit-2026-05-02.md](./security-audit-2026-05-02.md) — security posture per layer
- [SECURITY.md](../SECURITY.md) — vulnerability disclosure policy
