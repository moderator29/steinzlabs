# Session Handoff — Context Feed wave, DMs, Sniper docs

**Branch:** `feat/glass-card-and-button-system` (NOT merged — `nakalabs.xyz` runs `main`, so none of this is live until the owner merges).

## Shipped this session (all build-tested + pushed)

### Context Feed
- **Filters rebuilt** (`lib/contextFeed/filter.ts`, `components/ContextFeed.tsx`, `app/api/context-feed/route.ts`): correct taxonomy — News = informational events; Coins/New Coins/Trending = discovery; **Volume = metric-based** (`matchesEventFilter`, real 24h volume, sorted). Killed the client double-filter. Coins-first **and ETH-first** default mix.
- **ETH-first ranking + pump.fun demotion** (`scoreEvent`): chain weights (eth 35 ▸ … ▸ solana 6) + −45 pump penalty; pump.fun capped to top 5 @ $50k floor.
- **Real new coins all chains**: GeckoTerminal `new_pools` wired in (`fetchGeckoTerminalNewPairs`).
- **Birdeye Solana** trending-by-volume source (`fetchBirdeyeSolana`).
- **Smart-money labels** from our own `whales` table (`getKnownWhales` + `applySmartMoneyLabels`) — free, replaces dead Arkham.
- **AI Market Pulse** card (`/api/context-feed/pulse` + `MarketPulseCard`) — DB-cached in `market_pulse` table, regenerates ~3×/day (8h TTL) to cap Anthropic spend.
- **Per-user feed alerts** (`feed_alerts` table, `/api/context-feed/alerts`, `feed-alert-monitor` cron in the `frequent` dispatch group, `FeedAlertsButton`) — matches live feed → writes `notifications` rows → real-time bell.
- **View Proof**: native-token buy + real contract; `SecurityPanel` (liquidity-lock %, holders, top-holder %, tax, honeypot) via public `/api/context-feed/security`.
- Server now emits real `tokenAddress` on dex/pump/rug/birdeye events.

### DMs (`app/dashboard/messages/[peerId]/page.tsx` + conversations/messages APIs)
- **Plaintext-first, X-style, never blocks**: opens instantly (no WASM/peer-key stall), works unencrypted when peer has no key (empty-`iv` sentinel, `'plain'` conversation key). Existing encrypted threads still decrypt.
- Full-page layout (fixed header + scroll + pinned composer), small back button, header → profile, empty-state peer card + glass "View Profile", Encrypted/Unencrypted badge, optimistic send. Naka branding (neon sent bubbles, glass received).

### Market + Docs
- Market category filters → rectangular, smaller, glass blue-stride (`MarketDashboard.tsx`).
- Docs: Context Feed "Intelligence Sources" section + full **Sniper Bot** docs (non-custodial EIP-712 system, EVM scope, full feature grid).

## Migrations applied (live DB `phvewrldcdxupsnakddx`) + mirrored to `supabase/migrations/`
- `2026_market_pulse_cache.sql` — `market_pulse` singleton.
- `2026_feed_alerts.sql` — `feed_alerts` (RLS per-user).

## Naka Wallet — shipped this session
- Glass blue-stride action buttons (Send/Receive/Swap/Buy) + rectangular glass chain-filter pills.
- Removed NSFW (Pleasure Coin) default token + the cloned "ETH staking active" pill.
- `WalletTokenRow` shows the real live price (sparkline last point) instead of `—` on zero-balance wallets.
- **Multi-step Send flow** (`SendView`, app/dashboard/wallet-page/page.tsx): form (address + amount, MAX, ≈USD, HARD >balance guard) → confirm (from/to/network/fee) → password (dedicated, inline wrong-password) → processing → sent (Pending, recipient, fee, nonce, confirmations, View-on-block-explorer). Captures real tx nonce + hash. Glass blue-stride.
- DM thread render fixed (fixed inset-0 overlay; was clipped by dashboard chrome).

## Naka Wallet — REMAINING (precise, for continuation)
References (Trust Wallet, user-supplied): tabs 1472, manage-tokens 1474, import-token 1485, send 1486-1491.
1. **Add Token on-chain auto-fetch** — `AddTokenView` (~page.tsx:2134-2331): on contract paste, auto-fill Name/Symbol/Decimals via on-chain read (ERC-20 name()/symbol()/decimals() or Alchemy/DexScreener) like Trust's Import crypto (1485). Keep GoPlus scan.
2. **Manage/Customize tokens page** — new tab (Trust 1474): list tokens with on/off toggles + network filter + search, on-chain fed, persisted to the custom-token list. The "Customize" tab + "Watchlist" tab should join Holdings/NFTs/Activity (Trust 1472).
3. **Coin detail chart rebuild** — `app/dashboard/wallet-page/coin/[chain]/[address]/page.tsx`: make the chart actually work like Trust — real OHLC with 1H/1D/1W/1M/1Y timeframes (wire to `/api/market/token/{address}/chart` or GeckoTerminal/Birdeye), and show that token's transactions on the page. Send/Receive/Swap already wired; just the chart + tx list. (Staking pill already removed.)
4. **NAKA dedupe + real logo** — screenshot showed two NAKA rows; ensure the seed token isn't duplicated against an on-chain-detected NAKA, and the logo resolves.
5. **Icons** — flatten any remaining 3D icons (settings/refresh/copy) to match the flat brand set.

## Still REMAINING (other)
1. **Whale Tracker** — 40-agent audit found the core is dead: `whale_activity` ingestion stopped 45 days ago, **every `value_usd` is NULL**, table not in realtime publication, no alert dispatcher, dead/duplicate component stacks, tier-gate mismatch. Full report: `/tmp/.../tasks/w66sgfpfq.output` (also summarized in chat). **This is the next session's primary job.**
2. **Audit the 4–5 new feed features** built this session for correctness, pipeline strength, backend robustness (see follow-up prompt).
3. **Merge `feat/glass-card-and-button-system`** so everything goes live.

## Notes
- Remote merged-branch deletion is blocked (git creds can push but not delete refs; GitHub MCP has no delete-ref). Owner must delete merged branches from the GitHub Branches page.
- Session rate limits resered intermittently; workflows >~20 agents may hit the cap — prefer direct builds when limited.
