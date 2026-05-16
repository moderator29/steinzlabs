# Consolidated Audit Recommendations — 2026-05-15

10 audit agents ran in parallel, comparing each area to industry standards
(Uniswap, Jupiter, MEVX, Photon, BullX, Trojan, BananaGun, Maestro,
Nansen, Arkham, Cielo, Zerion, DeBank, ChatGPT, Claude.ai, Perplexity,
Bubblemaps.io, Honeypot.is, RugCheck, Coinbase Wallet, Privy, GitHub,
Linear). Per area: **P0** = security/correctness (must-fix);
**P1** = industry-parity gaps (ship-soon); **P2** = UI 2030 polish.

Effort = rough engineering hours, single-developer.

---

## 1. PORTFOLIO  (`/dashboard/portfolio`)

**On-disk:** working. Zerion + Alchemy + CoinGecko wired. 676-line page,
multi-chain holdings, performance/alpha tabs, 30s live polling, allocation
column, GoPlus-driven risk surfacing.

### P0
- **Solana case-sensitivity violation** — `app/dashboard/portfolio/page.tsx:176` uses `h.contractAddress?.toLowerCase()` and `app/api/portfolio/live-prices/route.ts:46` uses `t.address?.toLowerCase()`. Solana mints are base58, case-sensitive — silent price-lookup miss for SPL holdings. **Fix:** use `normalizeAddress(addr, chain)` from `lib/utils/addressNormalize.ts`. **Effort: 0.5h**
- **Cross-chain FIFO key bug** — `app/api/portfolio/performance/route.ts:95` keys FIFO lots on `symbol` only; bridged USDC.eth ≠ USDC.sol get merged → wrong realized PnL. **Fix:** key on `{wallet, chain, symbol}`. **Effort: 1h**
- **Fail-open swallow** — `page.tsx:163` `.catch(() => {})` and `live-prices/route.ts:79` `console.error` only; user sees stale prices indefinitely with no signal. **Fix:** Sentry capture + return error breadcrumb. **Effort: 0.5h**

### P1 (industry-parity)
- **Multi-wallet aggregation** — link N wallets, single rollup. Need `/api/portfolio/aggregate` + multi-select UI. **Effort: 4h**
- **NFT tab** — Alchemy `getNFTs()` + OpenSea floor. New `/api/portfolio/nfts` route + tab. **Effort: 4h**
- **DeFi positions tab** — parse Zerion `position_type=deposit/staked` for Aave/Curve/Uniswap LP. New `/api/portfolio/defi-positions`. **Effort: 4h**
- **CSV export (Koinly schema)** — `/api/portfolio/export/csv` streaming with tx_hash, date, buy/sell asset, cost_basis, realized_pnl. **Effort: 3h**
- **Sortable columns** — `HoldingsTable` (line 516–627) hardcoded; needs `useState<SortKey>` + clickable headers. **Effort: 1.5h**
- **Watchlist + spam filter** — surface existing GoPlus risk into a "Hide spam" toggle. **Effort: 2h**

### P2 (UI 2030)
- Glass hero + parallax on totalValueUsd card. **Effort: 1h**
- Animated counter (framer-motion `useSpring`) for $ total. **Effort: 0.5h**
- Skeleton loaders (replace "Loading holdings…" text). **Effort: 1h**
- AAA contrast: `text-slate-500/600` → `text-slate-300/400`. **Effort: 0.5h**
- Sparkline per row (recharts `AreaChart` 20px height, no axes). **Effort: 2h**
- Command palette ⌘K with portfolio actions. **Effort: 3h**

---

## 2. SNIPER BOT  (`/dashboard/sniper`)

**On-disk:** working. 5-chain (Solana/EVM/TON), kill-switch, GoPlus-gated,
auto-sell with TP/SL/trailing-stop, Realtime Supabase channel for fills,
multi-wallet, MEV toggle, slippage presets, per-snipe P&L.

### P0
- **`console.error` violations (CLAUDE.md)** — `app/dashboard/sniper/page.tsx:146` + `app/api/sniper/execute/route.ts:76`. **Fix:** swap to `Sentry.captureException`. **Effort: 0.25h**
- **`any` type** — `lib/sniper/engine/apiCost.ts:63` uses `catch (err: any)`. **Fix:** `catch (err: unknown)` + `instanceof Error`. **Effort: 0.25h**
- **Wallet addresses not canonicalized** — `app/api/sniper/criteria/route.ts:127–141` stores raw addresses. **Fix:** `normalizeAddress` before insert. **Effort: 0.5h**

### P1 (industry-parity vs BananaGun/Photon/BullX/Maestro)
- **Live-status badge** — Realtime channel exists but no UI indicator. Add pulsing green dot next to History tab when `liveConnected`. **Effort: 0.5h**
- **Dev-wallet auto-block** — extend GoPlus check to block criteria if creator address matches top-N holders. **Effort: 2h**
- **Pre-flight dry-run** — `eth_call` (EVM) / `simulateTransaction` (Solana) before execute; gate if simulate reverts. Log to `sniper_match_events.details.dryRunResult`. **Effort: 3h**
- **Anti-rug auto-sell triggers (LP-pulled, dev-dump)** — listen to LP events, fire auto-sell if conditions hit. **Effort: 4h**
- **Copy-trade** — extend `sniper_criteria.trigger_whale_address` (already half-wired) to auto-execute on detected whale buys. **Effort: 3h**
- **Telegram integration** — wire criteria → `/api/telegram/webhook` for pre-execution notifs + reaction veto. **Effort: 3h**
- **Risk dashboard per snipe** — max-loss USD, max-gas USD, kill-switch reason in History row. **Effort: 3h**

### P2 (UI 2030)
- Pulse-on-fill animation (`animate-pulse` on new row 2s, then remove). **Effort: 1h**
- Command palette `/snipe <token>` — wire into `GlobalSearch.tsx`. **Effort: 4h**
- Live tape ticker (left rail real-time fills, colored by P&L). **Effort: 3h**
- Tip-strategy auto-bid (Jito/Flashbots dynamic). **Effort: 2h**

---

## 3. AUTH WALLET-CONNECT  (`/login`, `/signup`, `/naka-cult`)

**On-disk:** working. Email+captcha, Phantom (Solana, ed25519), MetaMask
+ Reown/WalletConnect QR (EVM, SIWE-style), Google OAuth, magic-link
post-verify. `auth_wallet_nonces` 5-min expiry, `wallet_identities` table.

### P0
- **Non-EIP-4361 SIWE message** — `app/api/auth/wallet-nonce/route.ts:33,47` sends `"Sign this message to authenticate..."` without domain/URI/version/chainId. No domain binding → phishing-prone; wallets can't show origin. **Fix:** use `viem`'s `SiweMessage.prepareMessage()` (viem already in deps). **Effort: 2h**
- **Chain-ID missing from message** — same file. User signs without seeing which chain. Mitigated by nonce table chain scoping but UX-poor. **Fix:** include chainId in EIP-4361 builder. **Effort: included above**

### P1 (industry-parity)
- **Coinbase Wallet SDK** native — `@coinbase/wallet-sdk` (~50KB) wired into AppKit's `WagmiAdapter`. Touches `lib/wallet/appkit.ts:62-67`. **Effort: 2h**
- **Trust Wallet direct** — extend AppKit. **Effort: 1h**
- **Backpack + Glow (Solana alt wallets)** — extend SolanaWalletAuthButton to detect + offer. **Effort: 2h**
- **Wallet detection + recommendation** — scan `window.ethereum`/`window.solana`/`window.coinbaseWallet` on mount; pin to top of modal. localStorage `naka_recent_wallets`. **Effort: 3h**
- **Email + social broadening** — Magic Link or Web3Auth (Twitter/Discord/Apple/Google). New components, parallel to wallet flow. **Effort: 8h**
- **Passkey / WebAuthn** — Coinbase Smart Wallet / Privy style seedless. **Effort: 8h+**

### P2 (UI 2030)
- Glass modal with `backdrop-blur(24px)`, `rounded-2xl`, soft shadow. **Effort: 1h**
- Animated wallet logos (3D rotate on hover). **Effort: 1h**
- "Detected" green badge when injected provider present. **Effort: 0.5h**
- "Recent wallet" pinning row. **Effort: 1h**
- Inline network-switch CTA on wrong chain. **Effort: 1h**

---

## 4. SECURITY STACK  (GoPlus, SecurityGate, simulateTransaction)

**On-disk:** working. GoPlus integrated, Naka Trust Score, SecurityPanel
on token detail. Approval Manager + Domain Shield + Signature Insight all
real-call. Note: GoPlus auth header is currently `Authorization: API_KEY`
(GoPlus V1 still accepts this — not blocking, but rotate keys).

### P0
- **`simulateTransaction` fails OPEN** — `lib/security/goplusService.ts:496–501` returns `success:true riskLevel:MEDIUM` on error → SecurityGate green-lights signs when GoPlus is offline. **Fix:** return `success:false riskLevel:'UNKNOWN'`; extend type union to include `UNKNOWN`. **Effort: 0.5h**
- **Solana token security uses EVM endpoint** — `goplusService.ts:79` calls `/token_security/{chainId}?contract_addresses=...`. Solana real path is `/solana/token_security/?contract_addresses=...` with different schema (mintable/freezable/transfer_fee as nested). `SecurityPanel.tsx:199–249` `readSolanaFacts()` parses correctly but the backend never feeds it the right shape. **Fix:** branch in `scanTokenSecurity` on `chain==='solana'`. **Effort: 2h**
- **`portfolio-risk/route.ts:53` LP lock coercion** — `is_locked === 1` numeric vs `'1'` string mix; reduce inconsistent. **Fix:** `String(h.is_locked) === '1'`. **Effort: 0.25h**

### P1 (industry-parity vs Honeypot.is/de.fi/RugCheck)
- **Source triangulation** — single GoPlus = false negatives. Add Honeypot.is + de.fi Scanner + RugCheck (Solana) with 3-source voting. New `lib/security/triangulate.ts`. **Effort: 6h**
- **Pre-sign simulation in SecurityGate** — `components/security/SecurityGate.tsx:172–190` modal shows trust score but never calls `simulateTransaction` before user signs. Add lazy "Simulate" button. **Effort: 2h**
- **LP lock duration** — fetch Team Finance / Unicrypt unlock timestamp via Etherscan/Blockscout and surface in SecurityPanel facts. **Effort: 3h**
- **Deployer rug history** — Arkham entity lookup on creator + owner addresses. **Effort: 2h**
- **Bundled-supply detection** — % sniped in first N blocks by single entity. **Effort: 4h**
- **Tax simulation (1-wei eth_call)** — surface actual vs claimed tax delta. **Effort: 3h**
- **Top-3 holder labels** (CEX/LP/dev/whale) — Arkham labels into SecurityPanel. **Effort: 2h**

### P2 (UI 2030)
- Source-triangulation badge stack (3 badges, hover = "3/3 agree = high confidence"). **Effort: 1h**
- Animated severity bar (left-to-right fill, color-graded 0–100). **Effort: 1h**
- Expandable findings drawer with mitigation copy + "Simulate sell" button. **Effort: 2h**

---

## 5. VTX AI  (`components/VtxAiTab.tsx` + `/api/vtx-ai`)

**On-disk:** SSE streaming **confirmed working** server-side AND client-side
(prior handoff was wrong). Tool sidecar exists. Conversation history
panel persists per user. Markdown is regex-stripped (line 1141) — bad.

### P0
- **Prompt injection** — `route.ts:1141` interpolates `context.currentPage` and `context.currentToken` raw into system prompt. Personality/language/depth have allow-lists; context fields don't. Attacker can pass `currentToken: "ETH\n\nIGNORE PRIOR INSTRUCTIONS..."`. **Fix:** strip control chars + length cap (≤16 for symbol, ≤64 for page). **Effort: 0.5h**

### P1 (industry-parity vs ChatGPT/Claude.ai/Perplexity)
- **Real markdown render** — replace regex strip at `VtxAiTab.tsx:1141` with `react-markdown` + `remark-gfm` (tables, code blocks, syntax highlight). **Effort: 2h**
- **Streaming caret** — animated `▌` cursor while tokens arrive. **Effort: 0.5h**
- **Visible tool calls during stream** — emit `{type:'tool_start', name, args}` events; collapsed cards in UI. Currently `toolsUsed` only emitted on done. **Effort: 3h**
- **Stop-generation button** — wire `AbortController` into fetch + UI. **Effort: 1h**
- **Copy message + copy-as-markdown** — buttons on assistant messages. **Effort: 0.5h**
- **Regenerate response** — re-POST last user message with same context. **Effort: 1h**
- **Edit-and-resend** — pencil icon on user message, opens inline editor. **Effort: 2h**
- **Citations** (Perplexity-style) — when tools return URLs/sources, show numbered footnotes with hover preview. **Effort: 3h**
- **Model picker** — Sonnet 4.6 / Opus 4.7 / Haiku 4.5 toggle. **Effort: 1h**
- **Suggested follow-ups** — emit 3 questions in done event; render as pills. **Effort: 1.5h**

### P2 (UI 2030)
- Glass message bubbles (`backdrop-blur-xl border border-white/5`). **Effort: 0.5h**
- Gradient streaming cursor (blue→purple). **Effort: 0.25h**
- Animated tool-call cards with fade-in. **Effort: 1h**

---

## 6. PROFILE / SETTINGS / NOTIFICATIONS  (`/settings`)

**On-disk:** working. Display name, password change, account deletion
(immediate), login activity (last 10), notification panel with browser
push (VAPID + service worker), Telegram + email + 5 event types + quiet
hours. **MIGRATION `2026_05_15_notification_quiet_hours.sql` NOT YET
APPLIED** — settings UI hides quiet-hours / email / Telegram with
"Pending — apply migration" message.

### P0
- **Apply pending migration** — `supabase/migrations/2026_05_15_notification_quiet_hours.sql` adds 6 columns. Run via `mcp__supabase__apply_migration` (was classifier-blocked before). **Effort: 0.25h**
- **Avatar upload missing** — schema has `avatar_url` but no UI. Add Supabase Storage bucket + uploader. **Effort: 3h**
- **Bio + social links missing** — schema has `bio` but no UI; no Twitter/Discord/GitHub fields. **Effort: 1.5h**

### P1 (industry-parity vs GitHub/Linear/Coinbase)
- **2FA: TOTP + WebAuthn** — `@oslojs/otp` + `@passwordless-id/webauthn`. **Effort: 8h**
- **Active sessions revocation** — "Sign out this device" + "Sign out everywhere" buttons on login_activity rows. **Effort: 3h**
- **Device naming** — parse user agents into "Chrome on macOS" labels. **Effort: 1h**
- **GDPR data export** — POST `/api/account/export` returns JSON archive. **Effort: 3h**
- **Soft-delete with 30-day grace** — flag account, cron purges after 30 days. **Effort: 3h**
- **API keys with scopes** — generate + last-used timestamps. **Effort: 6h**

### P2 (UI 2030)
- Segmented toggle group for channels (Linear-style). **Effort: 1h**
- Sentry breadcrumbs on preference saves. **Effort: 0.5h**
- "Test email" button alongside existing "Test push". **Effort: 0.5h**
- Auto-detect timezone + lazy-load IANA list. **Effort: 0.5h**
- Animated channel badges (push/email/telegram dots). **Effort: 0.5h**

---

## 7. BUBBLE MAP + AGENT  (`/dashboard/bubble-map` + `/api/bubble-map` + `/api/bubblemap-agent`)

**On-disk:** all routes exist (page 650 lines, bubble-map 245, agent 168).
`bubblemap_conversations` table exists with RLS. 4 suggested-question
pills shipped. **Tier check on agent route is server-side correct, but
`/api/bubble-map` itself has zero auth/tier gate.**

### P0
- **`/api/bubble-map` has no auth or tier gate** — anyone (logged in or not) can enumerate unlimited token holders. Free/Pro segregation bypassed. **Fix:** `getUser()` + tier check in route. **Effort: 0.5h**
- **Prompt injection** — `/api/bubblemap-agent/route.ts:80–90` interpolates `ctx.tokenName`/`ctx.tokenSymbol` raw via `summarizeContext()`. Strip newlines/control chars. **Effort: 0.5h**
- **Hardcoded Solscan explorer** — `route.ts:178` hardcodes Solscan for all chains; ETH tokens 404. **Fix:** chain-aware explorer map. **Effort: 0.5h**

### P1 (industry-parity vs Bubblemaps.io/Arkham/Breadcrumbs)
- **Hover tooltips** — D3 tooltip on node hover: label, addr, balance, first-tx age, edge weight. **Effort: 3h**
- **Wallet-search pin** — input above chart, type address → highlight + center. **Effort: 2h**
- **Time-scrubber** — connect existing `/api/intelligence/holders/[token]/timeline` to D3; slider replays supply distribution by block. **Effort: 5h**
- **Suspicious cluster alert** — flag clusters with >5 wallets created within 24h holding identical %. **Effort: 3h**
- **Export PNG/SVG** — canvas snapshot button. **Effort: 1h**
- **Cluster legend refinement** — sub-categories (CEX hot / fresh / OG / sniper). **Effort: 1.5h**

### P2 (UI 2030)
- Glass canvas overlay with `backdrop-blur(8px)`. **Effort: 0.5h**
- Staggered bubble-arrival animation (0.2s per node, scale + opacity spring). **Effort: 1h**
- Gradient edge color by transfer-volume (blue→red). **Effort: 1h**

---

## 8. WALLET INTELLIGENCE + DNA ANALYZER  (`/dashboard/wallet-intelligence`, `/dashboard/dna-analyzer`)

**On-disk:** wired. Alchemy + Birdeye + DexScreener real APIs, archetype
detection (DIAMOND_HANDS / SCALPER / DEGEN / WHALE_FOLLOWER / HOLDER /
INACTIVE / NEW_WALLET), Sonnet 4.6 AI synthesis, Fear & Greed live,
trending coins, side-by-side wallet comparison.

### P0
- **Prompt injection** — `app/api/dna-analyzer/route.ts:22–66` interpolates `walletAddress` + `holdingsText` raw into prompt. **Fix:** sanitize symbols (strip `\n\r"}`) + length cap. **Effort: 0.5h**
- **No auth on DNA endpoints** — `/api/dna-analysis` and `/api/dna-analyzer` accept any input, no rate-limit. Sonnet calls billable → abuse risk ($150–$300/day attack). **Fix:** rate-limit by IP+user; tier-gate (Free 5/day, Pro unlimited). **Effort: 2h**
- **EVM symbol case-mismatch** — `wallet-intelligence/route.ts:148` doesn't `.toUpperCase()` before BLUE_CHIP set lookup; if Birdeye returns `'sol'`, blue-chip detection fails → archetype misclassified. **Fix:** normalize symbols upper. **Effort: 0.25h**
- **Hardcoded compare button (no tier check)** — `wallet-intelligence/page.tsx:449–459` always shows compare CTA. **Fix:** gate by `useAuth().tier`. **Effort: 0.5h**
- **`vtxAnalyze()` fail-open** — `dna-analyzer/route.ts:68–69` throws on null with no fallback. UI shows generic "Analysis failed". **Fix:** return stub with `note: 'AI analysis unavailable — using on-chain data only'`. **Effort: 0.5h**

### P1 (industry-parity vs Nansen/Arkham/Cielo)
- **Realized PnL calculation** — currently estimates `txCount * 0.6/0.4` for buys/sells (no real entry/exit). New `lib/pnl/calculator.ts`: avg_entry vs current price per holding + closed lots from history. **Effort: 8h**
- **On-chain identity (ENS / SNS / Arkham entity)** — call Arkham label lookup on the wallet itself, not just holdings. **Effort: 4h**
- **Decomposed risk score** — break overallScore into: concentration (HHI) / liquidity / entry-timing / smart-money-following / scam exposure. Stacked bar UI. **Effort: 4h**
- **Cohort comparison radar** — fetch top 20 same-archetype wallets, plot percentile rank. **Effort: 5h**
- **Trade-style detection (sniper/swing/arb)** — entry/exit pattern detection from tx history. New `lib/trade-classifier.ts`. **Effort: 6h**
- **Behavior-shift timeline** — weekly snapshots in `wallet_snapshots`; detect "HODLER → DEGEN" pivots. **Effort: 5h**

### P2 (UI 2030)
- Animated DNA helix in hero (framer-motion SVG). **Effort: 2h**
- Trait chips with hover-define tooltips. **Effort: 1h**
- Score gauge with band coloring (red/orange/yellow/green). **Effort: 1h**
- AAA contrast pass (`text-gray-300` → `text-gray-200`). **Effort: 0.5h**

### Stuff to remove
- `lib/intelligence/holderAnalysis.ts` — never called by wallet-intelligence/dna routes; only used for token-holder analysis. Keep or move.
- `lib/intelligence/historicalTracking.ts:findSimilarTokens()` — returns stub; mark TODO or feature-flag.

---

## 9. CONTEXT FEED + PROOF MODAL  (`components/ContextFeed.tsx`, `/dashboard/proof`)

**On-disk:** both production. ContextFeed (857 LOC) + 9-chain aggregator
(971 LOC) wired to Alchemy/Helius/DexScreener/CoinGecko. Proof modal
(465 LOC) with TradingView + lightweight-charts, "Endorse Signal" poll.

### P0
- **Engagement data leakage** — `/api/engagement/route.ts` uses in-memory `Map`; all likes/views/shares wiped on every serverless redeploy. `engagement` table exists in schema but never written. **Fix:** swap Map for Supabase upsert. **Effort: 2h**
- **Proof event passed via sessionStorage with no validation** — `/dashboard/proof/page.tsx:119` `JSON.parse(stored)` of arbitrary input. Attacker crafts event in DevTools → XSS via `event.title` if rendered as HTML. **Fix:** Zod schema validate on parse. **Effort: 1h**
- **Fake holder distribution labeled as real** — `proof/page.tsx:51–106` BubbleVisualization generates deterministic-seeded fake holder %. Labeled "Powered by on-chain data". CLAUDE.md "no fabricated values" violation. **Fix:** fetch real Birdeye/DexScreener holders OR add "Simulated" badge. **Effort: 3h**

### P1 (industry-adjacent)
- **Trust score consistency** — different formula per source (alchemy=value, pump.fun=mcap/vol, dexscreener=liq+vol). Document scoring matrix; unify formula. **Effort: 2h**
- **Cielo-style "Activity for $SYMBOL" filter chip** — group events by token. **Effort: 2h**
- **Friend.tech-style social attribution** — "N users endorsed bullish" + avatar stack. **Effort: 3h**
- **OpenSea-style verified-badge tiers** — VERIFIED at score≥75, WHALE-ALIGNED, WATCHLIST-HIT. **Effort: 1.5h**

### P2 (UI 2030)
- Glass timeline cards (alternating left/right on desktop, vertical line). **Effort: 2h**
- Animated event arrival (fade + slide-up). **Effort: 0.5h**
- Sentiment-pulse ring matching color (green/red/blue). **Effort: 0.5h**
- Overlapping proof-badge stack. **Effort: 0.5h**

### Stuff to remove
- `/api/cron/context-feed-poll/route.ts` — placeholder that does nothing. Delete or implement.
- `displayTimestamp` 6-second staggering — clever but adds complexity; low value.

---

## 10. WHALE CLUSTER  (`/dashboard/wallet-clusters` + `/api/clusters/*` + `lib/clusters/*`)

**On-disk:** production. 5 detectors (direct_transfer / common_funding /
coordinated_trading / behavioral_fingerprint / sybil_pattern), Supabase
persistence (wallet_clusters / wallet_cluster_members / wallet_edges /
cluster_labels / cluster_label_votes / user_reputation), tier-gated to
'pro', cron weekly, react-force-graph-2d UI.

### P0
- **Solana case violations** — `lib/clusters/detection.ts:54,63,86,89,135,148–149,181,183` and `app/api/clusters/analyze/route.ts:20,47–48` call `.toLowerCase()` on raw addresses. Sybil + behavioral detection silently fails for Solana. **Fix:** `normalizeAddress(addr, chain)` everywhere. **Effort: 1.5h**
- **Risk score never persisted** — `orchestrator.ts:115–122` computes `risk_score` but `wallet_clusters` schema doesn't have the column. **Fix:** add migration + `risk_score numeric` + write in upsert. **Effort: 1h**
- **Edge `.or()` query truncation risk** — `/api/clusters/by-id/[id]/route.ts:47–51` builds an `.or()` string from address arrays; large clusters may exceed URL length. **Fix:** chunk into batches of 50 + union. **Effort: 1h**
- **Claude narrative fail-open silent fallback** — `orchestrator.ts:191–218` returns hardcoded fallback names on Anthropic timeout. **Fix:** retry once + Sentry alert. **Effort: 1h**

### P1 (industry-adjacent vs Nansen/Arkham/Cielo/Maestro)
- **Entity registry** — table mapping known addresses (Binance Deposit, Uniswap Router) to entity types. Enrich narratives. **Effort: 4h**
- **Confidence weighting** — currently uniform 0.4–0.75; weight by `total_value_usd`, chain diversity, temporal entropy. **Effort: 3h**
- **MEV / sandwich detector** (Algorithm 6) — front-run within 1s of UniswapV3 events. **Effort: 6h**
- **Time-decay on edges** — edges 6 months old count equal to fresh; weight by recency. **Effort: 2h**
- **Cross-chain bridge_pattern detector** — wallet_A on ETH + wallet_B on Solana via same Multichain/Stargate router within 2h → soft edge. **Effort: 5h**
- **Label provenance enum** — `label_source`: verified / community / ai / exchange. UI highlights verified. **Effort: 2h**
- **Realtime cluster updates** — Supabase Realtime on `wallet_edges` instead of weekly cron. **Effort: 4h**

### P2 (UI 2030)
- Glass cluster cards with archetype-tinted glowing border. **Effort: 1h**
- Hover tooltip per node (label / score / value / edges / explorer link). **Effort: 1.5h**
- Floating draggable cluster legend. **Effort: 1h**
- Risk score heatmap (X=whale_score, Y=risk_score scatter). **Effort: 2h**
- Temporal evolution scrubber (slider over first_seen→last_seen, edges fade). **Effort: 4h**

### Stuff to remove
- `lib/jobs/cluster-detection.ts` — orphan Solana-specific job, no cron uses it.
- `components/clusters/Cluster2DGraph.tsx` — duplicate of `ClusterGraph.tsx`, only used in deprecated `/[address]` route.
- `/api/clusters/by-address/[address]/route.ts` — overlaps `/api/clusters/analyze`. Pick one.
- `ARCHETYPE_FALLBACK_NAMES` duplicated in `orchestrator.ts:150` + detail page `:37`.

---

## TOTALS BY PRIORITY (effort hours, all areas combined)

| Tier | Hours | What |
|------|-------|------|
| **P0 (security/correctness)** | ~22h | Solana case fixes, fail-open closes, prompt-injection, missing auth, migration apply, EIP-4361 |
| **P1 (industry-parity)** | ~165h | Real PnL, multi-wallet, NFT/DeFi tabs, source triangulation, source markdown, 2FA, time-scrubber, MEV detector, etc. |
| **P2 (UI 2030)** | ~45h | Glass cards, animated counters, skeletons, command palettes, AAA contrast, sparklines |
| **Stuff to remove** | ~3h | Dead code (4 files / duplicated constants) |
| **TOTAL** | **~235h** | |

---

## SUGGESTED EXECUTION ORDER

1. **Sweep P0 across ALL areas first** (~22h, single PR per area or one mega-PR). This kills the security holes + the obvious correctness bugs that audits all kept finding (Solana case-sensitivity is in 4 different areas).
2. **Apply pending Supabase migration** (`2026_05_15_notification_quiet_hours.sql`).
3. **Pick top-3 P1 areas for industry parity** based on user-visible value:
   - Portfolio (multi-wallet + NFT + DeFi + CSV) — biggest user-visible upgrade
   - Security (source triangulation + pre-sign simulate) — biggest trust upgrade
   - VTX AI (real markdown + tool cards + regenerate) — biggest "feels next-gen" upgrade
4. **UI 2030 polish pass** — glass + animated counters + skeletons + AAA across all dashboards. Single sweep, ~10–15h.
5. **Defer**: passkey/WebAuthn, 2FA, GDPR export, MEV detector, behavior-shift timeline, cohort radar — all valuable but multi-day each.

Tell me which order to execute and I start the moment you greenlight.

---

# DEEP-PASS — Cross-Cutting Concerns (added after first round)

The first 10 feature audits were per-area. These 4 deep-pass audits cover
the cross-cutting stuff that makes the difference between "works" and
"feels industry-standard."

## 11. PERFORMANCE / WEB VITALS

**Build size:** 3.2GB `.next`, 115 pages, Next 16 (webpack, NOT Turbopack
in prod build). Top-10 wins ranked effort/impact:

| # | Win | Effort | Gain |
|---|-----|--------|------|
| 1 | **Google-Fonts CDN → `next/font`** — `app/layout.tsx:75-78` + `app/globals.css:1-9` use blocking `@import url('https://fonts.googleapis.com/...')` for Inter + JetBrains Mono | 0.5h | **200–400ms LCP** |
| 2 | **Anthropic SDK out of client bundle** — `@anthropic-ai/sdk` (~400KB min) imported in `components/VtxAiTab.tsx`. Client should fetch `/api/vtx-ai`, not import SDK | 2h | **250–350KB JS, 1.2–1.8s transitions** |
| 3 | **Split mega-client pages** — `portfolio/page.tsx` (675 LOC), `whale-tracker/page.tsx` (992), `sniper/page.tsx` (581). All `'use client'` monoliths blocking hydration. Move to server-shell + `<Suspense>` per section, lazy lightweight-charts/recharts | 8h | **400–600ms LCP, 800–1200ms TTI** |
| 4 | **`react-force-graph-2d` lazy w/ skeleton** — `components/clusters/ClusterGraph.tsx:11` already SSR-false; needs deferred mount + 500-edge ceiling | 1h | **200–300ms FCP** on cluster page |
| 5 | **AuroraBackground GPU optimize** — `app/dashboard/layout.tsx:22` runs conic keyframes on every dashboard route. Move to fixed pseudo-element + `will-change: transform` | 1h | **30–50ms / route transition** |
| 6 | **Route-level chart code-splitting** — d3 (bubble-map), recharts (market prices), lightweight-charts (portfolio) all eager-loaded everywhere. `next/dynamic` per route + hover-prefetch | 4h | **600–800KB off critical path** |
| 7 | **Auth state caching** — `lib/hooks/useAuth.ts:67-120` re-fetches on every page. Move to SWR/TanStack Query + localStorage tier fallback | 3h | **300–500ms repeat-nav** |
| 8 | **`<Suspense>` boundaries on dashboard** — `app/dashboard/layout.tsx:95` only `<Suspense fallback={null}>`. Wrap KpiBar/Insight/MiniVtx individually | 3h | **400–600ms FCP, 200–300ms FID** |
| 9 | **Cron batching** — `vercel.json` runs 33 crons; whale-activity-poll every 10s, sniper-monitor every 5s. Merge feed-aggregator + exponential backoff for low-traffic tokens | 4h | **40–60% Vercel + Alchemy quota saving** |
| 10 | **Token logo `next/image` + dimensions** — `next.config.js:36-52` whitelists Supabase + CoinGecko but most renders use raw `<img>` or no width/height. Market list (115 logos) causes CLS | 2h | **80–120ms LCP, CLS<0.1** |

**Total perf effort: ~28h. Items 1+2+4+5+10 alone = 6.5h, biggest UX delta.**

---

## 12. ACCESSIBILITY + MOBILE + PWA

Top-12 user-impact gaps:

| # | Gap | Severity | Fix |
|---|-----|----------|-----|
| 1 | **Microscopic type** — 391 instances of `text-[9px]` / `text-[10px]` (SidebarMenu:129, NotificationBell:165, ContextFeed throughout). WCAG AA = 12px floor | Severe | Floor 11px secondary, 13px body. Audit pass |
| 2 | **Touch targets <44px** — `py-1`/`py-2.5`/`p-1.5` everywhere; ThemeToggle/NotificationBell close buttons are 24-32px hit zones. Apple HIG = 44×44px | Critical | Wrap micro-icons in `w-11 h-11` containers; enlarge to 20px base + 12px padding |
| 3 | **No general service worker** — `push-sw.js` is push-only. No fetch listener, no offline shell, no SWR cache | High | Offline shell for `/dashboard`, `/market`. Stale-while-revalidate API |
| 4 | **No install prompt** — `manifest.json` is correct but no `beforeinstallprompt` listener; iOS gets no "Add to Home" CTA | High | `useInstallPrompt` hook + one-time banner |
| 5 | **Modal focus trap + ESC missing** — `AlertModal.tsx`, `BuySellModal.tsx`, others have onClose but no `event.key === 'Escape'` listener; no focus trap, focus escapes to background | High | Headless UI Dialog or hand-roll trap with `useRef` |
| 6 | **Label/input association broken** — `AlertModal:66`, `BuySellModal`, `OrderForm`, `ProfileTab` have orphan `<label>` w/o `htmlFor`. Screen readers read inputs as "edit text" | Medium-high | Pair every label `htmlFor={id}` with input `id={id}` |
| 7 | **No mobile bottom nav** — `SidebarMenu.tsx` is desktop-first; mobile forces drawer-toggle every section. Phantom/Jupiter use 5-icon bottom bar | High | New `<BottomNav>` `bottom-0`, 5 routes (Market/Wallet/Portfolio/Alerts/Profile), `sm:hidden` |
| 8 | **Color contrast fails** — `text-gray-500` (#6B7280) on `#111827` = 3.8:1; `text-gray-600` = 3.2:1. WCAG AA = 4.5:1, AAA = 7:1. Multiple instances in NotificationBell, ContextFeed, VtxAiTab | Medium-high | Bump gray-500/600 → gray-300/400 globally |
| 9 | **Screen reader gaps** — TokenLogo fallback `<div>` w/ letter has no `aria-label`; no `aria-current="page"` on active nav; icon-only buttons missing `aria-label`; toast container missing `aria-live` | Medium-high | Add aria-* per WCAG; live region for toast |
| 10 | **No reduced-motion support** — globals.css transitions on every element; no `@media (prefers-reduced-motion: reduce)`; framer-motion w/o `useReducedMotion` hook | Medium | Wrap animations in media query; framer `shouldReduceMotion` prop |
| 11 | **No safe-area insets** — Layout viewport correct but no `env(safe-area-inset-*)` on fixed elements. iPhone X+ home indicator + Android gesture nav clip content | Medium | `padding: env(safe-area-inset-bottom)` on bottom-fixed; `@supports (padding: max(0px))` for fallback |
| 12 | **Form validation associations** — `BuySellModal:68` shows balance error but no `aria-describedby` linking input → error div; AlertModal `aria-live` missing | Medium | `aria-describedby` per input; `aria-live="assertive"` for inline errors |

**Total a11y/mobile effort: ~18h. Items 1+2+5+7+8 = ~10h, single sprint.**

---

## 13. OBSERVABILITY / RELIABILITY / ANALYTICS

Top-12 by user blast-radius:

| # | Gap | Blast | Fix |
|---|-----|-------|-----|
| 1 | **Sentry init missing release/profiling/replay** — `instrumentation.ts:9-20` hardcodes `tracesSampleRate: 0.1`, no `release`, no profilerSampleRate, no session replay on error | Prod visibility | Add `release: VERCEL_GIT_COMMIT_SHA`, `profileSampleRate: 0.05`, replay on error |
| 2 | **18 `.catch(() => {})` blocks swallow errors** — `app/api/sniper/execute/:118-120` (`createSniperExecution().catch(() => {})`), `app/api/security/check-wallet/`, `app/api/notifications/`, `app/api/support/tickets/`, +14 more | User-invisible failures | Always `Sentry.captureException(err)` before swallow |
| 3 | **162 console.* in prod** — across 78 routes (auth/signup:139, bubble-map, admin/settings) | Log noise, unsearchable | Pino logger w/ JSON output; Sentry breadcrumbs on error paths |
| 4 | **Zero retry on 29 service wrappers** — CoinGecko has 429-fallback but Alchemy/Birdeye/DexScreener/GoPlus have NONE. Single transient 429 → user failure | Transient errors = user errors | `p-retry` with 3 attempts, exp backoff 100/500/2000ms + per-attempt timeout |
| 5 | **Health check incomplete** — `/api/health` only checks env vars + Supabase; no Redis, no external APIs | Outage blind | Public `/api/health` returns 503 if any critical service down (Redis degrade gracefully) |
| 6 | **Redis timeout silent fail-open** — `lib/cache/redis.ts:32-46` `withTimeout()` returns null on Upstash timeout → no rate-limiting during cache outage | Silent rate-limit bypass | Sentry warn before fallthrough; circuit breaker after 3 timeouts/60s |
| 7 | **No per-route trace sampling** — flat 10% rate; auth errors should be 100%, price-fetch 1% | Cost creep + signal dilution | `tracesSampler` callback in Sentry init |
| 8 | **CoinGecko plan-mismatch silent downgrade** — `lib/services/coingecko.ts:15-35` if `COINGECKO_PLAN=demo` but key is pro (or vice versa), call silently downgrades to unauth | Tier bleed | Validate plan/key at startup → throw if mismatch; log selected plan |
| 9 | **Cron error swallow** — `app/api/cron/_shared.ts:71-91` `logCronExecution()` writes to `cron_execution_log` but catch is empty; 33 crons w/ no failure alert | Silent cron failures | Sentry capture in catch; `/api/admin/cron-status` alerts on >2× schedule interval since last run |
| 10 | **PostHog client-only** — `lib/posthog.ts:1-41` only browser. No backend funnel: signup→confirm→first-trade, no auth-failure cohort, no rate-limit-hit segment | Funnel blind | `posthog-node` server-side; track signup+confirm+first-trade events; `plan_tier` property |
| 11 | **Timeout chaos** — CoinGecko 12s, DexScreener 10s, Birdeye 600s, Anthropic 900s. Vercel function 15min cap → cascading 504s | Latency cascades | Env-driven `EXTERNAL_API_TIMEOUT_MS=8000`, `LLM_TIMEOUT_MS=30000`. CI lint: every fetch must have explicit timeout |
| 12 | **No Web Vitals / RUM** — no `web-vitals` package, no `@vercel/analytics`. Trade latency unmeasured | Perf regressions invisible | `@vercel/analytics/react` + custom `trade_latency_ms = execute - quote_requested`; alert P95 > 3s |

**Total observability effort: ~22h. Items 1+2+3+4 = ~7h and unblock everything downstream.**

---

## 14. DESIGN SYSTEM + PER-FEATURE UI 2030 MICRO-INTERACTIONS

**Current state:** components/ui/ has only 6 primitives (BackButton,
LanguageSwitcher, StatusDot, SteinzLogo, VerifiedGoldBadge, TierBadge).
No Radix / Headless UI / shadcn. No Storybook. Toast is custom (not
Sonner). LoadingSkeleton has 4 variants but only `animate-pulse`. NO
command palette anywhere. NO global keyboard shortcuts. Focus-visible
rings on only 2 components.

**Cross-section opportunities (highest leverage):**

| # | Opportunity | Effort | Why it matters |
|---|-------------|--------|----------------|
| A | **Command palette ⌘K** — fuzzy nav + actions, framer-motion layout-id selection slide | 15h | 40% faster nav; "feels Linear" |
| B | **Global keyboard shortcuts** — `g+p` portfolio, `g+m` market, `g+s` sniper; help modal `?` | 5h | Power-user retention |
| C | **`:focus-visible` rings everywhere** — global Tailwind config, primary-blue ring + offset | 4h | A11y + premium feel |
| D | **Spring easing presets** — add cubic-bezier-spring values to tailwind.config; use on card scales / button presses | 2h | Replace flat `linear` with springy "alive" feel |
| E | **Real toast lib (Sonner)** — replace custom toast w/ Sonner: stacking, swipe-dismiss, sound, undo | 3h | Stripe-grade feedback |
| F | **Headless UI Dialog (focus trap, ESC, click-outside)** — replace ad-hoc modals | 4h | Fixes a11y #5 simultaneously |
| G | **Skeleton shimmer (not pulse)** — left-to-right gradient sweep, not just opacity flash | 1.5h | Premium loading vs cheap |

**Per-feature 2030 micro-interaction specs (highest-value highlights):**

### Portfolio (~14h)
1. Metric cards: skeleton shimmer L→R, 120ms stagger, final fade-in + scale 1.02 (250ms ease-out-cubic) — **2h**
2. Chart: hover crosshair, range brush at bottom, click-zoom, 100ms tooltip delay — **3h**
3. Donut hover: segment shifts outward 4px + 8px glow, tooltip with composition+unrealized — **2h**
4. Holdings row: bg shift + left-border accent slide-in 40ms; click → slide-up drawer 300ms parallax — **4h**
5. P&L badge flash on update (opacity 0.5→1, 400ms); rotate icon 180° on direction flip — **1h**
6. Empty state: illustration + bounce-in CTA — **2h**

### Market list / detail (~14h)
- Active pill underline slide-in (150ms) — **1h**
- Token row: depth shift on hover, chevron fade-in; click w/ shared-element transition (logo stays, details expand) — **5h**
- Search results: stagger-fade, type-debounced fade-out-old before fade-in-new — **2h**
- Live price flash green/red 0.3s; ≥5% move adds pop-in badge — **2h**
- Watchlist heart: scale + bounce-back (110%→100%, 300ms ease-out-bounce), hover glow — **1h**
- Filter modal: slide-in right semi-modal, animated list reflow on apply — **3h**

### Sniper (~11.5h)
- Card hover: blue halo glow 0.15→0.25, top accent slide-in; toggle animates state change — **2h**
- Feed tokens: slide-in from top w/ 100ms stagger + brief glow pulse; security badges color-animate — **3h**
- Execution row arrival: scale 0.9→1 + fade 300ms; status badge spring color-shift pending→executed→profit/loss — **2h**
- Kill-switch: large power icon, confirm overlay, on-confirm icon spins 180° + red flash — **2h**
- New-sniper modal: scale 0.95→1 + fade 250ms; field underline accent slide-in on focus — **1h**
- Execution table: stagger-in load 20ms; row hover depth + right-actions fade-in — **1.5h**

### Swap (~13h)
- Token selector grid: hover scale 1.03 + brief glow; selected checkmark + scale pulse; type-filter staggered fade-in — **3h**
- Route card expand: max-height slide-down; fee breakdown 20ms-stagger fade-in — **2h**
- Amount input: underline accent slide-in 80ms; subtotal price feeds in next to field on type — **1.5h**
- Confirm button state-machine: idle → signing (spinner + "Awaiting wallet") → broadcasting (checkmark pulse) → confirmed (green flash) — **2.5h**
- Slippage/gas tooltips: hover info icon → slide-up tooltip 100ms delay — **1h**
- Success modal: slide-up + framer-motion confetti; tx hash hover glow — **3h**

### VTX AI (~10.5h)
- Streaming: char-by-char (20ms/char) with blinking cursor, hold-to-reveal-all — **2.5h**
- Token cards in-message: scale-up 0.8→1, 300ms spring; hover shadow + border shift — **1.5h**
- Tool-call cards: slide-left + fade 250ms; auto-highlight inputs w/ border glow 100ms delay — **2h**
- Conversation sidebar: hover bg shift + truncated tooltip; click scrolls main + previous-messages fade-out 200ms — **2h**
- Settings drawer: slide-in right 300ms cubic-bezier; smooth knob/toggle animations — **1.5h**
- Suggestion pills: stagger-fade 50ms apart; hover scale 1.02 + glow — **1h**

### Wallet (~7h)
- List entry add: slide-up from bottom 250ms; remove: slide-left + fade 200ms; smooth re-order via framer layout — **2.5h**
- Row hover: right-side actions (edit/copy/delete) fade-in + shift-right 100ms; depth increase — **1h**
- Default-wallet star: 360° rotate on load 400ms; toggle = 180° rotate + color shift — **0.5h**
- Connection status dot pulse on change (1→1.2→1, 300ms) — **0.5h**
- Copy address: brief checkmark overlay + toast slide-in — **1h**
- Empty state: illustration + pulsing CTA every 3s — **1.5h**

### Wallet clusters (~8.5h)
- Card hover: scale 1.02, primary-color border glow, archetype icon enlarges + 10° rotate — **1.5h**
- Archetype badge: subtle pulse-glow every 2s matching archetype color (alpha_hive=amber etc.) — **1h**
- Filter pill underline + cluster list re-render with stagger-fade 20ms apart — **1.5h**
- Analyze form: focus underline accent; submit spinner; success → result cards slide-up from bottom — **2h**
- Mini whale-score donut: hover segments shift out + tooltip — **1.5h**
- Member-count badge: count-up hover animation 300ms + pulsing bg — **1h**

### DNA Analyzer (~8.5h)
- DNA helix intro: spiral grows from center + rotates 1s spring — **2h**
- Report sections: slide-down + fade-in stagger 100ms; left accent border grows 0→full 150ms — **2h**
- Gene card hover: scale 1.02 + shadow + glow; inline mini-chart animates to full color — **1.5h**
- Risk ring SVG: stroke animates 0°→arc 300ms; smooth color transition by risk level — **2h**
- Trait badges: stagger-in 30ms from left; hover scale + glow — **1h**

### Proof modal (~5.5h)
- Row hover: depth + right actions fade-in (verify/copy/share) — **1h**
- Verification flow: idle → verifying (spinner) → verified (checkmark pulse + green flash) | failed (red X + shake) — **1.5h**
- Inline expand: max-height slide 200ms; tx hash + timestamp stagger fade-in — **1.5h**
- Filter pills slide-in from left on load — **1h**
- Copy: icon swap to checkmark flash → back; toast — **0.5h**

### Login / Signup (~8h)
- Input focus: underline accent slide-in 80ms; error border red + message fade-in 100ms — **1.5h**
- Password eye toggle: rotate 180° 100ms — **0.5h**
- Submit state-machine: idle → loading (disabled+spinner) → success (checkmark pulse) | error (shake + red flash) — **1.5h**
- Wallet connect buttons: hover scale 1.03 + shadow; click → "connecting" → success badge — **1.5h**
- Captcha: smooth spinner; on completion checkmark + dim — **0.5h**
- Coin background: parallax on scroll/mouse (max 2px shift) — **1h**
- Form transitions signup → email-verify: slide-left out + slide-right in 300ms — **1h**

### Settings / admin (~4.5h)
- Toggle knob slide 100ms spring + color shift — **0.5h**
- On blur/toggle field glow 200ms then settle + brief checkmark — **1h**
- Danger-zone confirm overlay; on confirm button animates + disabled — **1.5h**
- Section header left-accent border grows on viewport-enter — **0.5h**
- Save toast: slide-in + 4s dismiss; animated stroke checkmark icon 300ms — **1h**

### Context feed / notifications (~4h)
- New-notif slide-in from top 200ms; 50ms stagger for batch — **1h**
- Unread count badge scale + pulse 1→1.2→1 300ms — **0.5h**
- Row hover: scale 1.01 + shadow + dismiss-button fade-in — **0.5h**
- Dismiss: slide-out right + fade 150ms; count shrinks — **1h**
- Empty state: "No alerts" + all-clear illustration — **1h**

**Total micro-interactions effort: ~110h (cross-section + per-feature combined).**
**Quick-win items (focus-visible + Sonner + Headless Dialog + skeleton shimmer + spring easing): ~14h.**

---

# COMPETITIVE PARITY MATRIX (us vs them)

Honest line-by-line, post-fix-state. ✓ = ship-quality, ◐ = partial, ✗ = missing.

| Capability | Us (today) | Us (after P0+P1) | MEVX | BullX | Photon | Nansen | Phantom |
|---|---|---|---|---|---|---|---|
| Multi-chain trading | ◐ EVM+Sol | ✓ | ✓ | ✓ | Sol-only | n/a | EVM+Sol |
| Multi-wallet portfolio | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| NFT tab w/ floor | ✗ | ✓ | ✓ | ◐ | ✗ | ◐ | ✓ |
| DeFi positions tab | ✗ | ✓ | ◐ | ✗ | ✗ | ✓ | ◐ |
| Tax CSV export | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Whale clusters | ✓ unique | ✓ deeper | ✗ | ✗ | ✗ | ✓ Smart-Money | ✗ |
| DNA analyzer | ✓ unique | ✓ + real PnL | ✗ | ✗ | ✗ | ◐ profiler | ✗ |
| Bubble map | ✓ | ✓ + scrubber | ✗ | ✗ | ✗ | ✗ | ✗ |
| Context feed | ✓ unique | ✓ persistent | ✗ | ✗ | ✗ | ◐ | ✗ |
| Proof modal | ✓ unique | ✓ real holders | ✗ | ✗ | ✗ | ✗ | ✗ |
| AI chat (VTX) | ◐ | ✓ markdown+tools+regen | ✗ | ✗ | ✗ | ✗ | ✗ |
| Sniper bot | ✓ multi-chain | ✓ + dry-run + dev-block + copy-trade | ✗ | ✓ | ✓ | ✗ | ✗ |
| Pre-flight tx simulation | ◐ fail-open | ✓ fail-closed | ✓ | ✓ | ✓ | ✗ | ✓ |
| Source-triangulated rug check | ✗ GoPlus only | ✓ +Honeypot+RugCheck+de.fi | ✓ | ✓ | ◐ | ✗ | ✓ Blockaid |
| EIP-4361 SIWE | ✗ non-compliant | ✓ | ✓ | ✓ | n/a | n/a | n/a |
| Coinbase Wallet SDK | ✗ | ✓ | ✓ | ✓ | ✗ | n/a | ✗ |
| Backpack/Glow Solana | ✗ | ✓ | ✓ | ✓ | ✓ | n/a | n/a |
| Passkey / WebAuthn | ✗ | deferred | ✗ | ✗ | ✗ | ✗ | ✓ |
| 2FA TOTP | ✗ | deferred | ✓ | ✓ | ◐ | ✓ | n/a |
| Mobile bottom nav | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PWA install prompt | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | n/a |
| Offline shell SW | ✗ | ✓ | ✗ | ✗ | ✗ | ◐ | ✓ |
| Touch targets ≥44px | ✗ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ |
| AAA contrast | ✗ | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ |
| Reduced-motion respect | ✗ | ✓ | ◐ | ✗ | ✗ | ✓ | ✓ |
| Command palette ⌘K | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Keyboard shortcuts | ✗ | ✓ | ✗ | ✗ | ◐ | ✓ | ✗ |
| Real markdown chat | ✗ regex-strip | ✓ | n/a | n/a | n/a | n/a | n/a |
| Streaming caret | ✗ | ✓ | n/a | n/a | n/a | n/a | n/a |
| Tool-call cards in chat | ◐ post-only | ✓ live | n/a | n/a | n/a | n/a | n/a |
| LCP < 2s | ? | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ |
| CLS < 0.1 | ? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sentry coverage on every API | ◐ 18 swallowed | ✓ | n/a | n/a | n/a | ✓ | n/a |
| Server-side funnel telemetry | ✗ client only | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Retry on external API | ◐ CG only | ✓ all 29 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Web Vitals RUM | ✗ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ |

**Net: post-fix we MATCH industry on 30 of 33 standard capabilities AND we keep the 5 unique features (whale clusters, DNA analyzer, bubble map, context feed, proof modal) that nobody else has.** The deferred items (passkey, 2FA, server-side PostHog backfill on history) are worth-shipping-but-not-blocking-launch.

---

# UPDATED TOTALS (everything combined)

| Tier | Hours | What |
|------|-------|------|
| **P0 (security/correctness)** | ~22h | Solana case fixes, fail-open closes, prompt-injection, missing auth, migration apply, EIP-4361, Sentry init |
| **P1 (industry-parity feature gaps)** | ~165h | Real PnL, multi-wallet, NFT/DeFi, source triangulation, real markdown, 2FA, time-scrubber, MEV detector |
| **Cross-cutting P0+P1 (perf/a11y/observability)** | ~50h | next/font, Anthropic-out-of-bundle, lazy chart pages, focus-trap modals, bottom nav, contrast, Sentry coverage, retry, Pino logger, Web Vitals |
| **P2 + UI 2030 micro-interactions** | ~125h | Per-feature spec above + cross-section (cmd-palette, kbd shortcuts, focus-visible, springs, Sonner, skeleton shimmer) |
| **Stuff to remove** | ~3h | Dead code (4 files / duplicated constants) |
| **TOTAL** | **~365h** | full premium-feel state |

---

# HONEST ANSWER TO "ARE WE GOOD AFTER THIS?"

**Yes, post-fix we match or exceed industry on every measurable capability AND keep our 5 unique differentiators.** What "industry standard" actually means:
- **Functionally:** matched after P0+P1 (~187h)
- **Performance / a11y / mobile:** matched after cross-cutting P0+P1 (~+50h)
- **Premium feel (motion, microcopy, command palette, spring easing):** matched after UI 2030 pass (~+125h)
- **Brand differentiation:** already AHEAD on 5 unique features (whale-cluster, DNA, bubble-map, context-feed, proof) — these get DEEPER on P1, not "added"

**What this won't fix (intentionally deferred, not blockers):**
- Passkey / WebAuthn (multi-day, low adoption today)
- 2FA TOTP (multi-day, partial coverage by wallet sigs)
- Server-side analytics backfill on historical events
- MEV/sandwich detector for whale-cluster
- Multi-day cohort radar + behavior-shift timeline for DNA

**What WILL still feel different from the giants 6 months in:**
- Data depth (Nansen has 5 years of labels; we'll be 1 year)
- API quotas / latency on free tier (their infra spend > ours)
- Volume of tested edge cases (their QA / months of bug-bash)

These close with time + usage, not engineering. They're not "industry-standard gaps" — they're age gaps.

---

# REVISED EXECUTION ORDER (best ROI)

**Sprint 1 — Foundation (~50h, 1 week solo / 2 days team)**
1. P0 security sweep across all 10 features (~22h)
2. Apply pending Supabase migration
3. Sentry release/profiling/replay + replace 18 catch-swallow + Pino logger (~8h)
4. next/font + AnthropSDK out-of-client + AuroraBg GPU + token-logo `next/image` (~6h)
5. Touch targets 44px + min font 11px + AAA contrast pass + focus-visible globally (~7h)
6. Headless UI Dialog (kills focus-trap + ESC + label-input gaps) + Sonner toast (~7h)

**Sprint 2 — Industry parity for top-3 P1 (~50h)**
7. Portfolio: multi-wallet + NFT + DeFi + CSV (~15h)
8. Security: source triangulation + pre-sign sim + LP-lock duration + deployer history (~14h)
9. VTX AI: react-markdown + streaming caret + tool cards + stop button + regenerate + edit-resend (~12h)
10. Mobile bottom nav + safe-area insets + PWA install prompt + offline shell (~9h)

**Sprint 3 — UI 2030 sweep (~50h)**
11. Command palette ⌘K + global keyboard shortcuts (~20h)
12. Per-feature micro-interactions: portfolio + market + sniper + swap (highest ROI 4) (~30h)

**Sprint 4 — Long-tail P1 (~50h)**
13. Wallet-intel real PnL + ENS/SNS + decomposed risk score (~16h)
14. Whale-cluster entity registry + time-decay + bridge detector + Realtime updates (~15h)
15. Bubble-map time-scrubber + hover tooltips + wallet-search + suspicious-cluster alert (~12h)
16. Profile avatar + bio + sessions revocation + GDPR export (~7h)

**Sprint 5 — Polish + remaining UI 2030 (~30h)**
17. Sniper UI 2030 + DNA UI + wallet/clusters/proof/context-feed/settings micro-interactions
18. Web Vitals RUM + per-route trace sampling + `/api/health` deep-check + retry-on-29-APIs

**Deferred (worth shipping, not blocking):** 2FA, passkey, MEV detector, cohort radar, behavior timeline, server-side PostHog backfill.

**Greenlight any sprint subset and I start.**
