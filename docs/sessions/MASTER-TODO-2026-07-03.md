# Master TODO — Naka Labs platform (40-agent audit 2026-07-03)

Prioritised backlog. **31 P0 / 114 P1** across 40 features. ✅ = shipped this session on
`claude/platform-audit-trust-wallet-bceep5`. Verify DB fixes were applied live via Supabase.

**P0 progress: 27 fixed / 4 open.**

## P0 — status

### admin-panel
- ✅ Audit log records NOTHING for any real admin action. admin_audit_log has CHECK (action IN ('set_tier','set_role','ban','unban','delete','other')) and no later migration relaxes it, but logAdminAction and its ~40 call sites write disallowed strings (feature_fla
- ✅ Audit-log VIEWER page is always 401. app/admin/audit-log/page.tsx:52 fetches /api/admin/audit-log with NO Authorization header, but that route authenticates via Supabase COOKIE session + profiles.role='admin' (app/api/admin/audit-log/route.ts:11-35). The admin
- ✅ Static bearer (the ONLY UI login) never writes any audit row: logAdminAction returns early when ctx.staticBearer is true (lib/auth/adminAuth.ts:143). So even if the CHECK constraint were fixed, UI-driven actions log nothing because the UI can only auth as the 

### approvals-signature-mev
- ✅ MEV risk pill is fed a token SYMBOL, not a contract address. Swap page fetches /api/mev-protection?token=${toToken} where toToken is a symbol like 'USDC' (app/dashboard/swap/page.tsx:1411; toToken state = 'USDC' at page.tsx:597). The MEV service passes it stra
- ✅ MEV protect toggle is unwired server-side. The Settings toggle advertises 'Routes via private mempool (Flashbots / Jito) to block sandwich bots' (app/dashboard/swap/page.tsx:580) and shows a 'Protected' badge (page.tsx:2140), but mevProtect is only ever passed

### archive-proof-preview
- ✅ Share link retrieval is broken on serverless. /api/share stores short-ids in a module-level in-memory Map (shareStore). On Vercel the POST that mints /s/<id> and the later GET /api/share?id=<id> almost always hit different lambda instances (or a cold start), s

### bridge
- ✅ execute insert uses source_reason='bridge' but the pending_trades CHECK constraint permits no 'bridge' value in either constraint version (session5b2 allows only limit_order/dca/stop_loss/take_profit/trail_stop/copy_trade/vtx_chat; 06_27 adds sniper_* but stil
- ☐ No ERC20 approval/allowance step. LiFi requires an approve() to estimate.approvalAddress before the bridge tx for any non-native token, but the page only sends the single transactionRequest. Bridging any ERC20 (incl. USDC/USDT) reverts because the LiFi contrac

### bubble-map
- ✅ EVM holder fetch ignores the selected chain — getTopERC20Holders takes no chain param and always hits api.ethplorer.io (Ethereum-only). For BSC/Base/Arbitrum/Polygon token addresses it returns [] , so the graph shows the empty 'No holder data available' state.
- ☐ Solana fallback holder percentages are wrong and addresses are token accounts, not owners. getTokenLargestAccounts returns the top-20 SPL token accounts and percentage is computed relative to the SUM OF THOSE 20, not circulating supply — so the top-20 always s

### copy-social-trading
- ✅ Live DB status CHECK constraint on user_copy_trades allows only ('pending','success','failed','cancelled','expired','alert') — verified via live SQL — but /api/copy-trading/execute writes 'blocked_rule'/'blocked_security': every recordBlocked() insert silently
- ✅ Matcher generic-failure branch never updates the claimed user_copy_trades row — on any non-security relayer failure (no route, insert error) the row stays 'pending' forever; pending-trades-cleanup can't expire it because no pending_trades row exists, so each f

### crons-pipelines
- ✅ recompute-reputation NEVER runs via the scheduler. The daily dispatcher fans out with header `authorization: Bearer <CRON_SECRET>`, but recompute-reputation validates `x-cron-secret` header OR `?secret=` query param instead — neither is sent — so it returns 40

### naka-wallet
- ✅ Wrong-chain balances: /api/wallet-intelligence silently falls back to Ethereum for any chain not in EVM_CHAIN_CONFIG (only 6 chains mapped). Selecting Optimism, Fantom, Cronos, Linea, Scroll, zkSync, Mantle, Blast, etc. (all offered in Add Network, page.tsx:13

### navigation-back-sweep
- ✅ SYSTEMIC ROOT CAUSE: BackButton with no href is supposed to go back but uses document.referrer to decide. Next.js client-side navigations (router.push/Link) never update document.referrer, so for normal in-app navigation internalReferrer is false and the guard

### onboarding
- ✅ Two separate first-run overlays mount at the same z-[200] on a brand-new user's dashboard: OnboardingGate (10-card flow, gated on DB onboarding_completed_at) AND the dashboard FirstRunTour 3-step modal (gated only on localStorage naka_tour_done). A first-time 

### pricing-tiers
- ✅ No payment path exists for any paid tier. All 'Get Mini/Pro/Max' buttons just fire toast.info('Crypto payment integration coming soon'). No Stripe checkout, no crypto-payment flow, no webhook to set a tier. Self-serve upgrade is impossible; the entire pricing 
- ✅ Stripe is a package dependency but is NEVER imported or used in any app/lib code. Zero grep hits for `new Stripe`, `from 'stripe'`, `STRIPE_`, or a checkout/webhook route. tier_source='stripe' is referenced only in a code comment with no implementation.

### research-labs
- ✅ Schema/code mismatch: the public list selects 'summary' and 'view_count' and filters .eq('published', true), but the canonical research_posts table has NO published, summary, or view_count columns (it defines status TEXT, excerpt, cover_image). No repo migrati

### security-center
- ✅ No producer ever writes security_alerts, approval_audit_results, or user_token_security_flags — they are only READ. LiveThreatFeed is therefore permanently empty for all users, and the health score's approvals/threats/honeypots sub-scores are always 100 (decor
- ✅ ShadowGuardian (wallet-analysis page + scan-trade route) depends on Arkham Intelligence, a PAID API (api.arkm.com, ARKHAM_API_KEY) not in the owner's free-tier matrix. Without the key getTokenHolders throws and scanTrade returns BLOCKED 'Cannot verify token ho

### sniper
- ✅ Webhook (low-latency) matching path is structurally dead. Alchemy events set chain = ev.network.toLowerCase() which yields 'eth_mainnet'/'base_mainnet' — never the 'ethereum'/'bsc'/'avalanche' slugs stored in sniper_criteria.chains_allowed, so matcher's .conta
- ✅ price_target trigger is a fake feature: users can build it in the UI (with live preview chart) and it persists, but no code evaluates it — matcher.ts triggerAliases only maps new_token_launch/whale_buy (price_target criteria are skipped), and sniper-monitor ex

### support-cs-ai
- ✅ Admin reply button is fully broken and writes to the wrong table. app/admin/support/page.tsx:77 sends the reply to /api/admin/support-tickets/reply, whose handler reads/writes the legacy support_conversations JSONB table, NOT ticket_replies. So (a) admin repli

### swap
- ✅ Main swap page quote pipeline is dead: client checks data.buyAmount and reads data.estimatedPriceImpact / data.gas, but /api/swap/price was refactored to return toAmount (human) / priceImpactPct / no gas — the condition is never true, so 'You receive' never po
- ✅ Solana swap execution throws on every attempt: Jupiter buildSwapTransaction does not set asLegacyTransaction, so it returns a base64 VersionedTransaction, but both signers deserialize with legacy Transaction.from(), which throws on version-prefixed messages
- ✅ Selecting a non-0x route (1inch/Kyber/OpenOcean) always fails: handleSwap posts {taker, fromToken, toToken} but /api/market/trade/execute requires tokenIn/tokenOut/amountIn/walletAddress -> 400 'Missing required fields'; even if fields matched, RouteQuote.raw 
- ✅ RouteComparison feeds token SYMBOLS + human amounts into /api/swap/routes, but getAllRoutes forwards them raw to 1inch/Kyber/OpenOcean which require contract addresses and base units — 1inch additionally 401s without ONEINCH_API_KEY (absent from .env.example) 

### vtx-agent
- ✅ Client-controlled rate-limit bypass: request body field skipRateLimit is trusted verbatim — any anonymous caller can POST {"skipRateLimit": true} to /api/vtx-ai and get unlimited free Claude (Sonnet 5 + Opus 4.8 advisor) on the owner's Anthropic bill. No legit

### whale-tracker
- ☐ Feed freshness: whale_activity ingestion runs in the half-hourly dispatch group at only 14 whales/tick via Alchemy (≈672 whale-polls/day over a 500+ row directory ⇒ a given whale is re-polled roughly every 18h), while the UI empty state claims 'The background 
- ☐ PnL accuracy: whale-backfill-pnl cannot distinguish 'Arkham API failed/key missing' from 'whale had no transfers' — getAddressTransfers errors are swallowed to [], and the cron then writes pnl_30d_usd=0, win_rate=null, and last_active_at=NULL over real values 

## P1 — open (top items per feature)

### admin-panel
- ☐ Nine admin pages fetch WITHOUT the bearer header their backends require, so they 401/blank under the standard static-bearer login: revenue (->/api/analytics/admin needs verifyAdminContext, app/admin/revenue/page.tsx:65),
- ☐ Root /admin page requires a DIFFERENT auth than the rest of the panel. app/admin/page.tsx:287-320 gates on supabase.auth.getSession() + profiles.role='admin' and uses the Supabase session access_token as bearer (:302). B

### alerts-notifications
- ☐ Server-fired alerts NEVER push to Telegram in real time. fanOutNotification (the path every cron-fired alert uses) dispatches in-app + Discord + SMS + email but has no Telegram branch at all; the comment punts to 'the ex
- ☐ Non-price smart alerts and composite alerts reach Telegram by NO path whatsoever. evaluateSmartAlerts only sets triggered=true for one-shot price alerts; whale/launch/wallet_activity fire repeatedly without stamping trig
- ☐ Discord + SMS notification channels have no UI. No component references /api/notifications/channels or user_notification_channels, so users cannot enter a Discord webhook or SMS phone through the app. fanOutNotification 

### archive-proof-preview
- ☐ /s/[id] share landing is a client component doing a client-side fetch with no generateMetadata/openGraph, so social crawlers (Twitter/Telegram/Discord) receive an empty shell and no unfurl. There is no server-rendered ti

### auth-walletconnect
- ☐ WalletAuthButton calls wagmi hooks useAccount/useSignMessage/useDisconnect and useAppKit unconditionally, BEFORE the `if (!HAS_APPKIT) return null` guard. When NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is unset, WalletProvide
- ☐ Turnstile is not enforced on the server for the actual auth mutations. Login calls supabase.auth.signInWithPassword({email,password}) client-side with NO captchaToken passed (app/login/page.tsx:258), and /api/auth/signup
- ☐ No rate limiting on /api/auth/wallet-nonce or /api/auth/wallet-verify. wallet-nonce is an unauthenticated INSERT into auth_wallet_nonces (DB write amplification / table flooding) and wallet-verify runs expensive admin pa

### bridge
- ☐ Amount parsing hardcodes 18 decimals: parseUnits(amount, 18). For 6-decimal tokens (USDC/USDT) entering 100 sends 100e18 base units (100 trillion) to LiFi, yielding 'no route' or a nonsense quote. All stablecoin bridging
- ☐ Status polling permanently halts on any non-2xx response: 'if (!res.ok) return;' returns without scheduling the next tick. LiFi /status frequently 502s or is unindexed right after broadcast (status route returns 502 when

### bubble-map
- ☐ D3 force graph fully tears down (svg.selectAll('*').remove()) and re-runs the entire force simulation on every node selection AND on every keystroke in the 'Find wallet' box, because `selected` and `pinnedAddress` are in

### context-feed
- ☐ SSE permanently self-destructs: the server emits `event: error` frames on ANY transient upstream non-OK tick (events/route.ts:64-66,78), which dispatch as type-'error' events on the client EventSource and trigger es.oner
- ☐ SSE is per-connection self-polling, not fan-out: each connected client holds its own serverless function alive for 5 minutes, self-fetching /api/context-feed every 5s with the user's cookie. The header comment 'Multiple 
- ☐ Fetch failures render as a fake-calm empty state: errors are swallowed with only a console.warn, loading is set false, and the UI shows 'No Events on X / Waiting for activity...' with a pulsing 'Live' dot - the user cann
- ☐ DexScreener stampede with no rate-limit handling: one cache-miss 'all' refresh fires ~70+ DexScreener requests (12 ETH searches + profiles per chain across 8 chains at route.ts:1120-1192, 40 boost-search lookups at route
- ☐ All CoinGecko-sourced events hardcode chain:'ethereum' - a trending SOL or BTC coin gets an ETH badge in the UI AND the ethereum +35 chain-rank boost in scoring, misattributing chain data on every gainer/trending/new-lis

### contract-analyzer
- ☐ token-scanner Solana path depends on Birdeye, a NON-approved paid API requiring BIRDEYE_API_KEY; without the key birdSec is null and the whole Solana security scorecard silently degrades to DEX-market-signals-only (no mi
- ☐ Contract Analyzer gives Solana tokens NO honeypot second opinion: reconcileHoneypot only combines GoPlus static + Honeypot.is (EVM-only), so every Solana token's verdict rests on GoPlus static alone even though a real, f

### copy-social-trading
- ☐ Whale-tracker watchlist and directory 'Copy' buttons deep-link to /dashboard/copy-trading?whale=...&chain=...&label=... but the copy-trading page ignores those params entirely — deepLink requires tx+token+action (page.ts
- ☐ Tier contradiction: NewCopyRuleModal shows 'Alerts Only' as free-tier (required:'free') and the rules API's own comment says alerts_only is mini+, but POST /api/copy-trading/rules is wrapped in withTierGate('pro') — free
- ☐ Avalanche is selectable in the chain dropdown but has no USDC mapping in either execution path — a rule created on avalanche can never execute: manual execute fails with 'Unsupported chain', matcher silently blocks
- ☐ Rules for whales not already in the pipeline never fire: the Alchemy/Helius webhooks only match transfers against the curated `whales` table (alchemy-whale/route.ts:164) and the cron only replays activity for whales in u

### crons-pipelines
- ☐ daily-digest is a no-op stub. Scheduled in the daily dispatch group but the entire handler body is verifyCron() + cronResponse() with zero digest logic. No other daily-digest implementation exists in the repo. The 'daily

### dashboard-home
- ☐ PortfolioHeroCard (the first, defaultVisible 'hero' widget) NEVER renders for any user. It fetches /api/portfolio with no query params, but the route requires ?address and returns 400 without it, so res.ok is false, data

### dna-analyzer
- ☐ Win Rate tile always renders 'N/A'. UI reads dna.aiAnalysis.metrics.timing but the API only ever returns metrics: { diversification } — the 'timing' key is never populated.
- ☐ Partner Wallets is a permanently dead feature. The API hardcodes partnerWallets: [] on every response, so Section 4's entire UI (PartnerWallet type, per-partner 'Analyze' buttons) never renders, yet the input-screen intr
- ☐ Performance Metrics section over-promises: AIAnalysis type declares 5 metrics (diversification, timing, riskManagement, consistency, conviction) but the API supplies only diversification, so the metrics bar list (Object.
- ☐ Orphaned duplicate page. app/dna-analyzer/page.tsx is not linked from anywhere (sidebar, profile, whale-tracker all point to /dashboard/dna-analyzer) and depends on Arkham (getAddressIntel -> ARKHAM_API_KEY), a paid off-

### geo-stream-misc-apis
- ☐ Admin revenue dashboard can NEVER load: frontend fetches /api/analytics/admin with no Authorization header, but backend requires Bearer via verifyAdminContext (returns 403). Page permanently shows 'No analytics data avai
- ☐ /api/game-scores stores the entire leaderboard in a module-level in-memory Map. On serverless/Vercel this is per-instance and wiped on every cold start — scores never persist and are not shared across instances. Leaderbo

### glass-brand-consistency
- ☐ Broken Tailwind opacity-modifier idiom on custom class: className="nl-glass/50" (also /40, /30, /60). Tailwind only generates opacity modifiers for registered utilities; .nl-glass is a hand-written CSS class whose backgr

### i18n-a11y
- ☐ Skip link is broken: app/layout.tsx:175 renders <a href="#main"> ('Skip to main content', comment claims 'a11y P0' WCAG 2.4.1) but NO element with id="main" exists anywhere in app/ or components/ (grep for id="main" retu
- ☐ html lang is hardcoded 'en' and never updated on language switch. AutoTranslate.onLang only sets document dir (AutoTranslate.tsx:180), never lang. So when content is visually Spanish/Arabic, screen readers still announce
- ☐ components/ui/LanguageSwitcher.tsx is a DEAD button: it writes localStorage key 'steinz_locale' and dispatches CustomEvent('localeChange') (lines 7,54) but nothing in the codebase ever reads that key or listens to that e
- ☐ ~12 dialog/modal surfaces render role="dialog"/aria-modal but do NOT use useFocusTrap: app/admin/users/page.tsx, app/vault/conclave/CreateProposalModal.tsx, app/dashboard/wallet-page/page.tsx, components/ui/NotificationC

### landing-discover
- ☐ Landing 'Tokens Analyzed' and 'Rugs Detected' counters are permanently 0: nothing in the codebase ever increments tokens_analyzed or rugs_detected. Only swaps_protected is incremented, and only from wallet/send. The sect
- ☐ Hero StatBar hardcodes a fabricated 'Wallets Tracked' number. useCountUp(400) animates to a static '400+' with no data source; the code comment even admits the true value ('449 live') while hardcoding 400. This is exactl

### market-data-core
- ☐ Primary chart data source is Binance REST (api.binance.com), which returns HTTP 451 to US-hosted IPs. coin-chart and coin-ohlc run server-side on Vercel, so the Binance 'Strategy 1' path almost always fails in production
- ☐ universalSearch (backing /api/search/coins) fetches the full Binance 24hr ticker server-side on every query — geo-blocked on Vercel (451) so searchBinance() returns [] and all major-coin results silently disappear; also 
- ☐ market-data fallback chain second tier is CoinCap (api.coincap.io/v2), whose free v2 API is deprecated/now key-gated. When CoinGecko fails the fallback also fails, so the entire market list goes empty instead of degradin

### market-maker
- ☐ Activation succeeds with no execution path and the user is never told: PATCH sets status=active regardless of whether a funded kernel/active session key exists on that chain, then the engine silently returns skip 'no ses
- ☐ Solana strategies are creatable AND activatable but the engine unconditionally skips them ('chain not AA-executable yet') — disclosed only in a small hint inside the create modal, not on the strategy card or at activatio
- ☐ BackgroundSnipingCard (the only kernel fund/enable path on this page) renders null when the user has no built-in Naka wallet in localStorage — those users get an activatable Market Maker with literally no way to set up e

### messages-social
- ☐ E2E private key is wrapped with a secret derived from SHA-256 of the FULL Supabase access-token JWT string, which rotates on every ~hourly token refresh. The keyVault comment claims the input is stable sub+aud claims, bu

### naka-cult
- ☐ getCultAccess() calls reportDenial() -> Sentry.captureMessage on EVERY denial, and it is invoked on the PUBLIC, force-dynamic /naka-cult landing (page.tsx:28) plus /api/cult/me which SidebarMenu fetches on every mount. S

### naka-wallet
- ☐ Portfolio Analytics double/triple-counts Ethereum: it fetches LIVE_CHAINS ids directly including 'bnb' (backend keys it 'bsc') and 'solana' (EVM address → EVM path) — both fall back to ethereum, so the same Ethereum bala
- ☐ Adding a Ledger wallet permanently breaks cloud sync for ALL wallets: Ledger rows are stored with encryptedKey: '' but the sync endpoint rejects any row with encryptedKey.length < 8, returning 400 for the entire array on
- ☐ Balance fetch failure is silent: fetchBalances catches errors with console.error only, no error state — the hero shows $0.00 Total Balance and placeholder rows, making users think their funds are gone whenever the API ti
- ☐ /api/wallet/history always returns empty: walletManager.getTransactionHistory queries column wallet_address but the transaction_history table's column is wallet — PostgREST errors, error is ignored, [] returned (consumer
- ☐ Sends are native-coin only: SendView has no token selector and always does parseEther(amount) to the recipient — you cannot send USDC, USDT, or any ERC-20/SPL token you hold from the wallet

### navigation-back-sweep
- ☐ ~30 pages use plain <BackButton /> (no href) and thus inherit the broken referrer logic — Back sends them to /dashboard instead of history. Includes deep detail pages the owner called out.

### onboarding
- ☐ Dashboard FirstRunTour CTA 'Open settings' links to /dashboard/settings which does not exist (settings lives at /settings) -> Next.js 404 (app/dashboard/not-found.tsx).
- ☐ Dashboard FirstRunTour CTA 'Browse whales' links to /dashboard/whales which does not exist (the route is /dashboard/whale-tracker) -> 404.
- ☐ Orphaned /onboarding/complete page 'Connect a wallet' CTA also links to the non-existent /dashboard/settings -> 404.

### onchain-trends
- ☐ Cache poisoning in on-chain-trends: the route caches `result` by reference (line 173) and THEN mutates `result.cards` when a ?chain= filter is present (lines 177-179). The first request after TTL expiry that carries e.g.
- ☐ Dead fallback in /api/market-data: fromCoinCap hits api.coincap.io/v2, which CoinCap deprecated/sunset (v3 lives at rest.coincap.io and requires an API key). CoinCap is also not in the owner's locked free-API matrix. Whe
- ☐ DeFiLlama outage renders fabricated-looking '$0' cards: every defillama.ts function catches and returns [] (defillama.ts:42-55,81-98), so on failure globalNow=0 and totalStable=0 and the trends page confidently shows 'Al

### portfolio
- ☐ Security scoring is completely dead: holdings are mapped from intel.holdings only (page.tsx:192-209) which never contains a securityScore; the IntelResponse type (page.tsx:39-52) doesn't even include the contractSecurity
- ☐ Multi-chain holdings are not aggregated. The page passes only a single auto-detected address to /api/wallet-intelligence, which defaults an EVM wallet to chain='ethereum' (route.ts:284). A user's Base/Arbitrum/Optimism/P
- ☐ 'Today' P&L badge is misleading. The green/red '+$X (Y%) today' shown beside Total Portfolio Value is derived from the cumulative capital-flow series (buys add, stable-out subtracts), NOT mark-to-market. A buy made today

### pricing-tiers
- ☐ Mini tier is unreachable by end users. Founder Pass grants only Max; there is no self-serve upgrade; only an admin set_tier or admin comp can assign Mini. Yet Mini-gated features (whale-tracker, DNA analyzer, whales dire
- ☐ Revenue stats endpoint has no admin authorization — any authenticated user can read platform-wide totalRevenue/revenueByType/totalTrades. It only checks getAuthenticatedUser, never role==='admin'.

### push-email
- ☐ VAPID key rotation is half-wired: the client subscribes against the DB-served active key (/api/push/vapid-public-key -> vapid_keys.public_key) and stores vapid_key_version, but sendWebPush ALWAYS signs the JWT and sets t
- ☐ Two divergent subscribe paths using two different service workers at the same root scope. components/notifications/NotificationSetup.tsx:74 registers '/sw.js' and POSTs to /api/notifications/subscribe, while lib/preferen
- ☐ NotificationSetup.tsx passes the raw base64url VAPID string directly as applicationServerKey instead of a Uint8Array (BufferSource). webPush.ts:98 correctly converts via urlBase64ToUint8Array; NotificationSetup does not.
- ☐ Email fan-out from the notifications POST is fire-and-forget with .catch(() => {}) and no retry/queue. The notification-retry cron only reprocesses pending_telegram_messages / pending_discord_messages / pending_sms_messa

### research-labs
- ☐ Pagination is dead. GET never passes {count:'exact'} to .select(), so Supabase returns count=null, making total = data.length (<= limit 20). The frontend only renders Previous/Next when total > 20 (page.tsx:676), so with
- ☐ 'Trending' sort is unwired. The frontend sends sort=latest|trending (page.tsx:420) but the GET handler never reads searchParams.get('sort') — it always .order('published_at', {ascending:false}). Selecting Trending re-fet

### security-center
- ☐ User-facing 2FA/TOTP does not exist. The only TOTP backend (app/api/admin/totp/route.ts) is gated by verifyAdminContext and writes admin_roles — admins only. ProfileTab shows a 'COMING SOON' badge for 2FA. There is no us
- ☐ SecurityHealthCard '2FA CTA' links to /settings/security which is a 404 — no app/settings/security route exists (only app/settings/page.tsx). Clicking the primary security action dead-ends.
- ☐ has2fa prop is hardcoded default false and the caller passes nothing, so the 'Enable two-factor authentication' CTA renders for every user unconditionally, including anyone who did enroll. It never reflects real 2FA stat
- ☐ Batch revoke is unwired. Hub card blurb promises 'revoke risky spenders in batch' but the approvals page only revokes one row at a time; the Permit2 revoke-batch endpoint is never called from any page.

### smart-money
- ☐ History tab compares move.action === 'buy' (lowercase) but recentMoves actions are 'Bought'/'Sold' (capitalized), so isUp is ALWAYS false — every move renders red TrendingDown with 'BOUGHT' in red regardless of direction
- ☐ winRate is hardcoded 0 for every wallet from BOTH sources, so 'Avg Win' stat, per-wallet 'X% Win' pills, Top-Performers card win rates, and expanded 'Win Rate' cell all display 0% permanently
- ☐ Paper Trade estimate = amt * (winRate/100) * 0.05, and winRate is always 0, so every simulated allocation shows '+0.00 est.'; 'Start Paper Simulation' button only calls setPaperTrade(null) — no simulation is ever run
- ☐ Convergence banner is effectively dead: Alchemy trades all have action 'Transfer' (never counted), and each DexScreener wallet is a different token symbol, so the count>=2-same-token condition almost never fires; it is a

### sniper
- ☐ 'Quick Buy' on every feed card and 'Create Sniper for {symbol}' in the drawer discard the token: onSnipe opens NewSniperModal with no token prefill (the drawer literally does `void t`). There is no quick-buy execution pa
- ☐ POST /api/sniper/execute (the 5-step safety flow) has zero frontend callers and never executes anything — it inserts a sniper_executions row with status 'queued' and tx_hash null, and no consumer reads 'queued' rows (aut
- ☐ whale_buy trigger via cron is effectively dead: sniper-monitor only scans whale_activity from the last 2 minutes, but whale-activity-poll runs every 30 minutes (dispatch group 'half-hourly'), so ~93% of whale buys land o
- ☐ Autosell price feed only supports ethereum/bsc/avalanche/solana; base/arbitrum/optimism/polygon return null (USDC_BY_CHAIN/CHAIN_IDS have 3 chains). Background-sniping AA sessions can be armed on base/arbitrum/optimism/p

### support-cs-ai
- ☐ Two divergent AI support backends with different models, prompts, and pricing that give inconsistent answers. /api/support (streaming, model 'claude-sonnet-4-6') and /api/customer-service (vtxQuery, sonnet-5 executor + o
- ☐ Hardcoded model 'claude-sonnet-4-6' in the support stream route while the shared service migrated to 'claude-sonnet-5' (VTX_EXECUTOR_MODEL). Stale/likely-invalid model id; if the id is not served this endpoint 500s on ev
- ☐ Support page back button hardcodes navigation to /dashboard instead of going back in history. BackButton pushes href unconditionally when href is set, bypassing its own smart router.back() logic. Users who reach support 

### swap
- ☐ Solana deep-links break quotes: resolveParam only handles EVM 0x-addresses; a base58 mint from the sniper drawer is uppercased into an invalid symbol/mint (uppercasing can produce chars outside the base58 alphabet) -> se
- ☐ SwapDuneStrip and the pre-trade sandwich-risk fetch pass token SYMBOLS where the backends key on contract ADDRESSES (goplus_security_cache.token_address, transactions.to_token_address, analyseMevProtection tokenAddress) 
- ☐ Client base-unit conversion uses float math BigInt(Math.round(parseFloat(amount) * 10**18)) — the exact precision bug the repo's own toBaseUnits docstring says causes MAX swaps to revert with insufficient funds; the safe
- ☐ OrderForm hardcodes wallet_source:'external_evm' even when chain is solana, and requires a Supabase login session — wallet-only users get a bare 'Unauthorized' toast with no sign-in prompt

### telegram-integration
- ☐ telegram_delivery_failures retry backoff is broken by an attempts-seeding mismatch. lib/telegram/notify.ts inserts every failure with attempts=MAX_ATTEMPTS=3, but telegram-retry-failures computes dueAt = last_attempt_at 
- ☐ The bot repeatedly deep-links users to ${APP_URL}/settings/notifications to generate a link code, but that route does not exist (only app/settings/page.tsx, which does not even mount TelegramConnectCard). Every user onbo
- ☐ /copy command deep-links to /dashboard/copy-trade and /dashboard/copy-trade/setup, but the real route is /dashboard/copy-trading. Both target 404. The whole PRO copy-trade CTA from Telegram is dead.
- ☐ The app-side Disconnect button is fake. unlink() makes no API call and does not delete the link; it just pops an alert() telling the user to go type /unlink in the bot. The 'Connected' state never changes from the app. T

### trading-suite
- ☐ Snipe transactions are labeled chain='ethereum' and linked to Etherscan even though sniper_executions is a Solana feature (amount_sol column) with no 'chain' column at all. e.chain is always undefined so line 114 falls b
- ☐ Order History tab on the Orders hub is always empty. order-history returns {rows} but the normalizer only checks orders/positions/history/rules/bots/data, never .rows, so it falls through to [].
- ☐ PortfolioHistoryPanel order-history tab is always empty for the same reason — normalizer checks positions/history/orders/data but not .rows.
- ☐ Orders hub table columns reference field names that do not exist in the DB. Limit tab uses token_in/side/limit_price/amount_in_usd but limit_orders columns are from_token_symbol/to_token_symbol/trigger_direction/trigger_

### wallet-clusters-graph
- ☐ Analyze-any-wallet box hardcodes chain:'ethereum' in the POST body, but the input placeholder invites '0x… or Solana address'. A pasted Solana wallet queries whale_activity WHERE chain='ethereum', matches nothing, and al
- ☐ Orchestrator computes ai_name, ai_narrative (Claude Haiku call), risk_score, edge_count, hub, confidence, total_value_usd, first/last_seen for every cron-built cluster, but persistClusters only writes cluster_id, token_a
- ☐ Network Metrics ships hardcoded/fake data: Ethereum TPS is the string '15' (never fetched), Solana gas is the string '0.00025 SOL' (never fetched), and Base/Arbitrum/Polygon TPS and Latest Block are hardcoded '—' even th

### wallet-intelligence
- ☐ Deep-link into the main page is dead: page.tsx never reads the ?address= query param (no useSearchParams anywhere). Shadow Guardian's 'Full alpha report' link and the header cross-link both pass ?address=, so the user la
- ☐ Off-matrix paid APIs power core data: Zerion (EVM fallback fetch), Birdeye (Solana price secondary), Bitquery (sole source of Realized PnL), Arkham (whale entity labels). None are in the owner's locked free-tier matrix; 

### whale-tracker
- ☐ whales.whale_score has two competing writers with different formulas in the same six-hourly group: whale-score-populator's populate_whale_score RPC (volume/recency from whale_activity) and whale-backfill-pnl's computeWha
- ☐ Watch-star toggles on LiveTradersGrid, copy-trade, and directory never check res.ok and have no tier gate: for a mini-tier user the POST 403s (watchlist is pro-gated) but fetch resolves, so the optimistic star stays lit 
- ☐ Default 'Traders' view ranks by volume_7d_usd/active_days_7d, columns populated ONLY by the Bitquery-gated bitquery-traders cron; without the key the flagship default view sorts nulls and every card shows n/a volume, and
- ☐ Legacy /api/whale-tracker route (Birdeye + raw Alchemy scan) is still live and polled every ~5 min by the dashboard-wide PlatformEventMonitor for every user; it uses a hardcoded $2500 ETH last-resort price and hardcodes 
