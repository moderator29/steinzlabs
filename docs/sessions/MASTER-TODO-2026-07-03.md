# Master TODO — Naka Labs platform (from 40-agent audit 2026-07-03)

Prioritised backlog in plain English. **31 P0 / 114 P1** across 40 features.
Already shipped this session are struck as ✅. Everything else is open, owner picks order.

## P0 — broken core flows / cost & security holes

### admin-panel
- [ ] Audit log records NOTHING for any real admin action. admin_audit_log has CHECK (action IN ('set_tier','set_role','ban','unban','delete','other')) and no later migration relaxes it, but logAdminAction and its ~40 call sites write disallowed strings (feature_flag.toggle, user.impersonate, admin.totp.enroll, announcement_create, broadcast_send, settings_update, wallet_label_set, support_reply, research_publish, social_moderation, whale_submission_approve, etc.). Every INSERT violates the CHECK and throws; logAdminAction swallows it in an empty catch. The append-only trail the audit-log page promises is permanently empty.  
  `supabase/migrations/2026_admin_audit_log.sql:17 (CHECK) vs lib/auth/adminAuth.ts:151-160 (insert + swallow); action strings enumerated across app/api/admin/*`
- [ ] Audit-log VIEWER page is always 401. app/admin/audit-log/page.tsx:52 fetches /api/admin/audit-log with NO Authorization header, but that route authenticates via Supabase COOKIE session + profiles.role='admin' (app/api/admin/audit-log/route.ts:11-35). The admin UI logs in with a static bearer in sessionStorage and has no Supabase auth cookie, so getUserId() returns null and the page shows the error banner. Doubly dead given the empty table above.  
  `app/admin/audit-log/page.tsx:52 (no header) + app/api/admin/audit-log/route.ts:33-36`
- [ ] Static bearer (the ONLY UI login) never writes any audit row: logAdminAction returns early when ctx.staticBearer is true (lib/auth/adminAuth.ts:143). So even if the CHECK constraint were fixed, UI-driven actions log nothing because the UI can only auth as the static bearer.  
  `lib/auth/adminAuth.ts:143`

### approvals-signature-mev
- [ ] MEV risk pill is fed a token SYMBOL, not a contract address. Swap page fetches /api/mev-protection?token=${toToken} where toToken is a symbol like 'USDC' (app/dashboard/swap/page.tsx:1411; toToken state = 'USDC' at page.tsx:597). The MEV service passes it straight into Alchemy contractAddresses:[tokenAddress] (lib/services/mev.ts:227), which is not a valid address, so transfers come back empty and sandwichRisk defaults to 0. The pre-trade MEV pill therefore shows ~0/100 for virtually every real swap — the feature does not function as displayed.  
  `app/dashboard/swap/page.tsx:1411 + lib/services/mev.ts:222-246`
- [ ] MEV protect toggle is unwired server-side. The Settings toggle advertises 'Routes via private mempool (Flashbots / Jito) to block sandwich bots' (app/dashboard/swap/page.tsx:580) and shows a 'Protected' badge (page.tsx:2140), but mevProtect is only ever passed to /api/market/trade/execute, whose handler destructures the body WITHOUT mevProtect and never references Flashbots/private RPC (app/api/market/trade/execute/route.ts:55). The primary 0x EVM path sends via plain eth_sendTransaction to the user's public RPC (page.tsx:1192-1197). No private-mempool wiring exists anywhere.  
  `app/api/market/trade/execute/route.ts:55 (mevProtect ignored) + app/dashboard/swap/page.tsx:1106,1196`

### archive-proof-preview
- [ ] Share link retrieval is broken on serverless. /api/share stores short-ids in a module-level in-memory Map (shareStore). On Vercel the POST that mints /s/<id> and the later GET /api/share?id=<id> almost always hit different lambda instances (or a cold start), so retrieval returns 404 and /s/[id] renders 'Share Not Found'. Every copied short-link is effectively dead once the origin lambda recycles.  
  `app/api/share/route.ts:5,37-42,56-72 (Map + POST mint + GET by id); consumed by components/ContextFeed.tsx:92 and app/s/[id]/page.tsx:25`

### bridge
- [ ] execute insert uses source_reason='bridge' but the pending_trades CHECK constraint permits no 'bridge' value in either constraint version (session5b2 allows only limit_order/dca/stop_loss/take_profit/trail_stop/copy_trade/vtx_chat; 06_27 adds sniper_* but still no bridge). The insert always violates the constraint, returns 500, and no bridge is ever recorded. Because the client calls execute as fire-and-forget (void fetch), the user never sees the failure.  
  `app/api/bridge/execute/route.ts:68 vs supabase/migrations/2026_session5b2_vtx_chat_reason.sql:13-18 and 2026_06_27_pending_trades_allow_sniper_sources.sql:13`
- [ ] No ERC20 approval/allowance step. LiFi requires an approve() to estimate.approvalAddress before the bridge tx for any non-native token, but the page only sends the single transactionRequest. Bridging any ERC20 (incl. USDC/USDT) reverts because the LiFi contract cannot pull tokens. approvalAddress is typed in LifiQuote.estimate but never read.  
  `app/dashboard/bridge/page.tsx:156-161; lib/services/lifi.ts:70 (approvalAddress defined, unused)`

### bubble-map
- [ ] EVM holder fetch ignores the selected chain — getTopERC20Holders takes no chain param and always hits api.ethplorer.io (Ethereum-only). For BSC/Base/Arbitrum/Polygon token addresses it returns [] , so the graph shows the empty 'No holder data available' state. 4 of the 6 chains in the dropdown produce no bubble map.  
  `lib/services/etherscan.ts:190-201 (no chain arg, hardcoded api.ethplorer.io) called at lib/services/contract-intelligence.ts:135 with only (address,20); CHAIN_OPTIONS advertises bsc/base/arbitrum/polygon at app/dashboard/bubble-map/page.tsx:103-107`
- [ ] Solana fallback holder percentages are wrong and addresses are token accounts, not owners. getTokenLargestAccounts returns the top-20 SPL token accounts and percentage is computed relative to the SUM OF THOSE 20, not circulating supply — so the top-20 always sum to ~100% and topHolderConcentration (top-5) is massively inflated. This path runs whenever Birdeye returns nothing (i.e. no paid Birdeye key).  
  `lib/services/alchemy-solana.ts:229-239 (percentage = uiAmount/sum-of-top-20; a.address is the token account); consumed at lib/services/contract-intelligence.ts:364-376`

### copy-social-trading
- [ ] Live DB status CHECK constraint on user_copy_trades allows only ('pending','success','failed','cancelled','expired','alert') — verified via live SQL — but /api/copy-trading/execute writes 'blocked_rule'/'blocked_security': every recordBlocked() insert silently fails (error never checked), so blocked attempts leave NO record; worse, when the relayer security-blocks after claim, the UPDATE to 'blocked_security' also fails and the claimed row stays 'pending', consuming the user's rolling 24h daily cap for a trade that never happened (claim_copy_trade counts 'pending')  
  `app/api/copy-trading/execute/route.ts:100-118,332-335 vs supabase/migrations/2026_session5b2_phase0_relayer.sql:90-92 (constraint replaced, blocked_* dropped) vs 2026_session5b1_batch2.sql:151`
- [ ] Matcher generic-failure branch never updates the claimed user_copy_trades row — on any non-security relayer failure (no route, insert error) the row stays 'pending' forever; pending-trades-cleanup can't expire it because no pending_trades row exists, so each failure permanently eats daily-cap budget for 24h and shows an eternal 'pending' in the UI  
  `lib/copy/matcher.ts:371-376 (only Sentry + counters, no status update) vs execute/route.ts:332-335 which does update; cleanup only walks pending_trades (app/api/cron/pending-trades-cleanup/route.ts)`

### crons-pipelines
- [ ] recompute-reputation NEVER runs via the scheduler. The daily dispatcher fans out with header `authorization: Bearer <CRON_SECRET>`, but recompute-reputation validates `x-cron-secret` header OR `?secret=` query param instead — neither is sent — so it returns 403 Forbidden on every daily tick. Reputation scores/ranks are never recomputed. It also ignores CRONS_PAUSED (no verifyCron).  
  `app/api/cron/recompute-reputation/route.ts:22-24 (reads x-cron-secret/?secret) vs app/api/cron/dispatch/[group]/route.ts:99 (sends authorization Bearer only)`

### naka-wallet
- ✅ Wrong-chain balances: /api/wallet-intelligence silently falls back to Ethereum for any chain not in EVM_CHAIN_CONFIG (only 6 chains mapped). Selecting Optimism, Fantom, Cronos, Linea, Scroll, zkSync, Mantle, Blast, etc. (all offered in Add Network, page.tsx:135-159) shows ETHEREUM holdings and totals labeled as that chain — balance accuracy is wrong, exactly the owner's complaint  
  `app/api/wallet-intelligence/route.ts:275 (EVM_CHAIN_CONFIG[chainParam] ? chainParam : 'ethereum') + lib/services/evm-intelligence.ts:10-22 (only ethereum/base/polygon/avalanche/arbitrum/bsc) + app/dashboard/wallet-page/page.tsx:586`

### navigation-back-sweep
- [ ] SYSTEMIC ROOT CAUSE: BackButton with no href is supposed to go back but uses document.referrer to decide. Next.js client-side navigations (router.push/Link) never update document.referrer, so for normal in-app navigation internalReferrer is false and the guard `internalReferrer && window.history.length>1` fails, dropping to router.push('/dashboard') on line 45. Plain <BackButton /> therefore dumps the user on /dashboard instead of the page they came from — the exact owner bug, still live. The correct smartBack() depth counter already exists but BackButton ignores it.  
  `components/ui/BackButton.tsx:20-46 (referrer check 26-39, fallback push 45); smartBack.ts:4-9 documents this same bug`

### onboarding
- [ ] Two separate first-run overlays mount at the same z-[200] on a brand-new user's dashboard: OnboardingGate (10-card flow, gated on DB onboarding_completed_at) AND the dashboard FirstRunTour 3-step modal (gated only on localStorage naka_tour_done). A first-time visitor with empty localStorage and null onboarding_completed_at sees BOTH stacked simultaneously.  
  `app/dashboard/page.tsx:457 (FirstRunTour) and app/dashboard/page.tsx:565 (OnboardingGate); both z-[200] at components/dashboard/FirstRunTour.tsx:76 and components/onboarding/OnboardingFlow.tsx:134`

### pricing-tiers
- [ ] No payment path exists for any paid tier. All 'Get Mini/Pro/Max' buttons just fire toast.info('Crypto payment integration coming soon'). No Stripe checkout, no crypto-payment flow, no webhook to set a tier. Self-serve upgrade is impossible; the entire pricing page's purchase function is non-operational.  
  `app/dashboard/pricing/page.tsx:98-101`
- [ ] Stripe is a package dependency but is NEVER imported or used in any app/lib code. Zero grep hits for `new Stripe`, `from 'stripe'`, `STRIPE_`, or a checkout/webhook route. tier_source='stripe' is referenced only in a code comment with no implementation.  
  `app/api/user/tier/route.ts:52 (comment) — no Stripe usage anywhere in app/ or lib/`

### research-labs
- [ ] Schema/code mismatch: the public list selects 'summary' and 'view_count' and filters .eq('published', true), but the canonical research_posts table has NO published, summary, or view_count columns (it defines status TEXT, excerpt, cover_image). No repo migration adds published/summary/view_count. If the live DB was not hand-patched, this query errors and route.ts:44-46 silently returns {posts:[],total:0} — the entire Latest Research grid is permanently empty, and the daily-brief upsert (which writes published+summary) would also error, publishing nothing.  
  `app/api/research/route.ts:34,36 (select summary,view_count + .eq('published',true)) vs supabase/migrations/20260413_full_schema.sql:626-640 (only status/excerpt/cover_image); no migration adds those columns`

### security-center
- [ ] No producer ever writes security_alerts, approval_audit_results, or user_token_security_flags — they are only READ. LiveThreatFeed is therefore permanently empty for all users, and the health score's approvals/threats/honeypots sub-scores are always 100 (decorative). Composite score is effectively reputation-only.  
  `grep shows security_alerts referenced only in health/route.ts:82, threats/route.ts:40 (reads); approval_audit_results & user_token_security_flags only in health/route.ts:70,94 (reads); zero inserts anywhere`
- [ ] ShadowGuardian (wallet-analysis page + scan-trade route) depends on Arkham Intelligence, a PAID API (api.arkm.com, ARKHAM_API_KEY) not in the owner's free-tier matrix. Without the key getTokenHolders throws and scanTrade returns BLOCKED 'Cannot verify token holders', so wallet-analysis fails for every input.  
  `lib/arkham/api.ts:14 (ARKHAM_API_KEY), :15 (api.arkm.com); lib/security/shadowGuardian.ts:2,11-30; app/dashboard/security/wallet-analysis/page.tsx:7`

### sniper
- [ ] Webhook (low-latency) matching path is structurally dead. Alchemy events set chain = ev.network.toLowerCase() which yields 'eth_mainnet'/'base_mainnet' — never the 'ethereum'/'bsc'/'avalanche' slugs stored in sniper_criteria.chains_allowed, so matcher's .contains('chains_allowed',[chain]) matches zero criteria. Helius events set chain='solana', but the UI only allows EVM chains on criteria (NewSniperModal.tsx:50). Net: no webhook event can ever fire a rule; the only working detection is the 2-minute cron, contradicting the 'sub-second' design.  
  `app/api/webhooks/sniper-detect/route.ts:73 + lib/sniper/matcher.ts:112 + app/dashboard/sniper/NewSniperModal.tsx:50`
- [ ] price_target trigger is a fake feature: users can build it in the UI (with live preview chart) and it persists, but no code evaluates it — matcher.ts triggerAliases only maps new_token_launch/whale_buy (price_target criteria are skipped), and sniper-monitor explicitly punts ('price checks require a price feed integration'). A user's Price Target sniper will never fire, ever.  
  `app/dashboard/sniper/NewSniperModal.tsx:336,353-384; lib/sniper/matcher.ts:156-167; app/api/cron/sniper-monitor/route.ts:334-335`

### support-cs-ai
- [ ] Admin reply button is fully broken and writes to the wrong table. app/admin/support/page.tsx:77 sends the reply to /api/admin/support-tickets/reply, whose handler reads/writes the legacy support_conversations JSONB table, NOT ticket_replies. So (a) admin replies never appear in the user's ticket thread (user detail page reads ticket_replies), and (b) the .single() fetch on a support_tickets UUID that has no support_conversations row errors -> 500. The correct handler already exists at the sibling POST /api/admin/support-tickets.  
  `app/admin/support/page.tsx:77, app/api/admin/support-tickets/reply/route.ts:27-45`

### swap
- ✅ Main swap page quote pipeline is dead: client checks data.buyAmount and reads data.estimatedPriceImpact / data.gas, but /api/swap/price was refactored to return toAmount (human) / priceImpactPct / no gas — the condition is never true, so 'You receive' never populates, quoteData stays null, and the details panel, order-routing panel, USD readouts, and MEV pill never render  
  `app/dashboard/swap/page.tsx:789-804 vs app/api/swap/price/route.ts:116-131 (EVM) and 78-94 (Solana) — no buyAmount key in either response`
- ✅ Solana swap execution throws on every attempt: Jupiter buildSwapTransaction does not set asLegacyTransaction, so it returns a base64 VersionedTransaction, but both signers deserialize with legacy Transaction.from(), which throws on version-prefixed messages  
  `lib/services/jupiter.ts:166-186 (no asLegacyTransaction) vs app/dashboard/swap/page.tsx:1026-1029 and lib/hooks/useSwapBroadcast.ts:315-318 (Transaction.from)`
- [ ] Selecting a non-0x route (1inch/Kyber/OpenOcean) always fails: handleSwap posts {taker, fromToken, toToken} but /api/market/trade/execute requires tokenIn/tokenOut/amountIn/walletAddress -> 400 'Missing required fields'; even if fields matched, RouteQuote.raw contains quote-only data (no calldata — services call /quote endpoints, never /swap or route/build), and the server returns {transaction} while the client only checks out.txHash and never signs/broadcasts; the success path's early return also skips setSwapping(false), stranding the spinner  
  `app/dashboard/swap/page.tsx:920-941,1193 vs app/api/market/trade/execute/route.ts:55,66-68,124-147; lib/services/oneinch.ts:31, lib/services/kyberswap.ts:31, lib/services/openocean.ts:29 (quote-only URLs)`
- [ ] RouteComparison feeds token SYMBOLS + human amounts into /api/swap/routes, but getAllRoutes forwards them raw to 1inch/Kyber/OpenOcean which require contract addresses and base units — 1inch additionally 401s without ONEINCH_API_KEY (absent from .env.example) — so the 'best-of-3 routes' panel almost always shows 'No alternative routes found' or wrong-magnitude numbers  
  `components/swap/RouteComparison.tsx:44-48 (sends fromToken='ETH', amountIn='0.5'), lib/services/swap-aggregator.ts:98-160 (no symbol/decimals resolution), lib/services/oneinch.ts:29-31; grep of .env.example shows no ONEINCH_API_KEY`

### vtx-agent
- ✅ Client-controlled rate-limit bypass: request body field skipRateLimit is trusted verbatim — any anonymous caller can POST {"skipRateLimit": true} to /api/vtx-ai and get unlimited free Claude (Sonnet 5 + Opus 4.8 advisor) on the owner's Anthropic bill. No legitimate caller anywhere in the repo sends this field.  
  `app/api/vtx-ai/route.ts:453,565,808,886`

### whale-tracker
- [ ] Feed freshness: whale_activity ingestion runs in the half-hourly dispatch group at only 14 whales/tick via Alchemy (≈672 whale-polls/day over a 500+ row directory ⇒ a given whale is re-polled roughly every 18h), while the UI empty state claims 'The background poll populates this feed every minute'. The faster Bitquery ingest (24 whales/tick) no-ops without BITQUERY_API_KEY.  
  `app/api/cron/dispatch/[group]/route.ts:34 (half-hourly), app/api/cron/whale-activity-poll/route.ts:31 (WHALES_PER_TICK=14), app/dashboard/whale-tracker/page.tsx:577-579 (false 'every minute' claim), app/api/cron/bitquery-activity-poll/route.ts:47-50 (key gate)`
- [ ] PnL accuracy: whale-backfill-pnl cannot distinguish 'Arkham API failed/key missing' from 'whale had no transfers' — getAddressTransfers errors are swallowed to [], and the cron then writes pnl_30d_usd=0, win_rate=null, and last_active_at=NULL over real values and stamps metrics_refreshed_at so the corruption persists 24h+. With no ARKHAM_API_KEY every whale gets zeroed.  
  `app/api/cron/whale-backfill-pnl/route.ts:189 (.catch(() => [])), :313-320 (unconditional overwrite incl. last_active_at: metrics.last_active_at which is null on empty transfers)`

## P1 — degraded / important

### admin-panel
- [ ] Nine admin pages fetch WITHOUT the bearer header their backends require, so they 401/blank under the standard static-bearer login: revenue (->/api/analytics/admin needs verifyAdminContext, app/admin/revenue/page.tsx:65), search-logs (app/admin/search-logs/page.tsx:37), onboarding-analytics (:16), so
- [ ] Root /admin page requires a DIFFERENT auth than the rest of the panel. app/admin/page.tsx:287-320 gates on supabase.auth.getSession() + profiles.role='admin' and uses the Supabase session access_token as bearer (:302). But the wrapping AdminLayout only ever authenticates the static ADMIN_BEARER_TOKE

### alerts-notifications
- [ ] Server-fired alerts NEVER push to Telegram in real time. fanOutNotification (the path every cron-fired alert uses) dispatches in-app + Discord + SMS + email but has no Telegram branch at all; the comment punts to 'the existing telegram-heartbeat path' which is only a health-check cron, not a deliver
- [ ] Non-price smart alerts and composite alerts reach Telegram by NO path whatsoever. evaluateSmartAlerts only sets triggered=true for one-shot price alerts; whale/launch/wallet_activity fire repeatedly without stamping triggered. The digest cron selects only alerts WHERE triggered=true, so whale/launch
- [ ] Discord + SMS notification channels have no UI. No component references /api/notifications/channels or user_notification_channels, so users cannot enter a Discord webhook or SMS phone through the app. fanOutNotification reads those rows but they can only be created via direct API calls, making both 

### archive-proof-preview
- [ ] /s/[id] share landing is a client component doing a client-side fetch with no generateMetadata/openGraph, so social crawlers (Twitter/Telegram/Discord) receive an empty shell and no unfurl. There is no server-rendered title/description/image for shared events.

### auth-walletconnect
- [ ] WalletAuthButton calls wagmi hooks useAccount/useSignMessage/useDisconnect and useAppKit unconditionally, BEFORE the `if (!HAS_APPKIT) return null` guard. When NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is unset, WalletProviders renders NO WagmiProvider (app/wallet-providers.tsx:49-51) and getAppKit() nev
- [ ] Turnstile is not enforced on the server for the actual auth mutations. Login calls supabase.auth.signInWithPassword({email,password}) client-side with NO captchaToken passed (app/login/page.tsx:258), and /api/auth/signup performs createUser with no captcha/turnstile check at all. The /api/auth/verif
- [ ] No rate limiting on /api/auth/wallet-nonce or /api/auth/wallet-verify. wallet-nonce is an unauthenticated INSERT into auth_wallet_nonces (DB write amplification / table flooding) and wallet-verify runs expensive admin paths (getUserById, entitlement chain calls, admin.createUser, generateLink) — all

### bridge
- [ ] Amount parsing hardcodes 18 decimals: parseUnits(amount, 18). For 6-decimal tokens (USDC/USDT) entering 100 sends 100e18 base units (100 trillion) to LiFi, yielding 'no route' or a nonsense quote. All stablecoin bridging is broken; only 18-decimal native tokens work.
- [ ] Status polling permanently halts on any non-2xx response: 'if (!res.ok) return;' returns without scheduling the next tick. LiFi /status frequently 502s or is unindexed right after broadcast (status route returns 502 when getLifiStatus is null), so the poll silently dies and the user is stuck on PEND

### bubble-map
- [ ] D3 force graph fully tears down (svg.selectAll('*').remove()) and re-runs the entire force simulation on every node selection AND on every keystroke in the 'Find wallet' box, because `selected` and `pinnedAddress` are in the effect dependency array. Bubbles reshuffle/fly on each click and each chara

### context-feed
- [ ] SSE permanently self-destructs: the server emits `event: error` frames on ANY transient upstream non-OK tick (events/route.ts:64-66,78), which dispatch as type-'error' events on the client EventSource and trigger es.onerror, which closes the stream and falls back to polling FOREVER with no reconnect
- [ ] SSE is per-connection self-polling, not fan-out: each connected client holds its own serverless function alive for 5 minutes, self-fetching /api/context-feed every 5s with the user's cookie. The header comment 'Multiple connected clients share one upstream tick' is false - N clients = N functions x 
- [ ] Fetch failures render as a fake-calm empty state: errors are swallowed with only a console.warn, loading is set false, and the UI shows 'No Events on X / Waiting for activity...' with a pulsing 'Live' dot - the user cannot tell a total outage from a quiet market. No error state, no retry affordance 
- [ ] DexScreener stampede with no rate-limit handling: one cache-miss 'all' refresh fires ~70+ DexScreener requests (12 ETH searches + profiles per chain across 8 chains at route.ts:1120-1192, 40 boost-search lookups at route.ts:1032-1040, 8 rug candidates x2 at route.ts:869-895, 6 social lookups at rout
- [ ] All CoinGecko-sourced events hardcode chain:'ethereum' - a trending SOL or BTC coin gets an ETH badge in the UI AND the ethereum +35 chain-rank boost in scoring, misattributing chain data on every gainer/trending/new-listing/top-10 card.

### contract-analyzer
- [ ] token-scanner Solana path depends on Birdeye, a NON-approved paid API requiring BIRDEYE_API_KEY; without the key birdSec is null and the whole Solana security scorecard silently degrades to DEX-market-signals-only (no mint/freeze/LP/holder flags)
- [ ] Contract Analyzer gives Solana tokens NO honeypot second opinion: reconcileHoneypot only combines GoPlus static + Honeypot.is (EVM-only), so every Solana token's verdict rests on GoPlus static alone even though a real, free, approved RugCheck fetcher already exists in the codebase

### copy-social-trading
- [ ] Whale-tracker watchlist and directory 'Copy' buttons deep-link to /dashboard/copy-trading?whale=...&chain=...&label=... but the copy-trading page ignores those params entirely — deepLink requires tx+token+action (page.tsx:77) and NewCopyRuleModal is opened with no initial props (page.tsx:392-394), s
- [ ] Tier contradiction: NewCopyRuleModal shows 'Alerts Only' as free-tier (required:'free') and the rules API's own comment says alerts_only is mini+, but POST /api/copy-trading/rules is wrapped in withTierGate('pro') — free/mini users see the mode unlocked, click Save, and get a raw 'upgrade_required' 
- [ ] Avalanche is selectable in the chain dropdown but has no USDC mapping in either execution path — a rule created on avalanche can never execute: manual execute fails with 'Unsupported chain', matcher silently blocks
- [ ] Rules for whales not already in the pipeline never fire: the Alchemy/Helius webhooks only match transfers against the curated `whales` table (alchemy-whale/route.ts:164) and the cron only replays activity for whales in user_whale_follows (copy-trade-monitor/route.ts:58-61); creating a rule (modal ac

### crons-pipelines
- [ ] daily-digest is a no-op stub. Scheduled in the daily dispatch group but the entire handler body is verifyCron() + cronResponse() with zero digest logic. No other daily-digest implementation exists in the repo. The 'daily digest' feature has no backend.

### dashboard-home
- [ ] PortfolioHeroCard (the first, defaultVisible 'hero' widget) NEVER renders for any user. It fetches /api/portfolio with no query params, but the route requires ?address and returns 400 without it, so res.ok is false, data stays null, and the card returns null. Even if an address were passed, the resp

### dna-analyzer
- [ ] Win Rate tile always renders 'N/A'. UI reads dna.aiAnalysis.metrics.timing but the API only ever returns metrics: { diversification } — the 'timing' key is never populated.
- [ ] Partner Wallets is a permanently dead feature. The API hardcodes partnerWallets: [] on every response, so Section 4's entire UI (PartnerWallet type, per-partner 'Analyze' buttons) never renders, yet the input-screen intro copy still advertises 'partner wallets'.
- [ ] Performance Metrics section over-promises: AIAnalysis type declares 5 metrics (diversification, timing, riskManagement, consistency, conviction) but the API supplies only diversification, so the metrics bar list (Object.entries) always renders exactly one bar.
- [ ] Orphaned duplicate page. app/dna-analyzer/page.tsx is not linked from anywhere (sidebar, profile, whale-tracker all point to /dashboard/dna-analyzer) and depends on Arkham (getAddressIntel -> ARKHAM_API_KEY), a paid off-matrix API. It renders a scammer/scamHistory UI that only ever populates if Arkh

### geo-stream-misc-apis
- [ ] Admin revenue dashboard can NEVER load: frontend fetches /api/analytics/admin with no Authorization header, but backend requires Bearer via verifyAdminContext (returns 403). Page permanently shows 'No analytics data available'.
- [ ] /api/game-scores stores the entire leaderboard in a module-level in-memory Map. On serverless/Vercel this is per-instance and wiped on every cold start — scores never persist and are not shared across instances. Leaderboard is effectively non-functional.

### glass-brand-consistency
- [ ] Broken Tailwind opacity-modifier idiom on custom class: className="nl-glass/50" (also /40, /30, /60). Tailwind only generates opacity modifiers for registered utilities; .nl-glass is a hand-written CSS class whose background is a gradient, so the token 'nl-glass/50' matches NO CSS rule. These elemen

### i18n-a11y
- [ ] Skip link is broken: app/layout.tsx:175 renders <a href="#main"> ('Skip to main content', comment claims 'a11y P0' WCAG 2.4.1) but NO element with id="main" exists anywhere in app/ or components/ (grep for id="main" returns zero; no <main> tag carries the id). Keyboard/SR users activating the skip l
- [ ] html lang is hardcoded 'en' and never updated on language switch. AutoTranslate.onLang only sets document dir (AutoTranslate.tsx:180), never lang. So when content is visually Spanish/Arabic, screen readers still announce it as English (WCAG 3.1.1/3.1.2 failure).
- [ ] components/ui/LanguageSwitcher.tsx is a DEAD button: it writes localStorage key 'steinz_locale' and dispatches CustomEvent('localeChange') (lines 7,54) but nothing in the codebase ever reads that key or listens to that event (grep confirms only self-references). It also does NOT touch the working 'n
- [ ] ~12 dialog/modal surfaces render role="dialog"/aria-modal but do NOT use useFocusTrap: app/admin/users/page.tsx, app/vault/conclave/CreateProposalModal.tsx, app/dashboard/wallet-page/page.tsx, components/ui/NotificationCenter.tsx (comment mentions 'focus trap' but never calls the hook), components/l

### landing-discover
- [ ] Landing 'Tokens Analyzed' and 'Rugs Detected' counters are permanently 0: nothing in the codebase ever increments tokens_analyzed or rugs_detected. Only swaps_protected is incremented, and only from wallet/send. The section tagline 'Live counters... grow with every real interaction' is false for hal
- [ ] Hero StatBar hardcodes a fabricated 'Wallets Tracked' number. useCountUp(400) animates to a static '400+' with no data source; the code comment even admits the true value ('449 live') while hardcoding 400. This is exactly the mock-data violation the comment claims to have removed.

### market-data-core
- [ ] Primary chart data source is Binance REST (api.binance.com), which returns HTTP 451 to US-hosted IPs. coin-chart and coin-ohlc run server-side on Vercel, so the Binance 'Strategy 1' path almost always fails in production and silently falls through.
- [ ] universalSearch (backing /api/search/coins) fetches the full Binance 24hr ticker server-side on every query — geo-blocked on Vercel (451) so searchBinance() returns [] and all major-coin results silently disappear; also a heavy full-ticker fetch with cache:'no-store' on each keystroke.
- [ ] market-data fallback chain second tier is CoinCap (api.coincap.io/v2), whose free v2 API is deprecated/now key-gated. When CoinGecko fails the fallback also fails, so the entire market list goes empty instead of degrading.

### market-maker
- [ ] Activation succeeds with no execution path and the user is never told: PATCH sets status=active regardless of whether a funded kernel/active session key exists on that chain, then the engine silently returns skip 'no session key / execution unavailable' every tick — skip reasons and last_run_at exis
- [ ] Solana strategies are creatable AND activatable but the engine unconditionally skips them ('chain not AA-executable yet') — disclosed only in a small hint inside the create modal, not on the strategy card or at activation time
- [ ] BackgroundSnipingCard (the only kernel fund/enable path on this page) renders null when the user has no built-in Naka wallet in localStorage — those users get an activatable Market Maker with literally no way to set up execution and no explanation

### messages-social
- [ ] E2E private key is wrapped with a secret derived from SHA-256 of the FULL Supabase access-token JWT string, which rotates on every ~hourly token refresh. The keyVault comment claims the input is stable sub+aud claims, but deriveWrapSecret hashes the entire token. After any refresh, unwrapPrivateKey 

### naka-cult
- [ ] getCultAccess() calls reportDenial() -> Sentry.captureMessage on EVERY denial, and it is invoked on the PUBLIC, force-dynamic /naka-cult landing (page.tsx:28) plus /api/cult/me which SidebarMenu fetches on every mount. So each anonymous visitor/crawler of the marketing page fires a 'cult-access-deni

### naka-wallet
- ✅ Receive QR code never renders: qrcode.toDataURL is passed dark: 'var(--nl-canvas-base)' — the qrcode lib requires hex color strings and throws 'Invalid hex color', the promise rejects into the catch, qrDataUrl stays '' and the placeholder icon renders forever on every chain
- ✅ API-supplied token logos are dropped: wallet-intelligence returns holdings[].logoUrl (Alchemy metadata + DexScreener imageUrl) but the page's logo resolution reads token.logo (which never exists on on-chain holdings) — so any ERC-20 not in the 24-symbol COIN_LOGOS map renders a letter avatar. This i
- [ ] Portfolio Analytics double/triple-counts Ethereum: it fetches LIVE_CHAINS ids directly including 'bnb' (backend keys it 'bsc') and 'solana' (EVM address → EVM path) — both fall back to ethereum, so the same Ethereum balance is counted under Ethereum, BNB Chain, and Solana and the total is inflated ~
- [ ] Adding a Ledger wallet permanently breaks cloud sync for ALL wallets: Ledger rows are stored with encryptedKey: '' but the sync endpoint rejects any row with encryptedKey.length < 8, returning 400 for the entire array on every subsequent save
- [ ] Balance fetch failure is silent: fetchBalances catches errors with console.error only, no error state — the hero shows $0.00 Total Balance and placeholder rows, making users think their funds are gone whenever the API times out or 500s
- [ ] /api/wallet/history always returns empty: walletManager.getTransactionHistory queries column wallet_address but the transaction_history table's column is wallet — PostgREST errors, error is ignored, [] returned (consumer: app/wallet-tracer/page.tsx:28)
- [ ] Sends are native-coin only: SendView has no token selector and always does parseEther(amount) to the recipient — you cannot send USDC, USDT, or any ERC-20/SPL token you hold from the wallet

### navigation-back-sweep
- [ ] ~30 pages use plain <BackButton /> (no href) and thus inherit the broken referrer logic — Back sends them to /dashboard instead of history. Includes deep detail pages the owner called out.
- [ ] BackButton with href literally forces router.push('/dashboard') (BackButton.tsx:21-23 short-circuits before any history check), so these ignore where the user came from entirely.

### onboarding
- [ ] Dashboard FirstRunTour CTA 'Open settings' links to /dashboard/settings which does not exist (settings lives at /settings) -> Next.js 404 (app/dashboard/not-found.tsx).
- [ ] Dashboard FirstRunTour CTA 'Browse whales' links to /dashboard/whales which does not exist (the route is /dashboard/whale-tracker) -> 404.
- [ ] Orphaned /onboarding/complete page 'Connect a wallet' CTA also links to the non-existent /dashboard/settings -> 404.

### onchain-trends
- [ ] Cache poisoning in on-chain-trends: the route caches `result` by reference (line 173) and THEN mutates `result.cards` when a ?chain= filter is present (lines 177-179). The first request after TTL expiry that carries e.g. ?chain=ethereum permanently filters the shared 5-minute cache, so every subsequ
- [ ] Dead fallback in /api/market-data: fromCoinCap hits api.coincap.io/v2, which CoinCap deprecated/sunset (v3 lives at rest.coincap.io and requires an API key). CoinCap is also not in the owner's locked free-API matrix. When CoinGecko fails/429s, the fallback fails too and the route returns an empty to
- [ ] DeFiLlama outage renders fabricated-looking '$0' cards: every defillama.ts function catches and returns [] (defillama.ts:42-55,81-98), so on failure globalNow=0 and totalStable=0 and the trends page confidently shows 'All Chains TVL $0' and 'Stablecoins $0' as real data instead of an error.

### portfolio
- [ ] Security scoring is completely dead: holdings are mapped from intel.holdings only (page.tsx:192-209) which never contains a securityScore; the IntelResponse type (page.tsx:39-52) doesn't even include the contractSecurity map the API returns (wallet-intelligence/route.ts:320). Result: riskyHoldings i
- [ ] Multi-chain holdings are not aggregated. The page passes only a single auto-detected address to /api/wallet-intelligence, which defaults an EVM wallet to chain='ethereum' (route.ts:284). A user's Base/Arbitrum/Optimism/Polygon/BSC balances never appear. A /api/wallet-intelligence/multichain route ex
- [ ] 'Today' P&L badge is misleading. The green/red '+$X (Y%) today' shown beside Total Portfolio Value is derived from the cumulative capital-flow series (buys add, stable-out subtracts), NOT mark-to-market. A buy made today shows as a positive 'today' gain. It also uses a different data source (perf.se

### pricing-tiers
- [ ] Mini tier is unreachable by end users. Founder Pass grants only Max; there is no self-serve upgrade; only an admin set_tier or admin comp can assign Mini. Yet Mini-gated features (whale-tracker, DNA analyzer, whales directory) are therefore locked to everyone except admins and Founder-Pass Max holde
- [ ] Revenue stats endpoint has no admin authorization — any authenticated user can read platform-wide totalRevenue/revenueByType/totalTrades. It only checks getAuthenticatedUser, never role==='admin'.

### push-email
- [ ] VAPID key rotation is half-wired: the client subscribes against the DB-served active key (/api/push/vapid-public-key -> vapid_keys.public_key) and stores vapid_key_version, but sendWebPush ALWAYS signs the JWT and sets the Authorization k= header with the single env VAPID_PUBLIC/VAPID_PRIVATE_KEY. N
- [ ] Two divergent subscribe paths using two different service workers at the same root scope. components/notifications/NotificationSetup.tsx:74 registers '/sw.js' and POSTs to /api/notifications/subscribe, while lib/preferences/webPush.ts:27,83 registers '/push-sw.js' and persists directly via the brows
- [ ] NotificationSetup.tsx passes the raw base64url VAPID string directly as applicationServerKey instead of a Uint8Array (BufferSource). webPush.ts:98 correctly converts via urlBase64ToUint8Array; NotificationSetup does not. Firefox and Safari throw on a string applicationServerKey, so the ProfileTab en
- [ ] Email fan-out from the notifications POST is fire-and-forget with .catch(() => {}) and no retry/queue. The notification-retry cron only reprocesses pending_telegram_messages / pending_discord_messages / pending_sms_messages — there is no pending_email table and push failures logged to push_delivery_

### research-labs
- [ ] Pagination is dead. GET never passes {count:'exact'} to .select(), so Supabase returns count=null, making total = data.length (<= limit 20). The frontend only renders Previous/Next when total > 20 (page.tsx:676), so with 21+ posts users can never reach page 2 — the tail of the newsroom is unreachabl
- [ ] 'Trending' sort is unwired. The frontend sends sort=latest|trending (page.tsx:420) but the GET handler never reads searchParams.get('sort') — it always .order('published_at', {ascending:false}). Selecting Trending re-fetches identical latest-ordered data.

### security-center
- [ ] User-facing 2FA/TOTP does not exist. The only TOTP backend (app/api/admin/totp/route.ts) is gated by verifyAdminContext and writes admin_roles — admins only. ProfileTab shows a 'COMING SOON' badge for 2FA. There is no user enrollment endpoint or UI.
- [ ] SecurityHealthCard '2FA CTA' links to /settings/security which is a 404 — no app/settings/security route exists (only app/settings/page.tsx). Clicking the primary security action dead-ends.
- [ ] has2fa prop is hardcoded default false and the caller passes nothing, so the 'Enable two-factor authentication' CTA renders for every user unconditionally, including anyone who did enroll. It never reflects real 2FA state.
- [ ] Batch revoke is unwired. Hub card blurb promises 'revoke risky spenders in batch' but the approvals page only revokes one row at a time; the Permit2 revoke-batch endpoint is never called from any page.
- [ ] Wallet-analysis feeds a WALLET address into ShadowGuardian.scanTrade, which treats its argument as a TOKEN contract (getTokenHolders). Wallet addresses have no token holders, so the scan returns BLOCKED/UNABLE_TO_VERIFY — semantic mismatch, the tool cannot work as labelled.

### smart-money
- [ ] History tab compares move.action === 'buy' (lowercase) but recentMoves actions are 'Bought'/'Sold' (capitalized), so isUp is ALWAYS false — every move renders red TrendingDown with 'BOUGHT' in red regardless of direction
- [ ] winRate is hardcoded 0 for every wallet from BOTH sources, so 'Avg Win' stat, per-wallet 'X% Win' pills, Top-Performers card win rates, and expanded 'Win Rate' cell all display 0% permanently
- [ ] Paper Trade estimate = amt * (winRate/100) * 0.05, and winRate is always 0, so every simulated allocation shows '+0.00 est.'; 'Start Paper Simulation' button only calls setPaperTrade(null) — no simulation is ever run
- [ ] Convergence banner is effectively dead: Alchemy trades all have action 'Transfer' (never counted), and each DexScreener wallet is a different token symbol, so the count>=2-same-token condition almost never fires; it is also fully disconnected from the real Supabase smart_money_convergence table

### sniper
- [ ] 'Quick Buy' on every feed card and 'Create Sniper for {symbol}' in the drawer discard the token: onSnipe opens NewSniperModal with no token prefill (the drawer literally does `void t`). There is no quick-buy execution path at all — the primary CTA on the discovery surface performs a generic rule-cre
- [ ] POST /api/sniper/execute (the 5-step safety flow) has zero frontend callers and never executes anything — it inserts a sniper_executions row with status 'queued' and tx_hash null, and no consumer reads 'queued' rows (auto-execute consumes sniped_pending match events; autosell only reads 'confirmed')
- [ ] whale_buy trigger via cron is effectively dead: sniper-monitor only scans whale_activity from the last 2 minutes, but whale-activity-poll runs every 30 minutes (dispatch group 'half-hourly'), so ~93% of whale buys land outside the window and are never matched. Combined with the dead webhook path, wh
- [ ] Autosell price feed only supports ethereum/bsc/avalanche/solana; base/arbitrum/optimism/polygon return null (USDC_BY_CHAIN/CHAIN_IDS have 3 chains). Background-sniping AA sessions can be armed on base/arbitrum/optimism/polygon (BackgroundSnipingCard AA_CHAINS), so any position there would sit unprot

### support-cs-ai
- [ ] Two divergent AI support backends with different models, prompts, and pricing that give inconsistent answers. /api/support (streaming, model 'claude-sonnet-4-6') and /api/customer-service (vtxQuery, sonnet-5 executor + opus-4-8 advisor). Their system prompts list different feature sets and one state
- [ ] Hardcoded model 'claude-sonnet-4-6' in the support stream route while the shared service migrated to 'claude-sonnet-5' (VTX_EXECUTOR_MODEL). Stale/likely-invalid model id; if the id is not served this endpoint 500s on every call.
- [ ] Support page back button hardcodes navigation to /dashboard instead of going back in history. BackButton pushes href unconditionally when href is set, bypassing its own smart router.back() logic. Users who reach support from profile/deeplink are thrown to /dashboard.

### swap
- [ ] Solana deep-links break quotes: resolveParam only handles EVM 0x-addresses; a base58 mint from the sniper drawer is uppercased into an invalid symbol/mint (uppercasing can produce chars outside the base58 alphabet) -> server 422 UNRESOLVED_TOKEN
- ✅ Token selector cannot find arbitrary tokens by NAME: search only filters the hardcoded 26-entry TOKEN_LIST; the list is not chain-filtered so picking e.g. BONK while on Ethereum silently produces no quote (simulateQuote swallows all errors with console.error, no UI error state)
- ✅ Imported tokens are invisible after import: stored only in a module-level in-memory map, lost on refresh, and never rendered in the token list on reopen (filtered list maps TOKEN_LIST only)
- [ ] SwapDuneStrip and the pre-trade sandwich-risk fetch pass token SYMBOLS where the backends key on contract ADDRESSES (goplus_security_cache.token_address, transactions.to_token_address, analyseMevProtection tokenAddress) — the intelligence strip is nearly always empty and the MEV score is computed ag
- [ ] Client base-unit conversion uses float math BigInt(Math.round(parseFloat(amount) * 10**18)) — the exact precision bug the repo's own toBaseUnits docstring says causes MAX swaps to revert with insufficient funds; the safe string-math helper exists server-side but the page bypasses it
- [ ] OrderForm hardcodes wallet_source:'external_evm' even when chain is solana, and requires a Supabase login session — wallet-only users get a bare 'Unauthorized' toast with no sign-in prompt

### telegram-integration
- [ ] telegram_delivery_failures retry backoff is broken by an attempts-seeding mismatch. lib/telegram/notify.ts inserts every failure with attempts=MAX_ATTEMPTS=3, but telegram-retry-failures computes dueAt = last_attempt_at + BACKOFF_MS[attempts-1] = BACKOFF_MS[2] = 7 DAYS for the very first retry (comm
- [ ] The bot repeatedly deep-links users to ${APP_URL}/settings/notifications to generate a link code, but that route does not exist (only app/settings/page.tsx, which does not even mount TelegramConnectCard). Every user onboarding via the bot lands on a 404. The card actually lives on /dashboard/profile
- [ ] /copy command deep-links to /dashboard/copy-trade and /dashboard/copy-trade/setup, but the real route is /dashboard/copy-trading. Both target 404. The whole PRO copy-trade CTA from Telegram is dead.
- [ ] The app-side Disconnect button is fake. unlink() makes no API call and does not delete the link; it just pops an alert() telling the user to go type /unlink in the bot. The 'Connected' state never changes from the app. There is no DELETE endpoint under app/api/telegram.

### trading-suite
- [ ] Snipe transactions are labeled chain='ethereum' and linked to Etherscan even though sniper_executions is a Solana feature (amount_sol column) with no 'chain' column at all. e.chain is always undefined so line 114 falls back to 'ethereum'; the explorer link then builds https://etherscan.io/tx/<solana
- [ ] Order History tab on the Orders hub is always empty. order-history returns {rows} but the normalizer only checks orders/positions/history/rules/bots/data, never .rows, so it falls through to [].
- [ ] PortfolioHistoryPanel order-history tab is always empty for the same reason — normalizer checks positions/history/orders/data but not .rows.
- [ ] Orders hub table columns reference field names that do not exist in the DB. Limit tab uses token_in/side/limit_price/amount_in_usd but limit_orders columns are from_token_symbol/to_token_symbol/trigger_direction/trigger_price_usd/from_amount, so Pair, Side, Price, Amount all render '—'. Stop tab use

### vtx-agent
- ✅ Dashboard-tab surface (VtxAiTab, mounted at app/dashboard/page.tsx:430 for the vtxai nav) discards the server-built tokenCard and swapCard in BOTH the JSON branch and the streaming done handler — a pasted CA renders text-only and a 'swap 0.1 ETH for USDC' request renders no Swap Card, while the syst
- ✅ Personality setting is dead on every surface: both UIs send lowercase 'professional'|'degen'|'conservative'|'neutral' but the server allow-list is case-sensitive ['Neutral','Friendly','Analytical','Direct','Casual','Professional'] — no value either UI can send ever matches, so resolvedPersonality is
- ✅ /api/vtx-ai/chat is publicly reachable with zero auth and zero rate limiting, runs the full Sonnet-5 tool loop (runVTXAgent/streamVTXAgent), and has no production caller — an open unlimited-cost endpoint.

### wallet-clusters-graph
- [ ] Analyze-any-wallet box hardcodes chain:'ethereum' in the POST body, but the input placeholder invites '0x… or Solana address'. A pasted Solana wallet queries whale_activity WHERE chain='ethereum', matches nothing, and always returns 'Insufficient on-chain activity'. Solana analysis is impossible fro
- [ ] Orchestrator computes ai_name, ai_narrative (Claude Haiku call), risk_score, edge_count, hub, confidence, total_value_usd, first/last_seen for every cron-built cluster, but persistClusters only writes cluster_id, token_address, behavior_type, whale_score — the wallet_clusters table has no columns fo
- [ ] Network Metrics ships hardcoded/fake data: Ethereum TPS is the string '15' (never fetched), Solana gas is the string '0.00025 SOL' (never fetched), and Base/Arbitrum/Polygon TPS and Latest Block are hardcoded '—' even though the Alchemy RPCs for those chains are already configured — only gas is actu

### wallet-intelligence
- [ ] Deep-link into the main page is dead: page.tsx never reads the ?address= query param (no useSearchParams anywhere). Shadow Guardian's 'Full alpha report' link and the header cross-link both pass ?address=, so the user lands on an empty search box and must re-type the address.
- [ ] Off-matrix paid APIs power core data: Zerion (EVM fallback fetch), Birdeye (Solana price secondary), Bitquery (sole source of Realized PnL), Arkham (whale entity labels). None are in the owner's locked free-tier matrix; owner pays only Anthropic+Vercel.

### whale-tracker
- [ ] whales.whale_score has two competing writers with different formulas in the same six-hourly group: whale-score-populator's populate_whale_score RPC (volume/recency from whale_activity) and whale-backfill-pnl's computeWhaleScore (win-rate/PnL/portfolio) — scores oscillate between two definitions ever
- [ ] Watch-star toggles on LiveTradersGrid, copy-trade, and directory never check res.ok and have no tier gate: for a mini-tier user the POST 403s (watchlist is pro-gated) but fetch resolves, so the optimistic star stays lit and the follow is silently never saved (rollback only fires on network throw).
- [ ] Default 'Traders' view ranks by volume_7d_usd/active_days_7d, columns populated ONLY by the Bitquery-gated bitquery-traders cron; without the key the flagship default view sorts nulls and every card shows n/a volume, and isCopyTradeable (active_days_7d >= 4) marks every whale un-copy-tradeable.
- [ ] Legacy /api/whale-tracker route (Birdeye + raw Alchemy scan) is still live and polled every ~5 min by the dashboard-wide PlatformEventMonitor for every user; it uses a hardcoded $2500 ETH last-resort price and hardcodes BSC rows to tier 'MID' with zero data; free users just burn a 403 per tick.
