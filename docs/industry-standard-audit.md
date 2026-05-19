# Industry Standard Audit — Naka Labs Platform

Date: 2026-05-16
Audit method: 6 parallel automated read-only audits (one per feature
category) + manual synthesis.

Per Section 6.6 of the social/onboarding/audit master prompt, this
file is the durable record of: current state → reference platform →
identified gap → recommended fix → status.

---

## 1. Trading & Swap

**Reference platforms:** Binance, Coinbase, Uniswap, Jupiter, 1inch.

| Aspect | Current State | Gap vs reference | Fix | Status |
|---|---|---|---|---|
| Sub-second quote fetch | `/app/api/swap/quote` + `lib/services/zerox.ts`; debounced 600 ms + 15 s timeout | Industry target <400 ms; no streaming quote, no AMM simulation | Add 300 ms debounce + websocket quote stream (or local AMM sim with cached reserves); add quote-staleness countdown UI | Backlog |
| Price impact warnings | Shown post-input in quote details (`OrderForm` 212; `swap/page.tsx` 955), red >2 % | Reactive, not proactive; no sticky pre-trade banner | Add sticky banner when impact >1 % (amber) / >3 % (red); auto-suggest split when >5 % | Backlog |
| MEV protection | `lib/services/mev.ts` returns analysis + recommendations, badge in `OrderForm` 182 | Read-only; no toggle to actually route via Flashbots / private RPC | Add SettingsPanel checkbox "Route via MEV-protected RPC"; persist in localStorage; pass to `/api/mev-protection` | Backlog |
| Slippage controls | Preset pills 0.1 / 0.3 / 0.5 / 1 / 3 % + custom; dynamic 10-50 bps from MEV risk | None — matches Uniswap/Coinbase | Minor: enforce max 20 % on custom input | Backlog (minor) |
| Gas estimation | 0x returns gas units; hardcoded `30 gwei` (`swap/page.tsx` 661); Solana shows static `$0.001` | No dynamic gas pricing or fast/std/slow tiers | Fetch live `eth_gasPrice` per chain; offer 3 tiers; pass `gasPrice` to 0x | Backlog |
| Multi-chain UX | 7-chain horizontal pill selector w/ deep-link `?chain=` (`swap/page.tsx` 1088); auto-sync from MetaMask `eth_chainId` | None major | Optional: liquidity-depth indicator per chain pill | Backlog (nice-to-have) |

Priority order: quote latency → pre-trade impact warning → MEV toggle → dynamic gas.

---

## 2. Whale Tracker

**Reference platforms:** Nansen, Arkham, Lookonchain.

| Aspect | Current State | Gap | Fix | Status |
|---|---|---|---|---|
| Real-time updates | Supabase Realtime on `whale_activity` INSERTs (sub-second) + 15 s SSE fallback (`/api/whale-activity/stream`); poll cron 60 s (`whale-activity-poll`) | Nansen uses proprietary WebSocket → <1 s; we hit 180 s worst-case end-to-end | Tighten cron to 15-30 s window (cost: higher Alchemy RPC bill — tier bump) | Backlog |
| Sub-minute alert delivery | Telegram send sync best-effort (`lib/trading/notifications.ts` 59), no queue/retry; user-watchlist SSE 30 s | No persistent queue; failed Telegram → lost | Add Upstash Queue (or Bull) + 3-retry exp backoff; FCM push for natives | Backlog |
| Copy-trade reliability | Cron 60 s; rule/security/relayer guards; 10 min confirmation window; no retry after relayer fail | 1-shot per tick; no auto-retry of failed relayer; expired confirmations lose order | Add `retry_count <= 3` exp retry in `/api/cron/copy-trade-monitor`; re-fire awaiting-confirmation on next activity pulse | Backlog |
| Whale profile depth | `whales` table has 30+ columns (PnL bands, win_rate, holdings size); win_rate dummy for EVM (line 290), real for Solana via Birdeye | EVM win rate not real; no per-token PnL; no holdings breakdown | Deploy 4 h cron to hydrate per-token PnL via Alchemy transfer history (EVM) + Phantom portfolio (Solana); return `top_tokens_24h/7d`, `avg_hold_hours_by_token`, `realized_pnl_by_token` in `/api/whale-tracker/[address]` | Backlog (high value) |
| Filter UX | 6-pill set (chain/action/size/time/token-search/label) + URL-state | Single-label filter only; no semantic filters (risk band, age, concentration) | Add label-AND-logic; risk-band slider; age filter (30 d / 90 d / 1 y+); concentration slider | Backlog |

Priority: PnL backfill → cron retry → alert queue → WebSocket upgrade.

---

## 3. VTX Agent

**Reference platforms:** ChatGPT, Claude, Perplexity.

| Aspect | Current State | Gap | Fix | Status |
|---|---|---|---|---|
| Streaming responses | `/api/vtx-ai` SSE works for text-only; heuristic in `VtxAiTab` disables streaming on tool-heavy keywords (line 681); page-level `/dashboard/vtx-ai` does NOT stream at all (line 504 has no `stream` flag) | Tool-use breaks streaming; page never streams | Add streaming tool-event emission (`{toolName, status}` per SSE chunk); wire `stream: true` to page-level requests; refactor sidecar to consume real-time events | Branch B partial (StreamingCursor mounted in `VtxAiTab`); page-level + tool-event = backlog |
| Inline cards | `TokenCard` + `SwapCard` mount inline; bubble viz only in `VtxAiTab`, missing on page | Bubble viz absent from page | Copy `BubbleVisualization` block from `VtxAiTab` to page renderer | Backlog |
| Tool transparency | Loading spinner "Searching Sargon Data Archive..." only; API returns `toolsUsed[]` but UI never renders it | No per-tool name surface to user; Claude/Perplexity show timeline | Sidebar timeline component fed by streaming tool-event channel | Backlog |
| Context awareness | Wallet address + live prices passed; portfolio NOT passed | Claude shows portfolio sidebar w/ holdings + recent swaps | Query `positions` or `wallet_summary` on auth'd requests; inject `User Portfolio: N tokens, $X` into system prompt | Backlog (low effort) |
| Time-to-first-token | SSE present but tool path falls to JSON | Sub-second TTFT in Claude/ChatGPT | Fix tool-event streaming above → unblocks TTFT parity | See above |

Priority: portfolio context injection (small) → tool-event streaming (unlocks page + tool transparency together).

---

## 4. Internal Wallet

**Reference platforms:** Trust Wallet, Phantom, Rabby.

| Aspect | Current State | Gap | Fix | Status |
|---|---|---|---|---|
| Token auto-detection | `/api/token-scanner` is misnamed — it's a **security scanner**, not a balance enumerator. No Alchemy `getTokenBalances()` on connect | CRITICAL: users see no balances unless they paste a contract | Rename `/api/token-scanner` → `/api/token-security`; create new `/api/wallet/balances` calling `alchemy.core.getTokenBalances()` (EVM) + Helius `getAsset` enumeration (Solana); 5 min cache | Backlog (critical) |
| NFT support | Not implemented anywhere | CRITICAL: Trust / Phantom / Rabby all ship NFT galleries | Add `/api/wallet/nfts` using Alchemy `getNfts` (EVM) + Helius DAS `getAssetsByOwner` (Solana); new `NFTTab` in `wallet-page` | Backlog (critical) |
| In-wallet swap | "Coming Soon" modal | Trust / Phantom ship lite swap | Replace with 0x / Jupiter lite form: in/out dropdowns, quote on input, slippage, execute via signer | Backlog |
| Multi-chain switching | Horizontal pill selector for 12 chains; 6 default enabled; "Add Network" modal | None major — Rabby parity. Lacks per-chain preloading | Minor: prefetch balances for adjacent chains | Backlog (minor) |
| Transaction history | LocalStorage only (`steinz_swap_history`, `steinz_send_history`) — no on-chain history | No decoded calls; Rabby decodes `Approve USDC for Uniswap` etc. | Integrate Tenderly decoder or Etherscan `getTransactionDetails`; cache in existing `transaction_history` table | Backlog (high) |
| Staking | Static text "ETH staking active" but no functional UI | No staking | Out of scope this audit; if user holds stETH, surface via Lido API | Deferred |

Priority: token auto-detect → NFT tab → tx decoding → in-wallet swap.

---

## 5. Dashboard Home

**Reference platforms:** Bloomberg Terminal, Linear, Notion.

| Aspect | Current State | Gap | Fix | Status |
|---|---|---|---|---|
| Information density | Desktop: good — Top Gainers fits 5 rows compactly, Context Feed information-rich. Mobile: sparse — 2-col actions, 1-col insights | Bloomberg dense rows; Linear compact lists. Mobile lacks task density | Add 3-col actions xs→sm; horizontal-scroll coin list with name shown | Backlog |
| Customizable layout | Zero customization — sections hard-coded in `PersonalizedHome`, filters preset in `MarketDashboard` | Notion DB views, Linear sidebar config, Bloomberg widget arrangement | "Customize dashboard" menu with checkbox toggles for Telegram banner / MiniVtxPanel / TelegramConnectBanner; persist in localStorage | Backlog (low effort) |
| Real-time data | KPI stats 120 s poll; Top Gainers 120 s; Heating Up 60 s; ContextFeed manual refresh; MarketDashboard zero polling | Bloomberg 3-5 s ticks; GeckoTerminal 30-60 s | Short-term: drop Top Gainers to 60 s + add refresh indicator. Long-term: WebSocket for Context Feed + price ticks | Backlog |
| Mobile/desktop parity | Identical single-column layouts everywhere; engagement footer cramped on xs | Responsive sidebars / multi-column / density toggles in references | `hidden md:flex` 2-column event panel; carousel insights on mobile; bump footer link size 12 px → 14 px | Backlog |

Priority: customize-menu (cheap) → mobile density tweak → WebSocket data plane.

---

## 6. Performance Targets

Section 6.5 of the master prompt lists these targets:

| Metric | Target | Current state | Status |
|---|---|---|---|
| Cold page load | <1.5 s | Unmeasured this session — needs Lighthouse run | Pending Lighthouse |
| Warm page load | <500 ms | Unmeasured | Pending |
| API response | <800 ms | Unmeasured; documented `15s` timeouts in GoPlus / swap | Pending |
| Interactive response | <100 ms | Unmeasured | Pending |
| Animation framerate | 60 fps | Onboarding flow uses Framer Motion with `prefers-reduced-motion` respected | Likely OK |
| Time to interactive | <2 s | Unmeasured | Pending |

Action: run Lighthouse CI against `/` + `/dashboard` + `/discover` +
`/leaderboard/success-rate` + `/u/<test-user>` once branches merge.
Add a `npm run perf:lighthouse` script that exits non-zero below
threshold. Backlog.

---

## 7. Security CVEs (Dependabot)

`npm audit` reports 29 vulnerabilities (14 low, 6 moderate, 9 high)
as of this audit. `npm audit fix` (non-force) does not reduce any of
them — all transitive in `@sentry/nextjs` and `rpc-websockets`
chains. The 9 highs need manual review (Sentry SDK bump pulls in the
SentryProvider config, breaking change in newer majors; rpc-websockets
bump risks breaking @solana/web3.js).

Action: triage the 9 highs against current upstream advisories;
upgrade Sentry SDK in an isolated branch with full UAT of error
reporting; assess whether @solana/web3.js can move to a version using
modern rpc-websockets without breaking signer flows. Backlog.

---

## 8. Mobile + Desktop Parity Sweep

Section 6.4 requires:

- Mobile: 375 / 393 / 412 px
- Tablet: 768 / 1024 px
- Desktop: 1440 / 1920 px

Every feature should work on every breakpoint. Current state per
audit: dashboard works but is sparse on mobile; markets watchlist
truncates token names on xs; context feed engagement footer cramped
on xs; new social pages (`/discover`, `/leaderboard/*`, `/u/*`,
`/dashboard/messages/*`) built mobile-first with `sm:` / `md:`
breakpoints throughout.

Backlog: explicit per-breakpoint UAT pass with screenshots in
`docs/parity-screenshots/`.

---

## 9. Status Legend

- **Done** — shipped + browser-verified.
- **Partial** — primitives shipped; consumer site still pending.
- **Backlog** — identified, sized; not yet implemented.
- **Deferred** — explicitly out-of-scope this audit cycle.
- **Pending Lighthouse** — needs measurement before fixing.

Live tracker UI: `/admin/audit-tracker`.

---

## 10. Update protocol

Update this file whenever:
- A new feature category is audited.
- A backlog item is shipped (move row to "Done", link the PR).
- A reference platform meaningfully changes their feature.

Owner of next pass: schedule a follow-up audit 90 days after the last
major shipped change, or sooner if a competitive intelligence signal
suggests we've fallen behind.
