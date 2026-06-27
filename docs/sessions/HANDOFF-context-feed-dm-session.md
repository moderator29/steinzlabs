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

## Still REMAINING
1. **Whale Tracker** — 40-agent audit found the core is dead: `whale_activity` ingestion stopped 45 days ago, **every `value_usd` is NULL**, table not in realtime publication, no alert dispatcher, dead/duplicate component stacks, tier-gate mismatch. Full report: `/tmp/.../tasks/w66sgfpfq.output` (also summarized in chat). **This is the next session's primary job.**
2. **Audit the 4–5 new feed features** built this session for correctness, pipeline strength, backend robustness (see follow-up prompt).
3. **Merge `feat/glass-card-and-button-system`** so everything goes live.

## Notes
- Remote merged-branch deletion is blocked (git creds can push but not delete refs; GitHub MCP has no delete-ref). Owner must delete merged branches from the GitHub Branches page.
- Session rate limits resered intermittently; workflows >~20 agents may hit the cap — prefer direct builds when limited.
