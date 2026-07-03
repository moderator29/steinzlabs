# Platform Audit — Fable 5 · 40-agent fleet · 2026-07-03

All 40 platform features audited by dedicated read-only agents. Every claim carries file:line evidence.
Severity totals across the fleet: **31 P0**, **114 P1**, **121 P2**.

> Items marked ✅ FIXED were repaired in the 2026-07-03 session (branch `claude/platform-audit-trust-wallet-bceep5`).

## admin-panel
**Verdict:** The admin panel layers two mutually incompatible auth models, so ~9 pages 401/blank while logged in, the RBAC/TOTP/impersonation subsystems are unreachable dead code, and the audit log silently records nothing because a stale CHECK constraint rejects every action string the code writes.

- **P0** — Audit log records NOTHING for any real admin action. admin_audit_log has CHECK (action IN ('set_tier','set_role','ban','unban','delete','other')) and no later migration relaxes it, but logAdminAction and its ~40 call sites write disallowed strings (feature_flag.toggle, user.impersonate, admin.totp.enroll, announcement_create, broadcast_send, settings_update, wallet_label_set, support_reply, research_publish, social_moderation, whale_submission_approve, etc.). Every INSERT violates the CHECK and throws; logAdminAction swallows it in an empty catch. The append-only trail the audit-log page promises is permanently empty.  
  `supabase/migrations/2026_admin_audit_log.sql:17 (CHECK) vs lib/auth/adminAuth.ts:151-160 (insert + swallow); action strings enumerated across app/api/admin/*`
- **P0** — Audit-log VIEWER page is always 401. app/admin/audit-log/page.tsx:52 fetches /api/admin/audit-log with NO Authorization header, but that route authenticates via Supabase COOKIE session + profiles.role='admin' (app/api/admin/audit-log/route.ts:11-35). The admin UI logs in with a static bearer in sessionStorage and has no Supabase auth cookie, so getUserId() returns null and the page shows the error banner. Doubly dead given the empty table above.  
  `app/admin/audit-log/page.tsx:52 (no header) + app/api/admin/audit-log/route.ts:33-36`
- **P1** — Nine admin pages fetch WITHOUT the bearer header their backends require, so they 401/blank under the standard static-bearer login: revenue (->/api/analytics/admin needs verifyAdminContext, app/admin/revenue/page.tsx:65), search-logs (app/admin/search-logs/page.tsx:37), onboarding-analytics (:16), social-block-analytics, social-reports, social-users (app/admin/social-users/page.tsx:24,38), whale-submissions (uses credentials:'include' cookies but backend checks profiles.role via cookie session -> 401, app/admin/whale-submissions/page.tsx:60-61), audit-log. Their APIs require verifyAdminRequest/verifyAdminContext (Bearer).  
  `app/admin/revenue/page.tsx:65; app/admin/search-logs/page.tsx:37; app/admin/onboarding-analytics/page.tsx:16; app/admin/social-users/page.tsx:24; app/admin/whale-submissions/page.tsx:60`
- **P1** — Root /admin page requires a DIFFERENT auth than the rest of the panel. app/admin/page.tsx:287-320 gates on supabase.auth.getSession() + profiles.role='admin' and uses the Supabase session access_token as bearer (:302). But the wrapping AdminLayout only ever authenticates the static ADMIN_BEARER_TOKEN. An operator using the static token has no Supabase session, so the root page shows 'Not authenticated. Please sign in first.' and stats/users never load (accessToken stays '').  
  `app/admin/page.tsx:287-320 vs app/admin/layout.tsx:56-75`
- **P0** — Static bearer (the ONLY UI login) never writes any audit row: logAdminAction returns early when ctx.staticBearer is true (lib/auth/adminAuth.ts:143). So even if the CHECK constraint were fixed, UI-driven actions log nothing because the UI can only auth as the static bearer.  
  `lib/auth/adminAuth.ts:143`
- **P2** — audit-log action filter dropdown is cosmetic/wrong: options are set_tier/set_role/ban/copy_rule_create/copy_trade_execute etc. (app/admin/audit-log/page.tsx:14-25) which do not match the dotted action namespace the code actually writes (feature_flag.toggle, user.impersonate). Filtering by any option returns nothing even if rows existed.  
  `app/admin/audit-log/page.tsx:14-25`

**Fake / unwired:**
- TOTP is entirely unwired dead code. app/api/admin/totp/route.ts (GET/POST/PATCH) exists and comments claim 'the admin layout reads this to elevate the session', but grep of app/admin + components/admin finds ZERO references to /api/admin/totp or any TOTP UI. No enrollment QR, no step-up prompt. Also POST rejects staticBearer (totp/route.ts:35-37) and the only UI login IS the static bearer, so it is unusable even if wired.
- Impersonation is dead end-to-end. app/api/admin/impersonate/route.ts mints a 10-min JWT and claims 'the middleware unpacks a custom header', but grep of middleware.ts and lib finds no impersonation-token consumption anywhere. No admin page calls /api/admin/impersonate (zero frontend references). And under the static bearer, ctx.userId='admin-bearer' (not a uuid) so the admin_impersonation_tokens insert (admin_id uuid FK, migration 2026_05_24_admin_rbac.sql:56) would FK/type-error, though the error is never checked (impersonate/route.ts:71-77).
- admin_roles RBAC has no management UI. role.grant permission exists (lib/auth/adminAuth.ts:24) but there is no admin page to create/edit admin_roles rows; the whole 5-role matrix is unreachable because UI login always resolves to super_admin via the static bearer. RBAC is decorative for the UI.
- app/admin/audit-tracker/page.tsx (the 'Audit Tracker' nav item) is 100% hardcoded static content: AUDIT_AREAS array with hand-typed statuses ('in-progress'/'partial'/'fresh') (audit-tracker/page.tsx:13-21). No backend, no data source. Meanwhile the REAL audit-log page is not even in the sidebar nav.

**Missing backend:**
- No migration to fix the admin_audit_log.action CHECK constraint to allow the dotted action namespace the code emits — the single highest-leverage backend fix.
- No middleware to consume the impersonation JWT (the mint half exists, the redeem half was never built).
- No unified admin auth: half the surface expects a static bearer, half expects a Supabase admin session; there is no bridge that turns the layout login into a Supabase session usable by cookie-gated routes (audit-log, whale-submissions) or session-token routes (/api/analytics/admin, root page).
- logAdminAction ignores the dedicated before_state/after_state/ip_address/user_agent columns added by 2026_05_24_admin_rbac.sql:22-26 and instead crams before/after into details jsonb — wasted schema, and the impersonation route never records ip/user_agent.

**Missing frontend:**
- No TOTP enrollment/step-up UI at all (endpoint orphaned).
- No impersonation trigger UI, no active-impersonation banner, no 'stop impersonating' control.
- No admin_roles management screen (grant/revoke role, list admins).
- Broken pages (revenue, social-*, onboarding-analytics, whale-submissions) render blank/error on 401 rather than an explicit unauthenticated state; audit-log surfaces a raw 'status 401' string. search-logs at least degrades to an empty state (search-logs/page.tsx:45-46).
- audit-log/page.tsx has loading + empty + error states but no auth-specific messaging; the sidebar (app/admin/layout.tsx) has no mobile-hidden handling issues but the whole panel is a dark bespoke theme (#0A0E1A/#141824) that does NOT use the site glassmorphism brand consistently.

**Free-API recommendations:**
- This feature is internal RBAC/audit/ops tooling — no external market/security/social API is needed. Owner's locked matrix (Supabase, Upstash, Anthropic, Vercel) fully covers it; no new third-party API should be added.
- For TOTP, keep it self-hosted: the existing lib/auth/totp.ts (RFC 6238) plus Supabase to store the secret is the correct free approach — do NOT add any SaaS 2FA provider.
- For step-up/audit alerting, reuse the already-approved Telegram Bot API / VAPID push to notify on sensitive actions (user.impersonate, user.delete) — free, already in the allowed matrix.
- Fix, not add: write a migration `ALTER TABLE admin_audit_log DROP CONSTRAINT ... ; ADD CONSTRAINT CHECK (action ~ '^[a-z_.]+$')` or drop the CHECK entirely so real actions persist.

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem helps the admin panel. trustwallet/assets is a token-logo registry, wallet-core is a client-side signing library, and deep links are end-user wallet-app entry points — all user-wallet-facing. The admin panel is an internal operator console for RBAC, audit trails, TOTP, impersonation, feature flags, and moderation. There is no Trust Wallet product surface for internal admin auth, audit logging, or feature-flag management. Correct stack is the already-approved Supabase (roles/audit/flags) + Upstash (rate-limit) + Telegram/VAPID (alerts). Recommend: do not involve Trust Wallet here.

**Back-button offenders:**
- app/admin/not-found.tsx:8 — 'Back to admin' link hardcoded to /admin/dashboard rather than history back (minor; acceptable on a 404).
- app/admin/error.tsx:26 — recovery link hardcoded to /admin/dashboard (minor; acceptable on an error boundary).
- app/admin/page.tsx:475 — 'Open Dashboard' anchor hardcoded to /dashboard (intended external jump, not a back button).
- No true history-back buttons were subverted; the panel has no per-page back/breadcrumb component, so there are no /dashboard-hardcoded back-button bugs of the classic kind.

## alerts-notifications
**Verdict:** The core alert engine and in-app notification bell are genuinely wired end-to-end against real free data sources, but Telegram real-time delivery is broken for every server-fired alert, two whole backends (composite alerts, multi-channel) have no UI, and the bell is padded with synthetic market signals disguised as personal notifications.

- **P1** — Server-fired alerts NEVER push to Telegram in real time. fanOutNotification (the path every cron-fired alert uses) dispatches in-app + Discord + SMS + email but has no Telegram branch at all; the comment punts to 'the existing telegram-heartbeat path' which is only a health-check cron, not a delivery path. The working queueTelegramNotification helper is only called from the client-driven POST /api/notifications, never from the alert engine.  
  `lib/notifications/channels.ts:100-186 (no Telegram send); comment lib/notifications/channels.ts:10-11; contrast queueTelegramNotification only in app/api/notifications/route.ts:334`
- **P1** — Non-price smart alerts and composite alerts reach Telegram by NO path whatsoever. evaluateSmartAlerts only sets triggered=true for one-shot price alerts; whale/launch/wallet_activity fire repeatedly without stamping triggered. The digest cron selects only alerts WHERE triggered=true, so whale/launch/wallet_activity fires are never batched, and composite_alerts live in a different table the digest never reads. Result: a user who linked Telegram for whale/launch alerts gets zero Telegram messages ever.  
  `alert-monitor/route.ts:309-313 (triggered only on oneShot); notification-digest/route.ts:29-34 (.eq('triggered', true) on alerts table only)`
- **P1** — Discord + SMS notification channels have no UI. No component references /api/notifications/channels or user_notification_channels, so users cannot enter a Discord webhook or SMS phone through the app. fanOutNotification reads those rows but they can only be created via direct API calls, making both channels effectively dead for real users.  
  `grep of /api/notifications/channels and user_notification_channels across **/*.tsx returns no files; endpoint app/api/notifications/channels/route.ts:56-100 has no caller`
- **P2** — Composite alert fires are invisible in history and render with a fallback icon. fanOutNotification for composites writes metadata without source='smart_alert' and type 'composite_alert', but /api/alerts/history filters contains(metadata,{source:'smart_alert'}) so composite fires never appear, and 'composite_alert' is absent from the bell icon map so it shows the default Bell.  
  `alert-monitor/route.ts:198-199 (type 'composite_alert', metadata lacks source); alerts/history/route.ts:48; NotificationBell.tsx:56-80 (no composite_alert case)`
- **P2** — Dead user-id read. dashboard/notifications page reads localStorage 'steinz_user_id' to build ?userId, but that key is never written anywhere in the app (NotificationBell.tsx:89 documents it as dead); the value is always empty and the GET route ignores ?userId regardless (derives user from session).  
  `app/dashboard/notifications/page.tsx:77; NotificationBell.tsx:89; lib/notifications.ts:44`

**Fake / unwired:**
- Synthetic market signals injected into every user's notification bell as if they were personal notifications: GET /api/notifications fabricates 'Price Break', 'Trending Token', 'Sharp Price Drop', 'High Trading Volume' entries from CoinGecko top/trending tokens, identical for all users, in a module-level shared cache. Real API data but not per-user and not subscribed-to — app/api/notifications/route.ts:41-132,187-201
- Composite-alert builder + user-defined query DSL: full backend (app/api/alerts/composite/route.ts, lib/alerts/evaluateComposite.ts, cron evaluation, tier limits, migration) with ZERO frontend — no .tsx references /api/alerts/composite or composite_alerts
- Alert templates library: GET /api/alerts/templates (app/api/alerts/templates/route.ts) serves seeded alert_templates but no UI renders a picker — no .tsx references /api/alerts/templates or alert_templates
- steinz_user_id localStorage read that is never populated — app/dashboard/notifications/page.tsx:77, lib/notifications.ts:44

**Missing backend:**
- Telegram delivery inside fanOutNotification — add a Telegram branch calling the existing queueTelegramNotification/sendTelegramNotification (lib/telegram/notify.ts) so every server-fired alert honors user_telegram_links + per-kind prefs + quiet hours in real time
- A digest path that captures repeating (non-one-shot) whale/launch/wallet_activity and composite fires — currently only triggered=true one-shot price alerts are batched
- Composite fires should be tagged metadata.source='smart_alert' (or history query broadened) so they appear in /api/alerts/history
- The synthetic market feed should be separated from personal notifications (own endpoint / 'Market' tab) rather than merged into the per-user bell count

**Missing frontend:**
- No composite-alert builder UI (backend fully built, no page/modal to create AND/OR predicate trees)
- No alert-templates picker UI (backend serves curated recipes, nothing renders them)
- No Discord-webhook / SMS-phone management UI for /api/notifications/channels (users cannot enable those channels)
- No dedicated Telegram-per-alert opt-in surface tied to the alert engine (per-kind telegram_* prefs in lib/telegram/notify.ts:97-98 are only honored on the client POST path, never for cron-fired alerts)
- GET /api/notifications has no unauthenticated/empty distinction — anon users still receive the synthetic market feed, so the 'No notifications yet' empty state (NotificationBell.tsx:368-373) is essentially never reached

**Free-API recommendations:**
- Telegram Bot API sendMessage (https://api.telegram.org/bot<token>/sendMessage) is already integrated via lib/telegram/client.ts — the fix is wiring, not a new API: call it from fanOutNotification. Free.
- For the real-time price-alert latency floor, keep Alchemy/Helius + the existing CoinGecko price cache (price:cg:<id>) and DexScreener getDexPrice fallback already used in alert-monitor priceFor() — no new vendor needed.
- Fallback chain for price evaluation: CoinGecko cache -> DexScreener (/latest/dex/tokens/<addr>) -> GeckoTerminal (/api/v2/networks/<net>/tokens/<addr>) so an address-keyed alert can still fire when CG is cold; all free tier.
- VAPID web-push (already in lib/services/webpush.ts, used only by /api/notifications/test) should also be a fanOutNotification channel so browser push works for real alerts, not just the admin test route.
- Trust Wallet offers nothing here.

**Trust Wallet fit:** Trust Wallet's developer ecosystem offers nothing for alerts-notifications. trustwallet/assets is a token-logo registry (relevant only to token-image display, and the alerts UI already pulls thumbs from CoinGecko /api/market/resolve); wallet-core is a signing/keygen library; Trust Wallet deep links only open the Trust mobile app. There is no Trust Wallet push, alerting, or notification API. The delivery gap is a wiring problem inside the existing free stack (Telegram Bot API + VAPID web-push both already integrated), so no external vendor is warranted.

## approvals-signature-mev
**Verdict:** Approval Manager, Signature Insight, and Domain Shield are genuinely real multi-source features end-to-end; gasless swap is a real 0x v2 gasless integration; but "MEV protection" is largely theatre — the risk score is fed a token symbol instead of an address (so it is ~0 almost always), the "private mempool / Flashbots / Jito" toggle is completely unwired server-side, and the underlying service reads confirmed transfers (not the mempool) with fake buy/sell and sandwich fields.

- **P0** — MEV risk pill is fed a token SYMBOL, not a contract address. Swap page fetches /api/mev-protection?token=${toToken} where toToken is a symbol like 'USDC' (app/dashboard/swap/page.tsx:1411; toToken state = 'USDC' at page.tsx:597). The MEV service passes it straight into Alchemy contractAddresses:[tokenAddress] (lib/services/mev.ts:227), which is not a valid address, so transfers come back empty and sandwichRisk defaults to 0. The pre-trade MEV pill therefore shows ~0/100 for virtually every real swap — the feature does not function as displayed.  
  `app/dashboard/swap/page.tsx:1411 + lib/services/mev.ts:222-246`
- **P0** — MEV protect toggle is unwired server-side. The Settings toggle advertises 'Routes via private mempool (Flashbots / Jito) to block sandwich bots' (app/dashboard/swap/page.tsx:580) and shows a 'Protected' badge (page.tsx:2140), but mevProtect is only ever passed to /api/market/trade/execute, whose handler destructures the body WITHOUT mevProtect and never references Flashbots/private RPC (app/api/market/trade/execute/route.ts:55). The primary 0x EVM path sends via plain eth_sendTransaction to the user's public RPC (page.tsx:1192-1197). No private-mempool wiring exists anywhere.  
  `app/api/market/trade/execute/route.ts:55 (mevProtect ignored) + app/dashboard/swap/page.tsx:1106,1196`
- **P2** — Chain support mismatch: swap supports polygon/avalanche/optimism (page.tsx:72-73) but /api/mev-protection VALID_CHAINS only allows solana/ethereum/base/arbitrum/bsc (app/api/mev-protection/route.ts:8), so on those chains the MEV request 400s and the pill silently never appears.  
  `app/api/mev-protection/route.ts:8`
- **P2** — useSwapExecution.ts reads the wrong MEV schema: it expects mevData.level / mevData.score / mevData.warning (lib/hooks/useSwapExecution.ts:97-99) but /api/mev-protection returns activityLevel / sandwichRisk, so it always falls back to {level:'low',score:0}. Mitigated only by the fact that useSwapExecution is dead code (imported nowhere).  
  `lib/hooks/useSwapExecution.ts:97-99`
- **P2** — Single-revoke has no feedback path for built-in Naka wallet: sendRevoke returns false silently when window.ethereum is absent (app/dashboard/approval-manager/page.tsx:209-210) and, unlike batch, sets no txNote — the button just flips to 'failed' with no explanation for built-in-wallet users who pass the isOwnWallet check.  
  `app/dashboard/approval-manager/page.tsx:208-226`

**Fake / unwired:**
- Solana MEV buy/sell counts are fabricated: analyseSolanaMev builds every tx object with nativeTransfers:[] and tokenTransfers:[] HARDCODED empty (lib/services/mev.ts:150-153), so recentBuyCount (filter nativeTransfers.length>0) is always 0 and recentSellCount is always txs.length. Only fee/feePayer are actually parsed (mev.ts:184-185).
- MEV 'sandwich attack detection' is not real detection: the MevSandwichInfo interface declares attackerAddress/frontRunTxHash/backRunTxHash (mev.ts:17-24) but they are NEVER populated; sandwich.detected is just sandwichRisk>=75, a heuristic threshold (mev.ts:339-343). The service header comment claiming it 'detects sandwich attack' overstates this.
- mevLossEstimateUsd is an invented formula, not measured MEV: swapAmountUsd * (sandwichRisk/100) * 0.5 (lib/services/mev.ts:307-308) — an arbitrary 0.5% cap, presented as an 'estimated MEV loss for this swap'.
- EVM 'mempoolPendingCount' and the mempool premise are mislabeled: analyseEvmMev queries alchemy_getAssetTransfers with fromBlock/toBlock='latest' — CONFIRMED transfers in the latest block, not pending mempool txs (mev.ts:219-231) — yet reports transfers.length as mempoolPendingCount (mev.ts:278) and the file/route comments claim mempool analysis.
- EVM largeTradeCount treats raw token-unit transfer value as USD: t.value > 10_000 (mev.ts:256) compares Alchemy's decimal token amount against 10000 as if it were $10k, so 'large trade' counts are meaningless.
- Swap Settings copy 'private mempool (Flashbots / Jito)' + 'Protected' badge — claim of a feature with no backend (see broken P0 above).

**Missing backend:**
- Real private-mempool routing for the MEV protect toggle: no Flashbots Protect RPC (rpc.flashbots.net) for EVM and no Jito bundle relay for Solana are wired; the toggle is inert.
- Token symbol -> contract address resolution before calling /api/mev-protection (or the MEV route should reject non-address input instead of silently returning risk 0).
- Real mempool/sandwich analysis: the EVM path should use eth_getBlockByNumber('pending') / mempool streaming or a searcher feed rather than confirmed getAssetTransfers; Solana path should actually parse meta.preBalances/postBalances and token balances (currently discarded).
- USD normalization for 'large trade' detection (needs price x token amount, not raw value).
- Caching/rate-limit fallback so an Alchemy miss does not silently masquerade as 'low MEV risk' (risk 0) — should distinguish 'no data' from 'low'.
- polygon/avalanche/optimism support in the MEV route to match swap's chain list.

**Missing frontend:**
- There is NO dedicated MEV-protection dashboard page (app/dashboard/mev-protection does not exist) despite the scope naming one — MEV surfaces only as a pill inside the swap page, with no standalone loading/empty/error UI, no attacker/tx detail view, and no display of the (fabricated) poolActivity or recommendations the service computes.
- MEV pill has no error/empty state: if the API 400s (unsupported chain) or returns 0, the pill just disappears (setSandwichRisk(null)) with no 'MEV data unavailable' messaging (app/dashboard/swap/page.tsx:1408-1417).
- Approval Manager: no unauthenticated/no-wallet-connected guidance for the revoke path on the built-in wallet; the 'Revoke' button appears for own-wallet but silently fails without EIP-1193 injection.
- Gasless: no user-visible indication that slippage/toDecimals passed by the client are ignored by the gasless quote route (only sellToken/buyToken/sellAmount/taker/chain are read).

**Free-API recommendations:**
- Flashbots Protect RPC (free): https://rpc.flashbots.net (or https://rpc.flashbots.net/fast) — add as a wallet RPC / provider when mevProtect is on for ethereum; sends txs to the private mempool. This is the correct free backing for the existing toggle.
- Jito (free) for Solana MEV protection: submit bundles to the Jito Block Engine (mainnet.block-engine.jito.wtf) with a tip, instead of the public RPC, when mevProtect is on for Solana.
- MEV/sandwich data: Sim by Dune / Dune (already in the allowed matrix) for historical sandwich stats, or GeckoTerminal/DexScreener recent-trades endpoints (api.dexscreener.com/latest/dex/tokens/{addr}) to compute real buy/sell pressure per pool — replaces the fabricated Solana buy/sell split. Alchemy's alchemy_pendingTransactions subscription (WebSocket) gives an actual pending-tx feed if a live mempool signal is truly wanted.
- Token logo fallback for Approval Manager rows that lack a DexScreener/Alchemy logo: raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksumAddress}/logo.png (free, static GitHub) — chain the fallback DexScreener -> Alchemy -> trustwallet/assets -> initials.
- Fallback chain design for MEV pill: resolve symbol->address (internal token registry) -> DexScreener recent trades for real pool activity -> Alchemy pending-tx for EVM mempool signal; on all-fail return an explicit {available:false} so the UI shows 'MEV data unavailable' rather than 0/100.

**Trust Wallet fit:** "For the security core (revoke, calldata/typed-data decoding, mempool/MEV, phishing) Trust Wallet's developer ecosystem offers NOTHING useful — there is no Trust Wallet approvals API, no MEV/mempool service, no phishing/domain API, and wallet-core is a signing library the app does not need here. The ONLY marginally relevant asset is the trustwallet/assets GitHub logo registry, which is a legitimate FREE fallback for token/collection logos in the Approval Manager rows (raw.githubusercontent.com/trustwallet/assets/...) when DexScreener/Alchemy return no image. Even that is optional polish; the existing DexScreener + Alchemy logo sourcing already covers most tokens. Recommendation: do not adopt Trust Wallet for this feature beyond, at most, adding the assets registry as a last-resort logo fallback."

## archive-proof-preview
**Verdict:** Archive (Saved vault + Recent) and the proof detail surface are genuinely real and Supabase-backed, but the share pipeline is broken in production (in-memory Map store), the per-token OG image route is fully built yet wired to nothing, and the proof "Endorse Signal" poll is a local-only fake with no backend.

- **P0** — Share link retrieval is broken on serverless. /api/share stores short-ids in a module-level in-memory Map (shareStore). On Vercel the POST that mints /s/<id> and the later GET /api/share?id=<id> almost always hit different lambda instances (or a cold start), so retrieval returns 404 and /s/[id] renders 'Share Not Found'. Every copied short-link is effectively dead once the origin lambda recycles.  
  `app/api/share/route.ts:5,37-42,56-72 (Map + POST mint + GET by id); consumed by components/ContextFeed.tsx:92 and app/s/[id]/page.tsx:25`
- **P1** — /s/[id] share landing is a client component doing a client-side fetch with no generateMetadata/openGraph, so social crawlers (Twitter/Telegram/Discord) receive an empty shell and no unfurl. There is no server-rendered title/description/image for shared events.  
  `app/s/[id]/page.tsx:1-38 ("use client" + useEffect fetch, no metadata export)`
- **P2** — Proof explorer link is dead for Solana. The button only renders when event.txHash.startsWith('0x') (EVM hashes), but Solana signatures are base58 with no 0x prefix, so despite explorerUrl computing a solscan.io URL for chain==='solana', the 'View on Solscan' link never appears for any Solana event.  
  `app/dashboard/proof/page.tsx:643 (gate) vs :413-419 (solscan URL) and :651 (Solscan label)`

**Fake / unwired:**
- /api/og/token per-token OG image is fully built but has ZERO consumers — no generateMetadata or openGraph anywhere references it; a repo-wide grep for 'og/token' only matches the route's own doc comment. token-preview, proof, and /s/[id] are all client components with no metadata, so the OG card is never emitted (app/api/og/token/route.tsx; no reference in app/dashboard/token-preview/[id]/page.tsx or app/s/[id]/page.tsx).
- Proof 'Endorse Signal' poll is local-only and has no backend: yesVotes/noVotes are useState initialised to 0 and mutated only in-memory, resetting on every reload; the tooltip claims votes 'share your read with the community' but nothing is persisted or aggregated (app/dashboard/proof/page.tsx:356-357,424-429,731).
- Proof footer engagement counts (views/shares/likes) merely echo the sessionStorage event payload fields with '?? 0' — they are not live counts and are not updated by any interaction (app/dashboard/proof/page.tsx:769-771).

**Missing backend:**
- Durable storage for share short-ids: the in-memory Map must be replaced with a persistent store so /s/<id> resolves reliably across lambda instances.
- Vote persistence + aggregation backend for the proof 'Endorse Signal' poll (currently no table, no endpoint).
- Server-side metadata/OG wiring: no page in this feature emits openGraph tags, so the built /api/og/token image is never used by any unfurl.
- No caching/rate-limit handling on the share POST path (mints a fresh short-id and grows the Map unbounded per request).

**Missing frontend:**
- Proof page has no loading state: if sessionStorage 'steinz_proof_event' is empty (direct navigation, refresh, or a shared link), it instantly renders 'Event not found' with a Back to Dashboard button — no skeleton, and a shared/deep-linked proof URL can never hydrate (app/dashboard/proof/page.tsx:390-401).
- Proof page is not wrapped in AuroraBackground and uses a bare min-h-screen, unlike the Archive page which uses the branded AuroraBackground + nl-glass system — brand inconsistency across the same feature (app/dashboard/proof/page.tsx:443-444 vs app/dashboard/archive/page.tsx:112).
- /s/[id] share landing uses a legacy '.glass' class and a hardcoded bg-[#0A0E1A] instead of the platform nl-glass/AuroraBackground brand system (app/s/[id]/page.tsx:66-68).
- token-preview trusts listing.logoUrl into a raw <img> with no onError fallback; a broken/expired logo URL renders a broken image rather than the symbol-initials placeholder that already exists for the no-logo case (app/dashboard/token-preview/[id]/page.tsx:121-127).

**Free-API recommendations:**
- Share persistence: use Upstash Redis (allowed free tier) SET shareId payload EX 2592000 on POST and GET on read — swap the Map for @upstash/redis in app/api/share/route.ts. Alternatively persist to a Supabase 'shared_events' table exactly like the existing vtx/share flow already does (app/api/vtx/share/route.ts:57-68).
- Even simpler and storage-free: the route already supports a stateless base64 'payload' GET variant (app/api/share/route.ts:74-91) — have ContextFeed generate /s/?payload=<base64> links instead of /s/<shortId>, eliminating the store entirely.
- Wire the existing /api/og/token image into a server generateMetadata() on a server component wrapper for proof/token-preview/share pages (openGraph.images = `/api/og/token?symbol=..&price=..&change=..&trust=..`) so unfurls render the live token card.
- Token logos in proof/token-preview: add trustwallet/assets raw logos (https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksumAddress}/logo.png) as a free static fallback behind DexScreener/CoinGecko logo resolution.

**Trust Wallet fit:** "Narrowly useful for ONE thing only: the trustwallet/assets GitHub registry is a free static CDN of token logos (raw.githubusercontent.com/trustwallet/assets/.../logo.png keyed by checksummed contract) that would serve as a good zero-cost fallback for token/logo rendering in token-preview and the proof/SwapCard destination token. It offers nothing for the actual proof DATA — holder distribution, security/honeypot/LP-lock, price/volume/liquidity, market cap — which are already correctly sourced from bubble-map, GoPlus (context-feed/security), and DexScreener/CoinGecko. wallet-core and Trust deep links are irrelevant to a view/preview surface. Net: adopt the assets logo registry as a logo fallback only; do not expect any data help."

**Back-button offenders:**
- app/dashboard/proof/page.tsx:453 — BackButton href="/dashboard?subtab=context" hardcodes a router.push to a dashboard variant instead of history.back(); a user who arrived from Archive Saved or LiveWire is bounced to the Context Feed sub-tab rather than back where they came from.
- app/dashboard/proof/page.tsx:395 — not-found fallback button hardcodes router.push('/dashboard').
- app/s/[id]/page.tsx:55,93 — 'Go to Dashboard' / 'Open in Naka Labs' buttons hardcode router.push('/dashboard') (acceptable for a public landing with no history, but noted).
- app/dashboard/token-preview/[id]/page.tsx:101 — BackButton href="/dashboard/project-discovery" is a hardcoded push rather than history back (contextually reasonable but not history-aware).

## auth-walletconnect
**Verdict:** The wallet-connect signup/signin flow is genuinely wired end-to-end (real SIWE/SIWS nonce -> signature -> server verify -> Supabase magic-link session, backed by real tables), but Turnstile is client-side theater that adds no server-enforced protection, the wallet auth endpoints have zero rate limiting, and the "graceful degradation when WalletConnect is unconfigured" claim is false (the buttons call wagmi/AppKit hooks before their HAS_APPKIT guard and will throw).

- **P1** — WalletAuthButton calls wagmi hooks useAccount/useSignMessage/useDisconnect and useAppKit unconditionally, BEFORE the `if (!HAS_APPKIT) return null` guard. When NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is unset, WalletProviders renders NO WagmiProvider (app/wallet-providers.tsx:49-51) and getAppKit() never calls createAppKit, so these hooks throw WagmiProviderNotFound / 'call createAppKit first' and crash the entire login AND signup page into the error boundary. The component's own docstring claims it 'silently no-renders' in this case — false.  
  `components/auth/WalletAuthButton.tsx:41-44,102`
- **P1** — Turnstile is not enforced on the server for the actual auth mutations. Login calls supabase.auth.signInWithPassword({email,password}) client-side with NO captchaToken passed (app/login/page.tsx:258), and /api/auth/signup performs createUser with no captcha/turnstile check at all. The /api/auth/verify-captcha call is a separate client-side gate an attacker simply skips by POSTing the mutation endpoints directly. Captcha is effectively decorative for its stated purpose.  
  `app/login/page.tsx:258; app/api/auth/signup/route.ts:99-116 (no token check)`
- **P1** — No rate limiting on /api/auth/wallet-nonce or /api/auth/wallet-verify. wallet-nonce is an unauthenticated INSERT into auth_wallet_nonces (DB write amplification / table flooding) and wallet-verify runs expensive admin paths (getUserById, entitlement chain calls, admin.createUser, generateLink) — all unthrottled. Every other auth route uses lib/rateLimit; these two don't.  
  `app/api/auth/wallet-nonce/route.ts:23-57; app/api/auth/wallet-verify/route.ts:34-215`
- **P2** — No cleanup/TTL prune for auth_wallet_nonces. Rows are only marked consumed or left to expire; there is a cron for login-activity-prune but none for expired nonces, so the table grows unbounded (every connect attempt writes a row).  
  `app/api/auth/wallet-nonce/route.ts:46-53 (insert only); no prune route under app/api/cron for nonces`
- **P2** — SIWE domain can mismatch the served origin. resolveSiweOrigin prefers NEXT_PUBLIC_SITE_URL for the signed domain (lib/auth/siwe.ts:90-101) while AppKit metadata.url prefers window.location.origin (lib/wallet/appkit.ts:61-63). On www vs apex (or preview) the wallet prompt shows one domain while WalletConnect Verify sees another; compliant wallets may warn or refuse.  
  `lib/auth/siwe.ts:91-96 vs lib/wallet/appkit.ts:61-63`
- **P2** — Session is hard-capped at 1 hour by both the middleware cookie writer and the browser client (middleware.ts:113,149; lib/supabase.ts SESSION_SECONDS=3600). Auth callback separately claims 4-hour sessions (app/auth/callback/page.tsx:8 SESSION_HOURS=4, expires_in 14400) — inconsistent session lifetime between the wallet/OAuth callback path and the password path.  
  `app/auth/callback/page.tsx:8,20; middleware.ts:113; lib/supabase.ts:4`

**Fake / unwired:**
- Turnstile 'security check' UI presents as a real gate but is not enforced server-side on signup or signin — a real-looking control with no backing enforcement (app/login/page.tsx:258, app/api/auth/signup/route.ts:99-116)
- WalletAuthButton docstring claims it 'Renders nothing if WalletConnect Project ID is not configured' and 'the page still works' — untrue; it throws before the guard (components/auth/WalletAuthButton.tsx:33-37,102)
- verify-captcha fails open on missing secret, Cloudflare non-OK, or timeout, returning {success:true} (app/api/auth/verify-captcha/route.ts:39-41,60-64,83-87) — so even the client gate is bypassable during any Cloudflare hiccup (documented as intentional, but combined with no server enforcement it means captcha provides near-zero real protection)

**Missing backend:**
- Rate limiting absent on wallet-nonce and wallet-verify (see broken) — needs Upstash bucket like every other auth route
- Server-side captcha enforcement absent on the signup mutation and on signin (no captchaToken relayed to Supabase) — Turnstile token is verified in isolation and never bound to the mutation
- No prune pipeline for expired auth_wallet_nonces rows
- No fallback when Alchemy ENS lookup or entitlement resolution is slow beyond the wallet-verify request — entitlement errors are swallowed (wallet-verify/route.ts:197-201) which is correct, but there is no retry/queue so a first-login user with a chain hiccup silently lands without their cult/Max grant until a later trigger
- signup's admin.auth.admin.listUsers() (app/api/auth/signup/route.ts:84) loads ALL users into memory on every signup to dedupe email/username — O(n) and will degrade; there is a profiles.username index path but email dedup still full-scans auth users

**Missing frontend:**
- Signup Turnstile block lacks the login page's watchdog + 'unreachable' message + 'Refresh security check' button (app/signup/page.tsx:481-496 vs app/login/page.tsx:509-535). If the widget renders but hangs on 'verifying', signup submit is blocked (validate requires token when captchaReady) with no recovery path.
- Turnstile is forced to theme:'light'/colorScheme:'light' — a white 300x65 box injected into the dark glassmorphism card (app/login/page.tsx:80,501; app/signup/page.tsx:98,489). Breaks brand consistency and is a jarring contrast island on the #06060f card.
- No loading skeleton while authLoading: an already-authenticated user hitting /login or /signup sees the full form flash before the window.location redirect fires (app/login/page.tsx:135-139; app/signup/page.tsx:129-132).
- WalletConnectGroup renders both EVM and Phantom buttons with no per-button disabled/empty state when a provider is unavailable — feedback is toast-only, and on desktop with no Phantom it opens a download tab (SolanaWalletAuthButton.tsx:115-117) with no inline hint.
- No explicit 'wallet connected, awaiting signature' state — the button jumps straight from label to 'Verifying…' (WalletAuthButton.tsx:133-134); a user who dismisses the wallet signature prompt just sees the spinner reset via disconnect() with only a toast.

**Free-API recommendations:**
- Upstash Redis (already in the stack via lib/rateLimit): add rateLimit('auth:wallet-nonce:{ip}', 10/min) and rateLimit('auth:wallet-verify:{address}', 5/min) to the two wallet routes
- Supabase Auth Attack Protection: enable Turnstile/hCaptcha in the Supabase dashboard and pass options.captchaToken to supabase.auth.signInWithPassword and to admin signup so the captcha is enforced by Supabase itself, not just the client — closes the bypass with the free Turnstile already in the matrix
- Supabase pg_cron (free, in-project): DELETE FROM auth_wallet_nonces WHERE expires_at < now() - interval '1 day' on an hourly schedule; or add an app/api/cron/wallet-nonce-prune route wired in vercel.json cron
- Replace listUsers() email dedup with a targeted lookup: query auth.users via admin.rpc or a profiles(email) unique index + maybeSingle, avoiding the full-table load on every signup

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem meaningfully helps this feature, and adding it would be redundant. Trust Wallet is already fully reachable in the EVM flow because it is a WalletConnect v2 wallet — it appears automatically in the Reown AppKit modal (lib/wallet/appkit.ts) with zero extra integration. trustwallet/assets is only a token-logo registry (irrelevant to auth). wallet-core is a client-side signing library and is a non-starter here: the flow is non-custodial and the user's own wallet performs the SIWE signature (WalletAuthButton/SolanaWalletAuthButton), so importing a signing lib would add bundle weight for no capability. Trust Wallet deep links (link.trustwallet.com) overlap entirely with what WalletConnect's own mobile deep-link/QR handshake already does. Recommendation: keep WalletConnect (via AppKit) as the single EVM connector and Phantom's injected provider for Solana; do not add any Trust Wallet SDK. The one real mobile-UX gap (Phantom deep-link is hand-rolled in SolanaWalletAuthButton.tsx:57-62) is better solved by adding the Solana adapter to AppKit's modal, not by Trust Wallet tooling.

## bridge
**Verdict:** Native-token EVM happy path works end-to-end (quote to sign to broadcast to status poll), but ERC20/stablecoin bridging is fully broken (no approval flow + hardcoded 18-decimal parsing) and the history-recording insert is dead-on-arrival because 'bridge' is not in the pending_trades source_reason CHECK constraint.

- **P0** — execute insert uses source_reason='bridge' but the pending_trades CHECK constraint permits no 'bridge' value in either constraint version (session5b2 allows only limit_order/dca/stop_loss/take_profit/trail_stop/copy_trade/vtx_chat; 06_27 adds sniper_* but still no bridge). The insert always violates the constraint, returns 500, and no bridge is ever recorded. Because the client calls execute as fire-and-forget (void fetch), the user never sees the failure.  
  `app/api/bridge/execute/route.ts:68 vs supabase/migrations/2026_session5b2_vtx_chat_reason.sql:13-18 and 2026_06_27_pending_trades_allow_sniper_sources.sql:13`
- **P0** — No ERC20 approval/allowance step. LiFi requires an approve() to estimate.approvalAddress before the bridge tx for any non-native token, but the page only sends the single transactionRequest. Bridging any ERC20 (incl. USDC/USDT) reverts because the LiFi contract cannot pull tokens. approvalAddress is typed in LifiQuote.estimate but never read.  
  `app/dashboard/bridge/page.tsx:156-161; lib/services/lifi.ts:70 (approvalAddress defined, unused)`
- **P1** — Amount parsing hardcodes 18 decimals: parseUnits(amount, 18). For 6-decimal tokens (USDC/USDT) entering 100 sends 100e18 base units (100 trillion) to LiFi, yielding 'no route' or a nonsense quote. All stablecoin bridging is broken; only 18-decimal native tokens work.  
  `app/dashboard/bridge/page.tsx:107`
- **P1** — Status polling permanently halts on any non-2xx response: 'if (!res.ok) return;' returns without scheduling the next tick. LiFi /status frequently 502s or is unindexed right after broadcast (status route returns 502 when getLifiStatus is null), so the poll silently dies and the user is stuck on PENDING forever.  
  `app/dashboard/bridge/page.tsx:199; status route.ts:24`
- **P2** — getLifiQuote swallows LiFi's error body, returning null on any non-ok, so the route returns generic 'No route available' (404). Combined with the decimals bug, users get no actionable error (e.g. amount-too-low, token-unsupported).  
  `lib/services/lifi.ts:104; app/api/bridge/quote/route.ts:57-59`
- **P2** — Solana bridging is impossible from this UI though the backend supports it: CHAINS is EVM-only (page.tsx:36-43) and execution uses window.ethereum + parseUnits, yet execute route branches on fromChain==='solana' (dead branch that page.tsx can never trigger since it passes EVM keys).  
  `app/dashboard/bridge/page.tsx:36-43,72; app/api/bridge/execute/route.ts:72`

**Fake / unwired:**
- execute route comment claims 'the status cron can poll LiFi and reconcile' but no cron handles bridge/lifi/source_reason='bridge' (grep of app/api/cron/receipt-reconciliation and all crons returns nothing) — the reconciliation pipeline does not exist. app/api/bridge/execute/route.ts:14-15
- isLifiConfigured() is exported but never called anywhere in app/ — there is no guard/fallback when LIFI_API_KEY is absent or LiFi is down. lib/services/lifi.ts:141-143
- estimate.approvalAddress is declared in the LifiQuote type as if used, but no code reads it — implies an approval flow that was never built. lib/services/lifi.ts:70

**Missing backend:**
- Server-side bridge reconciliation cron (polls LiFi /status for recorded bridges and updates pending_trades) — claimed in comment, does not exist.
- pending_trades source_reason CHECK migration to add 'bridge' — without it every execute insert fails.
- No caching of LiFi quotes/status (each call hits li.quest directly) and no rate-limit/429 handling or backoff in lib/services/lifi.ts.
- No fallback chain if LiFi quote fails — single provider, blank result on failure.
- Token decimals resolution on the server (fetch decimals for fromToken) so the client stops hardcoding 18.

**Missing frontend:**
- No wallet-balance display or insufficient-balance check before quoting/bridging — user can request a route for more than they hold and only discover it at signing.
- No unauthenticated state: page never checks auth; the execute 401 is swallowed by void fetch so a logged-out user's bridge broadcasts but is never recorded with no feedback. page.tsx:165-180
- No empty/idle guidance and no per-chain token presets — token fields are raw hex free-text (page.tsx:225,228), inviting wrong-decimal and wrong-address errors.
- No approval-in-progress UI step (needed once ERC20 approval is added).
- No fallback UI when LiFi is unreachable/rate-limited — quote null just shows 'No route available', indistinguishable from an outage.
- Status card lacks a terminal FAILED explanation/retry and shows no distinction between 'polling stopped' and 'still pending'. page.tsx:270-300

**Free-API recommendations:**
- Keep LiFi as sole bridge (locked matrix compliant). Use GET https://li.quest/v1/quote/toAmount and the /quote response's estimate.approvalAddress to drive the missing ERC20 approve() step.
- Resolve token decimals instead of hardcoding 18: read it from the LiFi quote's action.fromToken.decimals (already returned by https://li.quest/v1/quote) or call an Alchemy/Helius eth_call to decimals() — no new paid API needed.
- Add /v1/tokens (https://li.quest/v1/tokens) to populate a per-chain token picker with addresses+decimals+logos, eliminating raw-hex entry and decimal bugs.
- For status robustness, keep polling on 502/NOT_FOUND with backoff rather than halting; LiFi /status returns status:'NOT_FOUND' (HTTP 200) until indexed — treat that as pending.
- Fallback chain: LiFi /quote -> on null, retry /advanced/routes (already implemented as getLifiRoutes) and surface the best route before giving up.

**Trust Wallet fit:** Trust Wallet offers little here. Its trustwallet/assets GitHub registry could supply token logos/metadata for a token picker, but LiFi's own /v1/tokens endpoint already returns addresses, decimals, and logoURIs per chain and is the better, single-source fit. wallet-core and Trust Wallet deep links are irrelevant to a browser dApp that signs via window.ethereum/ethers. There is no Trust Wallet bridging API. Recommendation: do NOT add Trust Wallet for bridge; use LiFi /v1/tokens for the token list and on-chain decimals() (via existing Alchemy RPC) for correctness.

## bubble-map
**Verdict:** The UI, API auth/tier-gating, and error/empty/loading states are genuinely well built and wired to real holder data — but real holder coverage only works for Ethereum and (partially) Solana, the Solana fallback percentages are mathematically wrong, and it leans on two PAID, non-approved APIs (Birdeye + Arkham) for its core value.

- **P0** — EVM holder fetch ignores the selected chain — getTopERC20Holders takes no chain param and always hits api.ethplorer.io (Ethereum-only). For BSC/Base/Arbitrum/Polygon token addresses it returns [] , so the graph shows the empty 'No holder data available' state. 4 of the 6 chains in the dropdown produce no bubble map.  
  `lib/services/etherscan.ts:190-201 (no chain arg, hardcoded api.ethplorer.io) called at lib/services/contract-intelligence.ts:135 with only (address,20); CHAIN_OPTIONS advertises bsc/base/arbitrum/polygon at app/dashboard/bubble-map/page.tsx:103-107`
- **P0** — Solana fallback holder percentages are wrong and addresses are token accounts, not owners. getTokenLargestAccounts returns the top-20 SPL token accounts and percentage is computed relative to the SUM OF THOSE 20, not circulating supply — so the top-20 always sum to ~100% and topHolderConcentration (top-5) is massively inflated. This path runs whenever Birdeye returns nothing (i.e. no paid Birdeye key).  
  `lib/services/alchemy-solana.ts:229-239 (percentage = uiAmount/sum-of-top-20; a.address is the token account); consumed at lib/services/contract-intelligence.ts:364-376`
- **P1** — D3 force graph fully tears down (svg.selectAll('*').remove()) and re-runs the entire force simulation on every node selection AND on every keystroke in the 'Find wallet' box, because `selected` and `pinnedAddress` are in the effect dependency array. Bubbles reshuffle/fly on each click and each character typed — the exact rendering-perf complaint.  
  `app/dashboard/bubble-map/page.tsx:396 (deps [data, selected, onNodeClick, fullscreen, pinnedAddress]) with teardown at page.tsx:268 and new sim at 362`
- **P2** — getTokenDetail is called with the token SYMBOL where CoinGecko expects a coin ID (/coins/{id}). For any token whose symbol != CoinGecko id (nearly all) this 404s, so the CoinGecko marketCap/priceChange enrichment silently fails and cgMarketCap stays 0 — the USD link-weighting and center-bubble color-by-24h-change quietly fall back to raw percentage/intel data.  
  `app/api/bubble-map/route.ts:184 getTokenDetail(intel.symbol.toLowerCase()); definition lib/services/coingecko.ts:251 getTokenDetail(coinId)`
- **P2** — Share button fails silently when JWT_SECRET/SESSION_SECRET is unset: the POST throws 500, shareView() just returns on !res.ok with no user-facing error, leaving the button stuck after 'Signing…'.  
  `app/api/bubble-map/share/route.ts:20-24 throws; app/dashboard/bubble-map/page.tsx:634 `if (!res.ok) return;` with no error surfaced`

**Fake / unwired:**
- 'Wallet Network' mode edges are fabricated, not real on-chain relationships: buildWalletConnections draws links between holders that merely share a type or have similar percentages (diff<0.3), framed as 'coordination signal' — there is no transaction/funding graph behind it. app/api/bubble-map/route.ts:86-124
- 'Cluster View' groups holders by their type label (exchange/whale/etc), not by any real on-chain cluster (common funding source / same-day creation). The map has no funding data. app/api/bubble-map/route.ts:230-239
- Agent system prompt instructs Claude to 'Identify dev-wallet patterns... cluster of wallets funded by the same source, all created in the same day' but no such data is ever computed or passed — the model is asked to detect clusters the visualization cannot see. app/api/bubblemap-agent/route.ts:60
- Conversation persistence is write-only: the route docstring claims a returning user can 'reopen the same token and pick up where they left off' and it upserts to bubblemap_conversations, but nothing ever reads it back — the page always starts from the static welcome message. app/api/bubblemap-agent/route.ts:12-24 & :158-180 vs page.tsx:539-543 (no load path).
- Entity 'verified' CEX/Protocol/Team badges depend entirely on the paid Arkham API; with ARKHAM_API_KEY unset every holder collapses to 'whale' with verified=false, so the labeled-entity value prop is invisible on free tier. lib/services/contract-intelligence.ts:198-238
- Solana holders returned via Birdeye/Alchemy carry entityName=null/verified=false always, so on Solana (the default chain, page.tsx:522) the entity-label column is permanently blank. lib/services/contract-intelligence.ts:347-376

**Missing backend:**
- No historical holder snapshots: timeline scrubber was (honestly) replaced by a 'Live' badge (page.tsx:831-840) and route surfaces snapshotAt but data is always current, despite a holder_snapshots table + uniq migration existing (supabase/migrations/2026_holder_snapshots_uniq_day.sql). The snapshot pipeline is unbuilt.
- Bubble-map agent has NO auth requirement and NO rate limit — getUser() can be null and the Anthropic call still runs (bubblemap-agent/route.ts:121-147). Owner pays for Anthropic; this is an unauthenticated, unthrottled token-cost sink, unlike the tier-gated main route.
- No multi-chain EVM holder source: the pipeline has no fallback when Ethplorer (ETH-only) returns nothing for a BSC/Base/Arbitrum/Polygon token — blank UI, no secondary indexer.
- No Solana holder fallback that computes real share-of-supply when Birdeye is absent — the only fallback (getTokenLargestAccounts) is the broken-percentage path.
- Caching is in-process only (lib/api/cache-manager, TTL.GENERAL ~2min); no shared Upstash Redis layer, so every cold Vercel lambda re-runs the full 7-source fan-out.

**Missing frontend:**
- No rich D3 tooltip — only a native SVG <title> (page.tsx:330-341); acknowledged as a follow-up but means no logos/sparklines on hover.
- Center token bubble never renders the token logo despite logoURI being fetched all the way through the API (tokenInfo.logoURI); nodes are color circles only — a Trust Wallet assets logo fallback could fill this.
- WCAG AAA contrast: pervasive text-[9px]/[10px] text-gray-600 hints on the near-black background (e.g. page.tsx:494 'Holder data:', 873, 926 legend counts) fall well below AAA (7:1).
- No skeleton for the holder list / concentration card independent of the graph spinner — the whole right column pops in at once.
- Suggested questions only appear while chatMessages.length<=1 (page.tsx:1028); after one message the on-ramp disappears with no other affordance.

**Free-API recommendations:**
- EVM multi-chain holders (fixes the P0): Sim by Dune Token Holders — GET https://api.sim.dune.com/v1/evm/token-holders/{chain_id}/{token_address} (free tier, approved). Returns owner wallet + balance across Ethereum/BSC/Base/Arbitrum/Polygon/Optimism. Replace the chain-ignoring Ethplorer call.
- Solana holders with REAL supply % (fixes the P0 fallback): RugCheck — GET https://api.rugcheck.xyz/v1/tokens/{mint}/report (approved, free) returns topHolders[].pct as true share of supply plus insider/creator flags. Fallback chain: Birdeye(if key) -> RugCheck -> Helius DAS getTokenAccounts (paged owners) instead of getTokenLargestAccounts.
- Contract-address market cap + 24h change for the center-bubble color (fixes getTokenDetail(symbol) bug): GeckoTerminal (CoinGecko onchain, approved) — GET https://api.geckoterminal.com/api/v2/networks/{network}/tokens/{address} returns price_change_percentage + market_cap_usd keyed by contract, no symbol->id guessing.
- Entity labels to reduce Arkham dependence: GoPlus (already used) dex/cex flags + a maintained known-address JSON; there is no free source as strong as Arkham for CEX labeling — document that gap rather than paying for Arkham.
- Fallback-chain design: for each field try approved-primary -> approved-secondary -> honest-null; never let a single provider's empty response collapse to a blank graph. Cache the merged intel in Upstash Redis (approved) keyed by chain:address for ~120s to cut the 7-call fan-out.
- Rate-limit + auth the agent route with the same Supabase session check and an Upstash Redis sliding-window (approved) to stop unauthenticated Anthropic spend.

**Trust Wallet fit:** "Marginal. The only relevant Trust Wallet asset is the trustwallet/assets logo registry (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksumAddress}/logo.png) — a free, keyless per-contract token-logo fallback that could finally render a real logo on the center bubble and on labeled-entity nodes (which today show text-in-a-circle only). It does NOT help the actual gaps: it has no holder data, no holder percentages, no entity/CEX classification, and no transaction graph. wallet-core and deep links are irrelevant to a holder-distribution view. Net: adopt trustwallet/assets purely as a logo image fallback; use Sim by Dune + RugCheck + GeckoTerminal for the data that actually matters."

## context-feed
**Verdict:** The feed genuinely aggregates ~17 real free-API sources with solid dedup, persistence and alerts, but the "live" layer is partly theater: SSE dies within 5 minutes and silently downgrades forever, event timestamps are fabricated at fetch time, upstream failures render as an innocent "Waiting for activity" empty state, and every cache miss fires ~70 uncached DexScreener calls with zero 429 handling.

- **P1** — SSE permanently self-destructs: the server emits `event: error` frames on ANY transient upstream non-OK tick (events/route.ts:64-66,78), which dispatch as type-'error' events on the client EventSource and trigger es.onerror, which closes the stream and falls back to polling FOREVER with no reconnect attempt; independently, maxDuration=300 (events/route.ts:21) ends every stream at 5 minutes and the same onerror path kills SSE for the rest of the session. The comment 'then client reconnects' is false - the client never reconnects.  
  `lib/hooks/useContextFeed.ts:167-172; app/api/context-feed/events/route.ts:21,64-66,78`
- **P1** — SSE is per-connection self-polling, not fan-out: each connected client holds its own serverless function alive for 5 minutes, self-fetching /api/context-feed every 5s with the user's cookie. The header comment 'Multiple connected clients share one upstream tick' is false - N clients = N functions x 60 self-invocations each per 5 min. Burns Vercel function-duration (the one bill the owner pays) and multiplies upstream API pressure.  
  `app/api/context-feed/events/route.ts:6-8,55-86`
- **P1** — Fetch failures render as a fake-calm empty state: errors are swallowed with only a console.warn, loading is set false, and the UI shows 'No Events on X / Waiting for activity...' with a pulsing 'Live' dot - the user cannot tell a total outage from a quiet market. No error state, no retry affordance beyond the generic Refresh.  
  `lib/hooks/useContextFeed.ts:121-129; components/ContextFeed.tsx:594-605,650-653`
- **P1** — DexScreener stampede with no rate-limit handling: one cache-miss 'all' refresh fires ~70+ DexScreener requests (12 ETH searches + profiles per chain across 8 chains at route.ts:1120-1192, 40 boost-search lookups at route.ts:1032-1040, 8 rug candidates x2 at route.ts:869-895, 6 social lookups at route.ts:984). DexScreener caps token-profiles/token-boosts at 60 req/min and search at 300 req/min. The response cache is in-memory per-lambda with a 5s TTL (route.ts:127-128) and there is no in-flight coalescing, so concurrent cold lambdas + SSE ticks blow the limits; 429s silently become [] and the feed thins with no signal.  
  `app/api/context-feed/route.ts:127-128,1032-1040,1120-1192`
- **P1** — All CoinGecko-sourced events hardcode chain:'ethereum' - a trending SOL or BTC coin gets an ETH badge in the UI AND the ethereum +35 chain-rank boost in scoring, misattributing chain data on every gainer/trending/new-listing/top-10 card.  
  `app/api/context-feed/route.ts:346,373,396,420; lib/contextFeed/filter.ts:70-79`
- **P2** — Server cursor pagination is dead code: GET supports ?cursor (route.ts:1255,1467-1473) but the client never sends it (hook always fetches limit=200, useContextFeed.ts:113). Meanwhile the UI cap notice claims 'Older items live in the Archive tab' - false: items 81-200 are neither rendered nor archived (archive = >24h old only). They are simply invisible.  
  `app/api/context-feed/route.ts:1467-1473; lib/hooks/useContextFeed.ts:113; components/ContextFeed.tsx:902-907`
- **P2** — Sentiment case mismatch: CoinGecko events emit lowercase 'bullish'/'neutral' while the card checks strict equality against 'BULLISH'/'BEARISH' and prints the raw string - those cards always render the amber neutral color with a lowercase pill, never green/red.  
  `app/api/context-feed/route.ts:340,367,391,414; components/ContextFeed.tsx:670-672,692`
- **P2** — Chain/filter-switch loading race: the new effect sets loading=true then fetchEvents() aborts the previous request, whose finally block sets loading=false while the new fetch is still in flight - flashing the 'No Events' empty state instead of the spinner.  
  `lib/hooks/useContextFeed.ts:103-138 (finally at :128)`
- **P2** — hasArchive is computed by two DB queries per request and returned to the hook, but the component destructures it and never uses it - the Archive tab renders unconditionally.  
  `components/ContextFeed.tsx:267 (sole reference); app/api/context-feed/route.ts:276-298`
- **P2** — Engagement is only fetched/viewed for the first 5 unseen events per events-change (slice(0,5)) - cards further down show 0 views/likes until enough poll cycles pass, understating real counts.  
  `components/ContextFeed.tsx:468-490`

**Fake / unwired:**
- Fetch-time stamped as event time: recentTimestamp() returns new Date() and is used for CoinGecko gainers/trending, DexScreener trending, Birdeye, rug alerts and social events - every cache refresh, these events re-appear as 'just happened now'; the card clock shows a fabricated time (app/api/context-feed/route.ts:120-123,325,838,944; components/ContextFeed.tsx:730)
- displayTimestamp is deliberately fabricated: staggerDisplayTimestamps rewrites the visible clock so adjacent events are >=6s apart - the UI shows times that never occurred (lib/hooks/useContextFeed.ts:48-64; rendered at components/ContextFeed.tsx:730)
- Solana 'network activity' cards invent a USD figure (valueUsd = txCount * 0.01 * SOL price) and fabricate timestamps (Date.now() - i*60000) - pure made-up numbers shown as 'TX: $...' (app/api/context-feed/route.ts:605,610)
- Muted sources (CF3) is backend-only: the filter reads user_preferences.preferences.muted_feed_sources (app/api/context-feed/route.ts:35-53; lib/contextFeed/filter.ts:189-194) but a repo-wide grep shows NO component or settings page ever writes muted_feed_sources - users have no way to mute anything; the feature is unreachable
- SSE route header comment claims shared upstream tick and client reconnect - both false (app/api/context-feed/events/route.ts:6-8,21 vs lib/hooks/useContextFeed.ts:167-172)
- Birdeye is used as a feed source requiring BIRDEYE_API_KEY (app/api/context-feed/route.ts:16,687-724; lib/services/birdeye.ts:5) - Birdeye is NOT in the owner's locked free-tier API matrix; silently returns [] when the key is absent/exhausted

**Missing backend:**
- No durable shared cache for the assembled feed: responseCache is in-memory per-lambda with a 5s TTL (app/api/context-feed/route.ts:127-128) - every cold instance rebuilds from ~70 upstream calls. Upstash Redis is in the approved matrix and unused here
- No in-flight request coalescing: N concurrent cache-miss requests each run the full 17-source Promise.all
- No 429/backoff/circuit-breaker handling for DexScreener, CoinGecko or GeckoTerminal - non-OK responses silently become [] with no retry-after respect and no source-health signal to the UI
- No real event-time pipeline: DexScreener/CG events lack true occurrence timestamps (only GeckoTerminal new pairs use pairCreatedAt, route.ts:736) - the fix is to persist first-seen time in context_feed_events and serve that, instead of stamping now() per fetch
- SSE fan-out layer absent: the persisted context_feed_events table (route.ts:206-242) is the natural Supabase Realtime publication source; instead each client gets a private 5-min self-polling function
- No Solana whale-transfer source: Solana 'news' is fabricated network-activity cards; Helius (approved, free tier) enhanced transactions are unused for this feature
- Cursor pagination exists server-side but no backend contract test / client consumer, so it can rot unnoticed

**Missing frontend:**
- Error state: no visual distinction between fetch failure / 500 / rate-limited and a genuinely quiet market - failures show 'Waiting for activity...' under a pulsing Live dot (components/ContextFeed.tsx:594-605,650-653)
- Live-status honesty: the 'Live' indicator pulses even after SSE has died and even when polling is failing - no degraded/reconnecting/stale badge
- No real virtualization: VIRTUAL_CAP=80 is a plain slice (components/ContextFeed.tsx:38,669) - 80 heavy glass cards stay mounted in the DOM; no windowing (react-window/virtua) and no 'load more' since cursor pagination is unwired
- No mute-source control anywhere in the UI despite full backend support (see fake_or_unwired)
- WCAG contrast failures: 'Powered by Naka Labs' is text-[10px] text-gray-600 (#4B5563 on near-black ~3:1, fails AA let alone AAA) at components/ContextFeed.tsx:212-214; 9px text-gray-500 stat labels (~4.6:1 at tiny size) at components/ContextFeed.tsx:782,788,794,812
- Unauthenticated state: bookmarks silently stay local-only for signed-out users with no hint they won't sync (components/ContextFeed.tsx:353-364,374-385); engagement likes are accepted optimistically with no auth feedback
- Loading state is a single full-panel spinner rather than card skeletons, so tab switches blank the whole feed (components/ContextFeed.tsx:620-634)
- MarketPulseCard fires once per mount and never refreshes during a long session (requestedRef, components/context-feed/MarketPulseCard.tsx:29-31) - the '8h refresh' only happens on remount

**Free-API recommendations:**
- Replace Birdeye (not in the approved matrix) with GeckoTerminal trending pools: GET https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token (free, no key, 30 req/min) - same fields (price, volume, liquidity, fdv) the Birdeye mapper needs
- Fix CoinGecko chain misattribution with GET https://api.coingecko.com/api/v3/coins/{id}?localization=false&tickers=false&market_data=false - read asset_platform_id / platforms to tag the real chain; cache per-coin in Upstash for 24h so it costs ~1 call per new coin
- Real Solana whale events via Helius (approved): POST https://api.helius.xyz/v0/addresses/{address}/transactions?api-key=KEY with type=TRANSFER for the whales-table Solana addresses - replaces the fabricated network-activity cards with genuine transfers
- Feed distribution: publish assembled events into the existing Supabase context_feed_events table and use Supabase Realtime (postgres_changes on that table) client-side instead of the SSE self-poll route - zero Vercel function-duration per listener, free on Supabase
- Cache the assembled per-chain feed JSON in Upstash Redis (SETEX 30-60s) with a lock key (SET NX PX) for regeneration to coalesce cold-start stampedes and keep DexScreener under its 60/min profiles-boosts cap
- Fallback chain for trending discovery: DexScreener token-boosts/top/v1 -> GeckoTerminal /networks/{net}/trending_pools -> CoinGecko /search/trending; for new listings: GeckoTerminal /networks/{net}/new_pools (already used) -> DexScreener token-profiles/latest/v1
- Token security fallback already partially present (GoPlus): add Honeypot.is GET https://api.honeypot.is/v2/IsHoneypot?address={addr}&chainID={id} (free) as second opinion for rug_alert, and RugCheck GET https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary for the missing Solana rug coverage

**Trust Wallet fit:** Mostly not useful for this feature. Trust Wallet has no event, feed, market-data, or trending API - nothing it offers helps event sourcing, SSE, dedup, or filtering. The one marginal fit is the trustwallet/assets GitHub logo registry (https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png, free CDN): it could fill the missing tokenIcon on Alchemy ERC-20 transfer cards (app/api/context-feed/route.ts:528-573 sets no tokenIcon), but it only covers established tokens - the feed's core content (fresh pump.fun/GeckoTerminal launches) will never be in that registry, and DexScreener/CoinGecko/GeckoTerminal already supply info.imageUrl for discovery events. Trust Wallet deep links (https://link.trustwallet.com/open_url or asset links) could add an 'Open in Trust Wallet' action per card, but the platform already has its own in-app swap, so it would leak users out of the product. wallet-core is irrelevant (native signing library). Verdict: use the assets registry only as a last-resort icon fallback for ERC-20 transfer cards; everything else the feature needs is better served by the already-approved DexScreener/GeckoTerminal/CoinGecko image fields.

**Back-button offenders:**
- app/dashboard/proof/page.tsx:395 - 'Back to Dashboard' on the event-not-found state hardcodes router.push('/dashboard') instead of history back, dropping the user's feed tab/filter/scroll context (the View Proof flow entered from ContextFeed.tsx:836-839)
- app/dashboard/proof/page.tsx:453 - BackButton href="/dashboard?subtab=context" forces a hardcoded destination rather than router.back(); works only because ContextFeed separately persists state to sessionStorage, and breaks if the user reached proof from anywhere else (e.g. a shared link then browsing)

## contract-analyzer
**Verdict:** The core Contract Analyzer is genuinely real and well-built end-to-end (GoPlus static + Honeypot.is live simulation + DexScreener/GeckoTerminal market + Supabase feed + Anthropic AI, with honest invalid/too-early/valid states), but adjacent scoped routes lean on two non-approved APIs (Birdeye, de.fi) and Solana never gets a honeypot second opinion despite RugCheck being wired elsewhere.

- **P1** — token-scanner Solana path depends on Birdeye, a NON-approved paid API requiring BIRDEYE_API_KEY; without the key birdSec is null and the whole Solana security scorecard silently degrades to DEX-market-signals-only (no mint/freeze/LP/holder flags)  
  `lib/services/birdeye.ts:5 (KEY=process.env.BIRDEYE_API_KEY), app/api/token-scanner/route.ts:120-181 (handleSolanaToken relies on getBirdeyeTokenSecurity/Overview)`
- **P1** — Contract Analyzer gives Solana tokens NO honeypot second opinion: reconcileHoneypot only combines GoPlus static + Honeypot.is (EVM-only), so every Solana token's verdict rests on GoPlus static alone even though a real, free, approved RugCheck fetcher already exists in the codebase  
  `app/api/security/contract-analyzer/route.ts:103-207 (no rugcheck import), lib/services/contractDetector.ts (no rugcheck), vs lib/security/sourceFetchers.ts:94 fetchRugCheckVerdict already implemented`
- **P2** — Triangulation route uses de.fi (public-api.de.fi) which is NOT on the owner's approved free-API matrix; it is a fourth honeypot voter that can flip a token to 'honeypot' via fail-closed majority  
  `lib/security/sourceFetchers.ts:82 (https://public-api.de.fi/v1/scanner), app/api/security/triangulation/route.ts:37`
- **P2** — security-scanner page and security/token-scanner page have NO back button at all (no BackButton import, no router.back) - dead-end navigation on mobile  
  `app/dashboard/security-scanner/page.tsx (no BackButton in 138 lines), app/dashboard/security/token-scanner/page.tsx (grep BackButton/ArrowLeft/router.back = empty)`
- **P2** — token-scanner Solana response maps isProxy=freezeable and ownerCanChangeBalance=freezeable as a semantic hack, so an SPL with freeze authority is reported to the UI as an 'upgradeable proxy' and 'owner can change balance' which are misleading EVM-framed labels  
  `app/api/token-scanner/route.ts:200-203`

**Fake / unwired:**
- Trust Score 'social' layer is documented as sourced from LunarCrush but the trust-score route never fetches it: calculateTrustScore is called with only {chain, tokenAddress} so socialScore is always undefined -> constant neutral 50 for every token, meaning 10% of every trust score is a fixed constant (app/api/trust-score/[chain]/[address]/route.ts:101 vs lib/trust/calculate.ts:12-13,179)
- Trust Score 'holders' layer top-10 concentration is never wired: route passes no top10ConcentrationPct, so holdersLayer always takes the null branch (+20 flat) and concentration never affects the score (lib/trust/calculate.ts:99-104,177)
- token-scanner Solana isHoneypot is hardcoded false and buyTax/sellTax hardcoded '0.0%' because no Solana honeypot/tax source is queried - presented in the same UI shape as real EVM GoPlus data (app/api/token-scanner/route.ts:195-197)
- RugCheck source exists (lib/security/sourceFetchers.ts:94) and is a free approved API, but is only reachable via /api/security/triangulation used by market SecurityPanel + clone-scan - it is completely unwired from the contract-analyzer feature the owner is auditing

**Missing backend:**
- No RugCheck triangulation in the contract-analyzer pipeline for Solana - detectContract should add fetchRugCheckVerdict as a Solana second opinion to close the ~12% Solana honeypot miss rate its own triangulator docstring cites (honeypotTriangulator.ts:1-11)
- GeckoTerminal fallback only queries getNewEvmPairs (new pools) so an established EVM token missing from DexScreener will not be recovered - the market fallback is narrow (contractDetector.ts:231-244)
- No CoinGecko/GeckoTerminal fallback for token metadata/price on the token-scanner Solana path when Birdeye is keyless - it drops straight to DEX-only with no approved backup security source
- trust-score social + holders concentration pipelines are unbuilt (no LunarCrush fetch, no top-10 holder fetch) so two of five layers are effectively inert
- No per-source rate-limit backoff/caching on Honeypot.is beyond a single in-memory TTL - a burst of Solana-then-EVM scans has no Redis L2 like GoPlus has

**Missing frontend:**
- Contract Analyzer has no unauthenticated/rate-limited distinct state: a GoPlus 429 (SecurityRateLimitError) bubbles to the generic 500 'Analysis failed' catch (route.ts:418), so the user cannot tell 'retry shortly' from a hard failure despite the typed error existing upstream
- No skeleton/shimmer loading for the token header, score card, or honeypot panel - only a single centered spinner (page.tsx:415), so the layout jumps in on data arrival
- security-scanner page relies on sonner toast for all errors with no inline error/empty region and no back navigation (app/dashboard/security-scanner/page.tsx:35-39)
- token image onError only hides the broken img (page.tsx:547) leaving an empty gap rather than falling back to the Code icon placeholder that exists for the no-image case
- No mobile-specific handling for the honeypot dual-source panel beyond flex-col sm:flex-row; very long provider reason strings can overflow the tiny 9px note text

**Free-API recommendations:**
- Add RugCheck to contract-analyzer Solana path: GET https://api.rugcheck.xyz/v1/tokens/{mint}/report (free, no key, already implemented in sourceFetchers.ts) - reconcile as the Solana equivalent of Honeypot.is so Solana verdicts stop resting on GoPlus static alone
- Replace Birdeye in the token-scanner Solana path with approved free sources: RugCheck (api.rugcheck.xyz report -> mint/freeze/LP/topHolders) for security + DexScreener (already used) for market + Jupiter token list (https://token.jup.ag/all or lite-api.jup.ag) for metadata - eliminates the BIRDEYE_API_KEY dependency
- Drop de.fi from the triangulation voter (not on approved matrix) and re-weight to GoPlus + Honeypot.is (EVM) + RugCheck (Solana); if a third EVM voter is wanted use Honeypot.is holderAnalysis + GoPlus cross-check rather than de.fi
- Wire the trust-score social layer to LunarCrush (lunarcrush.com/api4 public galaxy score, owner-approved) and the holders layer to GoPlus holder_count + top-10 from the same token_security payload (GoPlus already returns holders) so no layer is a constant
- Fallback chain for market data: DexScreener /latest/dex/tokens/{addr} -> GeckoTerminal /networks/{chain}/tokens/{addr} (not just new_pools) -> CoinGecko /coins/{platform}/contract/{addr}, all free
- Map GoPlus 429 to an HTTP 503 with retryAfter in contract-analyzer so the UI can render a 'security provider busy, retry shortly' state instead of a generic failure

**Trust Wallet fit:** "Marginal but real for ONE narrow slice: the trustwallet/assets GitHub logo registry (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksumAddr}/logo.png) is a free, no-key fallback for the token logo shown in the header (page.tsx:546) and token-scanner, useful when DexScreener info.imageUrl is null. It is a static CDN, so it needs no API key and fits the free-tier rule. Trust Wallet offers NOTHING for the actual security job: no honeypot API, no contract-risk API, no tax/permission scanner. wallet-core and deep links are irrelevant to a read-only analyzer. For every security function here the correct free tools are the ones already in the matrix - GoPlus, Honeypot.is, and (missing) RugCheck. Recommendation: optionally adopt the Trust Wallet asset registry only as a logo fallback; do not consider it for any security data."

## copy-social-trading
**Verdict:** Copy-trading has unusually deep, real plumbing (rules CRUD, atomic cap RPC, GoPlus gate, relayer, cron+webhook matcher) but is broken at the seams — live schema rejects the statuses the code writes, key entry points are dead, TP/SL and liquidity knobs are decorative, zero rules/trades exist in prod — while social-trading is a stale 'Coming Soon Q3 2025' shell that advertises the copy-trading feature that already shipped.

- **P0** — Live DB status CHECK constraint on user_copy_trades allows only ('pending','success','failed','cancelled','expired','alert') — verified via live SQL — but /api/copy-trading/execute writes 'blocked_rule'/'blocked_security': every recordBlocked() insert silently fails (error never checked), so blocked attempts leave NO record; worse, when the relayer security-blocks after claim, the UPDATE to 'blocked_security' also fails and the claimed row stays 'pending', consuming the user's rolling 24h daily cap for a trade that never happened (claim_copy_trade counts 'pending')  
  `app/api/copy-trading/execute/route.ts:100-118,332-335 vs supabase/migrations/2026_session5b2_phase0_relayer.sql:90-92 (constraint replaced, blocked_* dropped) vs 2026_session5b1_batch2.sql:151`
- **P0** — Matcher generic-failure branch never updates the claimed user_copy_trades row — on any non-security relayer failure (no route, insert error) the row stays 'pending' forever; pending-trades-cleanup can't expire it because no pending_trades row exists, so each failure permanently eats daily-cap budget for 24h and shows an eternal 'pending' in the UI  
  `lib/copy/matcher.ts:371-376 (only Sentry + counters, no status update) vs execute/route.ts:332-335 which does update; cleanup only walks pending_trades (app/api/cron/pending-trades-cleanup/route.ts)`
- **P1** — Whale-tracker watchlist and directory 'Copy' buttons deep-link to /dashboard/copy-trading?whale=...&chain=...&label=... but the copy-trading page ignores those params entirely — deepLink requires tx+token+action (page.tsx:77) and NewCopyRuleModal is opened with no initial props (page.tsx:392-394), so the user lands on a page with nothing prefilled and no modal  
  `app/dashboard/whale-tracker/watchlist/page.tsx:74 and directory/page.tsx:285 vs app/dashboard/copy-trading/page.tsx:77,392-394`
- **P1** — Tier contradiction: NewCopyRuleModal shows 'Alerts Only' as free-tier (required:'free') and the rules API's own comment says alerts_only is mini+, but POST /api/copy-trading/rules is wrapped in withTierGate('pro') — free/mini users see the mode unlocked, click Save, and get a raw 'upgrade_required' 403 toast; GET rules/trades are also pro-gated so the page silently renders empty for them  
  `app/dashboard/copy-trading/NewCopyRuleModal.tsx:18-24 vs app/api/copy-trading/rules/route.ts:59,93-95 and lib/subscriptions/apiTierGate.ts:37-75`
- **P1** — Avalanche is selectable in the chain dropdown but has no USDC mapping in either execution path — a rule created on avalanche can never execute: manual execute fails with 'Unsupported chain', matcher silently blocks  
  `NewCopyRuleModal.tsx:209 vs app/api/copy-trading/execute/route.ts:43-59 and lib/copy/matcher.ts:62-70`
- **P1** — Rules for whales not already in the pipeline never fire: the Alchemy/Helius webhooks only match transfers against the curated `whales` table (alchemy-whale/route.ts:164) and the cron only replays activity for whales in user_whale_follows (copy-trade-monitor/route.ts:58-61); creating a rule (modal accepts any free-text address, no format validation) does not follow the whale, add it to `whales`, or register it on any webhook — the rule is dead on arrival  
  `app/api/cron/copy-trade-monitor/route.ts:56-64, app/api/webhooks/alchemy-whale/route.ts:11-16,164, NewCopyRuleModal.tsx:101 (only non-empty check)`
- **P2** — Stats 'Blocked' card labeled 'security + rule guards' actually counts status failed+cancelled — blocked_rule/blocked_security rows can never exist (constraint) and aren't counted anyway; frontend also has no color/label mapping for blocked_*/expired statuses (falls to gray)  
  `app/api/copy-trading/trades/route.ts:42 vs app/dashboard/copy-trading/page.tsx:252,366-371`
- **P2** — Social-trading waitlist form always shows success: supabase-js insert returns {error} without throwing, the result is never checked, so the catch is unreachable for DB/RLS failures and 'You're on the waitlist!' fires regardless (live waitlist count for this feature: 0)  
  `app/dashboard/social-trading/page.tsx:134-136`
- **P2** — Neither /dashboard/copy-trading nor /dashboard/social-trading appears in SidebarMenu or CommandPalette — copy-trading is only reachable via whale-tracker links/Telegram deep-links; social-trading is linked from nowhere at all (grep across components/ found zero nav references)  
  `components/SidebarMenu.tsx and components/ui/CommandPalette.tsx contain no copy-trading/social-trading entries; only referencing files are whale-tracker pages and docs`

**Fake / unwired:**
- Entire social-trading page is a 'Coming Soon' marketing shell with a hardcoded PLANNED_FEATURES array whose first card advertises 'Copy Trading' — a feature that already shipped at /dashboard/copy-trading — app/dashboard/social-trading/page.tsx:8-45,61-78
- Stale launch promise: 'Q3 2025 / Estimated Launch Private Beta' hardcoded on the social-trading page; today is July 2026, the date is a year past — app/dashboard/social-trading/page.tsx:105-111
- tp_pct / sl_pct (take-profit/stop-loss) are collected in the modal, validated by the API, stored, and rendered as green/red badges on rule cards — but NO code anywhere reads them for execution; there is no TP/SL monitor for copy positions (repo-wide grep: only write paths) — NewCopyRuleModal.tsx:254-255, rules/route.ts:123-124, page.tsx:312-313
- min_liquidity_usd is stored (default 50000) and SELECTed by the matcher but never compared against anything — no liquidity check exists in matcher.ts or execute route — lib/copy/matcher.ts:110 (selected, unused), app/api/copy-trading/rules/route.ts:128
- Page header claims 'Every trade passes GoPlus + your rules' — true for GoPlus, false for the min-liquidity and TP/SL rules (page.tsx:228)
- Zero production usage verified live: 0 rows in user_copy_rules and 0 in user_copy_trades ever, despite 51,749 whale_activity rows/7d — the feature has never executed once; all 'working' claims are code-verified, not production-proven

**Missing backend:**
- Schema source-of-truth drift: live DB constraint includes 'alert' (added as an untracked hotfix) but repo migrations end at ('pending','success','failed','cancelled','expired') — a fresh deploy from migrations would break alerts_only mode too; and no migration anywhere re-adds 'blocked_rule'/'blocked_security' which the code still writes
- No pipeline registration on rule creation: creating a copy rule should auto-insert user_whale_follows and add the address to the Alchemy/Helius webhook subscription (both are manual dashboard steps today) — otherwise arbitrary-address rules never trigger
- No TP/SL execution engine for copy positions (rules store tp_pct/sl_pct; nothing monitors entry price vs current price; contrast with the existing stop-loss-monitor cron for stop_loss_orders)
- No liquidity enforcement: min_liquidity_usd stored but no DexScreener/GeckoTerminal liquidity lookup exists in the copy path
- GoPlus failure fails OPEN with no fallback: relayer catches GoPlus errors and proceeds (relayer.ts:100-104); no Honeypot.is or RugCheck fallback in the chain despite both being in the approved free matrix
- No sweeper for user_copy_trades rows stuck 'pending' without a matching pending_trades row (the matcher failure-path leak) — pending-trades-cleanup only walks pending_trades
- No tier re-validation at execution time: matcher/cron execute auto_copy and oneclick rules for users whose pro/max tier has lapsed (matcher.ts has no profile check; only rule creation is gated)
- No server-side whale_address format validation (EVM checksum / base58) — rules/route.ts:67 only checks non-empty

**Missing frontend:**
- copy-trading page has no error/unauthenticated/upgrade states: load() has no catch, and 401/403 responses (whole feature is pro-gated) render as 'No copy rules yet' with no sign-in or upgrade prompt — page.tsx:130-143,281-288
- Free-tier users see a fully interactive page (New rule, 24/7 Auto buttons) that can only ever 403 — no tier gate banner anywhere on the page
- AutoCopySessionModal is EVM-only (6 chains) even though a Solana session-key signer exists server-side — Solana auto-copy has no enable UI — components/copy/AutoCopySessionModal.tsx:38 vs lib/trading/solanaSessionKeySigner.ts
- Trades table: no token logos, no pagination past the 200-row limit, no explorer link for copied_tx_hash, statuses expired/blocked_* fall to unstyled gray — page.tsx:341-379
- No nav entry for either page in SidebarMenu/CommandPalette — feature is undiscoverable except via whale-tracker
- Social-trading page: stale Q3 2025 date, waitlist success-on-failure, and it duplicates a shipped feature instead of linking to it

**Free-API recommendations:**
- DexScreener (free, no key) to enforce min_liquidity_usd: GET https://api.dexscreener.com/latest/dex/tokens/{tokenAddress} -> max(pairs[].liquidity.usd); call it in lib/copy/matcher.ts and execute route before claim_copy_trade; same response supplies token logo (info.imageUrl) for the trades table
- Security fallback chain in relayer.ts instead of fail-open: GoPlus (current) -> Honeypot.is GET https://api.honeypot.is/v2/IsHoneypot?address={token}&chainID={id} (EVM, free) -> RugCheck GET https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary (Solana, free); block only if two sources agree or first source says honeypot
- Alchemy Notify webhook management (free tier) to auto-register rule whales: PATCH https://dashboard.alchemy.com/api/update-webhook-addresses with {webhook_id, addresses_to_add:[whale]} on rule creation; Solana equivalent: PUT https://api.helius.xyz/v0/webhooks/{webhookID}?api-key=... appending accountAddresses — closes the dead-rule gap without polling
- TP/SL engine for copy positions: hourly/2-min cron mirroring stop-loss-monitor, pricing via DexScreener batch GET https://api.dexscreener.com/latest/dex/tokens/{addr1},{addr2},... (up to 30 per call, free) against user_copy_trades success rows with actual_price; fire the existing relayer sell path when tp_pct/sl_pct hit
- Jupiter (already integrated) remains correct for Solana execution; 0x/1inch/KyberSwap/OpenOcean chain already wired via lib/services/swap-aggregator — no paid API needed anywhere in this feature
- Token logos: trustwallet/assets raw CDN (https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png) is a viable free option, but DexScreener already returns imageUrl in the same call you need for liquidity — prefer one call over two

**Trust Wallet fit:** Trust Wallet's developer ecosystem offers nothing that advances copy-trading execution: there is no Trust Wallet copy-trading or account API; wallet-core is a native (C++/mobile) signing library irrelevant to this Next.js + WalletConnect web flow; Trust Wallet deep links (link.trustwallet.com) can only open the app to a send/dapp screen and cannot sign the platform's pending_trades — Trust Wallet users are already reachable through the existing Reown AppKit/WalletConnect integration (components/copy/AutoCopySessionModal.tsx already resolves any injected/WC wallet). The single marginal asset is the trustwallet/assets GitHub logo registry for token images in the rules/trades tables, and even that is second-best: DexScreener returns a token logo in the same free call this feature needs anyway for the unenforced min_liquidity_usd check. Recommendation: skip Trust Wallet integration for this feature; spend the effort on DexScreener liquidity + logos and Alchemy/Helius webhook auto-registration.

## crons-pipelines
**Verdict:** The cron layer is architecturally strong — 6 Vercel schedules fan out to 63 authenticated, mostly-idempotent handlers with a kill switch and DB+Sentry observability — but it ships a dead reputation cron (auth-contract mismatch = 403 every run), a no-op daily-digest stub, and two core pipelines (whale PnL, whale activity) wired to non-matrix paid APIs (Arkham, Bitquery) that go silently dark without keys.

- **P0** — recompute-reputation NEVER runs via the scheduler. The daily dispatcher fans out with header `authorization: Bearer <CRON_SECRET>`, but recompute-reputation validates `x-cron-secret` header OR `?secret=` query param instead — neither is sent — so it returns 403 Forbidden on every daily tick. Reputation scores/ranks are never recomputed. It also ignores CRONS_PAUSED (no verifyCron).  
  `app/api/cron/recompute-reputation/route.ts:22-24 (reads x-cron-secret/?secret) vs app/api/cron/dispatch/[group]/route.ts:99 (sends authorization Bearer only)`
- **P1** — daily-digest is a no-op stub. Scheduled in the daily dispatch group but the entire handler body is verifyCron() + cronResponse() with zero digest logic. No other daily-digest implementation exists in the repo. The 'daily digest' feature has no backend.  
  `app/api/cron/daily-digest/route.ts:1-12`
- **P2** — telegram-retry-failures final 7d-backoff retry is unreachable dead code. The query filters `.gt('created_at', since7d)` (rows younger than 7 days), but the 4th attempt only becomes due at last_attempt_at + BACKOFF_MS[2] (7 days) which lands at ~7.04d after creation — by which point the created_at filter has already excluded the row. Messages silently expire instead of getting their final retry.  
  `app/api/cron/telegram-retry-failures/route.ts:26,58,84 (since7d filter + BACKOFF_MS=[1h,24h,7d])`
- **P2** — Admin per-cron pause is non-functional. admin/crons derives a `paused` flag from feature_flags key `cron.<name>.paused`, but NO cron handler reads that flag (grep for feature_flags/cron.*.paused across app/api/cron returns nothing). Only the global CRONS_PAUSED env actually pauses anything, so the per-cron toggle shown in the admin UI is display-only.  
  `app/api/admin/crons/route.ts:54-58 vs zero handler references to feature_flags cron pause keys`

**Fake / unwired:**
- daily-digest is a claim of a feature with no backend — pure verifyCron+return stub (app/api/cron/daily-digest/route.ts:8-11)
- cult-generate-daily-seal Anthropic context is stubbed: comment 'calls Anthropic Opus with curated context (placeholder for now — future revision will inject top-tickers / narrative / sentiment)' (app/api/cron/cult-generate-daily-seal/route.ts:40)
- Admin per-cron pause toggle backed by feature_flags cron.<name>.paused that no handler honors (app/api/admin/crons/route.ts:54-58)

**Missing backend:**
- whale-backfill-pnl depends entirely on Arkham (api.arkm.com, ARKHAM_API_KEY) which is NOT in the allowed free matrix; if the key is unset every request throws and the whale directory's pnl_30d/win_rate/portfolio_value dashes are never filled — no fallback to a matrix-approved source (lib/arkham/api.ts:11-14, whale-backfill-pnl/route.ts:183-189)
- bitquery-activity-poll + bitquery-traders depend on Bitquery (BITQUERY_API_KEY), also not in the matrix; gated to no-op when unset. The header comment positions Bitquery as the sole whale-activity driver ('NO Alchemy/Helius webhooks; fully Bitquery-driven'), so without the key that ingestion path is dark — though the Alchemy-based whale-activity-poll provides a compliant redundant path (bitquery-activity-poll/route.ts:19-32)
- Frequent-group invocation budget: dispatch/frequent fans out to 14 handlers every 2 min = ~10k downstream function invocations/day (~300k/month) plus the dispatcher ticks; demand-gates keep each cheap but every fan-out fetch is a separately-billed Vercel invocation — frequent is the dominant cost driver and should be watched against the Pro included quota
- telegram-retry-failures has no CAS claim before send; two overlapping ticks could double-deliver (low risk at 30-min cadence, but not idempotent like the alert/copy paths)

**Missing frontend:**
- Feature is backend-only (cron endpoints); the only surfaced UI is the admin/crons dashboard, whose per-cron pause control is wired to a flag no handler reads (see broken/fake) — the admin toggle needs either a handler-side read of the flag or removal
- Many high-frequency handlers (copy-trade-monitor, sniper-* crons) never call logCronExecution on the success path, so the admin dashboard's runs24h/successRate24h undercount them — only failures and dispatch-<group> rows appear, making a silently-idle handler look like it 'never ran' rather than 'ran and did nothing'

**Free-API recommendations:**
- Replace Arkham in whale-backfill-pnl with Sim by Dune Activity API (https://api.sim.dune.com/v1/evm/activity/{address} and /svm/ for Solana) for transfer history, or reuse the existing Alchemy alchemy_getAssetTransfers (EVM) + Helius Enhanced Transactions API (https://api.helius.xyz/v0/addresses/{addr}/transactions, Solana) already used by whale-activity-poll, and run the same FIFO cost-basis math on those — all matrix-approved, no new paid key
- Retire the Bitquery whale crons and rely on the Alchemy getAssetTransfers poll + Helius webhook already present; for DEX-trade granularity use GeckoTerminal /networks/{net}/pools/{pool}/trades or DexScreener token endpoints (all free matrix)
- Add a price fallback chain to price-cache-refresh: CoinGecko /coins/markets -> DexScreener /latest/dex/tokens/{addr} -> GeckoTerminal /simple/networks/{net}/token_price/{addrs}, so a CoinGecko 429 doesn't leave the cache cold and starve alert-monitor
- For whale-logo-backfill specifically, pull logos from the trustwallet/assets GitHub raw registry (see trust_wallet_fit) as a free, keyless CDN source with CoinGecko image URLs as fallback

**Trust Wallet fit:** Trust Wallet offers nothing for the cron/pipeline scheduling or evaluation layer — there is no Trust Wallet developer API for background jobs, PnL, alerts, or market data. The ONE genuine fit is the whale-logo-backfill pipeline: the trustwallet/assets GitHub registry (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksumAddr}/logo.png) is a free, keyless, CDN-hosted token/chain logo source that could serve as a fallback for that specific cron. For every other cron in scope (whale PnL, activity ingestion, alerts, price sync, telegram queue), Trust Wallet is irrelevant — Sim by Dune, Alchemy, Helius, CoinGecko, and DexScreener are the correct free tools already partly wired.

## dashboard-home
**Verdict:** The core dashboard is genuinely live — KPIs, Top Gainers, Heating Up, Personalized Home and widget-reorder persistence are all real and wired to CoinGecko + Supabase — but the flagship "Portfolio hero" widget never renders (calls /api/portfolio with no address → 400 → self-hides), and both CommandPalette and GlobalControls listed in scope are mounted nowhere on the dashboard.

- **P1** — PortfolioHeroCard (the first, defaultVisible 'hero' widget) NEVER renders for any user. It fetches /api/portfolio with no query params, but the route requires ?address and returns 400 without it, so res.ok is false, data stays null, and the card returns null. Even if an address were passed, the response shape mismatches: card reads totalBalanceUsd/totalChange24hPct/wallets, API returns totalValue/totalChangePct/portfolio.  
  `components/dashboard/PortfolioHeroCard.tsx:36-45,54 vs app/api/portfolio/route.ts:123-125,149-163`
- **P2** — CommandPalette (⌘K) is dead code — imported/mounted nowhere in the entire app, so Cmd+K does nothing on the dashboard (or any page). DEFAULT_ITEMS are also static-only by the component's own admission.  
  `components/ui/CommandPalette.tsx:28-48 (zero importers app-wide, verified by grep)`
- **P2** — GlobalControls (theme + language toggle) is not mounted on the dashboard. page.tsx §3.1 comment claims 'the theme toggle moved to the sidebar footer', but the sidebar footer contains only GlobalWhatsNewButton + a version string. Dashboard users have no theme or language control.  
  `components/SidebarMenu.tsx:213-216; app/dashboard/page.tsx:473-478 (comment); GlobalControls only used in docs/landing/FloatingNotificationBell (which is itself unmounted)`
- **P2** — FirstRunTour 'Follow a whale' CTA links to /dashboard/whales, which has no page and no redirect (unlike /dashboard/settings which IS redirected in next.config.js), so it lands on the cult-themed 404. Shown to every new user on first visit.  
  `components/dashboard/FirstRunTour.tsx:39; next.config.js:56-67 (whales absent from redirects)`
- **P2** — market-globals returns HTTP 200 with an all-zero fallback object when getGlobalMarketData exceeds the 8s deadline, so the KPI cards render '$0.0B', '0.0%', '0' as if real instead of showing a stale/error state.  
  `app/api/dashboard/market-globals/route.ts:20-23; consumed at app/dashboard/page.tsx:387-405`
- **P2** — BottomNav navigates Find (/discover) and VTX (/dashboard/vtx-ai) via window.location.href, forcing a full page reload instead of client-side router navigation.  
  `app/dashboard/page.tsx:210-215`

**Fake / unwired:**
- FirstRunTour hardcoded marketing claim '15k+ verified wallets across 8 chains' — static copy, not data-backed (components/dashboard/FirstRunTour.tsx:38)
- CommandPalette DEFAULT_ITEMS are a static nav list; comment admits dynamic token/whale search is 'future iteration' — and the palette isn't mounted anyway (components/ui/CommandPalette.tsx:28-48)
- Widget registry defines defaultVisible + the API supports a `hidden` array, but WidgetOrderer only reorders — it never exposes hide/show, so `hidden` is always [] (components/dashboard/WidgetOrderer.tsx; lib/dashboard/widgetRegistry.tsx:18-43)

**Missing backend:**
- No fallback provider for market globals — single CoinGecko dependency; on timeout the endpoint emits zeros with a 200 rather than falling back to another free source
- Portfolio hero has no server-side multichain aggregation over the user's saved wallet_identities — it assumes a client-passed address that the card never sends
- since-last-login watchlistMovers depends on a market_stats_snapshot table that may not exist (route degrades to 0 silently) — no snapshot pipeline confirmed

**Missing frontend:**
- KPI stat cards have no error/stale state — on upstream failure they show all-zero values or stick on '...'; no retry affordance (page.tsx:443-453)
- PortfolioHeroCard collapses every error path (400/500/network) into a silent null, indistinguishable from the legitimate 'no wallets' hide — users with wallets get no error and no data (PortfolioHeroCard.tsx:36-55)
- Two of four KPIs (24h Volume change, BTC Dominance change) never show a change indicator because volumeChange/dominanceChange are hardcoded empty (page.tsx:402-403) — leaves a visibly asymmetric card row
- No widget hide/show UI despite backend support — the 'Customise' modal is reorder-only

**Free-API recommendations:**
- Portfolio hero: aggregate balances server-side across user's wallet_identities using Alchemy getTokenBalances/getTokensForOwner (EVM) + Helius getAssetsByOwner/DAS (Solana), priced via CoinGecko /simple/price — no ?address needed. Or use Sim by Dune balances endpoint (GET /v1/evm/balances/{address}, free) for one-call multichain. NOTE: the current route's Zerion path (ZERION_API_KEY) is a PAID API not in the owner's allowed free-tier matrix — replace it.
- Market globals fallback chain: CoinGecko /global (primary) → CoinPaprika /v1/global (free, no key) → DefiLlama (free, no key) for TVL/chain counts, so KPIs never render $0
- Fill empty volume-change KPI: CoinPaprika /v1/global returns volume_24h_change_24h; or DexScreener aggregate — both free
- Token logo fallback for gainers/trending images (they onError-hide today): GeckoTerminal or DexScreener token-image CDN — free, keeps images instead of blank

**Trust Wallet fit:** Trust Wallet's developer offering is essentially (1) the trustwallet/assets GitHub token-logo registry, (2) wallet-core signing library, and (3) deep links. None of this helps the dashboard-home feature: KPIs, gainers, trending and portfolio are market/onchain data, not signing or deep-linking. The only marginal fit is using raw.githubusercontent.com/trustwallet/assets logos as a fallback when a token image 404s in TopGainers/HeatingUp — but CoinGecko already supplies those images, and GeckoTerminal/DexScreener image CDNs are a better free fallback keyed by the same token id/address. Recommendation: do not adopt Trust Wallet for this feature.

## dna-analyzer
**Verdict:** The real feature at /dashboard/dna-analyzer works end-to-end on genuine on-chain data (Alchemy + DexScreener/CoinGecko + grounded code-computed score + Anthropic narrative), but it ships a dead orphaned duplicate page wired to off-matrix paid APIs (Arkham/Birdeye/Zerion), a permanently-empty Partner Wallets section, a Win Rate tile that always reads N/A, and a back button hardcoded to /dashboard.

- **P1** — Win Rate tile always renders 'N/A'. UI reads dna.aiAnalysis.metrics.timing but the API only ever returns metrics: { diversification } — the 'timing' key is never populated.  
  `app/dashboard/dna-analyzer/page.tsx:726 vs app/api/dna-analysis/route.ts:306`
- **P1** — Partner Wallets is a permanently dead feature. The API hardcodes partnerWallets: [] on every response, so Section 4's entire UI (PartnerWallet type, per-partner 'Analyze' buttons) never renders, yet the input-screen intro copy still advertises 'partner wallets'.  
  `app/api/dna-analysis/route.ts:322 (partnerWallets: []) vs page.tsx:780 (render guard) and page.tsx:454 (marketing copy)`
- **P1** — Performance Metrics section over-promises: AIAnalysis type declares 5 metrics (diversification, timing, riskManagement, consistency, conviction) but the API supplies only diversification, so the metrics bar list (Object.entries) always renders exactly one bar.  
  `app/dashboard/dna-analyzer/page.tsx:55-61 and 753-767 vs app/api/dna-analysis/route.ts:306`
- **P1** — Orphaned duplicate page. app/dna-analyzer/page.tsx is not linked from anywhere (sidebar, profile, whale-tracker all point to /dashboard/dna-analyzer) and depends on Arkham (getAddressIntel -> ARKHAM_API_KEY), a paid off-matrix API. It renders a scammer/scamHistory UI that only ever populates if Arkham is keyed.  
  `app/dna-analyzer/page.tsx:18 (fetch /api/arkham/address) -> lib/services/arkham.ts:69 -> lib/arkham/api.ts:14 (ARKHAM_API_KEY)`
- **P2** — Confusingly duplicated API routes. /api/dna-analysis (GET) powers this feature; /api/dna-analyzer (POST) is a different endpoint used by wallet-intelligence, not the analyzer. Near-identical names invite mis-wiring.  
  `app/api/dna-analysis/route.ts:274 vs app/api/dna-analyzer/route.ts:47 (only caller is app/dashboard/wallet-intelligence/page.tsx:639)`
- **P2** — Solana recent transactions are mislabeled. For an outgoing tx with a counterparty, the API sets from=counterparty and to=counterparty, so the UI's isOut check (tx.from === dna.address) is false and every outbound Solana tx renders as green 'Received'.  
  `app/api/dna-analysis/route.ts:113-114 vs page.tsx:933`
- **P2** — Behavioral Archetype is recomputed client-side with different rules (e.g. score < 40 -> 'Whale Follower') instead of using the API's already-grounded archetype/archetypeDescription fields, so the label can diverge from the rule-based engine described in How-It-Works.  
  `app/dashboard/dna-analyzer/page.tsx:682-710 ignores app/api/dna-analysis/route.ts:41-67 (archetype) returned at route.ts:315-316`

**Fake / unwired:**
- partnerWallets: [] hardcoded empty on every response — Partner Wallets feature has no backend (app/api/dna-analysis/route.ts:322)
- metrics.timing / riskManagement / consistency / conviction declared in the AIAnalysis contract but never populated by the API — Win Rate + 4 metric bars are permanently dead (app/dashboard/dna-analyzer/page.tsx:55-61, 726)
- Orphaned standalone page's scam UI (totalRugs, totalStolen, victims, 'CRYPTO SCAMMER DETECTED') is fully gated on Arkham data that is off-matrix and likely unkeyed, so it falls through to 'Unknown Wallet' (app/dna-analyzer/page.tsx:121-163)
- coinsWorthWatching is fetched for Solana only; EVM wallets always receive [] and silently fall back to generic market trending (app/api/dna-analysis/route.ts:293)

**Missing backend:**
- No partner-wallet pipeline exists at all despite the UI/types — needs a counterparty-aggregation step over transfer history (route.ts:322).
- EVM has no coinsWorthWatching pipeline (Solana-only), and no buy/sell direction data (totalBuys/totalSells honestly null at route.ts:167), so the 'Win Rate' concept has no data source on any chain.
- No caching on the composite DNA response itself — each analyze re-fans-out to Alchemy + Birdeye + Anthropic; only the underlying service calls cache, so repeated analyses still trigger a billable LLM call.
- No fallback when the AI call fails in /api/dna-analysis: buildAIAnalysis returns null (route.ts:225) and aiAnalysis becomes null, collapsing the entire score/grade/insights section — unlike /api/dna-analyzer which has a graceful degraded path (dna-analyzer/route.ts:108-125). The GET route should adopt the same grounded-only fallback.

**Missing frontend:**
- No empty-holdings state: a valid but empty/new wallet returns holdings:[] and totalBalanceUsd:0; the UI renders score/grade cards and blank sector/metrics with no 'no activity found' messaging.
- No unauthenticated/tier-gated state: the API is withTierGate('mini') and can 401/403, but runAnalysis (page.tsx:386-389) only surfaces data.error text with no upgrade CTA or paywall UI.
- Live Market Context has no error state — if /api/market fails, Fear & Greed silently stays on the '--' placeholder forever (page.tsx:262-264) with no retry.
- Recommendation thumbs up/down feedback (page.tsx:896-908) is local state only — never persisted to any endpoint, so ratings vanish on reset/reload.
- Standalone orphaned page (app/dna-analyzer/page.tsx) has no loading skeleton beyond a button label, no error UI (only console.error at line 22), and no empty state.

**Free-API recommendations:**
- Replace Birdeye (off-matrix, requires BIRDEYE_API_KEY) for Solana pricing and trending: use Jupiter Price API v2 (https://api.jup.ag/price/v2?ids=<mint>) for prices and GeckoTerminal (https://api.geckoterminal.com/api/v2/networks/solana/trending_pools) or DexScreener (https://api.dexscreener.com/latest/dex/tokens/<mint>) for trending/liquidity — all free and on-matrix.
- Replace Zerion (off-matrix, ZERION_API_KEY) EVM fallback: use Alchemy getTokenBalances + alchemy_getTokenMetadata (already the primary, allowed) plus DexScreener/CoinGecko for pricing; for multi-chain breadth use Sim by Dune's EVM balances endpoint (free tier) instead of Zerion.
- Retire the Arkham dependency in the orphaned page entirely: for entity labels / scam flags use GoPlus (https://api.gopluslabs.io/api/v1/address_security/<address>) and RugCheck — both free and on-matrix — rather than paid Arkham.
- Build Partner Wallets from data you already fetch: aggregate counterparties from Alchemy alchemy_getAssetTransfers (EVM) and Helius parsed transactions (Solana), rank by tx count/volume; no new paid API needed.
- Fallback chain design for DNA fetch: Solana = Helius/Alchemy (balances+tx) -> Jupiter (price) -> DexScreener/GeckoTerminal (identity/liquidity); EVM = Alchemy (balances+tx) -> CoinGecko contract price -> DexScreener; on total failure return the grounded-score-only degraded payload.

**Trust Wallet fit:** Trust Wallet offers little of value here. Its main developer asset is the trustwallet/assets GitHub logo registry, which could serve as one more fallback for token logos (raw.githubusercontent.com/trustwallet/assets/master/blockchains/<chain>/assets/<checksummed_address>/logo.png) alongside the existing DexScreener/CoinGecko logo sources — marginal at best and only for EVM/known chains. Trust Wallet has no wallet-intelligence, entity-labeling, holdings, transaction-history, or trending API, which is what this feature actually needs. wallet-core and deep links are irrelevant to a read-only analyzer. Recommendation: do not adopt Trust Wallet for DNA Analyzer; the free on-matrix stack (Alchemy/Helius + Jupiter + DexScreener/GeckoTerminal + GoPlus/RugCheck) covers every gap better.

**Back-button offenders:**
- app/dashboard/dna-analyzer/page.tsx:435 — <BackButton href="/dashboard" /> forces router.push('/dashboard') (BackButton short-circuits on href, components/ui/BackButton.tsx:20-22) instead of router.back(); a user who deep-links from Whale Tracker (whale-tracker/[address]/page.tsx:376) is sent to /dashboard rather than back to the whale profile. Drop the href to use the built-in history-aware behavior.

## geo-stream-misc-apis
**Verdict:** A mixed bag of solid observability plumbing (geo, rum, health, log, instrumentation, sentry) that is genuinely wired, alongside a large graveyard of orphaned dead code (all 4 SSE streams, sim, game-scores) and two real owner-rule violations: a paid Arkham API in production and an admin revenue dashboard that can never authenticate against its own hardened backend.

- **P1** — Admin revenue dashboard can NEVER load: frontend fetches /api/analytics/admin with no Authorization header, but backend requires Bearer via verifyAdminContext (returns 403). Page permanently shows 'No analytics data available'.  
  `app/admin/revenue/page.tsx:65 (fetch('/api/analytics/admin') with no headers) vs app/api/analytics/admin/route.ts:33-36 + lib/auth/adminAuth.ts:70-72 (requires Authorization: Bearer)`
- **P1** — /api/game-scores stores the entire leaderboard in a module-level in-memory Map. On serverless/Vercel this is per-instance and wiped on every cold start — scores never persist and are not shared across instances. Leaderboard is effectively non-functional.  
  `app/api/game-scores/route.ts:15 (const scores: Map<string,GameScore> = new Map())`
- **P2** — /api/health exposes infra configuration unauthenticated: which env vars are set (SUPABASE_SERVICE_KEY, JWT_SECRET, RESEND, ANTHROPIC), WalletConnect projectId length, expectedOrigin, and raw Supabase error messages. Information disclosure to any anonymous caller.  
  `app/api/health/route.ts:82-132 (GET has no auth guard; body.env + walletconnect + checks.supabase error strings returned)`
- **P2** — All 4 SSE stream routes register teardown by RETURNING a function from ReadableStream.start(), which the stream spec ignores — cleanup belongs in cancel(reason). On client disconnect the setInterval poll loops keep firing (burning API quota) until a heartbeat/enqueue throws and flips active=false, ~25s later. Wasted fetch cycles per disconnect.  
  `app/api/stream/portfolio-updates/route.ts:191-195; also price-feed:96-100, sniper-events, whale-alerts (identical `return () => {...}` from start)`
- **P2** — /api/log/client-error is an unauthenticated POST that writes to Sentry on every call; comment claims 'Sentry dedup' rate-limits it but there is no server-side rate limit — trivially abusable to burn Sentry quota.  
  `app/api/log/client-error/route.ts:27-53 (no rate limiting; comment at 13-14 overstates protection)`

**Fake / unwired:**
- app/api/stream/portfolio-updates/route.ts — ORPHAN: no EventSource/consumer anywhere references /api/stream/portfolio-updates (grep of app/components/lib/hooks empty).
- app/api/stream/price-feed/route.ts — ORPHAN: zero consumers.
- app/api/stream/sniper-events/route.ts — ORPHAN: zero consumers.
- app/api/stream/whale-alerts/route.ts — ORPHAN: zero consumers (only /api/whale-tracker/feed/events and /api/context-feed/events are actually consumed by lib/hooks/useContextFeed.ts).
- app/api/sim/portfolio/route.ts — ORPHAN: no frontend or lib references /api/sim at all.
- app/api/game-scores/route.ts — ORPHAN: zero consumers; the wgm-runner game (app/dashboard/wgm-runner/page.tsx) never POSTs scores here.
- app/api/health/route.ts:79 — Anthropic 'check' only regex-tests the key prefix (/^sk-ant-/), never verifies the key is valid; a revoked/wrong key still reports 'ok'.

**Missing backend:**
- game-scores has no persistence layer, no anti-cheat/score validation (client sends arbitrary score), and no shared store — needs Supabase table or Upstash Redis.
- SSE streams have no shared pub/sub — each connection independently polls upstream APIs (Alchemy/Jupiter/CoinGecko/Dexscreener/Arkham) on its own interval; with N clients this multiplies quota usage N-fold. No fan-out/caching layer.
- log/client-error and rum have no rate limiting or abuse protection on unauthenticated write endpoints.
- health has no caching/gating; every hit runs live Supabase+CoinGecko calls (Cache-Control: no-store) — a cheap DoS/amplification vector against upstreams.

**Missing frontend:**
- No consumer UI exists for the 4 SSE streams, sim portfolio, or game-scores — so no loading/error/empty/mobile states can be assessed; the backends are built but have no frontend layer at all.
- app/admin/revenue/page.tsx has only loading + null-data states; because the fetch always 403s (missing auth header) users only ever see the empty state — no unauthenticated/error distinction, no retry.
- JurisdictionWarning (geo consumer) and stats page were not in error-state scope here but geo returns flagged=false silently outside Vercel, so local/self-hosted users see no warning — acceptable by design but undocumented in UI.

**Free-API recommendations:**
- Replace paid Arkham (api.arkm.com, ARKHAM_API_KEY) with locked/allowed Sim by Dune for address intel + transfers: GET https://api.sim.dune.com/v1/evm/activity/{address} and .../balances/{address} — already partly integrated via lib/services/sim.ts. Fallback chain: Sim -> GoPlus address security (gopluslabs.io /api/v1/address_security) -> GeckoTerminal for token metadata.
- game-scores leaderboard: use Upstash Redis sorted set (ZADD naka:leaderboard <score> <user>, ZREVRANGE 0 49 WITHSCORES) — Upstash is on the locked matrix and gives atomic, persistent, cross-instance ranking. Alternatively a Supabase table with an index on score.
- SSE fan-out: back the streams with Upstash Redis pub/sub or a single cron-driven producer writing to Redis, and have each SSE connection read the cached snapshot instead of polling upstreams per-connection.
- health Anthropic check: replace regex with a real 1-token models list call (GET https://api.anthropic.com/v1/models) gated behind admin only, so it validates the key without leaking config to anonymous users.

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem helps this feature set. These are observability/geo/streaming/infra endpoints (geo headers, web-vitals ingestion, health checks, client-error logging, SSE polling, revenue analytics, contract detection). trustwallet/assets is only token logos, wallet-core is key/signing, and deep links are wallet-connection UX — none intersect. The single tangential spot is token symbols/logos in the portfolio-updates stream, but symbols already come from Alchemy/Jupiter and logos aren't fetched here; if logos were ever needed the free CoinGecko/GeckoTerminal image fields (already locked/allowed) are a better fit than pinning a GitHub raw-asset URL. Recommend: do not adopt Trust Wallet for anything in this scope.

## glass-brand-consistency
**Verdict:** A real canonical glass system exists (.nl-glass / GlassCard + .nl-btn-neon / .nl-button, tokenized on --nl-blue #0066FF) and most dashboard surfaces including swap and sniper already use it, but consistency is undermined by a broken Tailwind-opacity idiom on nl-glass (renders NO glass on the flagship wallet page), a forked brand-blue between Tailwind config (#0A1EFF) and the CSS design system (#0066FF), a documented-canonical <Button> component that is imported by zero files, and ~67 files still hardcoding a flat off-token #141824 panel palette.

- **P1** — Broken Tailwind opacity-modifier idiom on custom class: className="nl-glass/50" (also /40, /30, /60). Tailwind only generates opacity modifiers for registered utilities; .nl-glass is a hand-written CSS class whose background is a gradient, so the token 'nl-glass/50' matches NO CSS rule. These elements render with zero glass: no background, no border, no blur, no edge ring — flat/transparent. This is on the flagship wallet page the owner cites as the reference standard.  
  `app/dashboard/wallet-page/page.tsx:1478,1513,1524,1625,1793,2912,3925,3939,4311; app/dashboard/vtx-ai/page.tsx:1370; components/profile/NotificationSettingsPanel.tsx:259; components/dashboard/CompactKpiBar.tsx:87; components/market/SecurityPanel.tsx:446,570 (14 sites, no matching .nl-glass\/NN rule or safelist)`
- **P2** — Forked brand blue. tailwind.config.ts defines neon-blue.DEFAULT and accent.blue as #0A1EFF (indigo) and every boxShadow.neon* uses rgba(10,30,255) = #0A1EFF, while the entire CSS design system uses --nl-blue #0066FF. Any surface using text-neon-blue/bg-neon-blue-*/shadow-neon renders a visibly different blue next to adjacent .nl-glass cards.  
  `tailwind.config.ts:16-35 (#0A1EFF) and :67-72 (rgba(10,30,255)) vs app/globals-brand.css:16 (--nl-blue #0066FF); neon-blue token used in 9 files`
- **P2** — Third value for the same 'strong blue' token: globals.css defines --nl-blue-strong #0818CC, but Button.tsx uses fallback #0052CC and BuySellModal hardcodes #0052CC for the same hover state — three sources of truth for one hover color.  
  `app/globals.css:50 (#0818CC) vs components/ui/Button.tsx:20 (--nl-blue-strong,#0052CC) vs components/market/BuySellModal.tsx:231 (#0052CC)`

**Fake / unwired:**
- 'Canonical' <Button> component is dead code: components/ui/Button.tsx:6 documents it as 'the canonical button §2' with primary/secondary/ghost/danger/neon variants, but it is imported by ZERO files (grep for ui/Button import = 0). Real buttons use the CSS classes .nl-btn-neon/.nl-button plus raw inline Tailwind. components/ui/Button.tsx:1
- CinematicButton and CinematicContainer are effectively unused: 0 real consumers outside components/cinematic/ self-references. The cinematic button/container layer advertised by components/cinematic/index.ts is dormant. components/cinematic/CinematicButton.tsx:1
- GlassCard.tsx doc-comment says buttons should use '<Button> / .nl-btn-neon' (components/ui/GlassCard.tsx:9) — points at the dead <Button>, so the stated canonical guidance is internally contradictory.

**Missing backend:**
- N/A — glass-brand-consistency is a pure client-side CSS/design-system concern (styles/, tailwind.config.ts, globals-brand.css, components). No data pipeline, API, caching, or rate-limit surface is in scope; nothing to build server-side.

**Missing frontend:**
- No standardized segmented-control / pill primitive: 33 files hand-roll the same toggle as inline `bg-white/[0.04] border border-white/10` (e.g. app/dashboard/sniper/page.tsx:423,677,694; SniperWalletModal.tsx:193,213). A .whale-pill exists (globals.css:199) but is not adopted platform-wide.
- Flat off-token panel palette #141824 / #1E2433 / #0A0E1A used for inputs/toggles/inner rows in 67 files, breaking the glass look inside otherwise-glass modals (e.g. components/market/BuySellModal.tsx:141-157 inner controls; app/vault/conclave/CreateProposalModal.tsx uses flat bg-white/[0.03] inputs). No tokenized input/field class exists.
- Legacy .glass/.glass-strong still live and mixed with .nl-glass: app/share/[id]/page.tsx:72, app/s/[id]/page.tsx:68, app/dashboard/loading.tsx:4,23,38, components/ContextFeed.tsx:158, components/ProfileTab.tsx:78,714,852,939, and components/ui/GlassPanel.tsx (used by AppearancePanel) — two parallel glass systems.
- Ad-hoc inline box-shadow overrides on .nl-glass duplicate/override the canonical edge ring with inconsistent intensities (style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4)...' }}) at app/dashboard/swap/page.tsx:354,1549,1714; BuySellModal.tsx:109; wallet-page.tsx:1224 — same class, many different glow strengths.
- CreateProposalModal CTA is a bespoke gradient button (bg-gradient-to-br from-[#0066FF] to-[#1230B3], app/vault/conclave/CreateProposalModal.tsx:139) instead of .nl-btn-neon / .nl-button — one-off button styling.

**Free-API recommendations:**
- N/A — no external API is relevant to a CSS/token-consolidation feature. The fix is internal: (1) add a Tailwind safelist or, better, delete the .nl-glass/NN usages and replace with a real utility; (2) unify tailwind.config.ts neon-blue/accent.blue/boxShadow.neon* to #0066FF/rgba(0,102,255) so the Tailwind token layer matches --nl-blue; (3) either adopt or delete components/ui/Button.tsx and the components/cinematic button layer to remove dead systems; (4) introduce tokenized .nl-input and .nl-pill/.nl-segment classes to retire the #141824 flat palette and the 33 hand-rolled segmented controls.

**Trust Wallet fit:** Not applicable and would not help. This feature is internal CSS/design-token consolidation. Trust Wallet's developer ecosystem offers only trustwallet/assets (a token-logo/metadata registry on GitHub), wallet-core (a signing/crypto library), and deep links — none of which touch UI styling, glass tokens, or brand consistency. There is no Trust Wallet design system or component library. The correct 'fix' is zero-cost first-party work: consolidate the design tokens already defined in app/globals-brand.css and tailwind.config.ts. (Separately, trustwallet/assets could serve token logos elsewhere in the app, but that is out of scope for glass-brand-consistency and is already covered by CoinGecko/DexScreener image endpoints on free tier.)

## i18n-a11y
**Verdict:** The only real localization is runtime DOM machine-translation (AutoTranslate -> /api/translate via unofficial Google gtx + MyMemory); the entire next-intl stack and all 10 message bundles are dead unused code, one of three language switchers is a dead button, and headline a11y claims (skip link, html lang) are broken.

- **P1** — Skip link is broken: app/layout.tsx:175 renders <a href="#main"> ('Skip to main content', comment claims 'a11y P0' WCAG 2.4.1) but NO element with id="main" exists anywhere in app/ or components/ (grep for id="main" returns zero; no <main> tag carries the id). Keyboard/SR users activating the skip link jump nowhere.  
  `app/layout.tsx:175 vs missing id="main" (0 matches repo-wide)`
- **P1** — html lang is hardcoded 'en' and never updated on language switch. AutoTranslate.onLang only sets document dir (AutoTranslate.tsx:180), never lang. So when content is visually Spanish/Arabic, screen readers still announce it as English (WCAG 3.1.1/3.1.2 failure).  
  `app/layout.tsx:95 lang="en"; AutoTranslate.tsx:178-181 sets dir only`
- **P1** — components/ui/LanguageSwitcher.tsx is a DEAD button: it writes localStorage key 'steinz_locale' and dispatches CustomEvent('localeChange') (lines 7,54) but nothing in the codebase ever reads that key or listens to that event (grep confirms only self-references). It also does NOT touch the working 'naka_language' key, so a user who changes language on ProfileTab (ProfileTab.tsx:1275) sees zero translation and desyncs from the real switcher.  
  `components/ui/LanguageSwitcher.tsx:7,54; only consumer is ProfileTab.tsx:1275`
- **P2** — AutoTranslate only translates DOM text nodes; it never translates aria-label, placeholder, alt, or title attributes. Non-English users get English screen-reader labels, input placeholders and image alts throughout the app (degraded a11y + incomplete i18n).  
  `components/i18n/AutoTranslate.tsx collectTextNodes uses NodeFilter.SHOW_TEXT only (line 58-72)`
- **P1** — ~12 dialog/modal surfaces render role="dialog"/aria-modal but do NOT use useFocusTrap: app/admin/users/page.tsx, app/vault/conclave/CreateProposalModal.tsx, app/dashboard/wallet-page/page.tsx, components/ui/NotificationCenter.tsx (comment mentions 'focus trap' but never calls the hook), components/legal/CookieConsent.tsx, components/security/SecurityGate.tsx, components/onboarding/OnboardingFlow.tsx + MaxWelcomeJourney.tsx + FirstRunTour.tsx (x2), PwaInstallPrompt.tsx. Focus can escape behind the overlay; Escape/restore-focus not guaranteed.  
  `grep of role=dialog files minus useFocusTrap consumers`
- **P2** — LandingNav mobile hamburger button has no accessible name: <button className="md:hidden..." onClick><Menu/></button> with no aria-label and an aria-hidden-free icon.  
  `components/landing/LandingNav.tsx:92-94`
- **P2** — MyMemory fallback in /api/translate is passed source='auto' when caller omits source (useTranslate/AutoTranslate never send source), producing langpair 'auto|xx' which MyMemory does not support; so if Google gtx is down the fallback also fails and text stays English.  
  `app/api/translate/route.ts:112 (source defaults 'auto'), viaMyMemory line 76 builds `${source}|${target}``

**Fake / unwired:**
- Entire next-intl runtime is dead/unwired: next.config.js wires createNextIntlPlugin('./i18n.ts') but there is NO app/[locale]/ directory, NO NextIntlClientProvider, and ZERO useTranslations/getTranslations calls anywhere (grep returns nothing). All 10 messages/*.json bundles are loaded but never rendered. (i18n.ts:22, next.config.js:2, app/layout.tsx has no provider)
- lib/i18n/config.ts + lib/i18n/request.ts are a second, entirely dead parallel i18n foundation: request.ts is never referenced by next.config (which points at ./i18n.ts), and config.ts declares 10 SUPPORTED_LOCALES (en,es,pt,fr,de,ja,zh,tr,ru,ko) while lib/i18n/messages/ ships only en.json + es.json — request.ts would throw on import('./messages/de.json') etc. if it were ever wired. (lib/i18n/config.ts:21, lib/i18n/request.ts:18)
- Three divergent locale sources that disagree: i18n.ts locales include ar+hi but NOT de/ru; lib/i18n/config.ts includes de+ru but NOT ar/hi; components/i18n/LanguageSwitcher.tsx offers 15 langs incl it/vi/id/zh-cn. No single source of truth. (i18n.ts:3 vs lib/i18n/config.ts:21 vs components/i18n/LanguageSwitcher.tsx:15-31)
- ProfileTab language selector (components/ui/LanguageSwitcher.tsx) presents a real-looking dropdown with checkmarks and RTL handling but performs no translation — pure UI theater; selecting a language does nothing user-visible.
- components/i18n/LanguageSwitcher.tsx footer text claims 'Auto-translated by Naka Labs' (line ~103) — translation is actually Google gtx unofficial endpoint + MyMemory, not a Naka service.

**Missing backend:**
- No use of the free, zero-cost, already-written translation bundles: messages/*.json contain complete real translations but the backend/render path ignores them in favor of live machine-translation API calls on every string — wasteful and lower quality.
- No rate-limit handling for MyMemory (anonymous ~5k words/day/IP) and no key rotation; on a shared Vercel egress IP the fallback will exhaust quota quickly with no backoff.
- /api/translate cache is per-lambda in-memory only (route.ts:26) — no shared cache, so Vercel's many cold instances each re-translate the same strings; Upstash Redis (already in the allowed stack) is not used.
- No persistence of AutoTranslate results server-side; only per-browser localStorage cache, so every new visitor re-hits the translate providers for the same static UI.
- No sanitization that brand/token names (e.g. 'Naka Labs', ticker symbols, contract labels) are excluded — NUMERIC_RE (AutoTranslate.tsx:24) skips pure numbers but proper nouns and tickers get machine-translated and garbled.

**Missing frontend:**
- No error/empty state when both translate providers fail: page silently stays English with no toast/indicator, so users can't tell translation failed vs. untranslatable.
- No loading indicator on manual language switch beyond the initial-load flash guard; switching language mid-session shows a debounced (400ms) partial swap with no spinner.
- RTL is only partial: dir is set for Arabic but there is no logical-property audit; many components use physical left/right Tailwind classes (only the switchers use text-start). Arabic layout will be visually broken in most panels.
- No visible focus-ring standardization audit; useFocusTrap moves focus but many custom buttons rely on default outline that the dark glass theme may suppress.
- html lang not localized (see broken) — also no per-element lang attributes on the machine-translated subtree, so mixed-language content isn't marked up.
- WCAG AAA contrast not verifiable as met: switcher dropdown uses text-gray-500 on #0e1220 for secondary labels (components/i18n/LanguageSwitcher.tsx) which fails AAA (7:1) and likely AA for small text.

**Free-API recommendations:**
- Best fix costs $0 and needs no API: actually consume the existing messages/*.json via next-intl (add app/[locale]/ or a lightweight useTranslations wrapper). Human translations already exist for 10 locales — render them instead of live-translating. This eliminates the gtx dependency entirely for static UI.
- Keep /api/translate only for user-generated content (feed posts, DMs). For that, prefer LibreTranslate (self-host on Vercel or use a free public instance like libretranslate.com/translate) or keep MyMemory (api.mymemory.translated.net/get) as the free, ToS-clean provider. Google gtx (translate.googleapis.com/translate_a/single) is undocumented, ToS-violating and can break silently — demote it or drop it.
- Add Upstash Redis (already in the allowed stack) as the shared translate cache keyed by source|target|hash(text), TTL 30d, so the static-UI and UGC translations are computed once platform-wide.
- Fix the MyMemory fallback to send an explicit source (resolve 'auto'->'en' before calling, since UI source is always English) so the fallback actually works when gtx is down.
- For locale-aware number/currency formatting keep the native Intl formatters (lib/i18n/formatters.ts) — zero cost, already correct.

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem helps i18n or a11y. trustwallet/assets is a token-logo/metadata registry, wallet-core is a signing library, and Trust Wallet deep links are wallet-connection URIs — none provide translation strings, locale bundles, RTL support, or accessibility primitives. Do not add Trust Wallet for this feature. The correct free path is to render the already-written next-intl messages/*.json bundles and, for UGC, use LibreTranslate/MyMemory with an Upstash Redis shared cache.

## landing-discover
**Verdict:** Discover/leaderboard is genuinely wired end-to-end to real Supabase tables, but the landing "live counters" are half-dead (2 of 4 never increment) and the hero StatBar still hardcodes a fabricated "400+ wallets" stat.

- **P1** — Landing 'Tokens Analyzed' and 'Rugs Detected' counters are permanently 0: nothing in the codebase ever increments tokens_analyzed or rugs_detected. Only swaps_protected is incremented, and only from wallet/send. The section tagline 'Live counters... grow with every real interaction' is false for half the tiles.  
  `app/api/wallet/send/route.ts:184 (sole incrementPlatformStat caller); grep found zero writers of tokens_analyzed/rugs_detected; StatsSection.tsx:118 tagline`
- **P1** — Hero StatBar hardcodes a fabricated 'Wallets Tracked' number. useCountUp(400) animates to a static '400+' with no data source; the code comment even admits the true value ('449 live') while hardcoding 400. This is exactly the mock-data violation the comment claims to have removed.  
  `components/landing/HeroLeft.tsx:32,36 (and comment lines 28-30)`
- **P2** — swaps_protected is labeled 'Swaps Protected' on the landing but is only incremented from the plain wallet transfer path (wallet/send), not from any swap or rug-protection event — the counter measures the wrong thing.  
  `app/api/wallet/send/route.ts:183-184 vs StatsSection.tsx:24 label 'Swaps Protected'`
- **P2** — Chain-count is inconsistent across the surface: hero says 8, landing-stats default is 7, FeatureShowcase says 9 (copy) and 7 (swap), platform-stats API returns 12, OnboardingMention says 'eight'. No single source of truth.  
  `HeroLeft.tsx:31; landing-stats/route.ts:22; FeatureShowcase.tsx:166,197; platform-stats/route.ts:51; OnboardingMention.tsx:25`
- **P2** — WCAG contrast fail on hero StatBar labels: #2a3a60 text on the near-black lower hero gradient is well below AAA (and AA). Other hero labels were explicitly fixed to --nl-text-muted; these were missed.  
  `components/landing/HeroLeft.tsx:46`
- **P2** — Perf: useScrollY calls setState on every rAF scroll frame, forcing HeroSection (which maps 55 animated star divs + grid) to re-render each frame during scroll — an avoidable reconcile cost on the LCP section. Aggravates the owner's heavy-FX Lighthouse concern.  
  `lib/landing/useScrollParallax.ts:9-30 + components/landing/HeroSection.tsx:18-55`
- **P2** — FloatingCoins hotlinks 10 external images from assets.coingecko.com at render on the landing (network + reliability + LCP cost), and imports next/image but never uses it (raw <img> used instead).  
  `components/landing/FloatingCoins.tsx:2,7-19,48`

**Fake / unwired:**
- Hero 'Wallets Tracked 400+' is hardcoded, no data source — HeroLeft.tsx:32
- StatsSection tagline claims 'Live counters... grow with every real interaction' while 2 of 4 counters (tokens_analyzed, rugs_detected) have no increment pipeline — StatsSection.tsx:118 + landing-stats/route.ts
- /api/platform-stats returns hardcoded placeholders chains:12, signalAccuracy:'Beta', activeUsers:'Beta', totalTokensScanned:'N/A', predictionsResolved:0 — only volumeTracked is real (CoinGecko /global) — platform-stats/route.ts:50-58
- /api/platform-stats is effectively dead: only consumed by an admin health-check list, never rendered to users — app/admin/page.tsx:213

**Missing backend:**
- No pipeline increments tokens_analyzed or rugs_detected — the token-security/honeypot/scan handlers must call incrementPlatformStat but do not.
- platform-stats API computes no real activeUsers, signalAccuracy, totalTokensScanned, or predictionsResolved — all placeholder strings.
- chains_supported has no source of truth; every surface hardcodes a different number.
- No caching/self-hosting of the 10 landing coin logos — runtime dependency on an external CDN with per-request onError hiding.

**Missing frontend:**
- StatsSection has no distinct error/empty state — a failed fetch silently renders zeros identical to a real cold-start, so users can't tell '0' from 'broken' (StatsSection.tsx:90-92).
- StatsSection shows counting-from-0 as its only loading affordance (no skeleton); acceptable but ambiguous against the permanent-zero bug.
- RecommendationsStrip renders null (invisible) on empty, and Discover has no anonymous-user prompt — anon users get a bare leaderboard grid with no sign-in nudge (RecommendationsStrip.tsx:69-70, discover/page.tsx).
- No reduced-motion handling on the heavy hero/CTA FX (55 pulsing stars, floating coins, parallax) for prefers-reduced-motion users.

**Free-API recommendations:**
- Wire lib/platformStats.incrementPlatformStat('tokens_analyzed') into every token-security scan handler (GoPlus token_security, Honeypot.is /v2/IsHoneypot, RugCheck /tokens/{mint}/report) and incrementPlatformStat('rugs_detected') when a scan verdict is high-risk/honeypot — all free-tier APIs already in the locked matrix.
- platform-stats.activeUsers: Supabase count on profiles or DAU from feature_usage_logs (already logged via useFeatureUsageLog) — free.
- platform-stats.totalTokensScanned: read platform_stats.tokens_analyzed instead of 'N/A'.
- volumeTracked already correctly uses CoinGecko /api/v3/global (free) — keep, add DexScreener/GeckoTerminal as fallback since it currently returns 'N/A' on any CoinGecko rate-limit with no retry.
- Derive Chains Supported from a single shared config/enum consumed by hero, landing-stats default, and feature copy.
- Self-host or bundle the FloatingCoins logos from the Trust Wallet assets registry (see trust_wallet_fit) or a build-time jsDelivr fetch, instead of runtime assets.coingecko.com hotlinks.

**Trust Wallet fit:** "One genuine fit: the FloatingCoins component (FloatingCoins.tsx:7-19) hotlinks 10 token logos from assets.coingecko.com at runtime. The trustwallet/assets GitHub registry (blockchains/<chain>/assets/<address>/logo.png, plus per-chain info/logo.png) is the standard free, license-clean source for exactly these BTC/ETH/SOL/BNB/AVAX/TRX/TON/ARB logos — pull them at build time (or bundle/self-host from a jsDelivr mirror of trustwallet/assets) to remove 10 render-time external requests and improve Lighthouse LCP. Nothing else Trust Wallet offers (wallet-core, deep links) touches the stats, leaderboards, or discover data — for those the free alternatives already in the matrix (Supabase for counts, CoinGecko/DexScreener for volume) are the correct sources."

**Back-button offenders:**
- components/ui/BackButton.tsx:45 — BackButton is history-first (router.back()) but falls back to router.push('/dashboard'); on the public /discover and /leaderboard/[kind] pages a direct/external landing with no internal referrer sends 'back' to the auth-gated /dashboard rather than home. Not a raw hardcode, but the wrong fallback destination for these public pages.

## market-data-core
**Verdict:** The one market-data path that actually renders in the UI (CoinGecko -> /api/market-data -> Markets/MarketDashboard list, plus DexScreener /api/search for CA paste) works, but roughly half the endpoints in scope (coin-chart, coin-ohlc, coin-discovery, ca-lookup, prices/batch, chart/drawings, /api/prices) are dead/unwired, the primary chart data source is Binance which is geo-blocked (HTTP 451) from Vercel's US IPs, and the Markets header ships hardcoded "$2.41T / +2.4%" fake numbers.

- **P1** — Primary chart data source is Binance REST (api.binance.com), which returns HTTP 451 to US-hosted IPs. coin-chart and coin-ohlc run server-side on Vercel, so the Binance 'Strategy 1' path almost always fails in production and silently falls through.  
  `app/api/coin-chart/route.ts:66, app/api/coin-ohlc/route.ts:59`
- **P1** — universalSearch (backing /api/search/coins) fetches the full Binance 24hr ticker server-side on every query — geo-blocked on Vercel (451) so searchBinance() returns [] and all major-coin results silently disappear; also a heavy full-ticker fetch with cache:'no-store' on each keystroke.  
  `lib/search/universalSearch.ts:36`
- **P1** — market-data fallback chain second tier is CoinCap (api.coincap.io/v2), whose free v2 API is deprecated/now key-gated. When CoinGecko fails the fallback also fails, so the entire market list goes empty instead of degrading.  
  `app/api/market-data/route.ts:33`
- **P2** — Filters modal is non-functional theater: options are hardcoded static labels ('All Chains','All','24 H') and 'Apply Filters' only calls setShowFilters(false) — no filtering ever applied to the list.  
  `components/Markets.tsx:287-310`
- **P2** — TradingView attribution is covered by an overlay hardcoded to dark (var(--tv-cover,#0A0E1A)); no light-theme value is defined, so in light mode two dark rectangles sit over the chart corners.  
  `components/TradingViewChart.tsx:207-221`

**Fake / unwired:**
- Hardcoded market-cap header: totalMcap='$2.41T' and totalChange='+2.4%' are useState defaults that are rendered but NEVER updated — setTotalMcap/setTotalChange are defined and never called. components/Markets.tsx:52-53 (rendered at :167-168). Direct NO-mock-data violation.
- Synthetic/fabricated chart: coin-chart's DexScreener branch generates a fake price series from current price + priceChange with Math.sin/Math.cos noise instead of real OHLC. app/api/coin-chart/route.ts:87-138 (noise at :127).
- Hardcoded trust score: universalSearch assigns every Binance major coin safetyScore:8 with comment 'higher trust by default'. lib/search/universalSearch.ts:65.
- Hardcoded logo registry: COINGECKO_LOGOS and BINANCE_NAMES are hand-maintained maps of ~14/28 tokens; anything outside them gets no logo/name in universal search. lib/search/universalSearch.ts:5-31.
- False 'in use' comment: /api/prices/batch header claims it is 'used by the alert-monitor poll loop', but nothing fetches the URL — the cron uses the getTokenPriceDetailed service directly. The HTTP endpoint is unwired. app/api/prices/batch/route.ts:8.
- Dead endpoint /api/coin-chart — no frontend consumer (grep of app/components/lib finds none).
- Dead endpoint /api/coin-ohlc — no frontend consumer.
- Dead endpoint /api/coin-discovery — referenced only in a code comment (lib/contextFeed/filter.ts:135), never fetched.
- Dead endpoint /api/ca-lookup — full-featured (DexScreener + GoPlus) but zero consumers anywhere.
- Unwired endpoint /api/chart/drawings — drawing-persistence table + route exist but no component reads/writes it; the TradingView widget does not use it.
- /api/prices is effectively dead in the UI — only lib/hooks/usePrices.ts (which itself has no consumers) and the admin health check call it.
- /api/search/coins (universalSearch, the Binance+Arkham path) is only wired to the admin health-check page, not the real search box; Markets uses /api/search (DexScreener-only).

**Missing backend:**
- No real global-market pipeline feeding the Markets header — getGlobalMarketData() exists in lib/services/coingecko.ts (CoinGecko /global) but is not called by Markets; the header should fetch it instead of showing hardcoded $2.41T.
- Fallback chain is off-allowlist and fragile: CoinGecko -> CoinCap(dead) with no GeckoTerminal/DexScreener tier for the market list; a CoinGecko 429/outage blanks the whole page.
- No caching or rate-limit budget on the raw Binance/CoinCap fetches in coin-chart/coin-ohlc/market-data (they bypass the cache-manager used by the coingecko/dexscreener services).
- No server-side dedup/rate-limit on universalSearch's per-keystroke full Binance ticker fetch.
- coin-ohlc/coin-chart never try GeckoTerminal OHLCV, which is the correct free source for the exact case (DEX tokens by contract) where they currently fabricate data.

**Missing frontend:**
- Markets header block has no loading skeleton for the total-mcap/change figures (they are static text, so nothing to load — but once wired they need a skeleton).
- No unauthenticated-state handling needed for public market data, but /api/chart/drawings requires auth and has no matching frontend to show a signed-out state.
- AdvancedChart fallback path (/api/market/ohlcv) has no visible error/empty state surfaced from the market detail page when a long-tail token has no DEX pair.
- Filters modal: no active/selected state, no persistence, no applied-filter chips — it looks interactive but is inert.
- WCAG: change % colors text-emerald-400/text-red-400 on #111827 rows are borderline for AAA; the gray-500 rank/mcap subtext on #111827 fails AAA contrast.

**Free-API recommendations:**
- Replace Binance server-side klines with GeckoTerminal free OHLCV: GET https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool}/ohlcv/{timeframe} (no key, not geo-blocked) for DEX tokens; for majors use CoinGecko /coins/{id}/ohlc which the service already wraps.
- Replace the dead CoinCap fallback with GeckoTerminal or DexScreener: for the market list, tier = CoinGecko /coins/markets -> (on fail) GeckoTerminal /networks/{net}/trending_pools or CoinGecko /coins/markets via the 429 public fallback already in coingecko.ts.
- Wire the header to CoinGecko /global (GET https://api.coingecko.com/api/v3/global -> data.total_market_cap.usd, data.market_cap_change_percentage_24h_usd) via existing getGlobalMarketData().
- Real DEX OHLCV for coin-chart's synthetic branch: GeckoTerminal /networks/{network}/pools/{pool_address}/ohlcv/{day|hour|minute}?aggregate=... returns real candles keyed by pair — removes the Math.sin fabrication entirely.
- For token search that needs CEX majors without Binance geo-risk, use CoinGecko /search?query= (GET https://api.coingecko.com/api/v3/search) instead of the full Binance ticker.
- Fallback chain design for market list: CoinGecko(demo key) -> CoinGecko(public, on 429) -> GeckoTerminal trending/pools -> cached-last-good (Upstash) -> empty-with-retry. All on the sanctioned free matrix.

**Trust Wallet fit:** Trust Wallet's trustwallet/assets GitHub registry could serve as one more token-logo fallback (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummed_address}/logo.png) to replace the hand-maintained COINGECKO_LOGOS map in universalSearch.ts:17-31 and fill missing images in the Markets list. However it is inferior for this feature: it is keyed by EVM-checksummed address (the code lowercases addresses, so lookups would miss), covers no live price/volume/OHLC data at all, and is stale for long-tail/new tokens. DexScreener's pair.info.imageUrl (already available in the DexPair type and used in ca-lookup) is the better free source since it comes back in the same call as price data. Recommendation: do NOT add Trust Wallet; use DexScreener imageUrl + CoinGecko markets image, with GeckoTerminal as the OHLC gap-filler.

## market-maker
**Verdict:** This is a genuinely real, unusually honest feature — real Supabase persistence, a real grid/range tick engine executing 0x swaps via ZeroDev AA session keys on a 2-minute cron with serious money-safety guards — but it is observability-blind: a strategy can sit "active" forever while the engine silently skips every tick (no session key, Solana, RPC failure) with zero UI feedback, and the fills/orders the engine records are never shown to the user.

- **P1** — Activation succeeds with no execution path and the user is never told: PATCH sets status=active regardless of whether a funded kernel/active session key exists on that chain, then the engine silently returns skip 'no session key / execution unavailable' every tick — skip reasons and last_run_at exist server-side but are never surfaced in the UI, so an 'active' strategy that will never trade is indistinguishable from a healthy one  
  `app/api/market-maker/strategies/route.ts:131-148 (no session-key precondition); lib/marketMaker/engine.ts:213 (skip reason discarded to cron log only); app/dashboard/market-maker/page.tsx:212-307 (card renders no last_run_at, no health/skip info)`
- **P1** — Solana strategies are creatable AND activatable but the engine unconditionally skips them ('chain not AA-executable yet') — disclosed only in a small hint inside the create modal, not on the strategy card or at activation time  
  `lib/marketMaker/engine.ts:83; app/api/market-maker/strategies/route.ts:29 (solana in CHAINS); components/marketMaker/CreateStrategyModal.tsx:207 (hint only)`
- **P1** — BackgroundSnipingCard (the only kernel fund/enable path on this page) renders null when the user has no built-in Naka wallet in localStorage — those users get an activatable Market Maker with literally no way to set up execution and no explanation  
  `components/sniper/BackgroundSnipingCard.tsx:46 (if (!wallet) return null); app/dashboard/market-maker/page.tsx:172-174`
- **P2** — Range strategy's ladder preview is wrong: the modal always renders the grid computeLadder (numLevels rungs from spread to band) even when Range is selected, but the engine places only 2 rungs at range_lower_pct/range_upper_pct — the user previews a grid they will not get  
  `components/marketMaker/CreateStrategyModal.tsx:127-130 (computeLadder regardless of strategyType) vs lib/marketMaker/engine.ts:105-110`
- **P2** — Client validation misses the server's $5 minimum order floor — a $1-4 order size passes canSave and only fails after submit with a server error  
  `app/api/market-maker/strategies/route.ts:78-79 (MIN_ORDER_USD=5) vs components/marketMaker/CreateStrategyModal.tsx:138 (only > $0)`
- **P2** — Sell-amount precision loss for micro-price tokens: BigInt(Math.round(tokensToSell * 1e9)) exceeds Number.MAX_SAFE_INTEGER once tokensToSell > ~9M tokens (routine for sub-$0.00001 tokens), silently mis-sizing the sell by the float rounding error  
  `lib/marketMaker/engine.ts:142`
- **P2** — No DELETE endpoint and no config editing: PATCH's own comment promises 'editable config' but only status is writable; stopped strategies accumulate on the dashboard forever with no way to remove or adjust them  
  `app/api/market-maker/strategies/route.ts:13 (comment) vs :131-148 (status only); no DELETE export in route.ts; no edit UI in page.tsx`
- **P2** — Dispatcher aborts its fetch to mm-engine at 60s while the handler's maxDuration is 120s — a busy tick (up to 50 strategies, each doing DexScreener + decimals RPC + 0x + userOp) gets logged as a TimeoutError failure even when it completes  
  `app/api/cron/dispatch/[group]/route.ts:105 (AbortSignal.timeout(60_000)) vs app/api/cron/mm-engine/route.ts:14 (maxDuration=120)`
- **P2** — Rung re-arm is a flat 30-minute cooldown, not price-re-entry based (acknowledged as a follow-up in the code) — in a slow one-directional bleed the same rung refills every 30 min until the budget is gone, just slower  
  `lib/marketMaker/engine.ts:76-78`

**Fake / unwired:**
- GET route doc-comment claims it returns '(+ recent fills summary)' but the handler returns strategies only — mm_fills and mm_orders are written by the engine and have RLS read policies for owners, yet no API or UI ever reads them (app/api/market-maker/strategies/route.ts:10 vs :35-45; grep: mm_fills/mm_orders referenced only in engine.ts + migrations)
- quote_token_address is accepted by POST and stored (route.ts:51,110) but never sent by the modal and never read by the engine — the engine always quotes USDC (engine.ts:90-91); vestigial column presented as configurable in the schema
- No mock/hardcoded data found anywhere in this feature — the 'Presence' strategy button is disabled and honestly labeled 'Not offered — wash trading' (CreateStrategyModal.tsx:250,258), empty states say so, and PnL/inventory come from real fills. This feature meets the no-mock rule.

**Missing backend:**
- Solana execution: engine hard-skips solana (engine.ts:83) even though Jupiter swap lib (lib/trading/jupiter.ts) and solanaSessionKeySigner.ts exist in the codebase — pipeline never wired to MM
- Fills/summary read endpoint (e.g. GET /api/market-maker/strategies?include=fills or /api/market-maker/fills?strategy_id=)
- Token decimals read uses free public RPCs (eth.llamarpc.com, polygon-rpc.com etc. — lib/sniper/priceFeed.ts:32-38) which rate-limit and cause skipped sell ticks, while an Alchemy key (in the approved matrix) already exists in lib/services/alchemy
- Single quote source: 0x only in executeSessionSwap (sessionKeyExecutor.ts:116) — no 1inch/KyberSwap/OpenOcean fallback, so a 0x outage halts all MM fills
- Single price source: DexScreener only for the reference/market price (engine.ts:67,95) — no GeckoTerminal/CoinGecko fallback; a DexScreener outage stalls every strategy (fails safe as skip, but stalls)
- No token-security gate at strategy creation — a user can budget $10k of grid buys into a honeypot; GoPlus is in the approved matrix and already integrated elsewhere in the repo
- No engine-side notification on repeated failed ticks (Telegram/push infra exists platform-wide but MM never uses it)

**Missing frontend:**
- Per-strategy fills/orders history (trade log with tx-hash links to explorers) — the data exists in mm_fills/mm_orders with owner read RLS but has zero UI
- Execution-health surface: last_run_at, last tick action/skip reason, and a 'session key active on this chain?' badge per strategy card
- Warning or block at Activate time when no active session key exists on the strategy's chain (and a hard notice for Solana strategies)
- Fallback guidance when BackgroundSnipingCard renders null (no built-in wallet) — currently a blank gap where the funding flow should be
- Edit-strategy UI (spread/levels/budget/slippage) and delete/archive for stopped strategies
- Range-specific preview (2 bounds, not a grid ladder) in the create modal
- Mark-to-market inventory USD for market-priced strategies — the card shows raw token count only (page.tsx:229-232); the server could return the DexScreener price with GET
- Confirmation dialog on Stop (single tap, described to the user as terminal)

**Free-API recommendations:**
- Decimals via Alchemy (already in matrix, free 300M CU/mo): POST https://{network}.g.alchemy.com/v2/{key} eth_call decimals(), fallback chain Alchemy -> current public RPC list — eliminates the flaky llamarpc dependency on the money path
- Reference-price fallback chain: DexScreener GET https://api.dexscreener.com/latest/dex/tokens/{address} (current) -> GeckoTerminal GET https://api.geckoterminal.com/api/v2/networks/{network}/tokens/{address} (free, 30 rpm) -> CoinGecko GET https://api.coingecko.com/api/v3/simple/token_price/{platform}?contract_addresses={addr}&vs_currencies=usd (free demo tier)
- EVM quote fallback chain in executeSessionSwap: 0x GET https://api.0x.org/swap/allowance-holder/quote (current) -> 1inch GET https://api.1inch.dev/swap/v6.0/{chainId}/quote -> KyberSwap GET https://aggregator-api.kyberswap.com/{chain}/api/v1/routes -> OpenOcean GET https://open-api.openocean.finance/v4/{chain}/swap — all in the owner's locked free matrix
- Solana MM execution: Jupiter GET https://lite-api.jup.ag/swap/v1/quote + POST /swap/v1/swap (free tier) reusing lib/trading/jupiter.ts + the existing Solana session signer
- Pre-creation safety gate: GoPlus GET https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses={addr} + Honeypot.is GET https://api.honeypot.is/v2/IsHoneypot?address={addr} (EVM) / RugCheck GET https://api.rugcheck.xyz/v1/tokens/{mint}/report (Solana) — warn before a budget is committed to a honeypot
- Flag for owner: ZeroDev bundler/paymaster (rpc.zerodev.app, lib/wallet/sessionKeyAA.ts:86-95) is a third-party dependency OUTSIDE the locked free-API matrix; its free tier is limited — the whole MM+sniper auto-execution stack depends on it, so it should be explicitly approved or budgeted

**Trust Wallet fit:** Nothing in the Trust Wallet ecosystem helps this feature. trustwallet/assets is only a static token-logo/metadata GitHub registry (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png) — the MM UI does not display token logos, and token-meta already resolves logos free via Alchemy + DexScreener info.imageUrl (app/api/swap/token-meta/route.ts:91), both of which cover long-tail memecoins that the community-PR-gated Trust registry misses. wallet-core is a client-side signing library and Trust deep links open the Trust Wallet app — both irrelevant to a server-side ZeroDev AA session-key execution engine, and Trust Wallet has no order/trading/market-making developer API at all. The better free investments are the quote/price fallback chains and GoPlus gating listed above.

## messages-social
**Verdict:** A genuinely built, non-mock, end-to-end DM + social system (real libsodium E2E, RLS-scoped realtime, request/block/mute logic) that works for plaintext DMs, but the E2E private-key wrapping is keyed to the rotating Supabase access token, so encrypted conversations become undecryptable after a routine token refresh, and the render-time sanitizer silently strips newlines.

- **P1** — E2E private key is wrapped with a secret derived from SHA-256 of the FULL Supabase access-token JWT string, which rotates on every ~hourly token refresh. The keyVault comment claims the input is stable sub+aud claims, but deriveWrapSecret hashes the entire token. After any refresh, unwrapPrivateKey throws, ensureKeyVault throws, and because public_key/encrypted_private_key still exist it never regenerates — so all encrypted DM history becomes permanently undecryptable ('can’t be unlocked on this device') and new threads silently downgrade to plaintext.  
  `lib/social/encryption.ts:60-72 (enc(accessToken) hashed) vs lib/social/keyVault.ts:12-18,63; failure surfaced at app/dashboard/messages/[peerId]/page.tsx:208-223`
- **P2** — sanitizeMessageBody strips all C0 control chars  -, which INCLUDES newline (
) and tab (	). It is applied at render time on every message body. The composer explicitly supports Shift+Enter newlines and renders with whitespace-pre-wrap, so multi-line messages are stored verbatim but always displayed collapsed onto a single line — user-visible content corruption. The DB last_message_preview is not sanitized, so inbox preview and thread render disagree.  
  `lib/social/sanitizeMessageBody.ts:14-21 applied at app/dashboard/messages/[peerId]/page.tsx:589; newline entry at composer [peerId]/page.tsx:623-624`
- **P2** — Shadow-block realtime guard has a load race: blockedPeerRef is populated by an async effect after mount, but the realtime INSERT handler reads it synchronously. A message arriving before the block state resolves is rendered into the open thread.  
  `app/dashboard/messages/[peerId]/page.tsx:295-308 (async populate) vs :314-321 (handleInsert reads blockedPeerRef)`
- **P2** — markAllRead in the inbox fires one PATCH request per unread conversation in parallel (no bulk endpoint), so a user with many unread threads triggers a burst of N requests against the rate-limited API.  
  `app/dashboard/messages/page.tsx:90-97`
- **P2** — GET /api/social/search has no rate limiting and runs 3+ admin queries per keystroke-debounced call; it can be abused for cheap user enumeration across the whole profiles table (ilike %q%).  
  `app/api/social/search/route.ts:20-83 (no takeToken)`

**Missing backend:**
- Rate limiter is in-memory per-serverless-instance (comment admits it); on Vercel it does not enforce limits across regions/cold starts. Upstash Redis is already in the owner's allowed stack and should back takeToken (lib/social/rateLimit.ts:8-49).
- Declined-request message history is hidden only in the API layer; the dm_messages SELECT RLS policy is participant-only and does not exclude declined conversations, so a participant using the anon client via PostgREST/Realtime can still read a declined thread's ciphertext+metadata (supabase/migrations/2026_05_16_social_layer_foundation.sql:205-207 vs API hiding at app/api/social/dm/messages/route.ts:46-48).
- No caching on GET /api/social/profile/batch or /profile/[username]; every inbox open and thread open re-queries profiles+counts with no revalidate window.
- last_message_preview is populated only for plaintext text messages by trg_dm_bump_last; encrypted conversations always show the static 'Encrypted message' string with no client-side decrypted preview pipeline (migration 2026_06_30:24-27, previewText at app/dashboard/messages/page.tsx:52-56).

**Missing frontend:**
- No per-message send state on the optimistic bubble: failures surface only in a single global error line at the top of the scroll area; a message that fails after optimistic append has no 'failed / retry' affordance and no per-bubble 'sending…' indicator (app/dashboard/messages/[peerId]/page.tsx:415-456, error rendered at :547-548).
- WCAG AAA contrast failures: message previews, timestamps and secondary labels use text-slate-500 (~#64748b) and text-[11px] on the near-black glass background, far below the 7:1 AAA ratio (app/dashboard/messages/page.tsx:230,233; [peerId]/page.tsx:590).
- No explicit 'peer has blocked you / DM disabled' empty state in the thread — a 403 from send is shown as a generic red error line rather than a designed state, and the composer stays enabled until send fails (app/dashboard/messages/[peerId]/page.tsx:432-438).
- When an encrypted thread can’t be unlocked on this device, convKey stays null and plaintext stays false, so `ready` is false and the composer is stuck on 'Opening conversation…' with only a terse error — no recovery/help UI (app/dashboard/messages/[peerId]/page.tsx:207-223,628-629).

**Free-API recommendations:**
- Replace the JWT-derived wrap secret with a stable per-user secret: derive the wrap key from a wallet signature (sign a fixed message with the user's connected wallet via wallet-core/ethers) or from user.id + a server-held pepper, never from the rotating access_token — this is a correctness fix, not an external API. No paid API needed.
- Back the token-bucket rate limiter with Upstash Redis (already allowed): use @upstash/ratelimit fixedWindow/slidingWindow keyed on `dm:${userId}` for distributed enforcement across Vercel regions.
- Add a bulk read-all-conversations endpoint (single UPDATE ... WHERE conversation_id IN (...)) to replace the N-request markAllRead fan-out; no external API.
- For avatars/profile media that currently rely on avatar_url only, keep Supabase Storage; no third-party needed.

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem helps this feature. Trust Wallet offers no messaging/social/DM API. trustwallet/assets is a token-logo registry (chain/contract -> logo) and is irrelevant to user avatars, profiles, follows, or DMs. wallet-core is a signing/key-management library for blockchain transactions, not for user-content encryption — the DM layer already uses libsodium (crypto_box/secretbox) correctly, which is the right free tool. The one adjacent idea — deriving the E2E key-wrap secret from a wallet signature — can be done with the wallet the app already integrates (or wallet-core), but that is generic wallet functionality, not a Trust-Wallet-specific offering. Recommendation: do not adopt Trust Wallet for messages-social; keep libsodium + Supabase (Realtime/RLS/Storage) and add Upstash Redis for rate limiting.

**Back-button offenders:**
- app/dashboard/messages/[peerId]/page.tsx:470 — thread back button hardcodes router.push('/dashboard/messages') instead of router.back(); destination is the contextually-correct parent inbox (not /dashboard), so low-impact, but it is a hardcoded push not a history-back and loses the prior scroll/entry point (e.g. if opened from a notification deep-link or profile).
- app/dashboard/messages/[peerId]/page.tsx:138 — respondToRequest('decline') hardcodes router.push('/dashboard/messages') rather than history-back; same class, contextually reasonable.
- Note: the inbox BackButton (components/ui/BackButton.tsx:40-45) correctly uses router.back() for internal referrers and only falls back to /dashboard when there is no internal referrer — acceptable, not a bug.

## naka-cult
**Verdict:** The core gating is genuinely solid and real end-to-end — no mock data, on-chain resolver, consistent server-side auth on every chamber — but the shared gate leaks a Sentry warning on every anonymous hit of the PUBLIC landing and every sidebar poll, and a retired "Chosen" UI still renders across three chambers with no writer behind it.

- **P1** — getCultAccess() calls reportDenial() -> Sentry.captureMessage on EVERY denial, and it is invoked on the PUBLIC, force-dynamic /naka-cult landing (page.tsx:28) plus /api/cult/me which SidebarMenu fetches on every mount. So each anonymous visitor/crawler of the marketing page fires a 'cult-access-denied: no-user' warning, and every logged-in non-member fires 'not-cult-member' — routine public traffic floods Sentry (quota/noise) instead of surfacing a real anomaly.  
  `lib/cult/access.ts:33-38 (captureMessage), :81 (no-user denial), :101 (not-cult-member denial); app/naka-cult/page.tsx:20,28; app/api/cult/me/route.ts:19; components/SidebarMenu.tsx:121-123`
- **P2** — Potential false-denial 'try again' loop risk: getCultAccess reads profiles.cult_member through the RLS-scoped anon client (createServerClient with user cookies), not the admin client. If the profiles RLS policy does not grant the user SELECT on their own cult_member row, a genuine member is denied and bounced to /naka-cult — the exact loop the Sentry logging was added to chase. Could not verify the RLS policy from repo code; flagging for owner confirmation.  
  `lib/cult/access.ts:66-98 (anon client + profiles select), vs chambers which use getSupabaseAdmin after the gate`

**Fake / unwired:**
- 'Chosen' gold-trim author decoration is dead UI: hall/conviction/ape routes still SELECT profiles.is_chosen and emit isChosen to the client, but the model retired the Chosen lineage and NOTHING ever sets is_chosen=true anymore (cult-verify-membership explicitly refuses to: 'never re-sync is_chosen back to true') — app/api/cron/cult-verify-membership/route.ts:101; still surfaced at app/api/cult/hall/route.ts:38, app/api/cult/conviction/route.ts:39, app/api/cult/ape/route.ts. The distinction can never render for new members.
- Entry threshold is hardcoded in the UI and can silently disagree with the real gate: CultStatsStrip.tsx:10 hardcodes 1_227_000 and the landing prints '1,227,000 $NAKA' as literal copy (app/naka-cult/page.tsx:185, components/cult/EnterNakaCultButton.tsx:132), while the actual on-chain check reads process.env.NAKA_CULT_THRESHOLD (lib/cult/entitlements.ts:31). Change the env and the landing/strip lie.
- Stale doc/comment drift (not runtime-breaking): naka-cult-resolver header says 'owner action: add cron entry after merge' though it is already wired (dispatch/[group]/route.ts:60); app/api/cult/me/route.ts:14 doc claims it returns { isChosen } but the handler actually returns { tier, cult }.

**Missing backend:**
- No caching/dedup on the per-request gate: /naka-cult is force-dynamic and calls getCultAccess() (which does auth.getUser + a profiles query) on every hit; combined with the Sentry write it makes a public marketing page do an auth round-trip + external capture per anonymous request. The stats query is cached 60s (good) but the gate is not.
- Treasury snapshot pipeline dependency is invisible to the reader: the strip depends on cult_treasury_snapshots being populated by the six-hourly 'cult-refresh-treasury' cron; if that cron fails the strip silently shows '…' forever with no fallback (e.g. no on-chain live read as a backstop).
- No rate-limit on /api/cult/me despite being polled by every authenticated client on mount; unlike ape/conviction/hall it imports no rateLimit (app/api/cult/me/route.ts).

**Missing frontend:**
- No dedicated empty state for a genuinely-zero treasury: CultStatsStrip collapses both null and 0 balance_usd to '…' (components/naka-cult/CultStatsStrip.tsx:84-86), so a real $0 treasury is indistinguishable from 'no snapshot yet' — misleading rather than honest-empty.
- EnterNakaCultButton has busy/denied/error states but no visible timeout or 'wallet still connecting' feedback while waitingForConnect is true after open() resolves but before isConnected flips (components/cult/EnterNakaCultButton.tsx:83-88,101-107) — a user who dismisses the wallet modal is left on 'idle' with no explanation.
- Landing uses a bespoke landing.css palette (gold #FFE9A8 on near-black) rather than the shared glassmorphism tokens; deliberate for the cinematic page, but the denied/error helper text at #C8D6FF / #FCA5A5 (EnterNakaCultButton.tsx:129,136) should be contrast-checked against the dark gradient for WCAG AAA.

**Free-API recommendations:**
- Keep the current free stack — it is correct for this feature: Alchemy eth_getTokenBalances + NFT ownership for the NIPPO/$NAKA/Founder gate (lib/services/alchemy). No paid API is introduced. Good.
- For a treasury fallback when the snapshot cron is stale, read the treasury wallet live via the same Alchemy alchemy_getTokenBalances + a CoinGecko /simple/token_price/ethereum (free) or DexScreener /latest/dex/tokens/{addr} valuation, so the Treasury cell degrades to a live figure instead of '…'.
- Gate the Sentry denial noise behind a sampling/allowlist: only captureMessage for the authenticated-but-not-member case on the /vault gate path, never for anonymous hits of the public landing or /api/cult/me polling.

**Trust Wallet fit:** "No meaningful fit for naka-cult. Wallet connection already runs on Reown AppKit/WalletConnect + wagmi (EnterNakaCultButton.tsx:4-6), so wallet-core and Trust Wallet deep links add nothing. The gate reads NIPPO/$NAKA/Founder-Pass holdings via Alchemy — Trust Wallet has no ownership/balance API to offer. The only conceivable use, trustwallet/assets raw GitHub logo for the $NAKA token icon, is irrelevant because this feature renders a bespoke LivingSigil SVG, not token logos; and where a logo is ever needed CoinGecko/DexScreener already return it. Recommend explicitly NOT adopting Trust Wallet for this feature."

## naka-wallet
**Verdict:** The core wallet is genuinely real (HD key generation, AES-GCM vaulting, live Alchemy/Helius balances, real client-signed sends, cloud sync, custom-token import with GoPlus scan), but it is undermined by a wrong-chain balance fallback that shows Ethereum data as Optimism/Fantom/Linea, a Receive QR that never renders due to an invalid color param, API-supplied token logos being dropped by a field-name mismatch, custom tokens never reaching the swap page, and several dead/fake buttons.

- **P0** ✅ FIXED — Wrong-chain balances: /api/wallet-intelligence silently falls back to Ethereum for any chain not in EVM_CHAIN_CONFIG (only 6 chains mapped). Selecting Optimism, Fantom, Cronos, Linea, Scroll, zkSync, Mantle, Blast, etc. (all offered in Add Network, page.tsx:135-159) shows ETHEREUM holdings and totals labeled as that chain — balance accuracy is wrong, exactly the owner's complaint  
  `app/api/wallet-intelligence/route.ts:275 (EVM_CHAIN_CONFIG[chainParam] ? chainParam : 'ethereum') + lib/services/evm-intelligence.ts:10-22 (only ethereum/base/polygon/avalanche/arbitrum/bsc) + app/dashboard/wallet-page/page.tsx:586`
- **P1** ✅ FIXED — Receive QR code never renders: qrcode.toDataURL is passed dark: 'var(--nl-canvas-base)' — the qrcode lib requires hex color strings and throws 'Invalid hex color', the promise rejects into the catch, qrDataUrl stays '' and the placeholder icon renders forever on every chain  
  `app/dashboard/wallet-page/page.tsx:3148 (color: { dark: 'var(--nl-canvas-base)', light: '#ffffff' }) with catch at 3153-3158 and fallback placeholder at 3243-3247`
- **P1** ✅ FIXED — API-supplied token logos are dropped: wallet-intelligence returns holdings[].logoUrl (Alchemy metadata + DexScreener imageUrl) but the page's logo resolution reads token.logo (which never exists on on-chain holdings) — so any ERC-20 not in the 24-symbol COIN_LOGOS map renders a letter avatar. This is the direct cause of 'missing logos for Arbitrum/Base tokens'  
  `app/api/wallet-intelligence/route.ts:149 (logoUrl: t.logoUrl) vs app/dashboard/wallet-page/page.tsx:36-43 (interface has logo, not logoUrl) and page.tsx:1562-1565 ((token as { logo?: string }).logo)`
- **P1** — Portfolio Analytics double/triple-counts Ethereum: it fetches LIVE_CHAINS ids directly including 'bnb' (backend keys it 'bsc') and 'solana' (EVM address → EVM path) — both fall back to ethereum, so the same Ethereum balance is counted under Ethereum, BNB Chain, and Solana and the total is inflated ~3x  
  `app/dashboard/wallet-page/page.tsx:169 (LIVE_CHAINS includes 'bnb','solana'), 2946-2948 (uses cid directly, not apiChain), app/api/wallet-intelligence/route.ts:275 fallback`
- **P1** — Adding a Ledger wallet permanently breaks cloud sync for ALL wallets: Ledger rows are stored with encryptedKey: '' but the sync endpoint rejects any row with encryptedKey.length < 8, returning 400 for the entire array on every subsequent save  
  `app/dashboard/wallet-page/page.tsx:913 (encryptedKey: '') vs app/api/wallet/sync/route.ts:63-66 (w.encryptedKey.length < 8 → 400 'invalid wallet row')`
- **P1** — Balance fetch failure is silent: fetchBalances catches errors with console.error only, no error state — the hero shows $0.00 Total Balance and placeholder rows, making users think their funds are gone whenever the API times out or 500s  
  `app/dashboard/wallet-page/page.tsx:590-607 (non-ok response ignored, catch only logs; no error UI in the crypto tabpanel at 1531-1595)`
- **P1** — /api/wallet/history always returns empty: walletManager.getTransactionHistory queries column wallet_address but the transaction_history table's column is wallet — PostgREST errors, error is ignored, [] returned (consumer: app/wallet-tracer/page.tsx:28)  
  `lib/wallet/walletManager.ts:118 (.eq('wallet_address', …)) vs supabase/migrations/20260413_full_schema.sql:91 (wallet TEXT NOT NULL)`
- **P1** — Sends are native-coin only: SendView has no token selector and always does parseEther(amount) to the recipient — you cannot send USDC, USDT, or any ERC-20/SPL token you hold from the wallet  
  `app/dashboard/wallet-page/page.tsx:2252-2517 (only nativeBalance state, value: ethers.parseEther(amount) at 2501, SystemProgram.transfer for SOL at 2473)`
- **P2** — transaction_history cache writes fail for wallets without a registered owner: user_id is NOT NULL in the schema but the route inserts user_id: null when getUserByWallet finds nobody, so the bulk upsert violates the constraint and is swallowed — the 'cached entries' fallback is empty exactly when needed  
  `app/api/wallet/transactions/route.ts:244-261 (userId = owner?.id ?? null) vs supabase/migrations/20260413_full_schema.sql:90 (user_id UUID NOT NULL)`
- **P2** — BNB Chain contract-token sparklines/prices always blank: WalletTokenRow passes chainLabel.toLowerCase() ('bnb chain') as the DexScreener chain filter but DexScreener's chainId is 'bsc'; same for 'zksync era', 'manta pacific'  
  `components/wallet/WalletTokenRow.tsx:71 + app/dashboard/wallet-page/page.tsx:1575 (chainLabel = chain name) + app/api/wallet/sparkline/route.ts:27 (p.chainId === chain)`
- **P2** — Buy on-ramp never works on BNB Chain even when configured: page passes activeChain.id 'bnb' but onramp maps key the chain as 'bsc', so getOnrampUrl returns null and the 'coming soon' copy shows  
  `app/dashboard/wallet-page/page.tsx:1221 (chain: activeChain.id) vs lib/wallet/onramp.ts:37/61 (keys 'bsc')`
- **P2** — Dead env guard in the (unused) send relayer: `if (!url.includes('undefined') === false && !url)` is always false, so a missing ALCHEMY_API_KEY produces a URL containing 'undefined' that is blindly POSTed  
  `app/api/wallet/send/route.ts:49`
- **P2** — runScan's scanChain parameter is ignored — the body closes over the outer `chain` state instead; currently benign (same value) but a refactor trap  
  `app/dashboard/wallet-page/page.tsx:3386-3395`

**Fake / unwired:**
- Header 'Scan QR' button is fake: it opens the camera, immediately stops it, then window.prompt()s for a pasted address and writes it back to the user's clipboard — it scans nothing and navigates nowhere, while the comment admits 'actual QR decode lives behind the feature flag below' (app/dashboard/wallet-page/page.tsx:1328-1352). The real scanner (ScanQrModal) exists but is only wired inside SendView (page.tsx:2581)
- WalletTab quick actions are dead buttons: Receive / Send / Scan render as real action buttons with no onClick handler at all (components/WalletTab.tsx:110-125)
- 'Today' PnL pill is fabricated math: it applies the ACTIVE CHAIN's native-coin 24h % change to the entire portfolio USD value (pnlAmount = currentBalance * priceChange/100), not per-holding change (app/dashboard/wallet-page/page.tsx:978-980, 1179-1180, 1386-1392)
- 'Total Balance' hero is active-chain-only (walletData.totalBalanceUsd) while the list below shows rows for every enabled chain — the multi-chain aggregation that would make it a true total (fetchMultiChainBalances / totalMultiChainUsd) is dead code that is never called or rendered (page.tsx:610-623, 973-976, 1383)
- /api/wallet/send — a full 188-line broadcast relayer with sender-verification and wallet_send_log — has ZERO callers; SendView signs and broadcasts directly to public RPCs, so the NW2 sender-verification design and the send log are never exercised (app/api/wallet/send/route.ts, grep shows no fetch('/api/wallet/send') anywhere)
- Custom-token rows always show balance '0' and valueUsd '0': the hydrator hardcodes balance: '0' and only the active-chain on-chain fetch can override; an imported token on a non-active chain never shows its real balance (page.tsx:721-729)
- DexScreener 'sparkline' fallback synthesizes a 5-point line from 1h/6h/24h percent buckets rather than real 7-day prices (self-admitted 'Not true OHLC', app/api/wallet/sparkline/route.ts:14-49)
- Residual NSFW token remnants: 'Pleasure Coin' (symbol NSFW) still has seeded brand metadata, a contract logo override, and a pinned slot in TOKEN_SORT_PRIORITY, so if the key resurfaces via server sync it renders branded near the top of the list (page.tsx:199-206, 694-705, 1556-1561)

**Missing backend:**
- No balance support for the 18 'Add Network' chains (optimism, fantom, cronos, linea, scroll, zksync, mantle, blast, mode, gnosis, celo, metis, moonbeam, opbnb, manta, zora, aurora, kava): EVM_CHAIN_CONFIG has 6 entries and the route falls back to Ethereum instead of erroring or reading the chain's RPC (lib/services/evm-intelligence.ts:10-22)
- No server-side spam/trash classification on the primary Alchemy path — Zerion's is_trash filter only applies on the rarely-hit fallback (lib/services/zerion.ts:165); GoPlus is fetched for top-5 tokens but never used to suppress or badge rows
- Activity depends on ETHERSCAN_API_KEY (not in the owner's locked free-API matrix); if unset, fetchEvmTxs returns [] silently and the tab shows 'No transactions yet' with no hint (app/api/wallet/transactions/route.ts:58-60). Zerion (evm-intelligence.ts:6) and Bitquery (walletPnl via wallet-intelligence/route.ts:305) are also off-matrix dependencies
- Every wallet balance refresh triggers server-side GoPlus scans on 5 tokens + a Bitquery 90-day realized-PnL build + counterparty analysis that the wallet page never renders — pure waste per refresh, with only a 30s Cache-Control (app/api/wallet-intelligence/route.ts:279-313)
- No multi-chain total pipeline: nothing aggregates balances across enabled chains for the home hero (fetchMultiChainBalances exists but is dead, page.tsx:610-623)
- No ERC-20/SPL transfer construction (client or server) — send is native-only
- transaction_history user_id should be nullable (or writes should skip unowned wallets) so the cache fallback actually works (route.ts:246 vs schema NOT NULL)

**Missing frontend:**
- No error state on the main holdings list: fetch failure = silent $0.00 (page.tsx:590-607); only loading skeleton (1543-1548) and empty state (1594) exist
- Spam filtering is a client-side regex over symbol/name only (SPAM_RE, page.tsx:1127) — spam tokens with clean names (fake USDT clones, impersonation tickers) pass straight through; the GoPlus contractSecurity map the API already returns is never consumed by the wallet page (grep: 'contractSecurity' has zero hits in page.tsx)
- Custom tokens imported in the wallet do NOT appear in swap: the swap page keeps its own in-memory IMPORTED_TOKENS registry (app/dashboard/swap/page.tsx:120-125) that resets on reload and never reads steinz_custom_tokens or /api/wallet/custom-tokens (grep confirms wallet-page/page.tsx is the only consumer) — direct violation of the owner requirement
- Send inconsistency with the unlock/session flow: SendView demands the password on every send and never uses UnlockWalletModal/setWalletSessionKey, while swap flows cache the session — two different unlock UXes for the same vault (page.tsx:2437-2440 vs components/wallet/UnlockWalletModal.tsx:97)
- Send button shows 'Soon' for chains that CHAIN_RPC could actually serve (optimism, fantom, linea…) because the gate is EVM_LIVE_CHAINS only (page.tsx:1410 vs CHAIN_RPC at 2197-2228)
- WCAG AAA contrast: pervasive 10-11px text in text-slate-500 (#64748b) / text-gray-500 on near-black backgrounds is ~4.6:1 — passes AA for large text only, fails the AAA 7:1 bar (e.g. page.tsx:1300, 3328; WalletTokenRow.tsx:148-154)
- walletSession doc/code drift: header comments promise a 'hard 30-minute TTL' while the default is 15 min and the sliding window refreshes on every read (lib/wallet/walletSession.ts:17-25 vs 25, 60-63)

**Free-API recommendations:**
- Fix the logo wiring first (map holdings logoUrl -> row logoUrl), then use this free fallback chain per token: Alchemy alchemy_getTokenMetadata .logo -> DexScreener pair.info.imageUrl (both already integrated) -> Trust Wallet assets registry raw URL: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{ethereum|arbitrum|base|polygon|smartchain|avalanchec|optimism|solana}/assets/{checksummed-address}/logo.png -> letter avatar
- Chain badges: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/info/logo.png (free, static, cacheable) instead of dd.dexscreener.com chain icons
- Spam/NSFW filtering (matrix-approved): batch GoPlus https://api.gopluslabs.io/api/v1/token_security/{chainId}?contract_addresses=a,b,c and hide rows with is_airdrop_scam=1/is_honeypot=1/fake_token=1; Solana mints via RugCheck https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary (danger score) — both free
- Replace Etherscan in /api/wallet/transactions with Alchemy alchemy_getAssetTransfers (already implemented in lib/services/alchemy.ts getAssetTransfers, in the locked matrix, covers eth/base/arb/opt/polygon/bnb/avax) so activity works with zero extra keys
- Multi-chain home total + spam-filtered token list in ONE call: Sim by Dune (in the locked matrix) GET https://api.sim.dune.com/v1/evm/balances/{address}?chain_ids=1,8453,42161,10,137,56,43114 — returns per-token USD values, logos, and a spam filter flag across all EVM chains; fall back to per-chain Alchemy loop
- Extended-chain native balances (linea/scroll/zksync/etc.): plain eth_getBalance against the public RPCs already listed client-side in CHAIN_RPC (page.tsx:2197) — move that map server-side into EVM_CHAIN_CONFIG rather than falling back to Ethereum
- Solana custom-token metadata/logo: Helius DAS getAsset (POST {jsonrpc, method:'getAsset', params:{id: mint}}) — already keyed, gives on-chain + off-chain image
- Token 24h change without per-row sparkline calls: GeckoTerminal https://api.geckoterminal.com/api/v2/simple/networks/{network}/token_price/{addresses} (free, 30 req/min, batchable) as the DexScreener fallback; fix the chain slug mapping ('bsc' not 'bnb chain')
- Custom tokens in swap: read /api/wallet/custom-tokens (existing endpoint) in the swap TokenSelectModal and hydrate via the existing /api/swap/token-meta — no new external API needed

**Trust Wallet fit:** One Trust Wallet ecosystem piece is a genuine, direct fit: the trustwallet/assets GitHub registry (free, MIT-licensed, served via raw.githubusercontent.com). It would materially fix the two logo complaints — per-token logos keyed by checksummed contract address for Arbitrum ('arbitrum'), Base ('base'), BSC ('smartchain') and 15+ other chains this wallet supports, plus per-chain info/logo.png images for the chain badges the WalletTokenRow already renders (WalletTokenRow.tsx:121-128). Its allowlist/tokenlist.json files can also serve as a free 'known-good token' set to complement GoPlus spam filtering. Everything else Trust Wallet offers does NOT help this feature: wallet-core is a C++/WASM signing library that duplicates what ethers.js + @solana/web3.js already do here (it would only matter if the owner wants Bitcoin/Sui signing later); Trust Wallet deep links are for routing users INTO the Trust Wallet app, which is pointless for a competing built-in wallet; and there is no Trust Wallet balance, price, or history API at all — balances/prices must stay on Alchemy/Helius/CoinGecko/DexScreener/Sim-by-Dune per the locked matrix. Recommendation: adopt the assets registry as a logo fallback tier only; skip the rest.

**Back-button offenders:**
- None hardcoded to /dashboard in this feature. The wallet home and coin detail use the shared BackButton with no href (app/dashboard/wallet-page/page.tsx:1307; app/dashboard/wallet-page/coin/[chain]/[address]/page.tsx:146), which prefers router.back() for internal referrers and only falls back to /dashboard when history/referrer is external (components/ui/BackButton.tsx:20-46). All sub-views (Send/Receive/AddToken/Settings/Approvals/Analytics) correctly use onBack={() => setView('main')} (page.tsx:982-1211). Note: on a direct page load (bookmark/refresh) BackButton's fallback still lands on /dashboard by design — acceptable, but worth knowing it is not a pure history-back.

## navigation-back-sweep
**Verdict:** The repo has TWO competing back-nav systems: a correct one (smartBack + sessionStorage depth counter, used only by PageHeader on ~5 pages) and the app-wide BackButton component whose no-href path relies on document.referrer — which SPA client-side navigations never update — so plain BackButton almost always dumps users on /dashboard instead of going back, reproducing the owner's top-priority bug across 30+ pages, on top of ~20 buttons that literally hardcode /dashboard.

- **P0** — SYSTEMIC ROOT CAUSE: BackButton with no href is supposed to go back but uses document.referrer to decide. Next.js client-side navigations (router.push/Link) never update document.referrer, so for normal in-app navigation internalReferrer is false and the guard `internalReferrer && window.history.length>1` fails, dropping to router.push('/dashboard') on line 45. Plain <BackButton /> therefore dumps the user on /dashboard instead of the page they came from — the exact owner bug, still live. The correct smartBack() depth counter already exists but BackButton ignores it.  
  `components/ui/BackButton.tsx:20-46 (referrer check 26-39, fallback push 45); smartBack.ts:4-9 documents this same bug`
- **P1** — ~30 pages use plain <BackButton /> (no href) and thus inherit the broken referrer logic — Back sends them to /dashboard instead of history. Includes deep detail pages the owner called out.  
  `app/dashboard/market/[chain]/[address]/page.tsx:201, app/dashboard/wallet-page/coin/[chain]/[address]/page.tsx:146, app/dashboard/wallet-clusters/cluster/[id]/page.tsx:140, app/u/[username]/page.tsx:99 & 145, app/dashboard/bubble-map/page.tsx:729, app/dashboard/smart-money/page.tsx:197, app/dashboard/wallet-intelligence/page.tsx:746, app/dashboard/sniper/page.tsx:395 & 539, app/dashboard/whale-tracker/directory/page.tsx:320, app/dashboard/whale-tracker/watchlist/page.tsx:82, app/dashboard/whale-tracker/copy-trade/page.tsx:80, plus discover:36, leaderboard/[kind]:98, market-maker:121, security/layout:54, pricing:106, archive:116, alerts:795, messages:250, domain-shield:140, builder-network:125, risk-scanner:243, launchpad:94, wallet-clusters:158, stats:76, wallet-page:1307, vtx-ai:934, trends:236, network-graph:607, research:496, contract-analyzer:351, signature-insight:190, network-metrics:40, u/[username]/[kind]:84, intelligence/[token]:89`
- **P1** — BackButton with href literally forces router.push('/dashboard') (BackButton.tsx:21-23 short-circuits before any history check), so these ignore where the user came from entirely.  
  `app/dashboard/whale-tracker/page.tsx:347 & 386, app/dashboard/trending/page.tsx:77, app/dashboard/top-gainers/page.tsx:110, app/dashboard/dna-analyzer/page.tsx:435, app/dashboard/portfolio/page.tsx:256, app/dashboard/support/page.tsx:154, app/dashboard/project-discovery/page.tsx:105, app/dashboard/proof/page.tsx:453 (href='/dashboard?subtab=context')`
- **P2** — Raw router.push('/dashboard') back buttons not using BackButton at all — same hardcoded dump, no history awareness.  
  `app/dashboard/proof/page.tsx:395 (event-not-found 'Back to Dashboard'), app/s/[id]/page.tsx:55 & 93, app/share/[id]/page.tsx:59 & 97`
- **P2** — BackButton referrer allowlist blocks router.back() when referrer path starts with /login, /signup, /auth (BackButton.tsx:33-35). A user who legitimately navigated app -> detail after auth and whose last full-load referrer was /auth gets forced to /dashboard even when real history exists.  
  `components/ui/BackButton.tsx:33-35`

**Fake / unwired:**
- BackButton's referrer-based history detection is effectively dead code for SPA navigation: the internalReferrer branch (components/ui/BackButton.tsx:40-43) is almost never reached because document.referrer is not updated by client-side Next navigations, so router.back() rarely fires and the 'smart' fallback is a placeholder that behaves like a hardcoded /dashboard redirect.
- Two parallel 'fixed' implementations coexist and only one is real: smartBack.ts is the working solution but is wired into ~5 pages via PageHeader, while the 50+ page BackButton was 'fixed' with a referrer heuristic that does not work — the fix is claimed but not functional.

**Missing frontend:**
- No page in the sweep provides a hardware/browser-back-consistent experience: because BackButton and the browser back button diverge (BackButton -> /dashboard, browser back -> real previous page), users get two different behaviors from the same visual affordance.
- Deep detail pages reached via a shared/deep link (empty history) have no distinct empty-history affordance — smartBack handles this (depth<=1 -> fallback) but BackButton pages don't, so a deep-linked user and an in-app user are treated identically (both -> /dashboard).
- No aria-current / breadcrumb trail anywhere in the feature set; back is a single icon button with aria-label 'Go back' only.

**Free-API recommendations:**
- None. Back navigation is 100% client-side routing (Next.js App Router). No external API is involved or needed. The fix is to make BackButton delegate to the existing smartBack(router, href) helper: when href is a feature-root fallback, call smartBack(router, href) so real in-app history wins and the href is only used as the deep-link fallback; drop the document.referrer heuristic entirely.

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem is relevant here. trustwallet/assets is a token-logo registry, wallet-core is signing/crypto, and Trust Wallet deep links only launch the external wallet app — none touch in-app SPA route history. This is a pure Next.js router.back()/History-API concern; the correct 'free alternative' is the app's own existing smartBack sessionStorage depth counter (lib/navigation/smartBack.ts), which already solves it correctly and just needs to be adopted by BackButton.

**Back-button offenders:**
- components/ui/BackButton.tsx:45 (fallback router.push('/dashboard') fires for all in-app SPA navigation because referrer check at :26-39 fails)
- app/dashboard/whale-tracker/page.tsx:347 (BackButton href='/dashboard')
- app/dashboard/whale-tracker/page.tsx:386 (BackButton href='/dashboard')
- app/dashboard/trending/page.tsx:77 (BackButton href='/dashboard')
- app/dashboard/top-gainers/page.tsx:110 (BackButton href='/dashboard')
- app/dashboard/dna-analyzer/page.tsx:435 (BackButton href='/dashboard')
- app/dashboard/portfolio/page.tsx:256 (BackButton href='/dashboard')
- app/dashboard/support/page.tsx:154 (BackButton href='/dashboard')
- app/dashboard/project-discovery/page.tsx:105 (BackButton href='/dashboard')
- app/dashboard/proof/page.tsx:453 (BackButton href='/dashboard?subtab=context')
- app/dashboard/proof/page.tsx:395 (raw router.push('/dashboard'))
- app/s/[id]/page.tsx:55 (raw router.push('/dashboard'))
- app/s/[id]/page.tsx:93 (raw router.push('/dashboard'))
- app/share/[id]/page.tsx:59 (raw router.push('/dashboard'))
- app/share/[id]/page.tsx:97 (raw router.push('/dashboard'))
- app/market/layout.tsx:21 (BackButton href='/dashboard' — defensible since market is outside dashboard, but still hardcoded)
- app/vtx/shared/[token]/page.tsx:61 (BackButton href='/dashboard' — public share page, defensible)

## onboarding
**Verdict:** The 10-card OnboardingFlow works end-to-end (UI -> /api/onboarding/event -> Supabase, gated on profiles.onboarding_completed_at), but it collides with a second unrelated first-run tour on the dashboard, a third tour component is dead code, and both the tour and the orphaned /onboarding/complete page point CTAs at routes that 404.

- **P0** — Two separate first-run overlays mount at the same z-[200] on a brand-new user's dashboard: OnboardingGate (10-card flow, gated on DB onboarding_completed_at) AND the dashboard FirstRunTour 3-step modal (gated only on localStorage naka_tour_done). A first-time visitor with empty localStorage and null onboarding_completed_at sees BOTH stacked simultaneously.  
  `app/dashboard/page.tsx:457 (FirstRunTour) and app/dashboard/page.tsx:565 (OnboardingGate); both z-[200] at components/dashboard/FirstRunTour.tsx:76 and components/onboarding/OnboardingFlow.tsx:134`
- **P1** — Dashboard FirstRunTour CTA 'Open settings' links to /dashboard/settings which does not exist (settings lives at /settings) -> Next.js 404 (app/dashboard/not-found.tsx).  
  `components/dashboard/FirstRunTour.tsx:26; route absent (only app/settings exists, confirmed by ls app/dashboard)`
- **P1** — Dashboard FirstRunTour CTA 'Browse whales' links to /dashboard/whales which does not exist (the route is /dashboard/whale-tracker) -> 404.  
  `components/dashboard/FirstRunTour.tsx:40; actual route is app/dashboard/whale-tracker`
- **P1** — Orphaned /onboarding/complete page 'Connect a wallet' CTA also links to the non-existent /dashboard/settings -> 404.  
  `app/onboarding/complete/page.tsx (FunnelStep ctaHref='/dashboard/settings')`
- **P2** — /onboarding/complete is a fully built page but nothing in the codebase navigates to it (no signup/verify flow links here) — dead, unreachable route.  
  `grep for 'onboarding/complete' returns only app/onboarding/complete/page.tsx itself`
- **P2** — Settings 'Replay onboarding' does not fire the replay_started analytics event; the event enum and DB CHECK both allow 'replay_started' but no code path ever emits it, so replays are invisible in the funnel.  
  `replay handler only nulls the column (app/settings/page.tsx:518-535); grep shows 'replay_started' appears only in the enum (app/api/onboarding/event/route.ts:7) and migration CHECK`

**Fake / unwired:**
- Dead component: components/onboarding/FirstRunTour.tsx (anchored-popover tour with DEFAULT_TOUR_STEPS) is never imported anywhere; the dashboard uses components/dashboard/FirstRunTour.tsx instead (grep: DEFAULT_TOUR_STEPS only defined, never used)
- Even if that dead FirstRunTour were mounted, it would silently skip all three steps: it targets data-tour='connect-wallet'/'set-first-alert'/'open-whale-tracker' but ZERO data-tour attributes exist anywhere in app/ or components/ (components/onboarding/FirstRunTour.tsx:169-188; readRect returns null -> step skipped at :92-93)
- Unverified hardcoded marketing stats presented as fact inside onboarding copy: '15,000+ verified whales across 8 chains' (lib/onboarding/cards.ts:56), 'Sub-2-second token launches' (cards.ts:63), 'AES-256-GCM encrypted' (cards.ts:40)
- Duplicate hardcoded claim '15k+ verified wallets across 8 chains' in the live dashboard tour (components/dashboard/FirstRunTour.tsx:38)

**Missing backend:**
- No rate limiting on /api/onboarding/event — it accepts anonymous inserts (user_id null) with a service-role client that bypasses RLS, so it is an unauthenticated open write endpoint that can flood onboarding_events (app/api/onboarding/event/route.ts:14-27)
- No cap/aggregation strategy: analytics endpoint pulls up to 50000 raw rows and aggregates in JS on every admin request with no caching (app/api/admin/onboarding/analytics/route.ts:20-24); will degrade as events accumulate
- Skip/complete event POSTs are fire-and-forget with no retry; if /api/onboarding/event fails, profiles.onboarding_completed_at is never stamped and the user re-sees the whole flow next login (OnboardingFlow.tsx:67-71, :102-108)

**Missing frontend:**
- No loading/empty/error state distinction in the gate: onboardedAt starts undefined and the flow simply does not mount until the profiles read resolves; a slow/failed Supabase read silently defaults to null (shows onboarding) with no skeleton (app/dashboard/page.tsx:358-373)
- OnboardingFlow full-screen overlay has no iOS safe-area-inset padding (footer uses pb-8 sm:pb-10) while the rest of the app uses naka-safe-top; the Skip/Next footer can sit under the iPhone home indicator (components/onboarding/OnboardingFlow.tsx:185)
- WCAG AAA contrast misses: text-slate-400 body/skip text and text-[10px]/text-[11px] micro-labels on the near-black gradient pass AA at best, not the owner's AAA bar (components/onboarding/OnboardingFlow.tsx:179,188; components/dashboard/FirstRunTour.tsx:83,101)
- Glassmorphism inconsistency: OnboardingFlow uses a bespoke aurora gradient + inline hex colors rather than the shared nl-glass / AuroraBackground primitives used by /onboarding/complete, so the two onboarding surfaces do not look like one system (OnboardingFlow.tsx:134-139 vs app/onboarding/complete/page.tsx AuroraBackground+nl-glass)

**Free-API recommendations:**
- No third-party API is needed here — the funnel is correctly self-hosted on Supabase (onboarding_events) which is on the owner's approved free list; keep it there
- Add Upstash Redis (approved) fixed-window rate limit on /api/onboarding/event keyed by IP for anonymous inserts to stop funnel-table flooding
- Replace the hardcoded whale/chain counts in onboarding copy with a real value pulled from the existing whale registry (the same Supabase/Dune source the whale-tracker uses) so the number is never a lie, or drop the number entirely
- For the funnel dashboard, precompute per-card rollups via a Supabase scheduled SQL/materialized view instead of scanning 50k rows per request

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem helps onboarding. Onboarding here is purely informational cards + a DOM tour + a Supabase event funnel — there is no wallet-logo lookup, no chain asset resolution, no wallet-core signing, and no deep-link surface involved. trustwallet/assets (token logos), wallet-core, and Trust Wallet deep links are all irrelevant to this feature, and Trust Wallet exposes no onboarding/analytics API. The correct path is entirely internal: fix the broken route strings, delete the dead FirstRunTour copy, and keep the funnel on Supabase. Recommend NOT adding Trust Wallet for this feature.

## onchain-trends
**Verdict:** The three pages are genuinely wired to real data (DeFiLlama TVL, CoinGecko trending/gainers) but the owner's mandated CoinGecko->DexScreener->GeckoTerminal fallback chain exists nowhere in this feature, the fallbacks that do exist are dead (CoinCap v2) or fake-shaped (DexScreener text-search of the chain name sold as "trending tokens"), and a cache-poisoning bug plus a dead "VTX Analysis" UI block undermine trust in the trends page.

- **P1** — Cache poisoning in on-chain-trends: the route caches `result` by reference (line 173) and THEN mutates `result.cards` when a ?chain= filter is present (lines 177-179). The first request after TTL expiry that carries e.g. ?chain=ethereum permanently filters the shared 5-minute cache, so every subsequent 'All Chains' request returns only Ethereum cards until the cache expires.  
  `app/api/intelligence/on-chain-trends/route.ts:173-179`
- **P1** — Dead fallback in /api/market-data: fromCoinCap hits api.coincap.io/v2, which CoinCap deprecated/sunset (v3 lives at rest.coincap.io and requires an API key). CoinCap is also not in the owner's locked free-API matrix. When CoinGecko fails/429s, the fallback fails too and the route returns an empty token list -> blank market table.  
  `app/api/market-data/route.ts:31-50,66-76`
- **P1** — DeFiLlama outage renders fabricated-looking '$0' cards: every defillama.ts function catches and returns [] (defillama.ts:42-55,81-98), so on failure globalNow=0 and totalStable=0 and the trends page confidently shows 'All Chains TVL $0' and 'Stablecoins $0' as real data instead of an error.  
  `app/api/intelligence/on-chain-trends/route.ts:76-88,158-169; lib/services/defillama.ts:44-46,86-87`
- **P2** — All three pages swallow fetch errors and show empty-state copy on API failure: trends catch is `{ /* ignore */ }` then renders 'No trend data available'; trending shows 'Nothing trending right now.'; top-gainers shows 'No gainers data available right now.' A CoinGecko outage is indistinguishable from a genuinely empty result, with no retry affordance.  
  `app/dashboard/trends/page.tsx:209,317-322; app/dashboard/trending/page.tsx:54-55,92-93; app/dashboard/top-gainers/page.tsx:87-88,158-160`
- **P2** — Trending page shows $0.00 prices and 0.0% change when the markets-enrichment call times out: withDeadline falls back to [] and every trending row gets current_price 0 / change 0, rendered as real values.  
  `app/api/dashboard/trending/route.ts:37,48-50`
- **P2** — Sparkline SVG gradient id collision: id is derived from color only (`sg-${color.slice(1)}`), so every green card on the trends page emits a duplicate DOM id `sg-10B981` (invalid HTML; fills can cross-wire).  
  `app/dashboard/trends/page.tsx:31`
- **P2** — Unused `router` (useRouter) declared and never used on the trends page.  
  `app/dashboard/trends/page.tsx:186`

**Fake / unwired:**
- 'Trending tokens by chain' is not trending data: /api/market?type=trending-tokens calls searchPairs(chain), i.e. a DexScreener free-text search for the literal string 'ethereum'/'solana' — it returns pairs whose token NAME matches the chain name, then presents them as trending tokens for that chain (app/api/market/route.ts:68-83; lib/services/dexscreener.ts:77-83). Consumed by dna-analyzer (app/dashboard/dna-analyzer/page.tsx:345).
- 'VTX Analysis' insight block and per-card alert chip are dead UI: TrendDrawer renders card.insight under a 'VTX Analysis' brand (app/dashboard/trends/page.tsx:162-169) and InsightCard renders card.alert (page.tsx:78-80), but the API never sets `insight` or `alert` on ANY card (app/api/intelligence/on-chain-trends/route.ts:81-169 — no card object includes either field). The AI-analysis feature the drawer advertises has no backend.
- Volume and Addresses cards hardcode change24h: 0 / change7d: 0 with empty sparklines, which the card UI renders as a literal '0.00% 24h' flat reading — a fabricated 'no change' figure, since no historical data exists for those metrics (app/api/intelligence/on-chain-trends/route.ts:144,151; rendered at app/dashboard/trends/page.tsx:70-75).
- 'LIVE' badge on trends header is hardcoded — it shows green LIVE before the first fetch and during/after failures (app/dashboard/trends/page.tsx:243).
- Volume/Addresses cards depend on Bitquery, gated behind BITQUERY_API_KEY (app/api/intelligence/on-chain-trends/route.ts:126; lib/services/bitquery.ts:43-45) — Bitquery is NOT in the owner's locked free-API matrix, and without the key the cards silently never appear.
- /api/market/dex-category 'bnb-meme' preset is a DexScreener text search for the word 'meme' on BSC, not a meme-category feed (app/api/market/dex-category/route.ts:72-73) — tokens without 'meme' in their name never appear.

**Missing backend:**
- The owner-mandated fallback chain CoinGecko -> DexScreener -> GeckoTerminal is implemented in NONE of the scoped routes: /api/dashboard/trending and /api/dashboard/top-gainers are CoinGecko-only (single point of failure), /api/market-data falls back to dead off-matrix CoinCap, /api/intelligence/on-chain-trends is DeFiLlama-only. lib/services/geckoterminal.ts exists in the repo but is not imported by any of these routes.
- No shared cache: all caching is per-lambda in-memory (lib/api/cache-manager.ts Map + module-level `cache` in on-chain-trends/route.ts:50). On Vercel serverless, every warm instance keeps its own copy, multiplying CoinGecko free-tier calls (~30 rpm demo) and causing the 429/staleness the owner complains about. Upstash Redis is in the locked matrix and unused here.
- No last-good-response persistence: when an upstream fails there is nothing stale to serve — routes return empty arrays or $0 values instead of the previous good payload.
- No stablecoin market-cap history pipeline — the stablecoin card ships an intentionally empty sparkline (route.ts:163-167) even though DeFiLlama exposes the history for free.
- No real volume/active-address change pipeline — the Bitquery cards carry hardcoded 0% deltas and no sparkline because no history is fetched.
- No per-endpoint rate-limit budgeting or backoff beyond the single 429->public retry in coingecko.ts:74-83 (the public endpoint shares the same IP rate limit, so the retry usually 429s too).

**Missing frontend:**
- Distinct error state + retry button on all three pages (currently error collapses into empty state — see broken items).
- Timeframe pills (1h/7d) on /dashboard/top-gainers: the UI is hard-locked to 24h with a stale comment claiming upstream can't sort other timeframes (app/dashboard/top-gainers/page.tsx:75-79), but the backend now fully supports timeframe ordering (app/api/dashboard/top-gainers/route.ts:41-42; lib/services/coingecko.ts:219-245). Built backend capability with no UI.
- Trends page stat tile 'Chains Tracked' shows data.chains.length - 1 which is 0-or-negative if the API returns a degraded chain list (app/dashboard/trends/page.tsx:291) — no guard.
- Freshness indicator tied to server updatedAt: the API returns updatedAt (route.ts:172) but the page shows client-side lastRefresh instead (app/dashboard/trends/page.tsx:190,246), so a 5-min-stale cached payload displays as 'Updated <now>'.
- Trends drawer has no deep-link/share and no link from a chain card to that chain's tokens (drawer is display-only, app/dashboard/trends/page.tsx:106-180).
- Trending/top-gainers rows show no data-source or as-of timestamp; glassmorphism (nl-glass) is otherwise consistent across all three pages.

**Free-API recommendations:**
- Replace Bitquery Volume cards with DeFiLlama DEX overview (free, keyless, already the page's data vendor): GET https://api.llama.fi/overview/dexs/{chain}?excludeTotalDataChart=false — gives real 24h volume, change_1d/change_7d, and totalDataChart for a genuine sparkline. Kills the off-matrix Bitquery dependency and the hardcoded 0% deltas in one move.
- Stablecoin sparkline: GET https://stablecoins.llama.fi/stablecoincharts/all — daily totalCirculatingUSD history; last 14 points give the real sparkline and real 24h/7d change for the stablecoin card.
- Fix 'trending tokens by chain' with GeckoTerminal (in matrix, free, 30 rpm): GET https://api.geckoterminal.com/api/v2/networks/{network}/trending_pools — actual trending pools per chain, with base_token price, 24h change, and volume. Use DexScreener GET https://api.dexscreener.com/token-boosts/top/v1 as the secondary.
- Trending fallback chain for /api/dashboard/trending: primary CoinGecko /search/trending -> fallback GeckoTerminal /api/v2/networks/trending_pools (cross-chain) -> fallback DexScreener /token-boosts/top/v1; normalize all three to the existing EnrichedTrending shape.
- Top-gainers fallback: CoinGecko /coins/markets?order=price_change_percentage_{tf}_desc is the only clean global source — back it with an Upstash Redis last-good cache (SET trends:gainers:{tf} EX 900) and serve stale-with-flag on 429/5xx instead of an empty list. Delete the CoinCap path from /api/market-data and use the same pattern there.
- Move cache-manager to Upstash Redis (in matrix, free tier 500K commands/mo): one shared cache across lambda instances cuts CoinGecko call volume roughly by instance count and directly addresses the freshness complaint.
- Fear & greed: keep https://api.alternative.me/fng/ (free, keyless) but note it is off-matrix; CoinGecko Demo has no F&G equivalent, so either add alternative.me to the matrix or drop the widget.
- Active-addresses card: if the owner wants it without Bitquery, use a Dune (in matrix, free tier) saved query over daily active addresses per chain via /api/v1/query/{id}/results, refreshed by the existing cron infrastructure; otherwise remove the card rather than gate it on an off-matrix key.
- DeFiLlama itself (api.llama.fi) is off the locked matrix but free, keyless, and load-bearing for the whole trends page — recommend the owner formally adds it; there is no in-matrix substitute for chain TVL history.

**Trust Wallet fit:** Trust Wallet offers nothing for the trends page itself (chain-level TVL/volume metrics have no Trust Wallet counterpart) and nothing better than CoinGecko for trending/gainers data. Its one genuine fit here is the trustwallet/assets GitHub logo registry as an image BACKSTOP for the DexScreener-sourced rows that ship with empty images today (app/api/market/dex-category/route.ts:33 falls back to '' and app/api/market/route.ts:80 passes info?.imageUrl which is often undefined) — and the repo already has this built and correctly implemented (EIP-55 checksumming included) in lib/services/trustwallet.ts:42-58; it just is not wired into these routes (only swap/token-meta, sniper feedIngest, and goplusService use it). The tws.trustwallet.com HMAC gateway client in the same file is inert (env-gated, endpoints unverified per its own comment at lib/services/trustwallet.ts:13-20) and its 1 req/s free tier is strictly worse than CoinGecko/GeckoTerminal for trending data — do not build on it. wallet-core and deep links are irrelevant to this feature.

**Back-button offenders:**
- app/dashboard/trending/page.tsx:77 — <BackButton href="/dashboard" /> forces router.push('/dashboard') (components/ui/BackButton.tsx:21-23) instead of history back; users arriving from the market page or a dashboard card get bounced to /dashboard.
- app/dashboard/top-gainers/page.tsx:110 — same hardcoded <BackButton href="/dashboard" />. (The trends page at app/dashboard/trends/page.tsx:236 uses the prop-less <BackButton /> which correctly walks history — the fix is just deleting the href prop on the other two.)

## portfolio
**Verdict:** The portfolio page renders real single-chain holdings and real FIFO realized-PnL from Supabase transactions, but the security/spam UI is dead-wired, it silently ignores multi-chain, the "today" P&L badge is misleading capital-flow not mark-to-market, and half the built backend (tax-loss, wash-trades, CSV export, holdings) has zero frontend.

- **P1** — Security scoring is completely dead: holdings are mapped from intel.holdings only (page.tsx:192-209) which never contains a securityScore; the IntelResponse type (page.tsx:39-52) doesn't even include the contractSecurity map the API returns (wallet-intelligence/route.ts:320). Result: riskyHoldings is always [] so the 'Risky holdings' panel never renders, and the 'Hide suspected spam tokens' checkbox filters nothing (h.securityScore==null -> always kept), so hiddenCount is always 0.  
  `app/dashboard/portfolio/page.tsx:233-236, 565-593`
- **P1** — Multi-chain holdings are not aggregated. The page passes only a single auto-detected address to /api/wallet-intelligence, which defaults an EVM wallet to chain='ethereum' (route.ts:284). A user's Base/Arbitrum/Optimism/Polygon/BSC balances never appear. A /api/wallet-intelligence/multichain route exists but the portfolio page never calls it.  
  `app/dashboard/portfolio/page.tsx:116; app/api/wallet-intelligence/route.ts:284`
- **P1** — 'Today' P&L badge is misleading. The green/red '+$X (Y%) today' shown beside Total Portfolio Value is derived from the cumulative capital-flow series (buys add, stable-out subtracts), NOT mark-to-market. A buy made today shows as a positive 'today' gain. It also uses a different data source (perf.series) than the total value (live holdings sum), so the % is unrelated to the number it sits next to.  
  `app/dashboard/portfolio/page.tsx:241-249, 278-291`
- **P2** — EVM ERC-20 24h change is always 0. evm-intelligence returns no per-token change24h (no priceChange field), and live-prices sets change24h:0 for every contract-based token (only symbol/native tokens get real change). So the 24h column shows 0.00% for all ERC-20 holdings.  
  `app/api/portfolio/live-prices/route.ts:77; lib/services/evm-intelligence.ts (no change24h in token map)`
- **P2** — Zerion (paid API, NOT in the locked free-tier matrix) is wired as a live fallback: base /api/portfolio route calls it first when ZERION_API_KEY is set (portfolio/route.ts:128-164) and evm-intelligence uses buildFromZerion as secondary (evm-intelligence.ts:301-328). Violates owner cost rules.  
  `app/api/portfolio/route.ts:3,128-164; lib/services/evm-intelligence.ts:6,301`
- **P2** — Birdeye (paid API, NOT in the locked matrix) is used as the Solana price fallback for holdings via getMultiTokenPrices/getBirdeyeTokenOverview. Violates owner cost rules; RugCheck/GeckoTerminal/DexScreener are the allowed Solana price sources.  
  `lib/services/solana-intelligence.ts:11,208-256`

**Fake / unwired:**
- Alpha Intelligence tab is a hardcoded 'Wallet DNA available after Phase 9.' placeholder behind a real-looking tab — app/dashboard/portfolio/page.tsx:432-436
- Holding.costBasisUsd field is declared but never populated or rendered anywhere despite the owner's cost-basis complaint — app/dashboard/portfolio/page.tsx:36 (entryMarkers ARE computed server-side at performance/route.ts:115 but the page never fetches or draws them)
- 'Hide suspected spam tokens' checkbox is defaulted on but non-functional (securityScore never wired) — app/dashboard/portfolio/page.tsx:626-637
- NATIVE_FALLBACK_PRICES hardcodes ETH=2500/AVAX=25/BNB=500 as last-resort prices in the base route — app/api/portfolio/route.ts:20-24 (guarded to only fire when all price APIs fail, but still stale hardcoded USD)

**Missing backend:**
- No mark-to-market unrealized PnL pipeline: performance/route.ts explicitly notes a real PnL series 'would require Alchemy transfer-history reconciliation against live prices and is tracked separately' — not built (performance/route.ts:181-184)
- No multi-chain aggregation in the portfolio holdings path — /api/wallet-intelligence resolves one chain per request
- No caching/rate-limit handling on the 30s live-prices poll beyond a Cache-Control header; a CoinGecko 429 yields blank prices with no backoff (live-prices/route.ts:80-92 returns 502 -> UI keeps last state but no retry/backoff)
- /api/portfolio/holdings (Alchemy/Helius+DexScreener) is fully built but orphaned — no caller (dead endpoint)

**Missing frontend:**
- No UI for /api/portfolio/tax-loss — a full tax-loss-harvesting + wash-sale-risk endpoint with zero frontend (tax-loss/route.ts)
- No UI for /api/portfolio/wash-trades — wash-sale detection endpoint with zero frontend (wash-trades/route.ts)
- No export button/UI for /api/portfolio/export or /api/portfolio/export/csv — Koinly-compatible CSV export is built but has no trigger in the portfolio page
- No 'Risky holdings' or spam UI ever renders because securityScore is unwired (see broken)
- No per-chain filter/selector or multi-chain aggregate view; user cannot switch or combine chains
- No mark-to-market unrealized-PnL display (owner's PnL complaint) — only realized PnL and a mislabeled capital-flow chart exist
- Cost-basis entry markers (entryMarkers) computed by the API are never drawn on any chart

**Free-API recommendations:**
- Replace the Zerion multi-chain fallback with Alchemy's free getTokenBalances + getTokenMetadata run per chain (ethereum/base/arbitrum/optimism/polygon/bsc via alchemy_getTokenBalances) and aggregate — keeps everything on the already-paid Alchemy key
- Replace Birdeye Solana pricing with Jupiter Price API v2 (https://api.jup.ag/price/v2?ids=<mint>, free) as primary and GeckoTerminal (https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/<addr>, free) as secondary, DexScreener as tertiary
- For 24h change on EVM ERC-20s, use DexScreener token endpoint (https://api.dexscreener.com/latest/dex/tokens/<addr>) priceChange.h24 — already imported elsewhere — or GeckoTerminal token_price with include_24hr_change
- For unrealized PnL, reconcile Alchemy alchemy_getAssetTransfers (already used) against current DexScreener/CoinGecko prices to mark open FIFO lots (lots already computed in performance/route.ts)
- Fallback chain design: holdings = Alchemy(per-chain) -> Helius(Solana); prices = DexScreener -> GeckoTerminal -> CoinGecko contract endpoint -> null (never $0); no paid Zerion/Birdeye anywhere

**Trust Wallet fit:** "Marginally useful for ONE thing only: token logos. The page currently relies on DexScreener logoUrl plus a hardcoded KNOWN_TOKEN_LOGOS map of CoinGecko image URLs (evm-intelligence.ts:25-34) and a mint-prefix placeholder for unknown SPLs. The free trustwallet/assets GitHub raw registry (raw.githubusercontent.com/trustwallet/assets/master/blockchains/<chain>/assets/<checksumAddr>/logo.png) is a solid zero-cost logo fallback keyed by contract address for tokens DexScreener misses. Nothing else from Trust Wallet (wallet-core, deep links, no real portfolio/pricing API) helps this feature. For everything else (balances, prices, PnL) the Alchemy/Helius/DexScreener/GeckoTerminal/Jupiter stack already in the allowed matrix is strictly better."

**Back-button offenders:**
- app/dashboard/portfolio/page.tsx:256 — <BackButton href="/dashboard" />. Passing href forces BackButton to router.push('/dashboard') and skip its own history-back logic (BackButton.tsx:20-45), so the back arrow never returns to the actual previous page (e.g. a token detail the user came from). Omit href to get history-back.

## pricing-tiers
**Verdict:** Tier GATING is real and enforced server-side everywhere, but the pricing page's actual monetization (subscribing to Mini/Pro/Max) is 100% non-functional: every purchase button is a "coming soon" toast, there is zero Stripe or crypto-payment wiring, and the only real paths to a paid tier are a Founder Pass NFT (Max only) or a manual admin grant.

- **P0** — No payment path exists for any paid tier. All 'Get Mini/Pro/Max' buttons just fire toast.info('Crypto payment integration coming soon'). No Stripe checkout, no crypto-payment flow, no webhook to set a tier. Self-serve upgrade is impossible; the entire pricing page's purchase function is non-operational.  
  `app/dashboard/pricing/page.tsx:98-101`
- **P0** — Stripe is a package dependency but is NEVER imported or used in any app/lib code. Zero grep hits for `new Stripe`, `from 'stripe'`, `STRIPE_`, or a checkout/webhook route. tier_source='stripe' is referenced only in a code comment with no implementation.  
  `app/api/user/tier/route.ts:52 (comment) — no Stripe usage anywhere in app/ or lib/`
- **P1** — Mini tier is unreachable by end users. Founder Pass grants only Max; there is no self-serve upgrade; only an admin set_tier or admin comp can assign Mini. Yet Mini-gated features (whale-tracker, DNA analyzer, whales directory) are therefore locked to everyone except admins and Founder-Pass Max holders.  
  `lib/cult/entitlements.ts:175-182 (grants only max); app/api/admin/users/route.ts:261-278 (admin-only mini path)`
- **P1** — Revenue stats endpoint has no admin authorization — any authenticated user can read platform-wide totalRevenue/revenueByType/totalTrades. It only checks getAuthenticatedUser, never role==='admin'.  
  `app/api/revenue/stats/route.ts:8-19`
- **P2** — Founder Pass grant writes the CONTRACT address into tier_nft_token_id instead of an actual token id — the column is mislabeled/misused.  
  `lib/cult/entitlements.ts:179`

**Fake / unwired:**
- handleSubscribe for Mini/Pro/Max is a stub that only shows a toast — no navigation, no checkout, no API call (app/dashboard/pricing/page.tsx:98-101)
- Founder Pass 'How it works' button is a toast-only stub with no action (app/dashboard/pricing/page.tsx:230)
- 'Crypto payment integration coming soon' appears twice as real-looking UI copy behind non-functional buttons (app/dashboard/pricing/page.tsx:100, :183)
- tier_source='stripe' is claimed in a comment as an onboarding signal but no code path ever writes it (app/api/user/tier/route.ts:52)
- The `stripe` npm package is installed but entirely unwired — dead dependency

**Missing backend:**
- Stripe checkout session route (app/api/stripe/checkout) — does not exist
- Stripe (or crypto) webhook/verifier route to set profiles.tier + tier_source + tier_expires_at on successful payment — does not exist
- Subscription lifecycle: renewal, cancel, downgrade, customer portal — none exist
- On-chain crypto payment verification pipeline (the copy promises 'crypto payment') — no route, no cron, no treasury-payment matching
- Subscription revenue tracking — app/api/revenue only tracks 0.5% trading fees, nothing records subscription income
- Rate-limit/caching on /api/revenue/stats is absent and it lacks the admin guard

**Missing frontend:**
- No monthly/annual billing toggle despite every tier showing '/month' (app/dashboard/pricing/page.tsx:37 etc)
- No explicit 'not purchasable yet' disabled state — paid buttons look fully active ('Get Pro') but do nothing, misleading users
- No loading/error/auth states — page is fully static with no data fetch; acceptable but there is no skeleton while useAuth resolves the current-plan badge
- No upgrade CTA surfaced from the 403 upgrade_required responses that gated features return (the tier route exposes the data but the pricing page never consumes a 'why are you here' deep-link/param)

**Free-API recommendations:**
- Owner wants crypto payments and pays only Anthropic+Vercel — build an on-chain subscription using stack APIs already present: user sends payment to TREASURY_WALLET_EVM/SOLANA, then verify with Alchemy `alchemy_getAssetTransfers` (EVM) or Helius `getSignaturesForAddress` + parsed tx (Solana) in a cron, and on match write profiles.tier + tier_expires_at (mirror lib/cult/entitlements.ts). No new paid API needed.
- If a fiat rail is acceptable: Stripe has no monthly cost (pay-per-transaction), so it does not violate the 'pays only Anthropic+Vercel' rule for fixed costs — add /api/stripe/checkout (Checkout Sessions) + /api/stripe/webhook (checkout.session.completed / customer.subscription.updated|deleted) to set tier and tier_source='stripe'. This is the fastest path to make the existing UI real.
- Add an admin guard to /api/revenue/stats (role==='admin') and cache aggregate results in Upstash Redis (already in stack) with a short TTL.

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem helps pricing/subscription billing. trustwallet/assets is only a token-logo registry, wallet-core is an offline signing library, and Trust Wallet deep links merely open the wallet app — none provide payment settlement, subscription state, or receipt verification. The one tangential use (deep-linking a crypto payment) is better served by the WalletConnect flow the app already uses plus Alchemy/Helius transfer verification, which are free-tier and already in the stack. Recommendation: do not adopt Trust Wallet for this feature; use on-chain payment verified via Alchemy/Helius.

## push-email
**Verdict:** Both channels are genuinely built end-to-end on free infra (hand-rolled RFC 8291 web push + Resend), but the VAPID key-rotation layer is half-wired (client subscribes against the DB key while the server always signs with a single env key), quiet-hours and event-level toggles are never enforced for push, there are two divergent subscribe paths using two different service workers, and emails ship with no List-Unsubscribe/one-click unsubscribe.

- **P1** — VAPID key rotation is half-wired: the client subscribes against the DB-served active key (/api/push/vapid-public-key -> vapid_keys.public_key) and stores vapid_key_version, but sendWebPush ALWAYS signs the JWT and sets the Authorization k= header with the single env VAPID_PUBLIC/VAPID_PRIVATE_KEY. No code ever reads vapid_keys.private_key or selects a key by vapid_key_version. The moment the vapid_keys table is seeded with a key different from the env key (the exact rotation scenario the schema/comments describe), every push is signed with the wrong key and push services reject it (403 VAPID mismatch) -> total push outage.  
  `lib/services/webpush.ts:10-11,98-108,133 vs app/api/push/vapid-public-key/route.ts:21-31 (grep confirms no vapid_keys.private_key / vapid_key_version read in any sender)`
- **P1** — Two divergent subscribe paths using two different service workers at the same root scope. components/notifications/NotificationSetup.tsx:74 registers '/sw.js' and POSTs to /api/notifications/subscribe, while lib/preferences/webPush.ts:27,83 registers '/push-sw.js' and persists directly via the browser Supabase client. Both register at scope '/', so the later registration replaces the earlier one; unsubscribeFromPush (webPush.ts:132) looks up getRegistration('/push-sw.js') and can miss the '/sw.js' registration NotificationSetup created, leaving orphaned subscriptions.  
  `components/notifications/NotificationSetup.tsx:74 + public/sw.js vs lib/preferences/webPush.ts:27,83,132 + public/push-sw.js`
- **P1** — NotificationSetup.tsx passes the raw base64url VAPID string directly as applicationServerKey instead of a Uint8Array (BufferSource). webPush.ts:98 correctly converts via urlBase64ToUint8Array; NotificationSetup does not. Firefox and Safari throw on a string applicationServerKey, so the ProfileTab enable-notifications button silently fails (returns false) on those browsers.  
  `components/notifications/NotificationSetup.tsx:30-33 (applicationServerKey: vapidKey) vs lib/preferences/webPush.ts:96-99`
- **P2** — NotificationSetup.tsx reads NEXT_PUBLIC_VAPID_PUBLIC_KEY at build time instead of the /api/push/vapid-public-key endpoint, and never sends vapidKeyVersion to the subscribe route (defaults null). It subscribes against a potentially stale build-time key and cannot participate in the versioned grace window at all.  
  `components/notifications/NotificationSetup.tsx:27,35-39 (no vapidKeyVersion in body) vs lib/preferences/webPush.ts:34-45,118`
- **P1** — Email fan-out from the notifications POST is fire-and-forget with .catch(() => {}) and no retry/queue. The notification-retry cron only reprocesses pending_telegram_messages / pending_discord_messages / pending_sms_messages — there is no pending_email table and push failures logged to push_delivery_log are never retried. If Resend is down or rate-limited, the alert email is silently lost.  
  `app/api/notifications/route.ts:302-311 (.catch(() => {})) and app/api/cron/notification-retry/route.ts:40-120 (telegram/discord/sms only)`

**Fake / unwired:**
- vapid_keys grace-window rotation: the route comment claims 'the server records which version each subscription was made under so rotations can use the matching private key during the grace window' but no sender ever selects a private key by version — app/api/push/vapid-public-key/route.ts:9-17 comment vs lib/services/webpush.ts:98-108 (always env key).
- Event-level push toggles are decorative: notification_settings.whale_alerts / smart_money / price_alerts / security_alerts are written by components/profile/NotificationSettingsPanel.tsx:265-286 but no push sender reads them — grep for whale_alerts/smart_money server-side returns only the panel. whale-alert-dispatcher gates on a per-follow wantsPush flag (app/api/cron/whale-alert-dispatcher/route.ts:243), not on these global event toggles.
- Quiet hours are ignored for push: only lib/telegram/notify.ts:87 and the digest cron read quiet_hours_*; sendPushToUser and all its callers (lib/services/webpush.ts:189, whale-alert-dispatcher:243, whales/[address]/follow/route.ts:57, lib/social/notify.ts:219) send regardless — a user inside their configured quiet window still gets OS push.
- Email fan-out only fires for two hard-coded types ['whale_alert','price_target'] (app/api/notifications/route.ts:282), so the market-signal notification types generated by the GET route ('whale','price','security','trending') never produce email despite the 'Email digest' channel toggle implying broad coverage.

**Missing backend:**
- No List-Unsubscribe / List-Unsubscribe-Post header on any Resend send (grep of lib/email.ts, lib/email/resend.ts, send-notification-email/route.ts returns nothing) — required by Gmail/Yahoo bulk-sender rules (RFC 8058) and CAN-SPAM; risks the alerts@nakalabs.xyz domain reputation and deliverability.
- No email retry/dead-letter pipeline (no pending_email table analogous to pending_telegram_messages); Resend rate-limit (429) or transient 5xx results in permanent loss.
- No unified pref gate before push: quiet hours and event-type filtering are implemented for telegram/email but not for push; sendPushToUser should consult notification_settings before delivering.
- Rotation cron/job to promote vapid_keys active->grace->retired and to re-sign against the versioned private key is absent — the table exists but nothing manages or consumes its lifecycle.
- No rate-limit/backoff handling around the Resend and push-service fetches (webpush.ts uses a huge default TIMEOUT of 600000ms from API_TIMEOUT_MS, line 13 — a hung push service blocks the request for 10 minutes).

**Missing frontend:**
- No in-app unsubscribe/preference destination for emails: send-notification-email footer 'profile settings' link and the CTA both hardcode https://nakalabs.xyz/dashboard (app/api/send-notification-email/route.ts:64,76) rather than /settings or an unsubscribe page — recipient cannot act on the stated 'manage your notification preferences'.
- NotificationSetup.tsx has no post-subscribe failure surface: registerSubscription returns false silently (line 41-43) and requestPermission just sets subscribed(false) with no error text, so a Firefox/Safari applicationServerKey throw or a 401 from the subscribe route shows nothing to the user.
- No delivered/failed feedback on the 'Test push' button — NotificationSettingsPanel.tsx:174-177 fires showLocalTestNotification (a LOCAL registration.showNotification, not a real server round-trip through VAPID) and always shows 'Sent' after 600ms even if it returned false; it does not test the actual server->push-service path.
- No loading/empty state distinction on the VAPID key fetch in webPush.ts — a fetch failure silently falls back to the env key (line 41-44) with no UI signal.

**Free-API recommendations:**
- Resend (already used, free tier 3k/mo, 100/day): keep, but add List-Unsubscribe + List-Unsubscribe-Post: List-Unsubscribe=<One-Click> headers via the Resend POST /emails body `headers` field, and back them with a real GET/POST /api/notifications/email-unsubscribe route that flips notification_settings.email_enabled=false using a signed token.
- Web Push: stay self-hosted VAPID (free, owner already pays nothing) — do NOT add a paid push provider. Fix the key path so the sender selects private_key from vapid_keys by the subscription's vapid_key_version, falling back to env only when the table is empty.
- For deliverability monitoring, use Resend's free webhook events (bounce/complaint) at POST /webhooks to auto-suppress addresses instead of re-sending to dead inboxes.
- Fallback chain for email: Resend (primary) -> SendGrid free tier (the send-notification-email route already has a SendGrid branch, lib/services layer does not) -> enqueue to a pending_email table for the notification-retry cron with 1h/24h/7d backoff mirroring the telegram path.

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem is relevant to push-email delivery. trustwallet/assets is a token-logo registry, wallet-core is a signing/keygen library, and Trust Wallet deep links open the Trust Wallet app — none of these touch VAPID web push, service workers, or transactional email. The current stack (self-hosted RFC 8291 VAPID web push + Resend free tier) is already the correct free-tier design and stays inside the owner's pay-only-Anthropic+Vercel rule. The one adjacent (still non-push) use for trustwallet/assets would be sourcing token icons for the notification `icon`/`image` fields, but CoinGecko's already-integrated image URLs cover that; no reason to add Trust Wallet here.

**Back-button offenders:**
- app/api/send-notification-email/route.ts:64 — email CTA 'View Dashboard' hardcodes https://nakalabs.xyz/dashboard
- app/api/send-notification-email/route.ts:76 — 'profile settings' preferences link hardcodes https://nakalabs.xyz/dashboard instead of a settings/unsubscribe page
- public/push-sw.js:59 and public/sw.js:30,42 — notificationclick tap target defaults to /dashboard when payload.data.url is absent (fallback, low severity)

## research-labs
**Verdict:** The Research Labs newsroom is genuinely wired to real data (Supabase research_posts + Claude-authored daily brief + live context-feed wire, no mock data), but the public list API silently ignores the sort param and never counts rows so pagination and "Trending" are dead, and the code targets research_posts columns (published/summary/view_count) that no repo migration ever creates — a schema/code mismatch that, unless the live DB was hand-patched, empties the entire page.

- **P0** — Schema/code mismatch: the public list selects 'summary' and 'view_count' and filters .eq('published', true), but the canonical research_posts table has NO published, summary, or view_count columns (it defines status TEXT, excerpt, cover_image). No repo migration adds published/summary/view_count. If the live DB was not hand-patched, this query errors and route.ts:44-46 silently returns {posts:[],total:0} — the entire Latest Research grid is permanently empty, and the daily-brief upsert (which writes published+summary) would also error, publishing nothing.  
  `app/api/research/route.ts:34,36 (select summary,view_count + .eq('published',true)) vs supabase/migrations/20260413_full_schema.sql:626-640 (only status/excerpt/cover_image); no migration adds those columns`
- **P1** — Pagination is dead. GET never passes {count:'exact'} to .select(), so Supabase returns count=null, making total = data.length (<= limit 20). The frontend only renders Previous/Next when total > 20 (page.tsx:676), so with 21+ posts users can never reach page 2 — the tail of the newsroom is unreachable.  
  `app/api/research/route.ts:32-42 (select without count option); app/dashboard/research/page.tsx:676-694`
- **P1** — 'Trending' sort is unwired. The frontend sends sort=latest|trending (page.tsx:420) but the GET handler never reads searchParams.get('sort') — it always .order('published_at', {ascending:false}). Selecting Trending re-fetches identical latest-ordered data.  
  `app/api/research/route.ts:24-42 (no sort read); app/dashboard/research/page.tsx:38-41,420`
- **P2** — Two divergent create/delete auth paths for the same table. The public app/api/research route's POST/DELETE authenticate with a plaintext ADMIN_PASSWORD compared against a query/body field, while app/api/admin/research uses verifyAdminRequest. The DELETE takes the password as a URL query param (?password=...), which leaks into logs/proxies/referrers.  
  `app/api/research/route.ts:66,102-113 (password from searchParams) vs app/api/admin/research/route.ts:15,38`

**Fake / unwired:**
- 'Sources: CoinGecko · DexScreener · CryptoPanic' footer implies the listed articles come from these feeds, but the dashboard list is 100% Supabase research_posts rows (daily brief + admin posts); no article carries a source and CryptoPanic is never called anywhere in this feature — app/dashboard/research/page.tsx:697-704
- SourceTag / SOURCE_COLORS (CryptoPanic/CoinGecko/DexScreener/Supabase) render nothing: the list API never selects or returns a 'source' field and the column doesn't exist, so post.source is always undefined — page.tsx:58-63,96-104,205,250
- 'View Source' external link block is permanently dead: it renders only when post.url is set, but the API never returns url and no such column exists — page.tsx:273-284
- Featured card hardcodes a red pulsing 'Breaking' badge on whatever the single newest post is (articles[0]), regardless of age, manufacturing false urgency for a possibly weeks-old post — page.tsx:139-145 with featured=articles[0] at page.tsx:484
- Header subtitle claims 'real-time market intelligence sourced from our own data' and a 'Live' badge, but the Latest Research grid is static published posts refreshed at most every 5 min, not live — page.tsx:499-505,531-532

**Missing backend:**
- No migration in the repo brings research_posts in line with the code's assumed columns (published boolean, summary, view_count) — only category/image_url were back-filled (2026_research_posts_add_category_image.sql). The schema drift is the root risk for the whole feature.
- GET list has no caching despite a public, low-cardinality dataset refreshed twice daily — every visitor + 5-min auto-refresh hits Supabase directly; should cache in Upstash Redis or set s-maxage
- No server-side trending ranking pipeline: the 'engagement' table (full_schema.sql:680) and view_count exist conceptually but nothing aggregates them into a trending sort
- Daily-brief cron awaits Claude synchronously inside the 120s function and then pages up to 10k users for email in the same request (research-daily-brief/route.ts:115-135) — no queueing; a slow Claude call plus large userbase risks timeout before emails send

**Missing frontend:**
- No error/failure state for the article grid: fetch failure sets posts=[] and shows a toast, then the UI falls through to the generic 'No research found' empty state (page.tsx:433,652-661) — a network error is indistinguishable from a genuinely empty newsroom
- MarketBriefCard collapse fade hardcodes from-[#0a0e1a] (page.tsx:354), which only matches a dark background — breaks visually if brand ever ships a light theme
- Category tabs expose 12 categories (Layer2, Meme, BTC, ETH, SOL, On-Chain, Protocols, etc.) but the pipeline only ever writes 'Daily Brief' (cron) or 'General' (admin default), so nearly every tab lands on the empty state — no indication which categories actually have content
- No unauthenticated/authorized handling distinction — the /dashboard/research page itself does no auth gate; relies entirely on the public API (acceptable for a public newsroom but undocumented)

**Free-API recommendations:**
- Fix the list query with Supabase count: admin.from('research_posts').select('...', { count: 'exact' }).range(...) to make total accurate and pagination live
- Implement sort server-side: when sort==='trending', .order('view_count', { ascending: false }) (after adding the view_count column) else .order('published_at'); the frontend already sends the param
- Drop the misleading CryptoPanic/DexScreener source footer — CryptoPanic is NOT in the owner's approved free matrix. For real external news/social augmentation use the already-approved LunarCrush feeds endpoint (https://lunarcrush.com/api4/public/topic/{topic}/news/v1) or GeckoTerminal, and actually populate/return a 'source' column so SourceTag stops being dead
- Add Upstash Redis cache (SETEX ~300s) in front of GET /api/research keyed by page+category+sort to cut Supabase reads for the public newsroom
- Fallback chain for the brief already good (CoinGecko primary, Promise.allSettled, null-if-empty); extend token logos fallback to DexScreener/GeckoTerminal image URLs when CoinGecko t.image is missing

**Trust Wallet fit:** Trust Wallet offers essentially nothing for a research newsroom. Its developer assets are the trustwallet/assets token-logo registry, wallet-core (signing), and deep links — none map to report generation, saved posts, or market briefs. The one marginal use would be token logos in the brief's movers table, but CoinGecko already returns free logos (dailyBrief.ts:319 t.image) and DexScreener/GeckoTerminal (both approved) cover any gaps. wallet-core and deep links are irrelevant here. Recommendation: do not add Trust Wallet for this feature; CoinGecko + DexScreener logos already fill the only conceivable gap.

## security-center
**Verdict:** The hub, health-score API, threat-feed API, approvals audit, and connected-dApps revoke are genuinely wired to live data, but the two headline promises (user 2FA/TOTP and a live threat feed) are non-functional, and the wallet-analysis path silently depends on the paid Arkham API.

- **P1** — User-facing 2FA/TOTP does not exist. The only TOTP backend (app/api/admin/totp/route.ts) is gated by verifyAdminContext and writes admin_roles — admins only. ProfileTab shows a 'COMING SOON' badge for 2FA. There is no user enrollment endpoint or UI.  
  `app/api/admin/totp/route.ts:21-27; components/ProfileTab.tsx:766`
- **P1** — SecurityHealthCard '2FA CTA' links to /settings/security which is a 404 — no app/settings/security route exists (only app/settings/page.tsx). Clicking the primary security action dead-ends.  
  `components/security/SecurityHealthCard.tsx:83 (href '/settings/security'); app/settings has only page.tsx, no security/ dir`
- **P1** — has2fa prop is hardcoded default false and the caller passes nothing, so the 'Enable two-factor authentication' CTA renders for every user unconditionally, including anyone who did enroll. It never reflects real 2FA state.  
  `components/security/SecurityHealthCard.tsx:25,81; app/dashboard/security/page.tsx:127 (<SecurityHealthCard/> no props)`
- **P0** — No producer ever writes security_alerts, approval_audit_results, or user_token_security_flags — they are only READ. LiveThreatFeed is therefore permanently empty for all users, and the health score's approvals/threats/honeypots sub-scores are always 100 (decorative). Composite score is effectively reputation-only.  
  `grep shows security_alerts referenced only in health/route.ts:82, threats/route.ts:40 (reads); approval_audit_results & user_token_security_flags only in health/route.ts:70,94 (reads); zero inserts anywhere`
- **P0** — ShadowGuardian (wallet-analysis page + scan-trade route) depends on Arkham Intelligence, a PAID API (api.arkm.com, ARKHAM_API_KEY) not in the owner's free-tier matrix. Without the key getTokenHolders throws and scanTrade returns BLOCKED 'Cannot verify token holders', so wallet-analysis fails for every input.  
  `lib/arkham/api.ts:14 (ARKHAM_API_KEY), :15 (api.arkm.com); lib/security/shadowGuardian.ts:2,11-30; app/dashboard/security/wallet-analysis/page.tsx:7`
- **P1** — Batch revoke is unwired. Hub card blurb promises 'revoke risky spenders in batch' but the approvals page only revokes one row at a time; the Permit2 revoke-batch endpoint is never called from any page.  
  `app/dashboard/security/page.tsx:84 (blurb); approvals/page.tsx:84-99 (per-row revoke only); revoke-batch/route.ts has no client caller`
- **P1** — Wallet-analysis feeds a WALLET address into ShadowGuardian.scanTrade, which treats its argument as a TOKEN contract (getTokenHolders). Wallet addresses have no token holders, so the scan returns BLOCKED/UNABLE_TO_VERIFY — semantic mismatch, the tool cannot work as labelled.  
  `lib/security/shadowGuardian.ts:8 (scanTrade(tokenAddress)); :28-30 returns BLOCKED when holderList empty; wallet-analysis/page.tsx passes wallet addr`
- **P2** — Approvals revoke uses the manually-typed address as tx 'from' and never switches the wallet to the selected chain, so a base/arbitrum approval is broadcast on whatever chain the wallet is currently on, or from a mismatched account.  
  `app/dashboard/security/approvals/page.tsx:84-98`
- **P2** — deployer-history route contains a no-op placeholder query .ilike('deployer_address','%') that matches everything.  
  `app/api/security/deployer-history/route.ts:38`
- **P2** — SecurityHealthCard has no error/unauthenticated state: on a failed or 401 fetch, loading resolves and the ring silently shows '—' with no message, so a logged-out or errored user sees a broken-looking empty gauge.  
  `components/security/SecurityHealthCard.tsx:29-40,57-59`

**Fake / unwired:**
- User 2FA is 'COMING SOON' fake behind real-looking security UI — ProfileTab.tsx:766 and the SecurityHealthCard CTA both imply enrollable 2FA that has no user backend.
- LiveThreatFeed is real UI with no data producer — security_alerts is never inserted (health/route.ts:82, threats/route.ts:40 read only), so it is an always-empty feature.
- Health score approvals/threats/honeypots components are effectively hardcoded to 100 because their source tables are never populated (health/route.ts:104-106).
- Batch-revoke capability advertised on hub card is unwired — revoke-batch/route.ts has no caller (page.tsx:84).
- Connected dApps hub card lists 'Session registry' as its data source, but there is no server registry — sessions come purely from the client WalletConnect signClient (connected-dapps/page.tsx:46-51). Misleading provenance.
- has2fa is a dead prop — declared but never supplied by the caller (SecurityHealthCard.tsx:25).

**Missing backend:**
- A producer pipeline that inserts security_alerts from scans (GoPlus token flags, Alchemy approval danger, OFAC hits) — without it the feed and 2 of 4 health components are dead.
- A writer for approval_audit_results — the approvals scan endpoint does not persist its danger findings, so the health score never reflects approvals.
- A writer for user_token_security_flags (honeypot holdings) from a portfolio scan.
- A free-tier replacement for Arkham in ShadowGuardian (holder/entity/scammer intel).
- User-tier TOTP enrollment/verify endpoints and a settings/security page.
- Caching/write-throttling on /api/security/health — it upserts the profile and may insert a history row on every single page load (write amplification, no rate guard).

**Missing frontend:**
- SecurityHealthCard: no error state and no unauthenticated state — fetch failure/401 silently renders a '—' ring (SecurityHealthCard.tsx:29-40).
- Approvals page: no explicit unauthenticated/no-wallet-connected state and revoke() uses a blocking window.alert('No EVM wallet detected') instead of brand UI (approvals/page.tsx:86-88).
- Approval rows show no token logo — the one place a trustwallet/assets icon would add real value is absent.
- wallet-analysis: no clear messaging that the tool expects a token vs wallet address; a wallet address just returns a scary BLOCKED result.
- No batch-select / 'revoke all risky' affordance on approvals despite the endpoint existing.

**Free-API recommendations:**
- User 2FA: use Supabase Auth MFA (already in stack, free) — supabase.auth.mfa.enroll({factorType:'totp'}) + mfa.challenge/verify; render QR from the returned otpauth URI. Replace the admin-only totp coupling and build /settings/security.
- security_alerts producer: run GoPlus token_security (https://api.gopluslabs.io/api/v1/token_security/{chainId}) + address_security and Alchemy alchemy_getTokenApprovals on the user's holdings, insert WARN/CRITICAL rows so the feed and score come alive. All free.
- Replace Arkham holder/entity data with free tiers: Sim by Dune (https://api.sim.dune.com token holders / activity) or Dune SQL for top holders; GoPlus malicious_address + RugCheck for scammer labels; Chainalysis free OFAC list (https://public.chainalysis.com/api/v1/address/{addr}) for sanction hits.
- Wallet reputation/threat profile for wallet-analysis: GoPlus address_security (free) instead of Arkham getAddressIntel.
- Token logos on approval rows: trustwallet/assets raw CDN https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksumAddr}/logo.png with a DexScreener/GoPlus logo fallback.
- Fallback chain design for token security: GoPlus → Honeypot.is → RugCheck (Solana), cache in Upstash Redis 5–10 min; on all-fail, render an explicit 'unable to verify' state rather than a fake pass.

**Trust Wallet fit:** "For the security-center, Trust Wallet's developer ecosystem offers essentially nothing on the security logic side — there is no Trust Wallet security, approval, OFAC, or threat API. The single marginal use is the trustwallet/assets GitHub token-logo registry (raw CDN) to put token icons on approval rows and threat-feed targets, which the UI currently lacks; but that is a cosmetic asset source, not a security data source, and GoPlus/DexScreener logo fields already partially cover it. wallet-core and deep links are irrelevant here. Verdict: do not adopt Trust Wallet for this feature beyond optionally pulling logos from trustwallet/assets; the real gaps (alert pipeline, replacing paid Arkham, user 2FA) are filled by GoPlus, Sim by Dune, Chainalysis OFAC, and Supabase Auth MFA."

## smart-money
**Verdict:** The in-scope dashboard page renders a polished leaderboard on top of fabricated "wallets" — DexScreener trading pairs dressed up as individual whale wallets with synthetic trades, hardcoded ETH price, always-zero win rates, and a paper-trade/convergence/weekly-riser layer that is mostly cosmetic; no Dune is wired anywhere, and the real Supabase convergence pipeline belongs to a different feature.

- **P1** — History tab compares move.action === 'buy' (lowercase) but recentMoves actions are 'Bought'/'Sold' (capitalized), so isUp is ALWAYS false — every move renders red TrendingDown with 'BOUGHT' in red regardless of direction  
  `app/dashboard/smart-money/page.tsx:578 vs route.ts:287 (action: priceChange>0 ? 'Bought' : 'Sold')`
- **P1** — winRate is hardcoded 0 for every wallet from BOTH sources, so 'Avg Win' stat, per-wallet 'X% Win' pills, Top-Performers card win rates, and expanded 'Win Rate' cell all display 0% permanently  
  `route.ts:173 (Alchemy winRate:0), route.ts:258 (Dex winRate:0); consumed at page.tsx:269, 314, 471, 529`
- **P1** — Paper Trade estimate = amt * (winRate/100) * 0.05, and winRate is always 0, so every simulated allocation shows '+0.00 est.'; 'Start Paper Simulation' button only calls setPaperTrade(null) — no simulation is ever run  
  `page.tsx:675 (estimate) and page.tsx:680-683 (button just closes modal)`
- **P1** — Convergence banner is effectively dead: Alchemy trades all have action 'Transfer' (never counted), and each DexScreener wallet is a different token symbol, so the count>=2-same-token condition almost never fires; it is also fully disconnected from the real Supabase smart_money_convergence table  
  `route.ts:151 (action:'Transfer'), route.ts:313-333 (self-computed convergence), unrelated to smart_money_convergence populated by cron RPC (cron/smart-money-convergence/route.ts:18) and read only by app/api/intelligence/convergence/route.ts`
- **P2** — Weekly Risers uses weeklyPnlChange which is hardcoded 0 everywhere, so the panel — when it renders — always shows '+0.0% this week'  
  `route.ts:180, 265 (weeklyPnlChange:0); sorted/displayed at route.ts:336-339 and page.tsx:347`
- **P2** — Settings-tab toggle switches (7 of them) are static divs hardcoded to the 'on' blue state with no state, no onClick, and no persistence — pure decoration implying alert prefs that do nothing  
  `app/dashboard/smart-money/page.tsx:604-635`
- **P2** — 'Watch' on the dashboard page only writes localStorage 'smart-money-watching'; it never calls /api/moneyRadar/follow, so watched wallets get no server persistence and no alerts despite the Bell 'Watch' affordance and alert Settings  
  `page.tsx:108-114 (localStorage only); moneyRadar/follow is imported by app/smart-money/page.tsx:95,109 not the dashboard page`

**Fake / unwired:**
- DexScreener 'wallets' are fabricated: each high-volume trading PAIR becomes a fake wallet named '<SYMBOL> Market Maker' with the pair address as the wallet address — route.ts:207-268, name at :249, id/address:246-248
- Synthetic recentTrades: amounts are pair volume * 0.3 and * 0.2 with hardcoded times '< 1h ago' / '2h ago' — not real wallet transactions — route.ts:222-237
- Hardcoded ETH price of 2500 used to convert all Alchemy volumes and best-trade figures to USD — route.ts:153, 157, 178
- avgHold hardcoded 'Unknown' (Alchemy) and '6h' (DexScreener); bestTrade fabricated as volume*0.15 — route.ts:177-178, 262-263
- pnlChange for DexScreener wallets is the token PAIR's 24h price change, not the wallet's PnL — route.ts:260
- recentMoves 'wallet' field is shortened pair address, not a wallet, with hardcoded '< 1h ago' — route.ts:285-290
- How-It-Works claims 'ranked by win rate' Top Performers and real convergence/weekly signals, but win rate is always 0 and both signals are inert — lib/howItWorks/content/smart-money.ts (Top Performers / convergence bullets)

**Missing backend:**
- No real wallet PnL / win-rate pipeline — the single most prominent metric across the UI has no data source and is hardcoded 0
- No Dune / Sim by Dune integration anywhere in scope despite owner complaint; convergence via whale_activity (refresh_smart_money_convergence) exists but is not consumed by /api/smart-money
- No CoinGecko (or any) live ETH/token price feed — USD conversions rely on a constant 2500
- No real per-wallet trade history for Alchemy wallets (transfers only) — archetype/win-rate/avgHold cannot be computed, so they are stubbed
- No rate-limit/caching around Alchemy or DexScreener beyond the response cache header; no Upstash/Redis memoization of the expensive dual-RPC call

**Missing frontend:**
- No source/freshness honesty: header says 'Live on-chain data' and stat cards imply real win rates while values are synthetic/zero (page.tsx:206, 269)
- History tab empty branch renders 'Loading recent moves…' with a spinner even when the API genuinely returned zero moves — no true empty state, appears to hang forever (page.tsx:570-574)
- Convergence banner, Weekly Risers, and Top-Performers blocks have no skeleton/loading placeholder — they pop in after fetch (page.tsx:275-354)
- No unauthenticated affordance on the dashboard page for the 'Watch'/alerts path (it silently uses localStorage instead of the auth-gated follow API)
- Settings toggles have no aria-pressed/role=switch, are non-interactive divs — fails keyboard + WCAG (page.tsx:615-616, 631-632)

**Free-API recommendations:**
- Sim by Dune (free tier) — GET https://api.sim.dune.com/v1/evm/activity/{address} and /v1/evm/token-balances/{address} to compute real wallet PnL, win rate, and avg hold from actual trades (replaces the hardcoded winRate:0 / avgHold stubs)
- Dune Analytics free API — POST https://api.dune.com/api/v1/query/{id}/execute for a saved smart-money-leaderboard query (top traders by realized PnL), directly answering the owner's 'Dune queries wired?' gap
- Wire the EXISTING free pipeline: read /rest/v1/smart_money_convergence (populated by refresh_smart_money_convergence over whale_activity) instead of recomputing convergence from synthetic recentTrades
- CoinGecko free — GET https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd to replace the hardcoded 2500 ETH price
- GeckoTerminal free — GET https://api.geckoterminal.com/api/v2/networks/{net}/pools/{pool}/trades for real recent trades to back Recent Moves instead of volume*0.3 estimates
- Fallback chain: Sim by Dune (wallet PnL) -> Dune saved query (leaderboard) -> Supabase whales table (/api/whales, already live) -> Alchemy transfers (labels only) -> empty state; never present pair aggregates as wallets

**Trust Wallet fit:** Trust Wallet's developer ecosystem offers essentially nothing for this feature. trustwallet/assets is only a token-logo/metadata registry, wallet-core is a client-side key/signing library, and deep links are for opening the Trust app — none provide wallet-level PnL, win rate, trade history, smart-money labels, or convergence data, which are exactly the gaps here. The only marginal use would be pulling token logos for symbols shown in Recent Moves, but DexScreener/GeckoTerminal already return token images. The correct free fills are Sim by Dune and Dune saved queries for wallet analytics, plus the already-built Supabase whale_activity/convergence pipeline.

## sniper
**Verdict:** The discover feed, criteria CRUD, autosell engine, and the cron-based execution pipeline are genuinely wired to real data (GeckoTerminal/DexScreener/GoPlus/0x/Jupiter), but the advertised low-latency webhook detection path is structurally dead, the price_target trigger and Anti-MEV/priority-fee/expiry controls are stored-but-never-enforced fakes, and the feed's primary "Quick Buy" CTA discards the token and opens a blank rule modal.

- **P0** — Webhook (low-latency) matching path is structurally dead. Alchemy events set chain = ev.network.toLowerCase() which yields 'eth_mainnet'/'base_mainnet' — never the 'ethereum'/'bsc'/'avalanche' slugs stored in sniper_criteria.chains_allowed, so matcher's .contains('chains_allowed',[chain]) matches zero criteria. Helius events set chain='solana', but the UI only allows EVM chains on criteria (NewSniperModal.tsx:50). Net: no webhook event can ever fire a rule; the only working detection is the 2-minute cron, contradicting the 'sub-second' design.  
  `app/api/webhooks/sniper-detect/route.ts:73 + lib/sniper/matcher.ts:112 + app/dashboard/sniper/NewSniperModal.tsx:50`
- **P0** — price_target trigger is a fake feature: users can build it in the UI (with live preview chart) and it persists, but no code evaluates it — matcher.ts triggerAliases only maps new_token_launch/whale_buy (price_target criteria are skipped), and sniper-monitor explicitly punts ('price checks require a price feed integration'). A user's Price Target sniper will never fire, ever.  
  `app/dashboard/sniper/NewSniperModal.tsx:336,353-384; lib/sniper/matcher.ts:156-167; app/api/cron/sniper-monitor/route.ts:334-335`
- **P1** — 'Quick Buy' on every feed card and 'Create Sniper for {symbol}' in the drawer discard the token: onSnipe opens NewSniperModal with no token prefill (the drawer literally does `void t`). There is no quick-buy execution path at all — the primary CTA on the discovery surface performs a generic rule-creation flow that cannot even target Base/Arbitrum/Optimism/Polygon tokens the feed shows (modal chains are ethereum/bsc/avalanche only).  
  `app/dashboard/sniper/page.tsx:494,527; components/sniper/TokenCard.tsx:146-157; app/dashboard/sniper/NewSniperModal.tsx:50`
- **P1** — POST /api/sniper/execute (the 5-step safety flow) has zero frontend callers and never executes anything — it inserts a sniper_executions row with status 'queued' and tx_hash null, and no consumer reads 'queued' rows (auto-execute consumes sniped_pending match events; autosell only reads 'confirmed'). Orphaned endpoint producing permanently-stuck rows that display as amber 'queued' in History.  
  `app/api/sniper/execute/route.ts:140-148 (grep shows no fetch('/api/sniper/execute') anywhere in app/)`
- **P1** — whale_buy trigger via cron is effectively dead: sniper-monitor only scans whale_activity from the last 2 minutes, but whale-activity-poll runs every 30 minutes (dispatch group 'half-hourly'), so ~93% of whale buys land outside the window and are never matched. Combined with the dead webhook path, whale-follow sniping essentially never fires.  
  `app/api/cron/sniper-monitor/route.ts:106-107 vs app/api/cron/dispatch/[group]/route.ts:33-37`
- **P1** — Autosell price feed only supports ethereum/bsc/avalanche/solana; base/arbitrum/optimism/polygon return null (USDC_BY_CHAIN/CHAIN_IDS have 3 chains). Background-sniping AA sessions can be armed on base/arbitrum/optimism/polygon (BackgroundSnipingCard AA_CHAINS), so any position there would sit unprotected with 'no live price' skips forever.  
  `lib/sniper/priceFeed.ts:17-29,178-189 vs components/sniper/BackgroundSnipingCard.tsx:18`
- **P2** — sniper-monitor dedup queries compare matched_token_address against the RAW candidate address while inserts store normalizeAddress(...) — a checksummed EVM address from whale_activity/GeckoTerminal bypasses the 10-minute dedup and re-fires the same match every 2-minute tick until the daily cap is exhausted.  
  `app/api/cron/sniper-monitor/route.ts:242 vs :250 and :307 vs :315`
- **P2** — Non-auto ('matched'/alert-only) decisions from the cron never notify the user — only matcher.ts (the dead webhook path) queues the Telegram alert. Cron-detected matches silently accumulate in the DB; the user only sees them if they open the Snipers tab.  
  `app/api/cron/sniper-monitor/route.ts:338-343 (insert only) vs lib/sniper/matcher.ts:263-278`
- **P2** — sniper-detect webhook insert error is silently swallowed: supabase-js .insert() does not throw, the returned error object is never checked, and the catch block that exists uses console.error (a stated CLAUDE.md violation). If sniper_detected_tokens is missing in prod (as the match route comment at app/api/sniper/match/route.ts:58-60 asserts), every detection write fails invisibly.  
  `app/api/webhooks/sniper-detect/route.ts:128-143`
- **P2** — Feed error states are conflated with empty: loadFeed treats a 403/500 JSON error body as tokens=[] and DiscoverTab renders 'No fresh pairs match these filters' — a mid-session tier expiry or DB error reads as an empty market, never an error.  
  `app/dashboard/sniper/page.tsx:248-260,743-746`
- **P2** — GET /api/sniper runs an extra up-to-2000-row launchpad scan on every feed request to compute `sources`, which the frontend never uses (SourceFilterRow renders the static LAUNCHPADS list). Pure wasted DB load on a 20-second polling endpoint.  
  `app/api/sniper/route.ts:175-181 vs components/sniper/SourceFilterRow.tsx:26-28`
- **P2** — matcher.ts daily-spend cap can overshoot by one snipe: it checks todaySpend >= cap but does not include the incoming amount (sniper-monitor fixed this with runningSpend; the webhook matcher did not).  
  `lib/sniper/matcher.ts:207-216 vs app/api/cron/sniper-monitor/route.ts:213-220`
- **P2** — NavPill tab buttons hide their text label on mobile (hidden sm:inline) leaving icon-only buttons with no aria-label — unlabeled controls for screen readers; also numerous text-white/40 10px labels on glass fall well short of WCAG AAA 7:1 contrast.  
  `app/dashboard/sniper/page.tsx:564-580`

**Fake / unwired:**
- Anti-MEV toggle + mev_protect column + 'MEV-protected' header claim ('Flashbots Protect'/'Jito Bundle'/'BloxRoute' labels in chains.ts): stored on criteria but never read by any execution code — grep of lib/trading/* shows zero references to mev_protect or priority_fee_native. app/dashboard/sniper/NewSniperModal.tsx:435-442, lib/sniper/chains.ts:43,57,71, app/dashboard/sniper/page.tsx:410
- priority_fee_native input: persisted (app/api/sniper/criteria/route.ts:200) but never used to build any transaction — pure decoration.
- expiry_hours ('Expiry (hours)') input: stored and displayed, but grep shows no code anywhere enforces expiry — snipers never expire. app/dashboard/sniper/NewSniperModal.tsx:462-464; only refs are lib/sniper/types.ts:52 and app/api/sniper/criteria/route.ts:207
- bonding_curve_pct is never written by any ingest (only the migration defines it and readers read it) — so the BondingCurveBar UI (sniperShared.tsx:214-236), the TokenCard bonding display (TokenCard.tsx:138), and the 'graduate' chime in the feed-sound feature (page.tsx:186-194 requires bondingCurvePct crossing graduatePct) can never activate. The graduation-alert sound setting is a control for a signal that does not exist.
- lib/sniper/engine/{evm,solana,ton,index,types,apiCost}.ts — the entire 'per-chain MEV-protected broadcast engine' (Jito/Flashbots/BloxRoute submit adapters) is imported by nothing (only priceFeed uses apiCost.timed); dead code that the docs and UI copy still describe as the execution layer.
- components/sniper/LiveTape.tsx and components/sniper/SnipeRiskCell.tsx are orphaned — defined, never imported by any page.
- 'Sub-2s execution' header claim + 'Avg Speed' stat: execution_time_ms is only ever written by the orphaned /api/sniper/execute route, where it measures the GoPlus/AI safety-scan duration, not a trade; the real AA/pending-trade paths never set it, so Avg Speed shows '—' forever or, worse, a safety-scan latency masquerading as execution speed. app/dashboard/sniper/page.tsx:410,453-461; app/api/sniper/execute/route.ts:139-147
- GET /api/sniper supports an audit=devsoldall filter (app/api/sniper/route.ts:131) with no corresponding UI control — half-wired.
- /api/sniper/state and /api/sniper/feed-health have no frontend consumers (grep shows zero fetches) — diagnostics-only endpoints presented in the API surface.

**Missing backend:**
- A price_target evaluation loop — nothing anywhere compares trigger_price_target to a live price (sniper-monitor route.ts:334-335 is a comment, not code).
- Chain-slug normalization for Alchemy webhook networks (ETH_MAINNET -> ethereum etc.) plus any webhook-subscription management: no code registers Alchemy/Helius webhooks for tracked whales or new-pair sources; the endpoint just waits for traffic that has no configured producer in-repo.
- Expiry enforcement for sniper_criteria.expiry_hours (a daily cron flipping enabled=false past expiry).
- Ingest of bonding_curve_pct (pump.fun graduation progress) — column exists, no producer.
- 0x price coverage for base/arbitrum/optimism/polygon in lib/sniper/priceFeed.ts (USDC addresses + chain IDs) so autosell can protect AA positions on those chains; TON pricing is absent entirely (explicit skip).
- Fallback chain for the feed ingest: GeckoTerminal is the single pool source; when GT is down a chain contributes nothing (acceptable honesty, but DexScreener /token-profiles or /latest/dex/search could serve as a secondary pool discovery source).
- Faster whale_activity freshness (webhook or 2-min poll) so sniper-monitor's 2-minute window has anything to match.
- A consumer or removal for /api/sniper/execute's 'queued' sniper_executions rows (they leak into Executions count and History forever).
- Cleanup/backfill for sniper_detected_tokens (webhook writes are unchecked; nothing reads the table — the UI feed reads sniper_feed_tokens instead).

**Missing frontend:**
- Distinct error vs empty state for the Discover feed (non-OK /api/sniper responses render as 'No fresh pairs match these filters', page.tsx:248-260,743-746); no tier-expired/403 handling mid-session.
- Token prefill in NewSniperModal when launched from a TokenCard/drawer (token identity is discarded at page.tsx:494,527) and a real quick-buy path for feed tokens on their actual chain.
- No UI for feed chains that cannot be sniped: Base/Arbitrum/Optimism/Polygon tokens show a 'Quick Buy' button that leads to a modal without those chains — needs either chain support or an honest 'view only' affordance.
- aria-labels on icon-only NavPill tabs when labels collapse on mobile (page.tsx:564-580); WCAG AAA contrast for the pervasive text-white/40-45 microcopy on glass.
- No edit flow for existing snipers — SniperCard offers only pause/delete (page.tsx:1107-1112); the API's POST supports update-by-id (criteria/route.ts:211-212) but nothing calls it with an id.
- No failure surfacing when togglePause/removeSniper Supabase writes fail (optimistic update with unchecked errors, page.tsx:341-351).
- MatchActivity is buried at the bottom of the Snipers tab only; queued/executed decisions have no link to the resulting execution or tx.
- The devsoldall audit filter exists server-side but has no toggle in the filter row.

**Free-API recommendations:**
- price_target trigger: reuse the already-built getCurrentTokenPriceUsd (0x allowance-holder /swap/allowance-holder/price for EVM — already keyed; Jupiter Price API https://api.jup.ag/price/v2?ids=<mint> free for Solana) inside sniper-monitor; for cheap bulk marks use DexScreener GET https://api.dexscreener.com/tokens/v1/{chain}/{addr1,addr2,...} (free, 300 req/min, 30 tokens/call).
- Autosell chain coverage: add USDC addresses + chainIds for base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, 8453), arbitrum (0xaf88d065e77c8cC2239327C5EDb3A432268e5831, 42161), optimism (0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85, 10), polygon (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359, 137) to lib/sniper/priceFeed.ts — 0x v2 already supports all four on the existing key. Fallback chain: 0x price -> DexScreener tokens/v1 -> GeckoTerminal /simple/networks/{net}/token_price/{addr} (free, no key).
- Solana launch detection (real sub-second, free): PumpPortal WebSocket wss://pumpportal.fun/api/data (subscribeNewToken / subscribeMigration) — also supplies bonding-curve progress to populate bonding_curve_pct; alternative: Helius enhanced webhooks (already integrated, free tier) pointed at the pump.fun program.
- EVM launch detection: keep GeckoTerminal /networks/{net}/new_pools (free, ~30 req/min — current ingest of 8 chains x 3 pages every 2 min is near the cap; add 429 backoff and consider alternating chains per tick). Fix the Alchemy webhook by mapping network enums (ETH_MAINNET->ethereum, BNB_MAINNET->bsc, AVAX_MAINNET->avalanche) before matching.
- whale_buy freshness: widen sniper-monitor's whale_activity window to >= the poll cadence (30 min) with dedup doing the dup-prevention, or register Alchemy Address Activity webhooks per tracked whale via https://dashboard.alchemy.com/api/create-webhook (free) feeding the existing /api/webhooks/alchemy-whale.
- Token security fallback: current GoPlus-only enrichment should fall back to Honeypot.is https://api.honeypot.is/v2/IsHoneypot?address= (free, EVM) when GoPlus 429s, and RugCheck https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary (free) for Solana rows — both are in the owner's approved matrix and currently unused in this feature.

**Trust Wallet fit:** Trust Wallet's only relevant offering — the trustwallet/assets GitHub logo registry — is ALREADY integrated exactly where it belongs: lib/sniper/feedIngest.ts:80-104 uses raw.githubusercontent.com/trustwallet/assets as the last-resort token logo (checksum-cased path, EVM only, UI handles the 404). That is the correct ceiling of its usefulness here: the registry is PR-curated and lags weeks-to-months, so for a feed of minutes-old meme launches the hit rate is near zero — DexScreener/GeckoTerminal imageUrl (already primary/secondary) is the right source. Nothing else in the Trust Wallet developer ecosystem helps sniping: wallet-core is a native signing library irrelevant to this web AA/session-key architecture; Trust Wallet deep links (trust://) would only open a token in someone else's wallet app, undermining the in-app execution loop; and there is no Trust Wallet developer API for launch detection, pricing, or token security. Recommendation: keep the existing logo fallback, adopt nothing further.

## support-cs-ai
**Verdict:** The human ticket system (user create/list/thread + admin list/status) is genuinely wired end-to-end, but the admin reply button writes to the wrong table so admin answers never reach users, the two AI-chat backends are duplicated/divergent with one fully orphaned, escalation and email delivery are promised in UI/prompts but do not exist, and there is zero cost tracking on any LLM call.

- **P0** — Admin reply button is fully broken and writes to the wrong table. app/admin/support/page.tsx:77 sends the reply to /api/admin/support-tickets/reply, whose handler reads/writes the legacy support_conversations JSONB table, NOT ticket_replies. So (a) admin replies never appear in the user's ticket thread (user detail page reads ticket_replies), and (b) the .single() fetch on a support_tickets UUID that has no support_conversations row errors -> 500. The correct handler already exists at the sibling POST /api/admin/support-tickets.  
  `app/admin/support/page.tsx:77, app/api/admin/support-tickets/reply/route.ts:27-45`
- **P1** — Two divergent AI support backends with different models, prompts, and pricing that give inconsistent answers. /api/support (streaming, model 'claude-sonnet-4-6') and /api/customer-service (vtxQuery, sonnet-5 executor + opus-4-8 advisor). Their system prompts list different feature sets and one states concrete pricing (Free 25/Mini $5/Pro $9/Max $15) while the other states none.  
  `app/api/support/route.ts:8-34,63 vs app/api/customer-service/route.ts:6-88`
- **P1** — Hardcoded model 'claude-sonnet-4-6' in the support stream route while the shared service migrated to 'claude-sonnet-5' (VTX_EXECUTOR_MODEL). Stale/likely-invalid model id; if the id is not served this endpoint 500s on every call.  
  `app/api/support/route.ts:63 vs lib/services/anthropic.ts:34`
- **P1** — Support page back button hardcodes navigation to /dashboard instead of going back in history. BackButton pushes href unconditionally when href is set, bypassing its own smart router.back() logic. Users who reach support from profile/deeplink are thrown to /dashboard.  
  `app/dashboard/support/page.tsx:154, components/ui/BackButton.tsx:21-23`
- **P2** — components/support/AISupportChat.tsx and its endpoint /api/support are orphaned dead code — AISupportChat is never imported/mounted anywhere. Maintenance hazard and the source of the divergent second prompt.  
  `components/support/AISupportChat.tsx:18 (no importing file found), app/api/support/route.ts`

**Fake / unwired:**
- Escalation path is verbal only — no mechanism. Both prompts promise 'a member of our support team will get back to you' / 'escalate to human support' but neither route creates a ticket, sends email, or notifies staff. app/api/customer-service/route.ts:83,87 and app/api/support/route.ts prompt.
- Support page subtitle claims 'Replies by email & Telegram (if linked)' but NO email-sending code exists anywhere in the ticket flow (grep for resend/nodemailer/sendEmail in app/api/support + app/api/admin/support-tickets returns nothing). app/dashboard/support/page.tsx:160.
- 'Attachments are coming soon' shown inside the real ticket form — coming-soon behind production UI. app/dashboard/support/page.tsx:276.
- customer-service system prompt presents retired/aspirational features as live product (COPY TRADING, SOCIAL TRADING, BUILDER NETWORK, LAUNCHPAD, PROJECT DISCOVERY, WALLET CLUSTERS, SMART MONEY, COMMUNITY, MESSAGES) — stale feature references the AI will confidently describe. app/api/customer-service/route.ts:30-52.
- AISupportChat header shows a hardcoded green 'Online' status pill with no health check backing it. components/support/AISupportChat.tsx:106.

**Missing backend:**
- Zero cost/token tracking on either AI endpoint. customer-service throws away response.usage (route.ts:113-125); the support stream never reads usage. No cost table, no per-user tally, no cap. Directly the owner's 'cost tracking' complaint.
- customer-service runs the full VTX stack for a FAQ bot: vtxQuery always prepends an Opus-4-8 advisor tool (max_uses 2) plus adaptive thinking (lib/services/anthropic.ts:399-419) — an FAQ answer can trigger up to two Opus advisor calls. No cheap-model (Haiku) path, no cost ceiling.
- No email delivery pipeline despite the 'Replies by email' claim; only Telegram notify exists and only on the canonical admin POST (not the reply endpoint the admin UI actually calls).
- No LLM fallback/degradation: on Anthropic error both routes just return a generic 500 (customer-service:127, support:97) — blank/failed chat with no cached FAQ fallback.
- maxTokens 1024 with adaptive thinking on customer-service (route.ts:119) risks truncating replies since thinking tokens count toward the cap — the code comment acknowledges the risk but 1024 is still tight.

**Missing frontend:**
- No unauthenticated state on /dashboard/support: a 401 from GET /api/support/tickets is swallowed into setTickets([]) and the UI shows 'No tickets yet. Create one to get started.' — misleading a logged-out/expired user. app/dashboard/support/page.tsx:77-80.
- postReply fails silently with a code comment 'keep input, silent fail' — user gets no error toast if the reply POST fails. app/dashboard/support/page.tsx:142-144.
- No loading/error/empty states for the AI chat beyond a spinner; ProfileTab chat has no retry affordance on failure. components/ProfileTab.tsx:237-239.
- No cost/usage indicator anywhere for the owner despite cost being a stated concern.
- Two different visual languages: the user support page uses nl-glass brand glassmorphism (page.tsx) while the orphaned AISupportChat + admin page use flat hex panels (#0D1117/#141824) — brand inconsistency.

**Free-API recommendations:**
- Cost tracking: log response.usage.input_tokens/output_tokens (and cache_read/creation) into a Supabase table (ai_usage_log) keyed by user_id + endpoint on every LLM call; compute cost from static per-model rates. No external API needed — Supabase already in the stack.
- Cheaper FAQ model: route customer-service/support FAQ to claude-haiku-4-5 with tools:[] and NO advisor tool (call anthropic.messages.create directly, not vtxQuery) to cut per-message cost ~10-20x; reserve the Opus advisor for VTX analytics only.
- Escalation: reuse the existing Telegram Bot API + lib/telegram/notify.queueTelegramNotification to alert staff, and auto-create a support_tickets row from the AI chat when the model emits an escalation signal — turns the verbal promise into a real handoff with no new vendor.
- Email replies (owner already pays nothing extra by keeping it free): if email is truly wanted, the only free-tier option is limited (Resend free 100/day) — otherwise drop the 'by email' claim from the UI to stop over-promising.
- Prompt-cache the support system prompt (it is static and large) via cache_control to cut input-token cost on repeat chats; vtxQuery already caches but the direct support/route.ts call does not.

**Trust Wallet fit:** "Nothing in the Trust Wallet developer ecosystem helps this feature. Support/CS is internal ticketing + an LLM FAQ bot: the trustwallet/assets logo registry, wallet-core signing library, and deep links have zero relevance to tickets, escalation, or cost tracking. The right fixes are all in tools the owner already pays for or gets free: Supabase (ticket + cost tables), Anthropic (cheaper Haiku FAQ path), and the Telegram Bot API (staff escalation + user reply notifications). Do not add Trust Wallet for this feature."

**Back-button offenders:**
- app/dashboard/support/page.tsx:154 — <BackButton href="/dashboard" /> forces router.push('/dashboard') (BackButton.tsx:21-23) instead of history back; remove the href prop to restore the component's built-in internal-referrer router.back() behavior.

## swap
**Verdict:** The backend (0x v2 + Jupiter + GoPlus) is largely real, but the swap page's primary quote display is dead from a client/server schema mismatch, Solana signing throws on every attempt, and the multi-aggregator route comparison + MEV toggle are unwired decoration over real-looking UI.

- **P0** ✅ FIXED — Main swap page quote pipeline is dead: client checks data.buyAmount and reads data.estimatedPriceImpact / data.gas, but /api/swap/price was refactored to return toAmount (human) / priceImpactPct / no gas — the condition is never true, so 'You receive' never populates, quoteData stays null, and the details panel, order-routing panel, USD readouts, and MEV pill never render  
  `app/dashboard/swap/page.tsx:789-804 vs app/api/swap/price/route.ts:116-131 (EVM) and 78-94 (Solana) — no buyAmount key in either response`
- **P0** ✅ FIXED — Solana swap execution throws on every attempt: Jupiter buildSwapTransaction does not set asLegacyTransaction, so it returns a base64 VersionedTransaction, but both signers deserialize with legacy Transaction.from(), which throws on version-prefixed messages  
  `lib/services/jupiter.ts:166-186 (no asLegacyTransaction) vs app/dashboard/swap/page.tsx:1026-1029 and lib/hooks/useSwapBroadcast.ts:315-318 (Transaction.from)`
- **P0** — Selecting a non-0x route (1inch/Kyber/OpenOcean) always fails: handleSwap posts {taker, fromToken, toToken} but /api/market/trade/execute requires tokenIn/tokenOut/amountIn/walletAddress -> 400 'Missing required fields'; even if fields matched, RouteQuote.raw contains quote-only data (no calldata — services call /quote endpoints, never /swap or route/build), and the server returns {transaction} while the client only checks out.txHash and never signs/broadcasts; the success path's early return also skips setSwapping(false), stranding the spinner  
  `app/dashboard/swap/page.tsx:920-941,1193 vs app/api/market/trade/execute/route.ts:55,66-68,124-147; lib/services/oneinch.ts:31, lib/services/kyberswap.ts:31, lib/services/openocean.ts:29 (quote-only URLs)`
- **P0** — RouteComparison feeds token SYMBOLS + human amounts into /api/swap/routes, but getAllRoutes forwards them raw to 1inch/Kyber/OpenOcean which require contract addresses and base units — 1inch additionally 401s without ONEINCH_API_KEY (absent from .env.example) — so the 'best-of-3 routes' panel almost always shows 'No alternative routes found' or wrong-magnitude numbers  
  `components/swap/RouteComparison.tsx:44-48 (sends fromToken='ETH', amountIn='0.5'), lib/services/swap-aggregator.ts:98-160 (no symbol/decimals resolution), lib/services/oneinch.ts:29-31; grep of .env.example shows no ONEINCH_API_KEY`
- **P1** — Solana deep-links break quotes: resolveParam only handles EVM 0x-addresses; a base58 mint from the sniper drawer is uppercased into an invalid symbol/mint (uppercasing can produce chars outside the base58 alphabet) -> server 422 UNRESOLVED_TOKEN  
  `app/dashboard/swap/page.tsx:596,607-619`
- **P1** ✅ FIXED — Token selector cannot find arbitrary tokens by NAME: search only filters the hardcoded 26-entry TOKEN_LIST; the list is not chain-filtered so picking e.g. BONK while on Ethereum silently produces no quote (simulateQuote swallows all errors with console.error, no UI error state)  
  `app/dashboard/swap/page.tsx:88-115,239-242 (static list filter), 806-809 (silent catch)`
- **P1** ✅ FIXED — Imported tokens are invisible after import: stored only in a module-level in-memory map, lost on refresh, and never rendered in the token list on reopen (filtered list maps TOKEN_LIST only)  
  `app/dashboard/swap/page.tsx:121-125 (IMPORTED_TOKENS in-memory), 239-242,317-333 (list renders TOKEN_LIST only)`
- **P1** — SwapDuneStrip and the pre-trade sandwich-risk fetch pass token SYMBOLS where the backends key on contract ADDRESSES (goplus_security_cache.token_address, transactions.to_token_address, analyseMevProtection tokenAddress) — the intelligence strip is nearly always empty and the MEV score is computed against a junk key; the MEV pill is additionally gated on hasQuote which never becomes true due to the P0 quote bug  
  `app/dashboard/swap/page.tsx:1226-1236 (toToken symbol to /api/mev-protection), 1926-1931 (symbols to SwapDuneStrip); lib/dune/useSurfaces.ts:445-478`
- **P1** — Client base-unit conversion uses float math BigInt(Math.round(parseFloat(amount) * 10**18)) — the exact precision bug the repo's own toBaseUnits docstring says causes MAX swaps to revert with insufficient funds; the safe string-math helper exists server-side but the page bypasses it  
  `app/dashboard/swap/page.tsx:775,947 vs lib/market/swapTokenMeta.ts:117-123`
- **P1** — OrderForm hardcodes wallet_source:'external_evm' even when chain is solana, and requires a Supabase login session — wallet-only users get a bare 'Unauthorized' toast with no sign-in prompt  
  `components/trading/OrderForm.tsx:127,220,289,362 (hardcoded wallet_source); app/api/trading/limit-orders/route.ts:65-67 (401)`
- **P2** ✅ FIXED — Direction-switch button uses hardcoded off-brand hex colors (bg-[#1a2332], border-[#0A0E1A]) that don't match the nl-glass/nl-card surfaces it straddles, making the cutout ring look broken; sits in a z-10/h-0 wrapper that is correct but fragile against the z-50 token modal  
  `app/dashboard/swap/page.tsx:1405-1414`
- **P2** — handleSwapTokens doesn't clear the stale toAmount while the reversed quote loads (and the quote never loads due to the P0), so reversed direction shows the old receive amount as the new input's counterpart  
  `app/dashboard/swap/page.tsx:882-890`
- **P2** — Custom slippage input accepts any value (e.g. 100%) with only a soft >5% warning; server caps at 50% (5000 bps) which is still far above safe  
  `app/dashboard/swap/page.tsx:384-401,951; app/api/swap/quote/route.ts:26`

**Fake / unwired:**
- Hardcoded gas estimates shown as real: fallbacks '$2.40' / '$0.02' / '$0.001' (page.tsx:1196) and gasEstimateUsd = gas*30/1e9 assumes a fixed 30 gwei and labels an ETH quantity as USD without any native-token price (page.tsx:799); Solana gasEstimateUsd hardcoded 0.001 (app/api/swap/price/route.ts:93)
- Price impact fabricated when absent: defaults to '0.01' (page.tsx:798, 1197) — a made-up 'Low' green badge
- Route / 'Powered by X' venue is a hardcoded per-chain DEX label (Uniswap V3, Aerodrome, Raydium, PancakeSwap...) that has nothing to do with the actual 0x/Jupiter routing (page.tsx:68-76 CHAINS.dex; rendered at 1495-1499, 1730-1734, 1749, 1886)
- MEV Protection toggle is cosmetic: copy claims 'Routes via private mempool (Flashbots / Jito)' (page.tsx:431-434) but mevProtect is only sent on the broken non-0x path (page.tsx:931) and ExecuteBody has no mevProtect field (app/api/market/trade/execute/route.ts:15-50); the standard 0x path never receives it; 'Auto-enabled for trades >= $1,000' can never fire because fromAmountUsd is hardcoded null (page.tsx:796, 1205-1206)
- RouteComparison presents selectable alternative routes as executable; the code's own comment admits 'execution wiring lands next sprint' (page.tsx:455-457) while the UI lets users pick a provider that then 400s
- Advanced Orders 'Market' tab is dead UI: two unwired inputs and a link to /dashboard/swap — the page you are already on (components/trading/OrderForm.tsx:79-98)
- USD value readouts '~$...' render quoteData.fromAmountUsd/toAmountUsd which the client explicitly sets to null (page.tsx:796-797), so they could only ever show $0.00

**Missing backend:**
- No token search-by-name endpoint: the requirement 'find any token by name on any chain' has no backend at all — /api/swap/token-meta only accepts addresses
- No aggregator fallback chain for quotes: /api/swap/price returns 500 when 0x fails; KyberSwap/OpenOcean services exist but are never used as fallback for the primary quote
- getAllRoutes performs no symbol->address or human->base-unit resolution before fanning out to 1inch/Kyber/OpenOcean (lib/services/swap-aggregator.ts:98-111)
- No calldata-building step for the alternative aggregators (1inch /swap, Kyber route/build, OpenOcean swap_quote) — route selection can never execute
- No real gas estimation pipeline: no eth_gasPrice/eth_estimateGas via Alchemy + native-token USD price; UI falls back to invented constants
- No server-side MEV/private-mempool submission path consumed by this flow despite the toggle's claims
- No rate limiting on /api/swap/token-meta or /api/swap/price (only edge caching / 10s route cache)
- Imported-token registry is client-memory only — no per-user persistence (localStorage or Supabase user_tokens table)

**Missing frontend:**
- No error state for failed quotes — simulateQuote swallows every failure (422 unsupported token, 500, network) into console.error; user sees a receive field stuck at 0 with no explanation (page.tsx:806-809)
- Token list has no per-chain filtering, no 'imported' section, no empty state distinguishing 'not on this chain' from 'not found' (page.tsx:239-333)
- Review modal renders token glyphs as text initials (fromToken.slice(0,2)) instead of the TokenBadge with real logos used elsewhere (page.tsx:1844, 1854)
- No loading skeleton for balances; 'Balance: 0.00' is indistinguishable from 'still loading' (page.tsx:1372, 1420)
- WCAG contrast: placeholder-gray-600 / text-gray-600 on #060A12 backgrounds (~2.9:1) fails AAA and even AA for body text (page.tsx:271, 1372, 1420)
- Direction-switch button hardcodes non-brand hexes instead of nl-glass tokens (page.tsx:1409)
- No unauthenticated state for Advanced Orders — form renders fully then 401s on submit (OrderForm.tsx + /api/trading/* auth)
- Batch page has no wallet-connect CTA (only an informational banner) and its Review button is just disabled with no hint (batch/page.tsx:71-79, 157-164)

**Free-API recommendations:**
- Token search by name: DexScreener GET https://api.dexscreener.com/latest/dex/search?q={query} (free, no key) for EVM+Solana; Jupiter GET https://lite-api.jup.ag/tokens/v2/search?query={query} (free) for Solana — wire into TokenSelectModal alongside the existing address paste
- EVM quote fallback chain: 0x v2 /swap/permit2/price (existing, keyed) -> KyberSwap GET https://aggregator-api.kyberswap.com/{chain}/api/v1/routes then POST /api/v1/route/build for executable calldata (free, no key) -> OpenOcean GET https://open-api.openocean.finance/v4/{chain}/swap_quote (free, returns calldata) -> 1inch api.1inch.dev only if a free dev-portal key is provisioned (1 RPS free tier); Kyber+OpenOcean also fix the missing calldata for RouteComparison execution
- Real gas estimate: Alchemy RPC eth_gasPrice (or eth_maxPriorityFeePerGas) x quote.transaction.gas, converted with CoinGecko GET /api/v3/simple/price?ids=ethereum,binancecoin,matic-network,avalanche-2&vs_currencies=usd (free) — replaces the $2.40 constants
- Solana fix: pass asLegacyTransaction=false intentionally and deserialize client-side with VersionedTransaction.deserialize(bytes) from @solana/web3.js (no new API needed)
- Token security fallbacks: keep GoPlus https://api.gopluslabs.io/api/v1/token_security/{chainId} (free), add Honeypot.is GET https://api.honeypot.is/v2/IsHoneypot?address={addr}&chainID={id} (free) for EVM tax verification, RugCheck GET https://api.rugcheck.xyz/v1/tokens/{mint}/report (free) for Solana in the review-modal probe
- Imported-token logo fallback: Trust Wallet assets raw CDN https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png (free, static) when Alchemy/DexScreener return no logo
- Pass contract ADDRESSES (already available from getTokenAddresses/quoteData.buyTokenAddress) to /api/swap/intelligence and /api/mev-protection so the existing Dune/Supabase pipelines actually match rows

**Trust Wallet fit:** Only one Trust Wallet asset is genuinely useful here: the trustwallet/assets GitHub registry as a free static logo fallback for user-imported tokens (raw.githubusercontent.com URL pattern), filling gaps where Alchemy/DexScreener return no image — a minor polish win, and DexScreener/CoinGecko logos (already wired) remain the better primary. Nothing else fits: Trust Wallet exposes no public swap/quote developer API (its in-app swap consumes the same aggregators this app already uses directly); wallet-core is a native mobile signing library redundant with the existing ethers/@solana/web3.js signing; and Trust Wallet deep links only matter for mobile wallet handoff, which Reown AppKit/WalletConnect already covers on this page (page.tsx:1326-1336). Recommendation: adopt the assets-repo logo fallback, skip the rest.

**Back-button offenders:**
- None hardcoded to /dashboard in this feature. app/dashboard/swap/page.tsx:1257-1264 maps ?from=wallet -> /dashboard/wallet-page and ?from=home -> /dashboard (intentional origin round-trip), else uses history-aware BackButton; batch page passes href='/dashboard/swap' (batch/page.tsx:66) which is the correct parent. Shared components/ui/BackButton.tsx:45 falls back to /dashboard only when there is no internal referrer/history — by design, not a bug.

## telegram-integration
**Verdict:** The inbound bot, account-linking, command handlers (real data, no mock), and the pending_telegram_messages retry queue genuinely work, but the telegram_delivery_failures retry pipeline has a broken backoff that makes failed real-time notifications almost never retry, several bot deep-links point at 404 routes, the app-side Disconnect button is fake, and the promised login-alert template does not exist.

- **P1** — telegram_delivery_failures retry backoff is broken by an attempts-seeding mismatch. lib/telegram/notify.ts inserts every failure with attempts=MAX_ATTEMPTS=3, but telegram-retry-failures computes dueAt = last_attempt_at + BACKOFF_MS[attempts-1] = BACKOFF_MS[2] = 7 DAYS for the very first retry (comment claims 1h->24h->7d). The read query also filters created_at > now-7d, so the row's due time (~created+7d) lands at/after the cutoff and gets excluded before it is ever due. Net effect: failed real-time Telegram notifications get at most one retry, 7 days out, and usually none.  
  `lib/telegram/notify.ts:127 (attempts: result.attempts=3) + app/api/cron/telegram-retry-failures/route.ts:71-84,58-64`
- **P1** — The bot repeatedly deep-links users to ${APP_URL}/settings/notifications to generate a link code, but that route does not exist (only app/settings/page.tsx, which does not even mount TelegramConnectCard). Every user onboarding via the bot lands on a 404. The card actually lives on /dashboard/profile and the dashboard home.  
  `app/api/telegram/webhook/route.ts:96,278,297,309,315 and components/dashboard/TelegramConnectBanner.tsx:44 vs. missing app/settings/notifications route`
- **P1** — /copy command deep-links to /dashboard/copy-trade and /dashboard/copy-trade/setup, but the real route is /dashboard/copy-trading. Both target 404. The whole PRO copy-trade CTA from Telegram is dead.  
  `app/api/telegram/webhook/route.ts:436 (copy-trade routes missing; copy-trading exists)`
- **P1** — The app-side Disconnect button is fake. unlink() makes no API call and does not delete the link; it just pops an alert() telling the user to go type /unlink in the bot. The 'Connected' state never changes from the app. There is no DELETE endpoint under app/api/telegram.  
  `components/settings/TelegramConnectCard.tsx:102-115 (no DELETE endpoint exists)`
- **P2** — /snipe command deep-links to /dashboard/sniper/new?token=... which is a missing route (only /dashboard/sniper exists). MAX sniper CTA from Telegram 404s.  
  `app/api/telegram/webhook/route.ts:456 (sniper/new missing)`
- **P2** — telegram_paused is only honored on the inbound webhook and the telegram-retry-failures cron. Outbound senders ignore it: sendTelegramNotification (lib/telegram/notify.ts), notification-digest, and notification-retry cron have no paused check, so live whale/sniper/copy/digest pushes still fire during a deliberate pause. The migration comment explicitly claims outbound senders treat pause as 'not configured'.  
  `supabase/migrations/2026_05_24_telegram_paused.sql:1-6 vs. lib/telegram/notify.ts:69-114, app/api/cron/notification-digest/route.ts (no paused grep hit), app/api/cron/notification-retry/route.ts (no paused check)`
- **P2** — /watchlist is registered in the Telegram command menu via setMyCommands but has no handler in the webhook switch, so tapping it replies 'Unknown command: /watchlist'.  
  `app/api/admin/telegram/diagnose/route.ts:191 registers watchlist; app/api/telegram/webhook/route.ts:382-461 has no watchlist case`
- **P2** — tierGateMsg links upgrade text to ${APP_URL}/pricing (404) while the rest of the file correctly uses PRICING_URL=/dashboard/pricing. Users hitting a tier gate get a dead upgrade link in the message body.  
  `app/api/telegram/webhook/route.ts:165 vs. 94`
- **P2** — Paused webhook returns HTTP 200 {ok:true,paused:true}, which tells Telegram the update was processed successfully, so Telegram will NOT redeliver after unpause. Messages sent during a pause are silently dropped, contradicting the in-code comment that 'Telegram retries the webhook for an hour'.  
  `app/api/telegram/webhook/route.ts:186-190`

**Fake / unwired:**
- Disconnect button performs no backend action, only an alert() instructing the user to type /unlink manually — components/settings/TelegramConnectCard.tsx:102-115
- 'Open Bot' deep-link uses https://t.me/<bot>?start=link_<code>, implying auto-linking, but the /start handler ignores the start payload entirely (webhook/route.ts:258-286 discards cmd.args), so the code is never consumed and the user must still type /link manually — components/settings/TelegramConnectCard.tsx:219
- Promised login-alert notification template does not exist: formatMessage kinds are price/whale/security/alert/sniper/copy/general with no 'login' kind, and login_activity is recorded at signin but never triggers a Telegram push — lib/telegram/notify.ts:20,33-48

**Missing backend:**
- No DELETE / unlink API endpoint under app/api/telegram — unlink is only possible by typing /unlink in the bot; the app UI cannot actually disconnect.
- No consumption of the Telegram /start deep-link payload (start=link_<code>) to auto-complete linking — the webhook start handler must parse cmd.args and run the link flow.
- No enforcement of telegram_paused in the outbound push path (notify.ts / notification-digest / notification-retry) so the kill switch cannot actually stop outbound spam.
- No login-alert / new-device Telegram template or trigger — login_activity is tracked (app/api/auth/signin/route.ts) but never fans out to Telegram despite being a named requirement.
- No self-healing of a broken webhook registration — diagnose can detect a mismatched/absent webhook but nothing re-registers it automatically (heartbeat only checks getMe, not getWebhookInfo).

**Missing frontend:**
- No /settings/notifications page exists even though the bot sends every unlinked user there to get a code; TelegramConnectCard is only mounted in components/ProfileTab.tsx (/dashboard/profile) and the dashboard home.
- TelegramConnectCard uses hardcoded flat-dark hex (#0F1320 / #1E2433 / Telegram-blue #229ED9) instead of the platform glassmorphism style — brand inconsistency (TelegramConnectCard.tsx:119-234).
- No unauthenticated state in the card: fetchStatus swallows errors silently (TelegramConnectCard.tsx:39-46) so a signed-out user sees a permanently 'Not connected' card with no sign-in prompt.
- No genuine loading/empty state for initial status fetch — status starts null and the unlinked block renders before the first GET resolves, so a linked user briefly sees the 'Generate Code' UI (flash of wrong state).

**Free-API recommendations:**
- Telegram Bot API is already the correct free primitive; no new provider needed. Fix the deep-link flow using the existing GET https://api.telegram.org/bot<token>/getWebhookInfo inside telegram-heartbeat to auto-repair via setWebhook when url mismatches or pending_update_count spikes.
- Consume the Telegram start payload: t.me/<bot>?start=<code> delivers '/start <code>' — parse cmd.args in the /start handler and reuse the /link logic to make the 'Open Bot' button one-tap link (no new API).
- Add a DELETE /api/telegram/link-code that deletes the user's row and (best-effort) calls sendMessage to confirm, so the app Disconnect button is real.
- For login alerts, reuse sendTelegramNotification with a new kind:'login' template fired from app/api/auth/signin/route.ts; still only Telegram Bot API (free).
- No paid API required anywhere in this feature.

**Trust Wallet fit:** Trust Wallet's developer ecosystem offers nothing useful for the telegram-integration feature. Bot messaging, account linking, retry queues and the kill switch are all served by the free Telegram Bot API + Supabase + Upstash. trustwallet/assets (token-logo registry), wallet-core (signing lib), and Trust Wallet deep links are wallet-side concerns with no bearing on notification delivery or bot command routing. The only tangential use — token logos inside /price or /chart message cards — is a market-data/rendering concern, not core Telegram, and CoinGecko/DexScreener image URLs already cover it. Recommendation: do not add Trust Wallet for this feature.

## trading-suite
**Verdict:** The backend order/tx endpoints are real and query real tables, but the "Trading Suite" surface itself is a redirect to /dashboard/market, the Orders hub renders almost entirely "—" because its column pickers and response-key normalization don't match the actual API shapes, and snipe transactions are mislabeled/mislinked as Ethereum.

- **P1** — Snipe transactions are labeled chain='ethereum' and linked to Etherscan even though sniper_executions is a Solana feature (amount_sol column) with no 'chain' column at all. e.chain is always undefined so line 114 falls back to 'ethereum'; the explorer link then builds https://etherscan.io/tx/<solana-signature> which is a dead link, and the row shows 'ETHEREUM'.  
  `app/dashboard/transactions/page.tsx:114,208-210 (chain: e.chain || 'ethereum') vs sniper_executions schema in supabase/migrations/*.sql (no chain column; has amount_sol)`
- **P1** — Order History tab on the Orders hub is always empty. order-history returns {rows} but the normalizer only checks orders/positions/history/rules/bots/data, never .rows, so it falls through to [].  
  `app/market/orders/page.tsx:47 vs app/api/trading/order-history/route.ts:134`
- **P1** — PortfolioHistoryPanel order-history tab is always empty for the same reason — normalizer checks positions/history/orders/data but not .rows.  
  `components/market/PortfolioHistoryPanel.tsx:48 vs order-history route returning {rows}`
- **P1** — Orders hub table columns reference field names that do not exist in the DB. Limit tab uses token_in/side/limit_price/amount_in_usd but limit_orders columns are from_token_symbol/to_token_symbol/trigger_direction/trigger_price_usd/from_amount, so Pair, Side, Price, Amount all render '—'. Stop tab uses rule_type/trigger_price_usd/amount_pct/active but stop_loss_orders has stop_loss_price_usd/take_profit_price_usd/position_amount and no 'active' column, so Active always shows 'No'. Positions Entry uses avg_entry_price_usd but the endpoint emits avg_entry_usd.  
  `app/market/orders/page.tsx:118-159 vs supabase/migrations/2026_session5b1_batch1.sql:9-33 (limit_orders) and stop_loss_orders block; app/api/trading/positions/route.ts:82`
- **P2** — Positions endpoint never populates live price or PnL — current_price_usd and pnl_usd are hardcoded null for every position; no price API is ever called. The Current/PnL columns are permanently empty.  
  `app/api/trading/positions/route.ts:83-85,105-107,112`
- **P2** — transactions page has no error UI: the catch only console.errors and sets loading=false, so a failed load renders the same 'No transactions yet' empty state as a genuinely empty account — indistinguishable from success.  
  `app/dashboard/transactions/page.tsx:124-128,175-180`

**Fake / unwired:**
- /api/trade/execute is a stub that returns {success:true, message:'Trade prepared - sign transaction in wallet'} without ever quoting, scanning, or executing anything — and it has zero frontend consumers (real swaps go through /api/market/trade/execute): app/api/trade/execute/route.ts:16-24
- /api/trade/quote is orphaned — zero frontend consumers; only referenced by its own route (getOptimalQuote): confirmed via grep, app/api/trade/quote/route.ts
- /api/trading-suite GET (CoinGecko trending/top/fear-greed/dexscreener aggregator) is dead code — no component fetches it; the trading-suite page is a redirect: app/api/trading-suite/route.ts (no consumers found)

**Missing backend:**
- Positions PnL pipeline is not built: positions/route.ts derives holdings only from dca_bots + stop_loss_orders (not actual wallet balances) and never fetches current price, so unrealized PnL can never be computed.
- sniper_executions has no chain column, so tx history cannot correctly attribute or link Solana snipes — needs a chain column written at execution time (or infer 'solana').
- No caching/rate-limit handling on the client-side transactions load; it fires two unbounded Supabase queries on every mount and refresh with no dedupe.

**Missing frontend:**
- transactions page: no distinct error state (errors collapse into the empty state) — page.tsx:124-128
- transactions page: unauthenticated users silently get an empty list with no sign-in prompt (setTxs([]) on no user) — page.tsx:75-78
- Orders hub (market/orders) has loading/error/empty states but no per-row explorer link or actions, and columns silently degrade to '—' rather than surfacing the mapping problem — page.tsx:114-190

**Free-API recommendations:**
- Positions live price + PnL: DexScreener GET https://api.dexscreener.com/latest/dex/tokens/{comma-separated-addresses} (free, no key) or GeckoTerminal GET https://api.geckoterminal.com/api/v2/simple/networks/{network}/token_price/{addresses} to fill current_price_usd, then compute pnl_usd = (current-avg_entry)*amount. Fallback chain: DexScreener -> GeckoTerminal -> CoinGecko /simple/token_price/{platform}.
- Solana explorer links: use Solscan (https://solscan.io/tx/) — already in EXPLORER_BASE — once the snipe chain is correctly set to 'solana'.
- No paid API needed anywhere in this feature; all order/tx data is Supabase-owned.

**Trust Wallet fit:** Trust Wallet offers nothing useful for order history or tx history — it has no trading, order, or transaction-history API. The only relevant asset is the trustwallet/assets logo registry, which could supply token icons for tx/order rows, but CoinGecko (t.image), DexScreener, and GeckoTerminal already provide logos in this codebase, so adding Trust Wallet assets would be redundant. Recommend not adopting it for this feature.

## vtx-agent
**Verdict:** The /dashboard/vtx-ai page is a genuinely working end-to-end AI agent (real tool pipeline, real price/swap cards, real CA resolution, correct current Anthropic API usage), but the dashboard-tab surface (VtxAiTab) silently discards the cards the server builds, the personality setting is dead everywhere, a client-controlled skipRateLimit flag lets anyone bypass the free-tier limit on the owner's Anthropic bill, and Claude usage/cost tracking does not exist at all.

- **P0** ✅ FIXED — Client-controlled rate-limit bypass: request body field skipRateLimit is trusted verbatim — any anonymous caller can POST {"skipRateLimit": true} to /api/vtx-ai and get unlimited free Claude (Sonnet 5 + Opus 4.8 advisor) on the owner's Anthropic bill. No legitimate caller anywhere in the repo sends this field.  
  `app/api/vtx-ai/route.ts:453,565,808,886`
- **P1** ✅ FIXED — Dashboard-tab surface (VtxAiTab, mounted at app/dashboard/page.tsx:430 for the vtxai nav) discards the server-built tokenCard and swapCard in BOTH the JSON branch and the streaming done handler — a pasted CA renders text-only and a 'swap 0.1 ETH for USDC' request renders no Swap Card, while the system prompt explicitly tells the model to say 'the UI will render an inline Swap Card' (route.ts:248). The tab's non-stream heuristic exists specifically 'so cards land correctly' yet the cards are never read.  
  `components/VtxAiTab.tsx:853-921 (reads only data.chart/reply/dailyUsage) and 787-843 (done handler ignores json.tokenCard/json.swapCard sent at route.ts:804); confirmed in docs/sessions/HANDOFF-2026-06-22-platform-audit-phase-b.md:158`
- **P1** ✅ FIXED — Personality setting is dead on every surface: both UIs send lowercase 'professional'|'degen'|'conservative'|'neutral' but the server allow-list is case-sensitive ['Neutral','Friendly','Analytical','Direct','Casual','Professional'] — no value either UI can send ever matches, so resolvedPersonality is always 'Neutral' and the Degen/Conservative/Professional selectors are no-ops.  
  `app/api/vtx-ai/route.ts:621-632 vs components/VtxAiTab.tsx:1035-1039 and app/dashboard/vtx-ai/page.tsx:1015-1024`
- **P1** ✅ FIXED — /api/vtx-ai/chat is publicly reachable with zero auth and zero rate limiting, runs the full Sonnet-5 tool loop (runVTXAgent/streamVTXAgent), and has no production caller — an open unlimited-cost endpoint.  
  `app/api/vtx-ai/chat/route.ts:20-89 (no auth/rate-limit); only references are docs (grep: docs/sessions/HANDOFF-2026-06-22-platform-audit-phase-b.md:204)`
- **P2** — Streaming responses never update the free-tier usage meter: the SSE done event carries no dailyUsage (and no suggestions), so the '25 left' counter and rateLimited state go stale until the next non-streamed message; server still increments the counter at route.ts:808.  
  `app/api/vtx-ai/route.ts:803-805 vs components/VtxAiTab.tsx:916-920 / app/dashboard/vtx-ai/page.tsx:816`
- **P2** — SuggestionPills in VtxAiTab can never render: the non-streaming JSON response has no suggestions field at all (response shape route.ts:909-925) and the streaming done event doesn't send one either, but the tab reads data.suggestions (VtxAiTab.tsx:908-912).  
  `app/api/vtx-ai/route.ts:909-925; components/VtxAiTab.tsx:908`
- **P2** — Model picker 'Deepest' does nothing: it maps to effort 'high', which is the Anthropic default when effort is omitted — so Deepest is identical to sending nothing, while Sonnet 5 supports 'xhigh' (the recommended setting for hard agentic work per current API docs).  
  `app/api/vtx-ai/route.ts:468-469; lib/services/anthropic.ts:352-354`
- **P2** — Dashboard vtx-ai page has no Stop/abort control and the textarea is disabled while loading — a long tool-loop reply (can run 30s+) locks the user out with no cancel; VtxAiTab has an AbortController + Stop button, the page does not.  
  `app/dashboard/vtx-ai/page.tsx (grep: zero Abort/stop matches; input disabled at :1400)`
- **P2** — Rate limiting is per-IP, not per-user: authenticated free users on shared NATs share one 25/day pool, and the in-memory Map fallback (used whenever Upstash is unconfigured/erroring) resets per serverless instance so limits silently vanish.  
  `app/api/vtx-ai/route.ts:31,58-90,536-537`
- **P2** — detectTokenAddress treats the first 40 hex chars of any 64-char tx hash as an EVM token address (regex 0x[a-fA-F0-9]{40} without boundary), so pasting a tx hash triggers a bogus token-card lookup.  
  `lib/ai/vtxToolExecutor.ts:45`

**Fake / unwired:**
- contract_analysis tool promises 'decode ABI, identify dangerous functions' (lib/services/anthropic.ts:209) but the executor only fetches bytecode LENGTH and asks the model to speculate — the prompt literally says 'actual bytecode not included for brevity... Focus on what can be inferred' — so the 'AI Assessment' shown to users is fabricated from an address and a KB count. lib/ai/vtxToolExecutor.ts:287-308
- 7d chart fallback in /api/vtx/token-card fabricates price history by multiplying the 24h change by 3 and 2 ('{ at: -7d, pct: changes.h24 * 3 }') — an invented series rendered as a real chart when Birdeye/CoinGecko have no data. app/api/vtx/token-card/route.ts:147-160
- VtxAiTab's 'Trusted/Caution/Risky' badge is a client-side made-up formula (100 minus penalties for >50% move and low liquidity), not GoPlus/Honeypot/RugCheck — a security verdict with no security data behind it. components/VtxAiTab.tsx:246-250,287-303
- 'AI' follow-up suggestions on /dashboard/vtx-ai are a hardcoded keyword-matched canned list (generateSuggestions), not model output. app/dashboard/vtx-ai/page.tsx:210-231
- VtxSettingsDrawer persists show_token_cards, show_swap_cards, response_style, default_chain, auto_trending_refresh to Supabase but nothing reads them — the chat request is built from the separate localStorage settings; only wallet_read_enabled is honored (route.ts:519-529). components/vtx/VtxSettingsDrawer.tsx:14-41
- VtxToolSidecar 'tool timeline' is reconstructed by inference from rendered cards ('when a token card appears we infer the underlying tool'), and pendingSwap is hardcoded null with a 'wired in by API once prepare_swap streams' comment — the sidecar shows guessed tool events, not the real toolsUsed the API already returns. app/dashboard/vtx-ai/page.tsx:853-904
- Loading spinner copy 'Searching Sargon Data Archive…' / 'Analyzing via Naka Intelligence…' brands third-party APIs (DexScreener/CoinGecko rebranded via scrubBranding, route.ts:1160-1199) as an in-house archive — deliberate white-labeling, flagging per no-fake-claims rule. components/VtxAiTab.tsx:1341, app/dashboard/vtx-ai/page.tsx:1346

**Missing backend:**
- Claude API usage/cost tracking does not exist: response.usage (input_tokens/output_tokens/cache_read_input_tokens) is never read anywhere in app/ or lib/ (grep: zero matches) — no per-request token log, no per-user cost attribution, no dashboard, despite the owner paying for Anthropic. Prompt caching is implemented but its effectiveness is unverifiable without capturing usage.
- No suggestions generation server-side (route never returns a suggestions field), forcing the hardcoded client fallback.
- Streaming done event omits dailyUsage/chart fields the clients expect (route.ts:804).
- Per-user (not per-IP) rate limiting for authenticated callers; durable fallback when Redis is down (current fallback is a per-lambda Map).
- No graceful degradation when the pre-flight market fetch chain fails: Binance (route.ts:342-365) is geo-blocked (HTTP 451) from US Vercel regions, so the primary market-context source likely never works in production and every request eats a failed fetch before the CoinGecko fallback.
- Four data sources violate the locked free-API matrix: Birdeye (BIRDEYE_API_KEY, lib/services/birdeye.ts:5; used by /api/vtx/token-card:183), Arkham (ARKHAM_API_KEY, paid/invite API, lib/arkham/api.ts:14; powers entity_lookup + wallet_profile), Binance ticker, and Etherscan gas oracle (ETHERSCAN_API_KEY, route.ts:408) — when their keys are absent these tools silently degrade to 'Unknown'/empty.
- No moderation/abuse guard on the open /api/vtx-ai/chat endpoint (or deletion of it).

**Missing frontend:**
- VtxAiTab: no token-card, swap-card, or suggestion rendering (server builds all three); its price display falls back to a client-side DexScreener symbol search that can surface wash-traded clone pairs — the exact failure buildResponseCards was written to prevent (VtxAiTab.tsx:229-243).
- No markdown rendering on either surface — bold/headers/bullets are regex-stripped to plain text (VtxAiTab.tsx:1252-1265, page.tsx:834-851); tables and code blocks from the model render as mush.
- No Stop/cancel on /dashboard/vtx-ai; input disabled during generation (page.tsx:1400).
- No retry affordance on error bubbles ('Error: ...' is a dead-end message on both surfaces).
- WCAG AAA contrast fails throughout: ~30 instances each of text-gray-500/600 (3.2-3.8:1) on near-black at 9-11px (e.g. VtxAiTab.tsx:326 'text-[9px] text-gray-600', page.tsx stat labels) — fails even AA for normal text.
- Usage meter and rateLimited banner go stale after streamed replies (no dailyUsage in the done event).
- Unauthenticated state is invisible: anonymous users get the same UI but prepare_swap/conversation-sync silently fail; no sign-in prompt in the chat surface.

**Free-API recommendations:**
- Replace Birdeye OHLCV with GeckoTerminal (in matrix, free, no key): GET https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool}/ohlcv/{timeframe} (pool from the DexScreener pair you already have); holder counts via GoPlus token_security 'holder_count' field (already fetched) or Helius getTokenAccounts for Solana.
- Replace Arkham entity_lookup/address intel with the matrix stack: Sim by Dune wallet API (https://api.sim.dune.com/v1/evm/balances/{address} and activity endpoints) for holdings/activity, GoPlus address_security (already integrated) for scam/blacklist labels; return honest 'no entity label' instead of a fabricated Unknown card.
- Drop Binance pre-flight (geo-blocked 451 on US Vercel) and make CoinGecko /api/v3/coins/markets?vs_currency=usd&per_page=20 the primary, DexScreener /latest/dex/tokens as per-token fallback — both already wrapped in lib/services.
- Replace Etherscan gas oracle with the Alchemy RPC you already pay nothing for: eth_gasPrice + eth_feeHistory via lib/services/alchemy (no new key).
- Add Claude cost tracking with zero new APIs: read message.usage / stream.finalMessage().usage in vtxQuery/vtxStreamRaw and insert {user_id, model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, tools_used} into a Supabase ai_usage table; price at Sonnet 5 $3/$15 per MTok ($2/$10 intro through 2026-08-31) and Opus 4.8 advisor $5/$25.
- Map the 'Deepest' picker to output_config.effort 'xhigh' (supported on claude-sonnet-5; 'high' is already the default so the current mapping is a no-op).
- Fear & Greed: keep alternative.me /fng/ (free, keyless) but add it to the owner's approved matrix explicitly, or drop the line from the prompt.
- Token logos fallback chain: DexScreener dd.dexscreener.com CDN (current) → CoinGecko image URL (current) → raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png → symbol initial.

**Trust Wallet fit:** Trust Wallet offers exactly one thing useful to this feature: the trustwallet/assets GitHub registry as a free, keyless token-logo fallback (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{address}/logo.png) to slot behind the DexScreener CDN and CoinGecko image URLs already used in buildResponseCards (route.ts:1026-1029) and the hardcoded LOGO map in SwapCard.tsx:56-72 — note it needs EIP-55 checksummed addresses and has patchy long-tail/Solana coverage, so it's a fallback, not a primary. Everything else is a poor fit: wallet-core is a C++/mobile key-management library irrelevant to a Next.js server agent; Trust Wallet deep links (link.trustwallet.com/swap) would hand the swap to a competing wallet instead of the platform's own SwapCard signer; and Trust Wallet has no developer API for prices, security scans, or entity data. The existing free stack (DexScreener/GeckoTerminal/CoinGecko + GoPlus + Jupiter/0x) already covers this feature better.

## wallet-clusters-graph
**Verdict:** The cluster + graph pipeline is genuinely real end-to-end (real 5-detector sybil algorithms, six-hourly cron persisting to wallet_clusters, real label-propagation community detection + OFAC/Tornado overlays on the fund-flow graph, no mock data), but it leaks value at the edges: the orchestrator burns Claude tokens generating AI names/narratives/risk scores that the schema can't store and the UI never shows, the "Analyze wallet" box hardcodes chain=ethereum so Solana addresses always fail, Member-Count sort is a no-op, Network Metrics ships hardcoded TPS/gas/health strings, and a whole duplicate /api/wallet-clusters route is dead and queries columns that don't exist.

- **P1** — Analyze-any-wallet box hardcodes chain:'ethereum' in the POST body, but the input placeholder invites '0x… or Solana address'. A pasted Solana wallet queries whale_activity WHERE chain='ethereum', matches nothing, and always returns 'Insufficient on-chain activity'. Solana analysis is impossible from this UI.  
  `app/dashboard/wallet-clusters/page.tsx:107 (chain:'ethereum') vs placeholder page.tsx:249; consumed at app/api/clusters/analyze/route.ts:25,34-39`
- **P1** — Orchestrator computes ai_name, ai_narrative (Claude Haiku call), risk_score, edge_count, hub, confidence, total_value_usd, first/last_seen for every cron-built cluster, but persistClusters only writes cluster_id, token_address, behavior_type, whale_score — the wallet_clusters table has no columns for the rest. All AI narrative/risk work on the cron path is discarded; directory cards + detail page can never show the Claude-generated name or risk_score. Real Claude spend (logged to claude_api_usage with cost) produces output that is thrown away.  
  `lib/clusters/orchestrator.ts:318 generateNarrative + 384-393 persistClusters (only 4 columns); table def full_schema.sql:419-427; detail page ClusterMeta has no ai_name/risk_score cluster/[id]/page.tsx:32-33`
- **P2** — 'Member Count' sort in the directory is a no-op. The ORDER map routes sort='members' (and 'risk_score') to the whale_score column with a comment 'members lives off-table; apply post-query' — but no post-query sort is ever applied. Selecting Member Count silently sorts by whale score.  
  `app/api/clusters/route.ts:15-17 (ORDER.members -> col:'whale_score'); UI option app/dashboard/wallet-clusters/page.tsx:201`
- **P1** — Network Metrics ships hardcoded/fake data: Ethereum TPS is the string '15' (never fetched), Solana gas is the string '0.00025 SOL' (never fetched), and Base/Arbitrum/Polygon TPS and Latest Block are hardcoded '—' even though the Alchemy RPCs for those chains are already configured — only gas is actually fetched for L2s. Violates NO-mock-data rule while the page labels the source 'Alchemy RPC (Live)'.  
  `app/api/network-metrics/route.ts:55 tps:'15', :56 gas:'0.00025 SOL', :57-59 tps:'—'/blocks:'—'`
- **P2** — Network Metrics page shows 'Network Healthy' pulse and 'Network Health: Excellent' as static strings regardless of whether any RPC call succeeded or the chain is congested. Fake status indicator.  
  `app/dashboard/network-metrics/page.tsx:62-64 (Network Healthy), :96-98 (Excellent)`
- **P2** — Dead + schema-broken duplicate route /api/wallet-clusters. It has ZERO callers (the page uses /api/clusters). Its GET cache query selects columns 'name, member_count, coordination_score, risk_level, signals, detected_at' and reads wallet_cluster_members.wallet_address — none of these columns exist (real table has behavior_type/whale_score; members col is 'address'). The Supabase error is swallowed, so it silently always falls through to expensive live detection. Whole file (plus its v2 lib/services/cluster-detection.ts + lib/jobs/cluster-detection.ts) is an abandoned parallel system.  
  `app/api/wallet-clusters/route.ts:90-91 (nonexistent cols), :97 (wallet_address); real schema full_schema.sql:419-427,434-439; no callers found via grep of app/lib/components`

**Fake / unwired:**
- Ethereum TPS is the literal string '15', never derived from chain data — app/api/network-metrics/route.ts:55
- Solana gas is the literal string '0.00025 SOL', never fetched — app/api/network-metrics/route.ts:56
- Base/Arbitrum/Polygon TPS and Latest Block hardcoded '—', never fetched despite RPCs being configured — app/api/network-metrics/route.ts:57-59
- 'Network Health: Excellent' and 'Network Healthy' are static, not computed from any RPC health signal — app/dashboard/network-metrics/page.tsx:62-64,96-98
- AI-generated risk_score / ai_name / ai_narrative are computed by the orchestrator but not persisted, so the directory + detail views never surface them for cron-built clusters — lib/clusters/orchestrator.ts:384-393
- Stat tile 'Detection signals' = hardcoded '5' string (this one is defensible — there really are 5 detectors) — app/dashboard/wallet-clusters/page.tsx:295

**Missing backend:**
- wallet_clusters table cannot store the orchestrator's richest outputs (ai_name, ai_narrative, risk_score, member_count, edge_count, hub, confidence, total_value_usd, first/last_seen). Add these columns or a wallet_cluster_meta table so the directory/detail can show what the pipeline already computes (and stop discarding paid Claude output).
- Network Metrics has no real TPS pipeline for EVM chains and no block-height fetch for Base/Arbitrum/Polygon, despite the RPCs being configured — the data simply isn't gathered.
- No last-good cache for network-graph or network-metrics: if Alchemy/DexScreener fail, the graph goes fully empty and metrics go to '—' with no stale-while-error fallback beyond the CDN s-maxage header.
- Community label ('community_label') only appears if a cluster_labels row is 'approved'; there is no automatic seeding of labels from the AI narrative, so freshly cron-built clusters show only the generic archetype label.

**Missing frontend:**
- /api/clusters, /api/clusters/by-id, /api/clusters/analyze are all withTierGate('pro'). A free/unauthenticated user gets 401/403 which the directory renders as raw 'HTTP 403' error text (page.tsx:85,300) — no branded upgrade/paywall or sign-in prompt state.
- Network Metrics has no visible error state: the fetch catch is empty and failures leave every field at '—' with the header still claiming 'Alchemy RPC (Live)' and 'Live' status — user cannot tell a dead RPC from a healthy chain (network-metrics/page.tsx:27-29,72).
- Directory analyze result: when a Solana address is pasted it always shows the generic 'Insufficient activity' note with no hint that Solana isn't supported by this box (see chain hardcode P1).
- Cluster detail: 'Graph unavailable — no edges persisted yet' is shown whenever edges array is empty (cluster/[id]/page.tsx:197) — reasonable, but no loading skeleton for the edge graph specifically while the by-id pagination fetch runs.
- Network Graph node x/y seeded with Math.random (page.tsx:211-212) — legitimate force-layout init, not fake data; but there is no deterministic re-layout, so the same wallet renders a different-looking graph each mount.

**Free-API recommendations:**
- Network Metrics EVM blocks: call eth_blockNumber on the already-configured Base/Arb/Polygon Alchemy RPCs (free) — the code already builds baseRpc/arbRpc/polyRpc but only queries gas. One extra eth_blockNumber per chain fills 'Latest Block'.
- Network Metrics real TPS: fetch latest eth_getBlockByNumber(latest,false) tx count and divide by ~12s block time (EVM) — free via Alchemy. For Solana keep the real getRecentPerformanceSamples path already present; drop the hardcoded ETH '15'.
- Network Metrics health: derive 'health' from whether the RPC responded + gas percentile vs a rolling window rather than a static 'Excellent'.
- Node entity labels: the graph currently uses Arkham (getEntityLabel, gated behind ARKHAM_API_KEY) which is a PAID API not on the owner allowlist — replace with free alternatives: GoPlus address_security / Sim-by-Dune wallet labels, or Dune SQL entity tables, keeping OFAC (Chainalysis free list) and Tornado which are already correct and free.
- Token nodes/token_focus logos: DexScreener token-profiles or GeckoTerminal /networks/{network}/tokens/{address} (both free, already in the allowlist) for token metadata + logo.
- Fallback chain for network-graph: Alchemy fund-flow -> DexScreener liquidity (already) -> Sim by Dune activity feed as a third source before the empty state.

**Trust Wallet fit:** Nothing in the Trust Wallet developer ecosystem helps the core of this feature. Trust Wallet offers no graph, cluster, sybil, or onchain-analytics API; wallet-core is a signing/address library and deep links are for launching the wallet — neither is relevant to server-side cluster detection or fund-flow graphing. The only marginal fit is trustwallet/assets (the GitHub token-logo registry) to decorate token nodes in the liquidity graph and the token_focus field, but that is purely cosmetic and DexScreener/GeckoTerminal (already free and in use) already supply token logos plus price/volume metadata the registry lacks. Recommendation: do not add Trust Wallet for this feature.

## wallet-intelligence
**Verdict:** The primary search flow (page.tsx → /api/wallet-intelligence) is genuinely real end-to-end with live on-chain data, but the whale-detail tabs are half stubs, the shadow-guardian deep-link into this page is dead, and the feature leans on four off-matrix paid APIs (Zerion, Birdeye, Bitquery, Arkham) that violate the free-tier cost rule.

- **P1** — Deep-link into the main page is dead: page.tsx never reads the ?address= query param (no useSearchParams anywhere). Shadow Guardian's 'Full alpha report' link and the header cross-link both pass ?address=, so the user lands on an empty search box and must re-type the address.  
  `app/dashboard/security/wallet-analysis/page.tsx:110 builds href=/dashboard/wallet-intelligence?address=... ; app/dashboard/wallet-intelligence/page.tsx has no useSearchParams (only useNavState at :554)`
- **P1** — Off-matrix paid APIs power core data: Zerion (EVM fallback fetch), Birdeye (Solana price secondary), Bitquery (sole source of Realized PnL), Arkham (whale entity labels). None are in the owner's locked free-tier matrix; owner pays only Anthropic+Vercel.  
  `lib/services/evm-intelligence.ts:6,397 (ZERION_API_KEY); lib/services/solana-intelligence.ts:11,247 (Birdeye); lib/walletIntel/walletPnl.ts:5-6,20 (Bitquery); app/api/whales/[address]/route.ts:31-48 (ARKHAM_API_KEY)`
- **P2** — Alpha report inserts a brand-new wallet_alpha_reports row on every Redis cache miss (hourly per address) with no upsert/dedupe — unbounded table growth.  
  `app/api/wallet-intelligence/[address]/alpha-report/route.ts:125-137 (admin.insert inside cacheWithFallback, TTL 3600)`
- **P2** — Solana recent-tx value is amountRaw (raw base units, not decimal-adjusted) but rendered as a plain number in Recent Transactions, producing misleading huge figures.  
  `app/api/wallet-intelligence/route.ts:218 (value: String(tx.amountRaw)); rendered page.tsx:219-226`
- **P2** — Redis alpha cache key is global (wallet:alpha:${address}) so one user's generated report is served to any other user hitting the same address, undercutting the owner-only SELECT RLS added in 2026_05_24_wallet_alpha_reports_select_own.sql.  
  `app/api/wallet-intelligence/[address]/alpha-report/route.ts:63`

**Fake / unwired:**
- Holdings tab on whale detail is a coming-soon stub behind a real-looking tab: 'Token holdings surface once the on-chain indexer ships in Session 5B-2.' — components/intelligence/WalletIntelligenceTabs.tsx:200-202
- Counterparties tab has no data, only a link out to clusters — components/intelligence/WalletIntelligenceTabs.tsx:205-211
- Performance tab '7d PnL' is hardcoded to '—', never computed — components/intelligence/WalletIntelligenceTabs.tsx:216
- Clusters tab is purely a navigation link, no in-tab content — components/intelligence/WalletIntelligenceTabs.tsx:225-235
- Net effect: 4 of 6 whale-detail tabs (holdings, counterparties, performance-partial, clusters) are stubs while presented as first-class tabs — components/intelligence/WalletIntelligenceTabs.tsx:128-139

**Missing backend:**
- Holdings + counterparties indexer for the whale-detail tabs is explicitly not built (deferred to 'Session 5B-2') — the tabs are hardcoded to say so
- 7d PnL is never computed anywhere in the whale pipeline
- Realized PnL has no fallback source when Bitquery is disabled — buildWalletRealizedPnl returns null and the whole card silently disappears (walletPnl.ts:20)
- No alternate price source path documented if DexScreener AND Birdeye both miss for a Solana token (falls to null 'No price', acceptable but no third fallback)
- Token logos rely on a hardcoded KNOWN_TOKEN_LOGOS map + DexScreener/Helius images; no registry fallback for the long tail of tokens

**Missing frontend:**
- Whale-detail: when the address isn't in the whales table it shows a single grey line 'Wallet not tracked. Submit it via the whale tracker.' with no link/CTA and no way to reach the alpha-report generator — WalletIntelligenceTabs.tsx:105-107
- Alpha report generation is entirely gated behind the wallet already being a tracked whale (generate button only in overview, which only renders when whale!=null) — arbitrary wallets can never generate one
- Whale-detail loading state is a bare 16px spinner, no skeleton for the stat grid/tabs — WalletIntelligenceTabs.tsx:98-104
- Main page has no distinct empty state for a valid wallet that returns zero holdings/zero tx (only inline 'No holdings found' / 'No recent transactions')
- No unauthenticated state on the main page — the /api/whales and alpha-report endpoints 401, but the client tabs/report just silently fail (toast) with no sign-in prompt

**Free-API recommendations:**
- Replace Bitquery (PnL) — off-matrix. Use Dune Sim 'Activity'/'Transactions' API (sim.dune.com/v1/evm/transactions/{address}) or Dune SQL for DEX-trade PnL; both are in the allowed matrix. For Solana trades, Helius Enhanced Transactions API (api.helius.xyz/v0/addresses/{addr}/transactions?type=SWAP) gives parsed swaps free.
- Replace Birdeye (Solana price) — off-matrix. Jupiter Price API (lite-api.jup.ag/price/v2?ids=<mint>) is free and in the matrix; keep DexScreener (api.dexscreener.com/latest/dex/tokens/{mint}) as primary and GeckoTerminal (api.geckoterminal.com/api/v2/networks/solana/tokens/{mint}) as third fallback.
- Replace Zerion (EVM fallback) — off-matrix. Alchemy is already primary; for a true second source use Alchemy Portfolio API (getTokenBalances + getTokenMetadata + alchemy_getTokenPrices) rather than a paid multi-chain provider.
- Replace Arkham (entity labels) — off-matrix. The repo already has an EVM entity registry (lib/clusters/entityRegistry) and can enrich with GoPlus address-security labels; for CEX/bridge tagging use the free public label sets (etherscan public tags / community CSVs) baked into the registry.
- Token logos long-tail fallback: trustwallet/assets raw CDN — https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{ethereum|smartchain|polygon|solana}/assets/{checksumAddress}/logo.png — free, no key, ideal chain to append after DexScreener/CoinGecko before the letter-avatar fallback.
- Fallback chain design (EVM holdings): Alchemy getTokenBalances → prices DexScreener → CoinGecko → logos: token source logo → trustwallet/assets → letter avatar. (Solana holdings): Alchemy-Solana balances → Helius metadata → DexScreener price/logo → Jupiter price → trustwallet/assets logo.

**Trust Wallet fit:** Partial, logos only. The one genuine fit is the trustwallet/assets GitHub token-logo registry (raw CDN, free, keyed by chain+checksum contract) as a fallback for the long tail of token logos this feature currently misses — it hardcodes a KNOWN_TOKEN_LOGOS map plus DexScreener/Helius images and falls back to a letter avatar (solana-intelligence.ts, evm-intelligence KNOWN_TOKEN_LOGOS). wallet-core (a signing/keying library) and Trust Wallet deep links are irrelevant to a read-only analytics feature, and Trust Wallet does not offer any wallet-analytics/balances/PnL data API, so nothing there fills the real gaps (PnL, holdings indexer, entity labels). Use the logo CDN; ignore the rest.

## whale-tracker
**Verdict:** The whale tracker is a genuinely wired Supabase-backed system (feed, watchlist, alerts, profiles all hit real tables), but its two most important promises — feed freshness and PnL accuracy — quietly depend on non-matrix paid APIs (Arkham, Bitquery, Birdeye) and degrade to stale/zeroed data without them, while a handful of controls (timeframe pill, SSE endpoint, submit prefill) are decorative.

- **P0** — Feed freshness: whale_activity ingestion runs in the half-hourly dispatch group at only 14 whales/tick via Alchemy (≈672 whale-polls/day over a 500+ row directory ⇒ a given whale is re-polled roughly every 18h), while the UI empty state claims 'The background poll populates this feed every minute'. The faster Bitquery ingest (24 whales/tick) no-ops without BITQUERY_API_KEY.  
  `app/api/cron/dispatch/[group]/route.ts:34 (half-hourly), app/api/cron/whale-activity-poll/route.ts:31 (WHALES_PER_TICK=14), app/dashboard/whale-tracker/page.tsx:577-579 (false 'every minute' claim), app/api/cron/bitquery-activity-poll/route.ts:47-50 (key gate)`
- **P0** — PnL accuracy: whale-backfill-pnl cannot distinguish 'Arkham API failed/key missing' from 'whale had no transfers' — getAddressTransfers errors are swallowed to [], and the cron then writes pnl_30d_usd=0, win_rate=null, and last_active_at=NULL over real values and stamps metrics_refreshed_at so the corruption persists 24h+. With no ARKHAM_API_KEY every whale gets zeroed.  
  `app/api/cron/whale-backfill-pnl/route.ts:189 (.catch(() => [])), :313-320 (unconditional overwrite incl. last_active_at: metrics.last_active_at which is null on empty transfers)`
- **P1** — whales.whale_score has two competing writers with different formulas in the same six-hourly group: whale-score-populator's populate_whale_score RPC (volume/recency from whale_activity) and whale-backfill-pnl's computeWhaleScore (win-rate/PnL/portfolio) — scores oscillate between two definitions every run and directory ranking is unstable.  
  `app/api/cron/dispatch/[group]/route.ts:47 (both in six-hourly), app/api/cron/whale-score-populator/route.ts:18, app/api/cron/whale-backfill-pnl/route.ts:155-170,325 and supabase/migrations/2026_06_22_populate_whale_score_target_whales.sql:29-46`
- **P1** — Watch-star toggles on LiveTradersGrid, copy-trade, and directory never check res.ok and have no tier gate: for a mini-tier user the POST 403s (watchlist is pro-gated) but fetch resolves, so the optimistic star stays lit and the follow is silently never saved (rollback only fires on network throw).  
  `components/whales/LiveTradersGrid.tsx:65-73, app/dashboard/whale-tracker/copy-trade/page.tsx:64-72, app/dashboard/whale-tracker/directory/page.tsx:252-278 vs pro gate at app/api/whale-tracker/watchlist/route.ts:87`
- **P1** — Default 'Traders' view ranks by volume_7d_usd/active_days_7d, columns populated ONLY by the Bitquery-gated bitquery-traders cron; without the key the flagship default view sorts nulls and every card shows n/a volume, and isCopyTradeable (active_days_7d >= 4) marks every whale un-copy-tradeable.  
  `app/dashboard/whale-tracker/page.tsx:134 (default feedView='traders'), components/whales/LiveTradersGrid.tsx:31 (sort=volume), app/api/cron/bitquery-traders/route.ts:24-27 (key gate; sole writer of volume_7d_usd per grep), components/whales/TraderCard.tsx:34-37`
- **P1** — Legacy /api/whale-tracker route (Birdeye + raw Alchemy scan) is still live and polled every ~5 min by the dashboard-wide PlatformEventMonitor for every user; it uses a hardcoded $2500 ETH last-resort price and hardcodes BSC rows to tier 'MID' with zero data; free users just burn a 403 per tick.  
  `components/PlatformEventMonitor.tsx:103, app/api/whale-tracker/route.ts:18 (2500 fallback), :364-386 (BSC tier 'MID' hardcode, whaleScore 0), :477 (mini gate)`
- **P2** — Swap rows vanish under the action filter: the poll writes action='swap' for base↔base pairs, the card renders them as 'transfer' via canonicalAction, but dbActionsForCanonical('transfer') queries only transfer/transfer_in/transfer_out — so a visible row disappears when the user selects the Transfer filter.  
  `app/api/cron/whale-activity-poll/route.ts:164 (action='swap'), lib/whales/labels.ts:79-96 (canonicalAction vs dbActionsForCanonical mismatch)`
- **P2** — Feed cards can never show the authoritative stored archetype badge: deriveBadges prefers w.archetype but the feed enrichment select omits the archetype column, so feed rows always fall back to the heuristic even after the backfill cron computed the real archetype.  
  `app/dashboard/whale-tracker/page.tsx:1028-1035 vs app/api/whale-tracker/feed/route.ts:147 (select lacks archetype)`
- **P2** — Submit-whale prefill deep-link is dead: the profile's 'Submit this whale' link passes ?address=&chain= but the submit page never reads searchParams, so the user re-types the address.  
  `app/dashboard/whale-tracker/[address]/page.tsx:309 vs app/dashboard/whale-tracker/submit/page.tsx:11-20 (no useSearchParams)`
- **P2** — Tier copy inconsistencies: the paywall header badge says 'PRO' for a mini-gated feature, and the feed 402/403 error message says 'Upgrade to Pro or higher' though the feed gate is mini.  
  `app/dashboard/whale-tracker/page.tsx:349-351, :199 vs app/api/whale-tracker/feed/route.ts:66 (withTierGate('mini'))`
- **P2** — PnL Leaderboard shows Arkham-failure zeros as real entries: it filters only pnl_30d_usd !== null, so the 0-PnL rows written by the failure path render as '+$0' leaders.  
  `app/dashboard/whale-tracker/page.tsx:1108 (filter excludes only null, not zero-with-zero-trades)`

**Fake / unwired:**
- Directory 'Timeframe' pill (24h/7d/30d/All) is decoration: the page sends a timeframe param (app/dashboard/whale-tracker/directory/page.tsx:110-115, :218) that /api/whales/directory never reads (app/api/whales/directory/route.ts:35-47 has no timeframe handling) — all metrics are 30d regardless.
- SSE endpoint /api/whale-tracker/feed/events has ZERO client consumers — the page uses Supabase Realtime + 30s polling instead; the only EventSource usages in the repo are for context-feed (app/api/whale-tracker/feed/events/route.ts entire file; grep shows no client). Dead code answering the owner's 'SSE vs polling' question: SSE was built and never wired.
- Fabricated timestamps on the whale profile live-activity fallback: every live EVM row gets timestamp: new Date().toISOString(), so the Activity 'When' column shows all rows as 'just now' regardless of real block time (app/api/whales/[address]/route.ts:78).
- Synthetic whale_score seeds presented as real ranking data: whale-discovery hardcodes whale_score: 70 (app/api/cron/whale-discovery/route.ts:128) and bitquery-traders assigns 70-90 by list position (app/api/cron/bitquery-traders/route.ts:69-70) — these drive the directory's default score sort until/unless the backfill overwrites them.
- False freshness claim in the feed empty state: 'The background poll populates this feed every minute' (app/dashboard/whale-tracker/page.tsx:577-579) — actual cadence is a half-hourly dispatcher rotating 14 whales/tick.
- Hardcoded $2500 ETH last-resort price in the legacy route (app/api/whale-tracker/route.ts:18).
- Internal jargon leaked to users as empty-state copy: 'The Bitquery discovery cron ranks traders by volume as it populates' (components/whales/LiveTradersGrid.tsx:102) and 'Active traders appear here as the discovery cron populates volume' (app/dashboard/whale-tracker/copy-trade/page.tsx:116).

**Missing backend:**
- No free-matrix PnL source: the entire pnl_30d/win_rate/avg_hold_hours/archetype pipeline rides Arkham (ARKHAM_API_KEY, paid/invite API — lib/arkham/api.ts:14, whale-backfill-pnl:182-207); no fallback exists, so PnL is either Arkham or zeros.
- No fallback for 7d volume/active-days metrics when Bitquery is absent (bitquery-traders is the sole writer of volume_7d_usd/active_days_7d); an Alchemy-based aggregation from whale_activity is never computed.
- No push-based EVM ingestion for followed whales: app/api/webhooks/alchemy-whale/route.ts exists but nothing registers followed whales with Alchemy Address Activity webhooks, so even followed whales wait for the 30-min rotation (alerts dispatcher runs every 2 min against data that arrives every 30+).
- No error/rate-limit differentiation in the backfill cron (API failure == empty wallet), and no retry/backoff ledger — a whale zeroed by a transient failure is not revisited for 24h (whale-backfill-pnl:279-286).
- No on-demand ingest: opening a whale profile shows a live Alchemy/Helius fallback that is never persisted to whale_activity, so the same data is re-fetched every visit and never enriches the feed (app/api/whales/[address]/route.ts:186-199).
- top-today recomputes by scanning ALL 24h whale_activity rows into memory on every cache miss with no row limit (app/api/whale-tracker/top-today/route.ts:29-45) — fine today, unbounded as ingest scales.

**Missing frontend:**
- WCAG AAA contrast failures throughout: 10-11px text-slate-500 (#64748b, ~4.6:1) and text-slate-600 (#475569, ~2.9:1 — fails even AA) on near-black backgrounds (app/dashboard/whale-tracker/page.tsx:577-579, :531, TraderCard metric labels); 8px badge text is below any legibility floor (page.tsx:1062 text-[8px]).
- No data-freshness indicator anywhere: the feed/Top Today/PnL panels never say when data was last ingested, which makes the 30-min ingest cadence read as 'broken' rather than 'stale'.
- Watch/bell buttons on feed cards and panels lack aria-pressed state (only title attr), unlike the label pills which do set aria-pressed (page.tsx:807-821 vs :515).
- PnL Leaderboard and Top Today panels have no retry affordance on error (PnlLeaderboardPanel shows a static error string, page.tsx:1126-1128; loadTopToday fails silently, page.tsx:223-232).
- Directory page uses its own initials-avatar (directory/page.tsx:172-184) while the rest of the tracker uses the shared WhaleAvatar with resolved logos — brand inconsistency across surfaces.
- Chain filter on the Traders view only honors the FIRST selected chain (LiveTradersGrid receives selectedChains[0], page.tsx:494) while the Activity view supports multi-chain — silent behavior divergence between the two views of the same pills.

**Free-API recommendations:**
- Replace Arkham with Sim by Dune (matrix-approved) for the PnL pipeline: GET https://api.sim.dune.com/v1/evm/activity/{address} (transfers with USD values for FIFO PnL), GET https://api.sim.dune.com/v1/evm/balances/{address} (portfolio_value_usd), and the SVM beta endpoints for Solana. Fallback chain: Sim -> Alchemy alchemy_getAssetTransfers (already wired) + GeckoTerminal historical OHLCV for pricing -> mark metrics 'stale', never write zeros.
- Feed freshness without paying: register followed + top-N whales with Alchemy Address Activity webhooks (free on all Alchemy plans) pointed at the existing app/api/webhooks/alchemy-whale route, keeping the 30-min poll as backstop for the long tail; Solana already has the Helius webhook (app/api/webhooks/helius-whale).
- Replace the Birdeye Solana top-traders source in /api/whale-tracker with the platform's own whales table (or point PlatformEventMonitor at /api/whale-tracker/top-today and delete the legacy route); for Solana trader stats use Dune's free tier (query on dex_solana.trades, refreshed via the existing dune-refresh cron).
- Token price fallback chain fully in-matrix: GeckoTerminal /api/v2/simple/networks/{network}/token_price/{addrs} (already primary, keyless) -> DexScreener https://api.dexscreener.com/latest/dex/tokens/{address} (free, keyless) -> CoinGecko /simple/price for natives; drop the Birdeye fallback in lib/whales/priceActivity.ts.
- Compute volume_7d_usd/active_days_7d from your own whale_activity table with a nightly SQL rollup (zero external cost) instead of depending on Bitquery; keep Bitquery-only code paths behind the existing key gate as optional enhancement.
- For real timestamps in the profile live fallback, use the blockTimestamp already returned by alchemy_getAssetTransfers withMetadata (the poll cron uses it at whale-activity-poll:151) instead of new Date() — zero extra API calls.

**Trust Wallet fit:** Almost nothing in the Trust Wallet developer ecosystem helps whale tracking. trustwallet/assets is a token-LOGO registry (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png) — it could serve as one more free fallback for token logos in the feed rows and Holdings table, but GeckoTerminal/DexScreener/CoinGecko already return logos and the platform already has a working Arkham→ENS→Dicebear avatar chain (components/whales/WhaleAvatar.tsx), so the gain is marginal. Trust Wallet offers NO wallet-address labeling, NO whale/transaction activity API, and NO PnL data — the actual gaps here. wallet-core is a signing library and deep links only open the Trust Wallet app, both irrelevant to tracking. The better free answers for this feature's real gaps are Sim by Dune (activity + balances, replaces Arkham), Dune SQL (PnL leaderboards), and Alchemy Address Activity webhooks (feed freshness) — all already in the owner's locked matrix.

**Back-button offenders:**
- app/dashboard/whale-tracker/page.tsx:347 — <BackButton href="/dashboard" compact /> forces router.push('/dashboard') (BackButton.tsx:21-24 skips history when href is set), even when the user arrived from another dashboard page.
- app/dashboard/whale-tracker/page.tsx:386 — same hardcoded href="/dashboard" on the main feed header back button.
