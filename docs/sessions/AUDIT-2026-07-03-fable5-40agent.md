# Platform Audit — Fable 5 · 40-agent fleet · 2026-07-03

> Wave 1: 9/40 features audited (session-limit interruptions; remainder auto-resumes 16:55 UTC).
> Every claim below carries file:line evidence gathered by a dedicated read-only auditor.

## swap
**Verdict:** The backend (0x v2 + Jupiter + GoPlus) is largely real, but the swap page's primary quote display is dead from a client/server schema mismatch, Solana signing throws on every attempt, and the multi-aggregator route comparison + MEV toggle are unwired decoration over real-looking UI.

### Broken
- **P0** — Main swap page quote pipeline is dead: client checks data.buyAmount and reads data.estimatedPriceImpact / data.gas, but /api/swap/price was refactored to return toAmount (human) / priceImpactPct / no gas — the condition is never true, so 'You receive' never populates, quoteData stays null, and the details panel, order-routing panel, USD readouts, and MEV pill never render  
  `app/dashboard/swap/page.tsx:789-804 vs app/api/swap/price/route.ts:116-131 (EVM) and 78-94 (Solana) — no buyAmount key in either response`
- **P0** — Solana swap execution throws on every attempt: Jupiter buildSwapTransaction does not set asLegacyTransaction, so it returns a base64 VersionedTransaction, but both signers deserialize with legacy Transaction.from(), which throws on version-prefixed messages  
  `lib/services/jupiter.ts:166-186 (no asLegacyTransaction) vs app/dashboard/swap/page.tsx:1026-1029 and lib/hooks/useSwapBroadcast.ts:315-318 (Transaction.from)`
- **P0** — Selecting a non-0x route (1inch/Kyber/OpenOcean) always fails: handleSwap posts {taker, fromToken, toToken} but /api/market/trade/execute requires tokenIn/tokenOut/amountIn/walletAddress -> 400 'Missing required fields'; even if fields matched, RouteQuote.raw contains quote-only data (no calldata — services call /quote endpoints, never /swap or route/build), and the server returns {transaction} while the client only checks out.txHash and never signs/broadcasts; the success path's early return also skips setSwapping(false), stranding the spinner  
  `app/dashboard/swap/page.tsx:920-941,1193 vs app/api/market/trade/execute/route.ts:55,66-68,124-147; lib/services/oneinch.ts:31, lib/services/kyberswap.ts:31, lib/services/openocean.ts:29 (quote-only URLs)`
- **P0** — RouteComparison feeds token SYMBOLS + human amounts into /api/swap/routes, but getAllRoutes forwards them raw to 1inch/Kyber/OpenOcean which require contract addresses and base units — 1inch additionally 401s without ONEINCH_API_KEY (absent from .env.example) — so the 'best-of-3 routes' panel almost always shows 'No alternative routes found' or wrong-magnitude numbers  
  `components/swap/RouteComparison.tsx:44-48 (sends fromToken='ETH', amountIn='0.5'), lib/services/swap-aggregator.ts:98-160 (no symbol/decimals resolution), lib/services/oneinch.ts:29-31; grep of .env.example shows no ONEINCH_API_KEY`
- **P1** — Solana deep-links break quotes: resolveParam only handles EVM 0x-addresses; a base58 mint from the sniper drawer is uppercased into an invalid symbol/mint (uppercasing can produce chars outside the base58 alphabet) -> server 422 UNRESOLVED_TOKEN  
  `app/dashboard/swap/page.tsx:596,607-619`
- **P1** — Token selector cannot find arbitrary tokens by NAME: search only filters the hardcoded 26-entry TOKEN_LIST; the list is not chain-filtered so picking e.g. BONK while on Ethereum silently produces no quote (simulateQuote swallows all errors with console.error, no UI error state)  
  `app/dashboard/swap/page.tsx:88-115,239-242 (static list filter), 806-809 (silent catch)`
- **P1** — Imported tokens are invisible after import: stored only in a module-level in-memory map, lost on refresh, and never rendered in the token list on reopen (filtered list maps TOKEN_LIST only)  
  `app/dashboard/swap/page.tsx:121-125 (IMPORTED_TOKENS in-memory), 239-242,317-333 (list renders TOKEN_LIST only)`
- **P1** — SwapDuneStrip and the pre-trade sandwich-risk fetch pass token SYMBOLS where the backends key on contract ADDRESSES (goplus_security_cache.token_address, transactions.to_token_address, analyseMevProtection tokenAddress) — the intelligence strip is nearly always empty and the MEV score is computed against a junk key; the MEV pill is additionally gated on hasQuote which never becomes true due to the P0 quote bug  
  `app/dashboard/swap/page.tsx:1226-1236 (toToken symbol to /api/mev-protection), 1926-1931 (symbols to SwapDuneStrip); lib/dune/useSurfaces.ts:445-478`
- **P1** — Client base-unit conversion uses float math BigInt(Math.round(parseFloat(amount) * 10**18)) — the exact precision bug the repo's own toBaseUnits docstring says causes MAX swaps to revert with insufficient funds; the safe string-math helper exists server-side but the page bypasses it  
  `app/dashboard/swap/page.tsx:775,947 vs lib/market/swapTokenMeta.ts:117-123`
- **P1** — OrderForm hardcodes wallet_source:'external_evm' even when chain is solana, and requires a Supabase login session — wallet-only users get a bare 'Unauthorized' toast with no sign-in prompt  
  `components/trading/OrderForm.tsx:127,220,289,362 (hardcoded wallet_source); app/api/trading/limit-orders/route.ts:65-67 (401)`
- **P2** — Direction-switch button uses hardcoded off-brand hex colors (bg-[#1a2332], border-[#0A0E1A]) that don't match the nl-glass/nl-card surfaces it straddles, making the cutout ring look broken; sits in a z-10/h-0 wrapper that is correct but fragile against the z-50 token modal  
  `app/dashboard/swap/page.tsx:1405-1414`
- **P2** — handleSwapTokens doesn't clear the stale toAmount while the reversed quote loads (and the quote never loads due to the P0), so reversed direction shows the old receive amount as the new input's counterpart  
  `app/dashboard/swap/page.tsx:882-890`
- **P2** — Custom slippage input accepts any value (e.g. 100%) with only a soft >5% warning; server caps at 50% (5000 bps) which is still far above safe  
  `app/dashboard/swap/page.tsx:384-401,951; app/api/swap/quote/route.ts:26`

### Fake / unwired
- Hardcoded gas estimates shown as real: fallbacks '$2.40' / '$0.02' / '$0.001' (page.tsx:1196) and gasEstimateUsd = gas*30/1e9 assumes a fixed 30 gwei and labels an ETH quantity as USD without any native-token price (page.tsx:799); Solana gasEstimateUsd hardcoded 0.001 (app/api/swap/price/route.ts:93)
- Price impact fabricated when absent: defaults to '0.01' (page.tsx:798, 1197) — a made-up 'Low' green badge
- Route / 'Powered by X' venue is a hardcoded per-chain DEX label (Uniswap V3, Aerodrome, Raydium, PancakeSwap...) that has nothing to do with the actual 0x/Jupiter routing (page.tsx:68-76 CHAINS.dex; rendered at 1495-1499, 1730-1734, 1749, 1886)
- MEV Protection toggle is cosmetic: copy claims 'Routes via private mempool (Flashbots / Jito)' (page.tsx:431-434) but mevProtect is only sent on the broken non-0x path (page.tsx:931) and ExecuteBody has no mevProtect field (app/api/market/trade/execute/route.ts:15-50); the standard 0x path never receives it; 'Auto-enabled for trades >= $1,000' can never fire because fromAmountUsd is hardcoded null (page.tsx:796, 1205-1206)
- RouteComparison presents selectable alternative routes as executable; the code's own comment admits 'execution wiring lands next sprint' (page.tsx:455-457) while the UI lets users pick a provider that then 400s
- Advanced Orders 'Market' tab is dead UI: two unwired inputs and a link to /dashboard/swap — the page you are already on (components/trading/OrderForm.tsx:79-98)
- USD value readouts '~$...' render quoteData.fromAmountUsd/toAmountUsd which the client explicitly sets to null (page.tsx:796-797), so they could only ever show $0.00

### Missing frontend layers
- No error state for failed quotes — simulateQuote swallows every failure (422 unsupported token, 500, network) into console.error; user sees a receive field stuck at 0 with no explanation (page.tsx:806-809)
- Token list has no per-chain filtering, no 'imported' section, no empty state distinguishing 'not on this chain' from 'not found' (page.tsx:239-333)
- Review modal renders token glyphs as text initials (fromToken.slice(0,2)) instead of the TokenBadge with real logos used elsewhere (page.tsx:1844, 1854)
- No loading skeleton for balances; 'Balance: 0.00' is indistinguishable from 'still loading' (page.tsx:1372, 1420)
- WCAG contrast: placeholder-gray-600 / text-gray-600 on #060A12 backgrounds (~2.9:1) fails AAA and even AA for body text (page.tsx:271, 1372, 1420)
- Direction-switch button hardcodes non-brand hexes instead of nl-glass tokens (page.tsx:1409)
- No unauthenticated state for Advanced Orders — form renders fully then 401s on submit (OrderForm.tsx + /api/trading/* auth)
- Batch page has no wallet-connect CTA (only an informational banner) and its Review button is just disabled with no hint (batch/page.tsx:71-79, 157-164)

### Missing backend
- No token search-by-name endpoint: the requirement 'find any token by name on any chain' has no backend at all — /api/swap/token-meta only accepts addresses
- No aggregator fallback chain for quotes: /api/swap/price returns 500 when 0x fails; KyberSwap/OpenOcean services exist but are never used as fallback for the primary quote
- getAllRoutes performs no symbol->address or human->base-unit resolution before fanning out to 1inch/Kyber/OpenOcean (lib/services/swap-aggregator.ts:98-111)
- No calldata-building step for the alternative aggregators (1inch /swap, Kyber route/build, OpenOcean swap_quote) — route selection can never execute
- No real gas estimation pipeline: no eth_gasPrice/eth_estimateGas via Alchemy + native-token USD price; UI falls back to invented constants
- No server-side MEV/private-mempool submission path consumed by this flow despite the toggle's claims
- No rate limiting on /api/swap/token-meta or /api/swap/price (only edge caching / 10s route cache)
- Imported-token registry is client-memory only — no per-user persistence (localStorage or Supabase user_tokens table)

### Free-API recommendations
- Token search by name: DexScreener GET https://api.dexscreener.com/latest/dex/search?q={query} (free, no key) for EVM+Solana; Jupiter GET https://lite-api.jup.ag/tokens/v2/search?query={query} (free) for Solana — wire into TokenSelectModal alongside the existing address paste
- EVM quote fallback chain: 0x v2 /swap/permit2/price (existing, keyed) -> KyberSwap GET https://aggregator-api.kyberswap.com/{chain}/api/v1/routes then POST /api/v1/route/build for executable calldata (free, no key) -> OpenOcean GET https://open-api.openocean.finance/v4/{chain}/swap_quote (free, returns calldata) -> 1inch api.1inch.dev only if a free dev-portal key is provisioned (1 RPS free tier); Kyber+OpenOcean also fix the missing calldata for RouteComparison execution
- Real gas estimate: Alchemy RPC eth_gasPrice (or eth_maxPriorityFeePerGas) x quote.transaction.gas, converted with CoinGecko GET /api/v3/simple/price?ids=ethereum,binancecoin,matic-network,avalanche-2&vs_currencies=usd (free) — replaces the $2.40 constants
- Solana fix: pass asLegacyTransaction=false intentionally and deserialize client-side with VersionedTransaction.deserialize(bytes) from @solana/web3.js (no new API needed)
- Token security fallbacks: keep GoPlus https://api.gopluslabs.io/api/v1/token_security/{chainId} (free), add Honeypot.is GET https://api.honeypot.is/v2/IsHoneypot?address={addr}&chainID={id} (free) for EVM tax verification, RugCheck GET https://api.rugcheck.xyz/v1/tokens/{mint}/report (free) for Solana in the review-modal probe
- Imported-token logo fallback: Trust Wallet assets raw CDN https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png (free, static) when Alchemy/DexScreener return no logo
- Pass contract ADDRESSES (already available from getTokenAddresses/quoteData.buyTokenAddress) to /api/swap/intelligence and /api/mev-protection so the existing Dune/Supabase pipelines actually match rows

### Trust Wallet fit
Only one Trust Wallet asset is genuinely useful here: the trustwallet/assets GitHub registry as a free static logo fallback for user-imported tokens (raw.githubusercontent.com URL pattern), filling gaps where Alchemy/DexScreener return no image — a minor polish win, and DexScreener/CoinGecko logos (already wired) remain the better primary. Nothing else fits: Trust Wallet exposes no public swap/quote developer API (its in-app swap consumes the same aggregators this app already uses directly); wallet-core is a native mobile signing library redundant with the existing ethers/@solana/web3.js signing; and Trust Wallet deep links only matter for mobile wallet handoff, which Reown AppKit/WalletConnect already covers on this page (page.tsx:1326-1336). Recommendation: adopt the assets-repo logo fallback, skip the rest.

### Back-button offenders
- None hardcoded to /dashboard in this feature. app/dashboard/swap/page.tsx:1257-1264 maps ?from=wallet -> /dashboard/wallet-page and ?from=home -> /dashboard (intentional origin round-trip), else uses history-aware BackButton; batch page passes href='/dashboard/swap' (batch/page.tsx:66) which is the correct parent. Shared components/ui/BackButton.tsx:45 falls back to /dashboard only when there is no internal referrer/history — by design, not a bug.

### Top fixes (priority order)
1. Fix the main-page quote read: consume the normalized /api/swap/price response (toAmount, rate, priceImpactPct, minReceived, quoteData.buyTokenAddress) exactly as SwapBatchCard already does — this single change revives the receive amount, details panel, routing panel, and review-modal numbers (page.tsx:789-804)
2. Fix Solana signing in both surfaces: deserialize Jupiter transactions with VersionedTransaction.deserialize instead of legacy Transaction.from (page.tsx:1026-1029, useSwapBroadcast.ts:315-318)
3. Make route selection real or remove it: resolve symbols->addresses and human->base units inside getAllRoutes, add Kyber route/build and OpenOcean swap_quote calldata steps, align handleSwap's POST body with ExecuteBody (tokenIn/tokenOut/amountIn/walletAddress), sign the returned transaction client-side, and stop skipping setSwapping(false) on early return
4. Ship token search by name: proxy DexScreener/Jupiter search behind a new /api/swap/token-search, filter the static list per chain, persist imported tokens (localStorage keyed per user) and render them in the selector
5. Delete fabricated numbers: compute network fee from eth_gasPrice x quote gas x native USD price; show '—' instead of $2.40/0.01% when data is absent; replace the hardcoded per-chain DEX label with the actual route fills from 0x/Jupiter
6. Wire the MEV toggle to a real private-tx submission path (Flashbots Protect RPC / Jito bundle for built-in wallet) or remove the toggle and its copy — right now it is a placebo
7. Pass contract addresses (not symbols) to /api/swap/intelligence and /api/mev-protection so the GoPlus cache, smart-money, and sandwich-risk pipelines return data
8. Surface quote errors: show the server's 422 'Unsupported token on {chain}' message under the amount field instead of swallowing it in console.error

<details><summary>Verified working</summary>

- Token import by pasted contract address: TokenSelectModal detects EVM/Solana address shapes (app/dashboard/swap/page.tsx:208-235) -> /api/swap/token-meta resolves real metadata via Alchemy + DexScreener (EVM) or Jupiter token list (Solana), returns 404 rather than fabricating (app/api/swap/token-meta/route.ts:40-124)
- Executable quote backend: /api/swap/quote -> 0x v2 (EVM) and Jupiter lite-api (Solana, free tier) with symbol+human-amount support, slippage cap, precise string-math base-unit conversion (app/api/swap/quote/route.ts:21-126, lib/market/swapTokenMeta.ts:124-134, lib/services/zerox.ts, lib/services/jupiter.ts:14 uses lite-api.jup.ag keyless)
- 0x EVM execution paths: MetaMask eth_sendTransaction (page.tsx:1017-1022), built-in Naka wallet with AES-256-GCM key decrypt + unlock modal re-run (page.tsx:1034-1121, 2015-2033), Ledger hardware path (page.tsx:1067-1077), gasless EIP-712 sign -> /api/gasless/submit -> status polling (page.tsx:975-1016)
- GoPlus trust/caution data is REAL: review modal fires /api/security/scan which calls getTokenSecurity (lib/services/goplus) and caches to goplus_security_cache (app/api/security/scan/route.ts:4,61); block/warn rules in components/swap/SwapSecurityWarnings.tsx:40-53 (honeypot, tax>=30%, pausable, blacklist) actually disable the Confirm button (page.tsx:2001-2008)
- SecurityGate trust-score gate wraps the Swap CTA with real /api/trust-score fetch, degraded-state banner on 5xx, fail-open only on legitimate 404 (components/security/SecurityGate.tsx:109-215)
- Quote freshness: 15s TTL auto-refresh + countdown pill in review modal (page.tsx:756-758, 822-880, 1819-1834)
- Swap logging to Supabase swap_logs + fee_revenue with user resolution from wallet (app/api/swap/log/route.ts:38-70)
- Advanced Orders Limit/Trailing/DCA/Stop tabs POST to real Supabase-auth'd endpoints /api/trading/limit-orders, /api/trading/stop-loss, /api/trading/dca-bots (components/trading/OrderForm.tsx:115, 205, 278, 350; app/api/trading/limit-orders/route.ts:29-31 enforces auth) — real backend, not a gimmick, though degraded (see broken)
- Batch swap page (app/dashboard/swap/batch/page.tsx) + SwapBatchCard correctly consume the NEW normalized /api/swap/price schema (toAmount/minReceived/rate/priceImpactPct) (components/swap/SwapBatchCard.tsx:108-135)
- Wallet plumbing: Reown AppKit mirror with CAIP namespace handling and disconnect rollback (page.tsx:663-708); Safari-private-mode-safe localStorage helpers (page.tsx:38-66)

</details>

## naka-wallet
**Verdict:** The core wallet is genuinely real (HD key generation, AES-GCM vaulting, live Alchemy/Helius balances, real client-signed sends, cloud sync, custom-token import with GoPlus scan), but it is undermined by a wrong-chain balance fallback that shows Ethereum data as Optimism/Fantom/Linea, a Receive QR that never renders due to an invalid color param, API-supplied token logos being dropped by a field-name mismatch, custom tokens never reaching the swap page, and several dead/fake buttons.

### Broken
- **P0** — Wrong-chain balances: /api/wallet-intelligence silently falls back to Ethereum for any chain not in EVM_CHAIN_CONFIG (only 6 chains mapped). Selecting Optimism, Fantom, Cronos, Linea, Scroll, zkSync, Mantle, Blast, etc. (all offered in Add Network, page.tsx:135-159) shows ETHEREUM holdings and totals labeled as that chain — balance accuracy is wrong, exactly the owner's complaint  
  `app/api/wallet-intelligence/route.ts:275 (EVM_CHAIN_CONFIG[chainParam] ? chainParam : 'ethereum') + lib/services/evm-intelligence.ts:10-22 (only ethereum/base/polygon/avalanche/arbitrum/bsc) + app/dashboard/wallet-page/page.tsx:586`
- **P1** — Receive QR code never renders: qrcode.toDataURL is passed dark: 'var(--nl-canvas-base)' — the qrcode lib requires hex color strings and throws 'Invalid hex color', the promise rejects into the catch, qrDataUrl stays '' and the placeholder icon renders forever on every chain  
  `app/dashboard/wallet-page/page.tsx:3148 (color: { dark: 'var(--nl-canvas-base)', light: '#ffffff' }) with catch at 3153-3158 and fallback placeholder at 3243-3247`
- **P1** — API-supplied token logos are dropped: wallet-intelligence returns holdings[].logoUrl (Alchemy metadata + DexScreener imageUrl) but the page's logo resolution reads token.logo (which never exists on on-chain holdings) — so any ERC-20 not in the 24-symbol COIN_LOGOS map renders a letter avatar. This is the direct cause of 'missing logos for Arbitrum/Base tokens'  
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

### Fake / unwired
- Header 'Scan QR' button is fake: it opens the camera, immediately stops it, then window.prompt()s for a pasted address and writes it back to the user's clipboard — it scans nothing and navigates nowhere, while the comment admits 'actual QR decode lives behind the feature flag below' (app/dashboard/wallet-page/page.tsx:1328-1352). The real scanner (ScanQrModal) exists but is only wired inside SendView (page.tsx:2581)
- WalletTab quick actions are dead buttons: Receive / Send / Scan render as real action buttons with no onClick handler at all (components/WalletTab.tsx:110-125)
- 'Today' PnL pill is fabricated math: it applies the ACTIVE CHAIN's native-coin 24h % change to the entire portfolio USD value (pnlAmount = currentBalance * priceChange/100), not per-holding change (app/dashboard/wallet-page/page.tsx:978-980, 1179-1180, 1386-1392)
- 'Total Balance' hero is active-chain-only (walletData.totalBalanceUsd) while the list below shows rows for every enabled chain — the multi-chain aggregation that would make it a true total (fetchMultiChainBalances / totalMultiChainUsd) is dead code that is never called or rendered (page.tsx:610-623, 973-976, 1383)
- /api/wallet/send — a full 188-line broadcast relayer with sender-verification and wallet_send_log — has ZERO callers; SendView signs and broadcasts directly to public RPCs, so the NW2 sender-verification design and the send log are never exercised (app/api/wallet/send/route.ts, grep shows no fetch('/api/wallet/send') anywhere)
- Custom-token rows always show balance '0' and valueUsd '0': the hydrator hardcodes balance: '0' and only the active-chain on-chain fetch can override; an imported token on a non-active chain never shows its real balance (page.tsx:721-729)
- DexScreener 'sparkline' fallback synthesizes a 5-point line from 1h/6h/24h percent buckets rather than real 7-day prices (self-admitted 'Not true OHLC', app/api/wallet/sparkline/route.ts:14-49)
- Residual NSFW token remnants: 'Pleasure Coin' (symbol NSFW) still has seeded brand metadata, a contract logo override, and a pinned slot in TOKEN_SORT_PRIORITY, so if the key resurfaces via server sync it renders branded near the top of the list (page.tsx:199-206, 694-705, 1556-1561)

### Missing frontend layers
- No error state on the main holdings list: fetch failure = silent $0.00 (page.tsx:590-607); only loading skeleton (1543-1548) and empty state (1594) exist
- Spam filtering is a client-side regex over symbol/name only (SPAM_RE, page.tsx:1127) — spam tokens with clean names (fake USDT clones, impersonation tickers) pass straight through; the GoPlus contractSecurity map the API already returns is never consumed by the wallet page (grep: 'contractSecurity' has zero hits in page.tsx)
- Custom tokens imported in the wallet do NOT appear in swap: the swap page keeps its own in-memory IMPORTED_TOKENS registry (app/dashboard/swap/page.tsx:120-125) that resets on reload and never reads steinz_custom_tokens or /api/wallet/custom-tokens (grep confirms wallet-page/page.tsx is the only consumer) — direct violation of the owner requirement
- Send inconsistency with the unlock/session flow: SendView demands the password on every send and never uses UnlockWalletModal/setWalletSessionKey, while swap flows cache the session — two different unlock UXes for the same vault (page.tsx:2437-2440 vs components/wallet/UnlockWalletModal.tsx:97)
- Send button shows 'Soon' for chains that CHAIN_RPC could actually serve (optimism, fantom, linea…) because the gate is EVM_LIVE_CHAINS only (page.tsx:1410 vs CHAIN_RPC at 2197-2228)
- WCAG AAA contrast: pervasive 10-11px text in text-slate-500 (#64748b) / text-gray-500 on near-black backgrounds is ~4.6:1 — passes AA for large text only, fails the AAA 7:1 bar (e.g. page.tsx:1300, 3328; WalletTokenRow.tsx:148-154)
- walletSession doc/code drift: header comments promise a 'hard 30-minute TTL' while the default is 15 min and the sliding window refreshes on every read (lib/wallet/walletSession.ts:17-25 vs 25, 60-63)

### Missing backend
- No balance support for the 18 'Add Network' chains (optimism, fantom, cronos, linea, scroll, zksync, mantle, blast, mode, gnosis, celo, metis, moonbeam, opbnb, manta, zora, aurora, kava): EVM_CHAIN_CONFIG has 6 entries and the route falls back to Ethereum instead of erroring or reading the chain's RPC (lib/services/evm-intelligence.ts:10-22)
- No server-side spam/trash classification on the primary Alchemy path — Zerion's is_trash filter only applies on the rarely-hit fallback (lib/services/zerion.ts:165); GoPlus is fetched for top-5 tokens but never used to suppress or badge rows
- Activity depends on ETHERSCAN_API_KEY (not in the owner's locked free-API matrix); if unset, fetchEvmTxs returns [] silently and the tab shows 'No transactions yet' with no hint (app/api/wallet/transactions/route.ts:58-60). Zerion (evm-intelligence.ts:6) and Bitquery (walletPnl via wallet-intelligence/route.ts:305) are also off-matrix dependencies
- Every wallet balance refresh triggers server-side GoPlus scans on 5 tokens + a Bitquery 90-day realized-PnL build + counterparty analysis that the wallet page never renders — pure waste per refresh, with only a 30s Cache-Control (app/api/wallet-intelligence/route.ts:279-313)
- No multi-chain total pipeline: nothing aggregates balances across enabled chains for the home hero (fetchMultiChainBalances exists but is dead, page.tsx:610-623)
- No ERC-20/SPL transfer construction (client or server) — send is native-only
- transaction_history user_id should be nullable (or writes should skip unowned wallets) so the cache fallback actually works (route.ts:246 vs schema NOT NULL)

### Free-API recommendations
- Fix the logo wiring first (map holdings logoUrl -> row logoUrl), then use this free fallback chain per token: Alchemy alchemy_getTokenMetadata .logo -> DexScreener pair.info.imageUrl (both already integrated) -> Trust Wallet assets registry raw URL: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{ethereum|arbitrum|base|polygon|smartchain|avalanchec|optimism|solana}/assets/{checksummed-address}/logo.png -> letter avatar
- Chain badges: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/info/logo.png (free, static, cacheable) instead of dd.dexscreener.com chain icons
- Spam/NSFW filtering (matrix-approved): batch GoPlus https://api.gopluslabs.io/api/v1/token_security/{chainId}?contract_addresses=a,b,c and hide rows with is_airdrop_scam=1/is_honeypot=1/fake_token=1; Solana mints via RugCheck https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary (danger score) — both free
- Replace Etherscan in /api/wallet/transactions with Alchemy alchemy_getAssetTransfers (already implemented in lib/services/alchemy.ts getAssetTransfers, in the locked matrix, covers eth/base/arb/opt/polygon/bnb/avax) so activity works with zero extra keys
- Multi-chain home total + spam-filtered token list in ONE call: Sim by Dune (in the locked matrix) GET https://api.sim.dune.com/v1/evm/balances/{address}?chain_ids=1,8453,42161,10,137,56,43114 — returns per-token USD values, logos, and a spam filter flag across all EVM chains; fall back to per-chain Alchemy loop
- Extended-chain native balances (linea/scroll/zksync/etc.): plain eth_getBalance against the public RPCs already listed client-side in CHAIN_RPC (page.tsx:2197) — move that map server-side into EVM_CHAIN_CONFIG rather than falling back to Ethereum
- Solana custom-token metadata/logo: Helius DAS getAsset (POST {jsonrpc, method:'getAsset', params:{id: mint}}) — already keyed, gives on-chain + off-chain image
- Token 24h change without per-row sparkline calls: GeckoTerminal https://api.geckoterminal.com/api/v2/simple/networks/{network}/token_price/{addresses} (free, 30 req/min, batchable) as the DexScreener fallback; fix the chain slug mapping ('bsc' not 'bnb chain')
- Custom tokens in swap: read /api/wallet/custom-tokens (existing endpoint) in the swap TokenSelectModal and hydrate via the existing /api/swap/token-meta — no new external API needed

### Trust Wallet fit
One Trust Wallet ecosystem piece is a genuine, direct fit: the trustwallet/assets GitHub registry (free, MIT-licensed, served via raw.githubusercontent.com). It would materially fix the two logo complaints — per-token logos keyed by checksummed contract address for Arbitrum ('arbitrum'), Base ('base'), BSC ('smartchain') and 15+ other chains this wallet supports, plus per-chain info/logo.png images for the chain badges the WalletTokenRow already renders (WalletTokenRow.tsx:121-128). Its allowlist/tokenlist.json files can also serve as a free 'known-good token' set to complement GoPlus spam filtering. Everything else Trust Wallet offers does NOT help this feature: wallet-core is a C++/WASM signing library that duplicates what ethers.js + @solana/web3.js already do here (it would only matter if the owner wants Bitcoin/Sui signing later); Trust Wallet deep links are for routing users INTO the Trust Wallet app, which is pointless for a competing built-in wallet; and there is no Trust Wallet balance, price, or history API at all — balances/prices must stay on Alchemy/Helius/CoinGecko/DexScreener/Sim-by-Dune per the locked matrix. Recommendation: adopt the assets registry as a logo fallback tier only; skip the rest.

### Back-button offenders
- None hardcoded to /dashboard in this feature. The wallet home and coin detail use the shared BackButton with no href (app/dashboard/wallet-page/page.tsx:1307; app/dashboard/wallet-page/coin/[chain]/[address]/page.tsx:146), which prefers router.back() for internal referrers and only falls back to /dashboard when history/referrer is external (components/ui/BackButton.tsx:20-46). All sub-views (Send/Receive/AddToken/Settings/Approvals/Analytics) correctly use onBack={() => setView('main')} (page.tsx:982-1211). Note: on a direct page load (bookmark/refresh) BackButton's fallback still lands on /dashboard by design — acceptable, but worth knowing it is not a pure history-back.

### Top fixes (priority order)
1. 1. Stop the wrong-chain fallback: make /api/wallet-intelligence return a 400 or a real RPC-based native balance for chains outside EVM_CHAIN_CONFIG instead of silently serving Ethereum data (route.ts:275) — this is showing users incorrect balances today, and also fixes the Portfolio Analytics double-count once 'bnb'→'bsc' and the solana entry are mapped correctly (page.tsx:2948)
2. 2. Fix the Receive QR: change dark: 'var(--nl-canvas-base)' to a literal hex like '#0A0E1A' in the qrcode.toDataURL call (page.tsx:3148) — one-line fix that restores the QR on every chain
3. 3. Wire logoUrl through: map h.logoUrl into the page's TokenBalance and use it in the row logo resolution (page.tsx:1562-1565), then add the trustwallet/assets raw-URL fallback — this alone resolves the Arbitrum/Base missing-logo complaint
4. 4. Make imported custom tokens appear in swap: have the swap TokenSelectModal read /api/wallet/custom-tokens + steinz_custom_tokens and hydrate via /api/swap/token-meta, replacing the ephemeral module-level IMPORTED_TOKENS registry (swap/page.tsx:120-125)
5. 5. Allow encryptedKey === '' for importMethod 'ledger' rows in /api/wallet/sync validation (sync/route.ts:63-66) so adding a Ledger doesn't kill cloud backup for every wallet
6. 6. Add an error state to fetchBalances (banner + retry, keep last-known data) so an API failure never renders $0.00 (page.tsx:590-607)
7. 7. Server-side spam filtering: apply GoPlus flags (already fetched) to hide/badge scam tokens on the Alchemy path, and purge the remaining Pleasure Coin metadata/priority pins (page.tsx:205, 700-704, 1559-1560)
8. 8. Kill or wire the fakes: give the header Scan button the real ScanQrModal (page.tsx:1328-1352), add onClick handlers or remove the dead Receive/Send/Scan buttons in WalletTab.tsx:110-125, and either route SendView through /api/wallet/send (gaining sender verification + send log) or delete that endpoint
9. 9. Add ERC-20/SPL token send (token selector + ERC-20 transfer()/SPL transfer construction in SendView) — a wallet that can only send native coins is half a wallet
10. 10. Replace Etherscan with the already-built Alchemy getAssetTransfers in /api/wallet/transactions to stay inside the locked free-API matrix and remove the silent-empty failure mode (transactions/route.ts:58-60); fix the wallet_address→wallet column bug in walletManager.getTransactionHistory (walletManager.ts:118)

<details><summary>Verified working</summary>

- Wallet create/import/derive: real ethers HD wallet (page.tsx:1892 Wallet.createRandom), encrypted client-side with AES-256-GCM + PBKDF2 100k iters (lib/wallet/encryption.ts:28-52), Solana address derived at create time (page.tsx:1908-1915 area), BIP-44 'Add account' derivation with collision scan (page.tsx:832-894)
- Balances for the 6 mapped chains (ethereum/base/polygon/avalanche/arbitrum/bsc + solana): UI -> /api/wallet-intelligence -> Alchemy primary with Zerion fallback -> DexScreener/CoinGecko pricing (page.tsx:553-608, app/api/wallet-intelligence/route.ts:139-191, lib/services/evm-intelligence.ts:377-407)
- Native-coin Send: real client-side signing + direct RPC broadcast with EIP-1559 fee speeds, ENS resolution, MAX-with-gas-reserve, live confirmation polling, Ledger WebHID path, Solana derivation-mismatch safety abort (page.tsx:2279-2529)
- Receive address display/copy/share with chain-compat guard that blocks showing an EVM address on Solana/Bitcoin (page.tsx:3117-3226)
- Custom token import in wallet: chain-aware validation, on-chain metadata resolve via /api/swap/token-meta, GoPlus scan-before-add via /api/security/scan, persisted to Supabase user_custom_tokens with RLS (page.tsx:3345-3450, app/api/wallet/custom-tokens/route.ts)
- Cloud wallet sync with never-shrink-to-zero guard and local/cloud union merge (page.tsx:359-418, app/api/wallet/sync/route.ts:74-101)
- Activity tab: real Etherscan-v2/Helius decoded txs merged with the app trade ledger, cached in transaction_history, with upstream-error banner and tx detail modal (page.tsx:4200-4401, app/api/wallet/transactions/route.ts)
- NFT tab via Alchemy NFT v3 / Helius DAS (components/wallet/NftTab.tsx:55-64, app/api/wallet/nfts/route.ts)
- Approvals manager: real ERC-20/Permit2/NFT allowance scan with revoke calldata, client-signed revocation (app/api/wallet/approvals/route.ts:1-35)
- SendView QR scanner is a real camera scanner (jsQR + EIP-681 parsing) (components/wallet/ScanQrModal.tsx, wired at page.tsx:2581)
- Unlock/session for swap flows: UnlockWalletModal verifies password by decryption then caches in closure-scoped 15-min sliding session, cleared on pagehide/visibility-hidden, passkey/biometric unwrap supported (components/wallet/UnlockWalletModal.tsx:97-150, lib/wallet/walletSession.ts, components/wallet/BiometricUnlockRow.tsx wired at page.tsx:1668)
- Token manage/hide: per-token hide toggles persisted to localStorage with chain-aware keys, hide-small-balances, sort, search (page.tsx:1058-1177)
- Testnet mode with honest $0 pricing and direct RPC reads (page.tsx:176-183, 561-580)
- Portfolio Analytics multi-chain aggregation UI fetches real per-chain data (page.tsx:2935-2993) — but see broken item on chain-id mismatch
- Buy on-ramp is honestly env-gated: real Transak/MoonPay hosted URL when configured, 'coming soon' otherwise (lib/wallet/onramp.ts, page.tsx:1216-1261)

</details>

## whale-tracker
**Verdict:** The whale tracker is a genuinely wired Supabase-backed system (feed, watchlist, alerts, profiles all hit real tables), but its two most important promises — feed freshness and PnL accuracy — quietly depend on non-matrix paid APIs (Arkham, Bitquery, Birdeye) and degrade to stale/zeroed data without them, while a handful of controls (timeframe pill, SSE endpoint, submit prefill) are decorative.

### Broken
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

### Fake / unwired
- Directory 'Timeframe' pill (24h/7d/30d/All) is decoration: the page sends a timeframe param (app/dashboard/whale-tracker/directory/page.tsx:110-115, :218) that /api/whales/directory never reads (app/api/whales/directory/route.ts:35-47 has no timeframe handling) — all metrics are 30d regardless.
- SSE endpoint /api/whale-tracker/feed/events has ZERO client consumers — the page uses Supabase Realtime + 30s polling instead; the only EventSource usages in the repo are for context-feed (app/api/whale-tracker/feed/events/route.ts entire file; grep shows no client). Dead code answering the owner's 'SSE vs polling' question: SSE was built and never wired.
- Fabricated timestamps on the whale profile live-activity fallback: every live EVM row gets timestamp: new Date().toISOString(), so the Activity 'When' column shows all rows as 'just now' regardless of real block time (app/api/whales/[address]/route.ts:78).
- Synthetic whale_score seeds presented as real ranking data: whale-discovery hardcodes whale_score: 70 (app/api/cron/whale-discovery/route.ts:128) and bitquery-traders assigns 70-90 by list position (app/api/cron/bitquery-traders/route.ts:69-70) — these drive the directory's default score sort until/unless the backfill overwrites them.
- False freshness claim in the feed empty state: 'The background poll populates this feed every minute' (app/dashboard/whale-tracker/page.tsx:577-579) — actual cadence is a half-hourly dispatcher rotating 14 whales/tick.
- Hardcoded $2500 ETH last-resort price in the legacy route (app/api/whale-tracker/route.ts:18).
- Internal jargon leaked to users as empty-state copy: 'The Bitquery discovery cron ranks traders by volume as it populates' (components/whales/LiveTradersGrid.tsx:102) and 'Active traders appear here as the discovery cron populates volume' (app/dashboard/whale-tracker/copy-trade/page.tsx:116).

### Missing frontend layers
- WCAG AAA contrast failures throughout: 10-11px text-slate-500 (#64748b, ~4.6:1) and text-slate-600 (#475569, ~2.9:1 — fails even AA) on near-black backgrounds (app/dashboard/whale-tracker/page.tsx:577-579, :531, TraderCard metric labels); 8px badge text is below any legibility floor (page.tsx:1062 text-[8px]).
- No data-freshness indicator anywhere: the feed/Top Today/PnL panels never say when data was last ingested, which makes the 30-min ingest cadence read as 'broken' rather than 'stale'.
- Watch/bell buttons on feed cards and panels lack aria-pressed state (only title attr), unlike the label pills which do set aria-pressed (page.tsx:807-821 vs :515).
- PnL Leaderboard and Top Today panels have no retry affordance on error (PnlLeaderboardPanel shows a static error string, page.tsx:1126-1128; loadTopToday fails silently, page.tsx:223-232).
- Directory page uses its own initials-avatar (directory/page.tsx:172-184) while the rest of the tracker uses the shared WhaleAvatar with resolved logos — brand inconsistency across surfaces.
- Chain filter on the Traders view only honors the FIRST selected chain (LiveTradersGrid receives selectedChains[0], page.tsx:494) while the Activity view supports multi-chain — silent behavior divergence between the two views of the same pills.

### Missing backend
- No free-matrix PnL source: the entire pnl_30d/win_rate/avg_hold_hours/archetype pipeline rides Arkham (ARKHAM_API_KEY, paid/invite API — lib/arkham/api.ts:14, whale-backfill-pnl:182-207); no fallback exists, so PnL is either Arkham or zeros.
- No fallback for 7d volume/active-days metrics when Bitquery is absent (bitquery-traders is the sole writer of volume_7d_usd/active_days_7d); an Alchemy-based aggregation from whale_activity is never computed.
- No push-based EVM ingestion for followed whales: app/api/webhooks/alchemy-whale/route.ts exists but nothing registers followed whales with Alchemy Address Activity webhooks, so even followed whales wait for the 30-min rotation (alerts dispatcher runs every 2 min against data that arrives every 30+).
- No error/rate-limit differentiation in the backfill cron (API failure == empty wallet), and no retry/backoff ledger — a whale zeroed by a transient failure is not revisited for 24h (whale-backfill-pnl:279-286).
- No on-demand ingest: opening a whale profile shows a live Alchemy/Helius fallback that is never persisted to whale_activity, so the same data is re-fetched every visit and never enriches the feed (app/api/whales/[address]/route.ts:186-199).
- top-today recomputes by scanning ALL 24h whale_activity rows into memory on every cache miss with no row limit (app/api/whale-tracker/top-today/route.ts:29-45) — fine today, unbounded as ingest scales.

### Free-API recommendations
- Replace Arkham with Sim by Dune (matrix-approved) for the PnL pipeline: GET https://api.sim.dune.com/v1/evm/activity/{address} (transfers with USD values for FIFO PnL), GET https://api.sim.dune.com/v1/evm/balances/{address} (portfolio_value_usd), and the SVM beta endpoints for Solana. Fallback chain: Sim -> Alchemy alchemy_getAssetTransfers (already wired) + GeckoTerminal historical OHLCV for pricing -> mark metrics 'stale', never write zeros.
- Feed freshness without paying: register followed + top-N whales with Alchemy Address Activity webhooks (free on all Alchemy plans) pointed at the existing app/api/webhooks/alchemy-whale route, keeping the 30-min poll as backstop for the long tail; Solana already has the Helius webhook (app/api/webhooks/helius-whale).
- Replace the Birdeye Solana top-traders source in /api/whale-tracker with the platform's own whales table (or point PlatformEventMonitor at /api/whale-tracker/top-today and delete the legacy route); for Solana trader stats use Dune's free tier (query on dex_solana.trades, refreshed via the existing dune-refresh cron).
- Token price fallback chain fully in-matrix: GeckoTerminal /api/v2/simple/networks/{network}/token_price/{addrs} (already primary, keyless) -> DexScreener https://api.dexscreener.com/latest/dex/tokens/{address} (free, keyless) -> CoinGecko /simple/price for natives; drop the Birdeye fallback in lib/whales/priceActivity.ts.
- Compute volume_7d_usd/active_days_7d from your own whale_activity table with a nightly SQL rollup (zero external cost) instead of depending on Bitquery; keep Bitquery-only code paths behind the existing key gate as optional enhancement.
- For real timestamps in the profile live fallback, use the blockTimestamp already returned by alchemy_getAssetTransfers withMetadata (the poll cron uses it at whale-activity-poll:151) instead of new Date() — zero extra API calls.

### Trust Wallet fit
Almost nothing in the Trust Wallet developer ecosystem helps whale tracking. trustwallet/assets is a token-LOGO registry (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png) — it could serve as one more free fallback for token logos in the feed rows and Holdings table, but GeckoTerminal/DexScreener/CoinGecko already return logos and the platform already has a working Arkham→ENS→Dicebear avatar chain (components/whales/WhaleAvatar.tsx), so the gain is marginal. Trust Wallet offers NO wallet-address labeling, NO whale/transaction activity API, and NO PnL data — the actual gaps here. wallet-core is a signing library and deep links only open the Trust Wallet app, both irrelevant to tracking. The better free answers for this feature's real gaps are Sim by Dune (activity + balances, replaces Arkham), Dune SQL (PnL leaderboards), and Alchemy Address Activity webhooks (feed freshness) — all already in the owner's locked matrix.

### Back-button offenders
- app/dashboard/whale-tracker/page.tsx:347 — <BackButton href="/dashboard" compact /> forces router.push('/dashboard') (BackButton.tsx:21-24 skips history when href is set), even when the user arrived from another dashboard page.
- app/dashboard/whale-tracker/page.tsx:386 — same hardcoded href="/dashboard" on the main feed header back button.

### Top fixes (priority order)
1. Stop the PnL corruption: in whale-backfill-pnl, distinguish 'transfer fetch failed' from 'no transfers' (propagate errors from fetchTransfers instead of .catch(()=>[]) at line 189), skip the DB write on failure, and never overwrite last_active_at with null — this alone fixes the '$0 PnL leaderboard' and vanished last-active data.
2. Migrate the PnL/portfolio pipeline off Arkham (paid, non-matrix) to Sim by Dune activity/balances endpoints with the same FIFO logic; the FIFO code is already source-agnostic.
3. Fix feed freshness honestly: register followed + top whales with Alchemy Address Activity webhooks feeding the existing alchemy-whale route, raise WHALES_PER_TICK, and correct the 'populates every minute' empty-state copy to the real cadence with a last-ingest timestamp in the UI.
4. Kill the whale_score dual-writer: remove whale-score-populator from the six-hourly group (or make its RPC a no-op) so whale-backfill-pnl's metric-based score is the single source of truth.
5. Fix the silent follow failures on subpages: check res.ok in every watch-toggle (LiveTradersGrid.tsx:65-73, copy-trade/page.tsx:64-72, directory/page.tsx toggleWatch) and gate them by the same canFollow/pro check the main page uses.
6. Wire or remove the directory Timeframe pill (the API ignores the timeframe param), and remove the unwired SSE endpoint or actually adopt it in place of the 30s poll.
7. Use real block timestamps in the whale-profile live fallback (alchemy_getAssetTransfers metadata.blockTimestamp) instead of new Date() at app/api/whales/[address]/route.ts:78.
8. Remove the two href="/dashboard" hardcodes on the main page's BackButton (page.tsx:347, :386) so back goes to history like every other tracker subpage.
9. Retire or rewire the legacy Birdeye-based /api/whale-tracker route; point PlatformEventMonitor at /api/whale-tracker/top-today and delete the hardcoded $2500 ETH fallback and fake 'MID'-tier BSC rows.
10. Read ?address=&chain= in the submit page so the profile's 'Submit this whale' deep-link actually prefills, and select archetype in the feed enrichment so authoritative badges reach feed cards.

<details><summary>Verified working</summary>

- Activity feed end-to-end: page.tsx loadFeed (app/dashboard/whale-tracker/page.tsx:183-210) -> /api/whale-tracker/feed (app/api/whale-tracker/feed/route.ts:66-228) -> whale_activity table, with 15s Redis cache, chain/size/time/action/token/label filters, canonical action translation (lib/whales/labels.ts:86-97), and label enrichment from whales + curated registry.
- Supabase Realtime 'N new whales - refresh' indicator: whale_activity is in the supabase_realtime publication with authenticated SELECT RLS (supabase/migrations/2026_whale_activity_realtime_and_alert_watermark.sql:9-19) and the page subscribes to INSERTs with client-side filter matching (page.tsx:254-279), with a 30s poll safety net (page.tsx:283-287).
- Watchlist CRUD end-to-end: page/panel -> /api/whale-tracker/watchlist (app/api/whale-tracker/watchlist/route.ts:43-176) -> user_whale_follows, with pro tier gate, EVM/Solana address normalization, per-follow alert threshold + channels, and copy_mode preservation on upsert (route.ts:117-122).
- Whale alerts pipeline: whale-alert-dispatcher cron (app/api/cron/whale-alert-dispatcher/route.ts) runs in the */2-min dispatch group (app/api/cron/dispatch/[group]/route.ts:30), with a forward-only CAS watermark to prevent duplicate alerts (route.ts:158-165), cold-start lookback cap (route.ts:25), and real fan-out to in-app bell, email (Resend), Telegram, and web push (route.ts:186-246).
- Top Whales Today: /api/whale-tracker/top-today aggregates real 24h whale_activity volume with an honest empty state instead of synthesizing a ranking (app/api/whale-tracker/top-today/route.ts:59-64).
- Whale profile page: /api/whales/[address] returns DB row + activity + follower count with per-source timeouts (app/api/whales/[address]/route.ts:126-207); the page has session-cache stale-while-revalidate fallback (app/dashboard/whale-tracker/[address]/page.tsx:170-221), holdings tab, client-derived counterparties tab, RFC-4180 CSV export (page.tsx:972-1002), and a Claude AI summary section.
- Directory with real server-side filters/facets/sorts: /api/whales/directory (app/api/whales/directory/route.ts:34-113) including PostgREST injection sanitization on search (route.ts:78-83) and custodial-entity exclusion by default (route.ts:71-74).
- Free-matrix whale discovery: whale-discovery cron reads DEX-router inflows via Alchemy, filters to funded EOAs, upserts with ignoreDuplicates (app/api/cron/whale-discovery/route.ts:48-149) — no paid API needed.
- USD pricing pipeline is matrix-compliant at its core: GeckoTerminal batch multi-price primary + CoinGecko for natives, returns null instead of fabricating (lib/whales/priceActivity.ts:43-70 and header comment), with whale-activity-price backfill cron bounded to the visible 8d window so it never fabricates historical prices (app/api/cron/whale-activity-price/route.ts:17,41-51).
- One-click copy deep-link is fully wired: FeedCard Zap button builds action/whale/token/chain/tx/amount params (page.tsx:599-611) and /dashboard/copy-trading actually consumes them with an idempotency key (app/dashboard/copy-trading/page.tsx:75-99); whale profile Copy tab opens NewCopyRuleModal pre-filled (app/dashboard/whale-tracker/[address]/page.tsx:603-631).
- DEX-swap leg pairing in whale-activity-poll produces real buy/sell rows (base-asset heuristic, 50 legs/direction) instead of transfer noise (app/api/cron/whale-activity-poll/route.ts:123-203).
- Tier UX split is honest on the main page: mini can view, pro can follow, with a real TierGateOverlay paywall and controls routed to pricing instead of silently 403ing (page.tsx:127-130,309-315,342-379).

</details>

## vtx-agent
**Verdict:** The /dashboard/vtx-ai page is a genuinely working end-to-end AI agent (real tool pipeline, real price/swap cards, real CA resolution, correct current Anthropic API usage), but the dashboard-tab surface (VtxAiTab) silently discards the cards the server builds, the personality setting is dead everywhere, a client-controlled skipRateLimit flag lets anyone bypass the free-tier limit on the owner's Anthropic bill, and Claude usage/cost tracking does not exist at all.

### Broken
- **P0** — Client-controlled rate-limit bypass: request body field skipRateLimit is trusted verbatim — any anonymous caller can POST {"skipRateLimit": true} to /api/vtx-ai and get unlimited free Claude (Sonnet 5 + Opus 4.8 advisor) on the owner's Anthropic bill. No legitimate caller anywhere in the repo sends this field.  
  `app/api/vtx-ai/route.ts:453,565,808,886`
- **P1** — Dashboard-tab surface (VtxAiTab, mounted at app/dashboard/page.tsx:430 for the vtxai nav) discards the server-built tokenCard and swapCard in BOTH the JSON branch and the streaming done handler — a pasted CA renders text-only and a 'swap 0.1 ETH for USDC' request renders no Swap Card, while the system prompt explicitly tells the model to say 'the UI will render an inline Swap Card' (route.ts:248). The tab's non-stream heuristic exists specifically 'so cards land correctly' yet the cards are never read.  
  `components/VtxAiTab.tsx:853-921 (reads only data.chart/reply/dailyUsage) and 787-843 (done handler ignores json.tokenCard/json.swapCard sent at route.ts:804); confirmed in docs/sessions/HANDOFF-2026-06-22-platform-audit-phase-b.md:158`
- **P1** — Personality setting is dead on every surface: both UIs send lowercase 'professional'|'degen'|'conservative'|'neutral' but the server allow-list is case-sensitive ['Neutral','Friendly','Analytical','Direct','Casual','Professional'] — no value either UI can send ever matches, so resolvedPersonality is always 'Neutral' and the Degen/Conservative/Professional selectors are no-ops.  
  `app/api/vtx-ai/route.ts:621-632 vs components/VtxAiTab.tsx:1035-1039 and app/dashboard/vtx-ai/page.tsx:1015-1024`
- **P1** — /api/vtx-ai/chat is publicly reachable with zero auth and zero rate limiting, runs the full Sonnet-5 tool loop (runVTXAgent/streamVTXAgent), and has no production caller — an open unlimited-cost endpoint.  
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

### Fake / unwired
- contract_analysis tool promises 'decode ABI, identify dangerous functions' (lib/services/anthropic.ts:209) but the executor only fetches bytecode LENGTH and asks the model to speculate — the prompt literally says 'actual bytecode not included for brevity... Focus on what can be inferred' — so the 'AI Assessment' shown to users is fabricated from an address and a KB count. lib/ai/vtxToolExecutor.ts:287-308
- 7d chart fallback in /api/vtx/token-card fabricates price history by multiplying the 24h change by 3 and 2 ('{ at: -7d, pct: changes.h24 * 3 }') — an invented series rendered as a real chart when Birdeye/CoinGecko have no data. app/api/vtx/token-card/route.ts:147-160
- VtxAiTab's 'Trusted/Caution/Risky' badge is a client-side made-up formula (100 minus penalties for >50% move and low liquidity), not GoPlus/Honeypot/RugCheck — a security verdict with no security data behind it. components/VtxAiTab.tsx:246-250,287-303
- 'AI' follow-up suggestions on /dashboard/vtx-ai are a hardcoded keyword-matched canned list (generateSuggestions), not model output. app/dashboard/vtx-ai/page.tsx:210-231
- VtxSettingsDrawer persists show_token_cards, show_swap_cards, response_style, default_chain, auto_trending_refresh to Supabase but nothing reads them — the chat request is built from the separate localStorage settings; only wallet_read_enabled is honored (route.ts:519-529). components/vtx/VtxSettingsDrawer.tsx:14-41
- VtxToolSidecar 'tool timeline' is reconstructed by inference from rendered cards ('when a token card appears we infer the underlying tool'), and pendingSwap is hardcoded null with a 'wired in by API once prepare_swap streams' comment — the sidecar shows guessed tool events, not the real toolsUsed the API already returns. app/dashboard/vtx-ai/page.tsx:853-904
- Loading spinner copy 'Searching Sargon Data Archive…' / 'Analyzing via Naka Intelligence…' brands third-party APIs (DexScreener/CoinGecko rebranded via scrubBranding, route.ts:1160-1199) as an in-house archive — deliberate white-labeling, flagging per no-fake-claims rule. components/VtxAiTab.tsx:1341, app/dashboard/vtx-ai/page.tsx:1346

### Missing frontend layers
- VtxAiTab: no token-card, swap-card, or suggestion rendering (server builds all three); its price display falls back to a client-side DexScreener symbol search that can surface wash-traded clone pairs — the exact failure buildResponseCards was written to prevent (VtxAiTab.tsx:229-243).
- No markdown rendering on either surface — bold/headers/bullets are regex-stripped to plain text (VtxAiTab.tsx:1252-1265, page.tsx:834-851); tables and code blocks from the model render as mush.
- No Stop/cancel on /dashboard/vtx-ai; input disabled during generation (page.tsx:1400).
- No retry affordance on error bubbles ('Error: ...' is a dead-end message on both surfaces).
- WCAG AAA contrast fails throughout: ~30 instances each of text-gray-500/600 (3.2-3.8:1) on near-black at 9-11px (e.g. VtxAiTab.tsx:326 'text-[9px] text-gray-600', page.tsx stat labels) — fails even AA for normal text.
- Usage meter and rateLimited banner go stale after streamed replies (no dailyUsage in the done event).
- Unauthenticated state is invisible: anonymous users get the same UI but prepare_swap/conversation-sync silently fail; no sign-in prompt in the chat surface.

### Missing backend
- Claude API usage/cost tracking does not exist: response.usage (input_tokens/output_tokens/cache_read_input_tokens) is never read anywhere in app/ or lib/ (grep: zero matches) — no per-request token log, no per-user cost attribution, no dashboard, despite the owner paying for Anthropic. Prompt caching is implemented but its effectiveness is unverifiable without capturing usage.
- No suggestions generation server-side (route never returns a suggestions field), forcing the hardcoded client fallback.
- Streaming done event omits dailyUsage/chart fields the clients expect (route.ts:804).
- Per-user (not per-IP) rate limiting for authenticated callers; durable fallback when Redis is down (current fallback is a per-lambda Map).
- No graceful degradation when the pre-flight market fetch chain fails: Binance (route.ts:342-365) is geo-blocked (HTTP 451) from US Vercel regions, so the primary market-context source likely never works in production and every request eats a failed fetch before the CoinGecko fallback.
- Four data sources violate the locked free-API matrix: Birdeye (BIRDEYE_API_KEY, lib/services/birdeye.ts:5; used by /api/vtx/token-card:183), Arkham (ARKHAM_API_KEY, paid/invite API, lib/arkham/api.ts:14; powers entity_lookup + wallet_profile), Binance ticker, and Etherscan gas oracle (ETHERSCAN_API_KEY, route.ts:408) — when their keys are absent these tools silently degrade to 'Unknown'/empty.
- No moderation/abuse guard on the open /api/vtx-ai/chat endpoint (or deletion of it).

### Free-API recommendations
- Replace Birdeye OHLCV with GeckoTerminal (in matrix, free, no key): GET https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool}/ohlcv/{timeframe} (pool from the DexScreener pair you already have); holder counts via GoPlus token_security 'holder_count' field (already fetched) or Helius getTokenAccounts for Solana.
- Replace Arkham entity_lookup/address intel with the matrix stack: Sim by Dune wallet API (https://api.sim.dune.com/v1/evm/balances/{address} and activity endpoints) for holdings/activity, GoPlus address_security (already integrated) for scam/blacklist labels; return honest 'no entity label' instead of a fabricated Unknown card.
- Drop Binance pre-flight (geo-blocked 451 on US Vercel) and make CoinGecko /api/v3/coins/markets?vs_currency=usd&per_page=20 the primary, DexScreener /latest/dex/tokens as per-token fallback — both already wrapped in lib/services.
- Replace Etherscan gas oracle with the Alchemy RPC you already pay nothing for: eth_gasPrice + eth_feeHistory via lib/services/alchemy (no new key).
- Add Claude cost tracking with zero new APIs: read message.usage / stream.finalMessage().usage in vtxQuery/vtxStreamRaw and insert {user_id, model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, tools_used} into a Supabase ai_usage table; price at Sonnet 5 $3/$15 per MTok ($2/$10 intro through 2026-08-31) and Opus 4.8 advisor $5/$25.
- Map the 'Deepest' picker to output_config.effort 'xhigh' (supported on claude-sonnet-5; 'high' is already the default so the current mapping is a no-op).
- Fear & Greed: keep alternative.me /fng/ (free, keyless) but add it to the owner's approved matrix explicitly, or drop the line from the prompt.
- Token logos fallback chain: DexScreener dd.dexscreener.com CDN (current) → CoinGecko image URL (current) → raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png → symbol initial.

### Trust Wallet fit
Trust Wallet offers exactly one thing useful to this feature: the trustwallet/assets GitHub registry as a free, keyless token-logo fallback (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{address}/logo.png) to slot behind the DexScreener CDN and CoinGecko image URLs already used in buildResponseCards (route.ts:1026-1029) and the hardcoded LOGO map in SwapCard.tsx:56-72 — note it needs EIP-55 checksummed addresses and has patchy long-tail/Solana coverage, so it's a fallback, not a primary. Everything else is a poor fit: wallet-core is a C++/mobile key-management library irrelevant to a Next.js server agent; Trust Wallet deep links (link.trustwallet.com/swap) would hand the swap to a competing wallet instead of the platform's own SwapCard signer; and Trust Wallet has no developer API for prices, security scans, or entity data. The existing free stack (DexScreener/GeckoTerminal/CoinGecko + GoPlus + Jupiter/0x) already covers this feature better.

### Top fixes (priority order)
1. Delete the skipRateLimit body field (or gate it on an internal server secret) in app/api/vtx-ai/route.ts — right now any anonymous user can bypass the 25/day free limit and run unlimited Sonnet 5 + Opus advisor calls on the owner's Anthropic bill.
2. Auth-gate and rate-limit /api/vtx-ai/chat or delete it — it is an open, unlimited, tool-enabled Claude endpoint with no production caller.
3. Make the dashboard tab render the cards: either read data.tokenCard/data.swapCard (and the streaming done fields) in VtxAiTab.tsx, or replace VtxAiTab with the /dashboard/vtx-ai page component — until then, CAs pasted in the tab don't render cards and the agent promises Swap Cards that never appear.
4. Fix the personality allow-list mismatch (lowercase/mismatched values from both UIs vs capitalized server list) so the Degen/Conservative/Professional setting actually changes anything; add degen/conservative to the server list or normalize case.
5. Start logging Claude token usage/cost per request (response.usage → Supabase) — the feature currently spends Anthropic money with zero accounting and no way to verify prompt-cache savings.
6. Include dailyUsage and suggestions in the streaming done event so the usage meter and pills work for streamed replies.
7. Swap out the non-matrix APIs: Birdeye → GeckoTerminal OHLCV, Arkham → Sim by Dune + GoPlus, Binance → CoinGecko primary, Etherscan gas → Alchemy RPC.
8. Remove or clearly label the fabricated 7d chart reconstruction (h24 × 3) in /api/vtx/token-card and replace the VtxAiTab client-side 'Trusted' heuristic with the GoPlus trusted flag the token-card API already returns.
9. Map the Deepest model-picker option to effort 'xhigh' (current 'high' equals the default, so the toggle is cosmetic).
10. Add a Stop button + AbortController to /dashboard/vtx-ai, render markdown properly, and bump the ~60 instances of 9-11px gray-500/600 text to meet contrast.

<details><summary>Verified working</summary>

- Tool pipeline returns real data: 15 core tools + P2B + Dune dispatched to real services (GoPlus, CoinGecko, DexScreener, Alchemy, Helius via alchemy-solana, LunarCrush, Supabase whale tables, trade relayer) — lib/ai/vtxToolExecutor.ts:559-594; executed in both the non-streaming loop (app/api/vtx-ai/route.ts:832-872) and the streaming SSE loop with tool re-entry (route.ts:740-825).
- Anthropic integration is correct against the current API (verified via claude-api skill): claude-sonnet-5 executor + claude-opus-4-8 advisor via advisor_20260301 + advisor-tool-2026-03-01 beta, web_search_20260209, adaptive thinking, output_config.effort, prompt-cache breakpoints on system + last tool — lib/services/anthropic.ts:34-36,361,395-425.
- Contract-address resolution works on /dashboard/vtx-ai: detectTokenAddress (lib/ai/vtxToolExecutor.ts:44-55) → exact getTokenPairs lookup ranked by liquidity with CoinGecko-first symbol ranking to avoid scam clones (route.ts buildResponseCards:964-1111) → TokenCard/PriceCard hydrated live from /api/vtx/token-card (DexScreener + Birdeye OHLC + CoinGecko + GoPlus trusted flag) — app/dashboard/vtx-ai/page.tsx:264-379, app/api/vtx/token-card/route.ts.
- Swap card is real, not simulated: swap-intent regex + resolveSwapAddress (route.ts:1113-1155) → SwapCard fetches live /api/swap/price quote, fresh /api/swap/quote at sign time, real wallet broadcast (useSwapBroadcast), on-chain tx hash gates the 'executed' state, chain-correct explorer links, trade logged to /api/swap/log — components/vtx/SwapCard.tsx:130-303.
- Streaming SSE works on both surfaces with delta rendering, buffered event parsing, and card parity on the page's done handler — route.ts:740-825, page.tsx:723-791.
- Server-side tier enforcement: client 'tier' claim is ignored; tier read from profiles with tier_expires_at check — route.ts:545-563. Redis-backed per-day rate limit (route.ts:38-90).
- Wallet privacy gate honored server-side (user_preferences.vtx_settings.wallet_read_enabled === false hides address + portfolio) — route.ts:512-532; prompt-injection allow-lists/sanitization on personality/language/context/walletAddress — route.ts:616-677.
- Conversations persist to Supabase with auth, upsert dedupe and stale-sync guard (page.tsx:101-119, 486-585; app/api/vtx/conversations/route.ts); share links with owned-conversation check + expiry (app/api/vtx/share/route.ts) and public viewer at app/vtx/shared/[token]/page.tsx.
- View-proof surface reuses the same SwapCard with source='proof' so proof-driven buys hit the identical quote/sign/broadcast path — app/dashboard/proof/page.tsx:684-713.
- BackButton on the vtx-ai page goes back in history when the referrer is internal, /dashboard only as fallback — components/ui/BackButton.tsx:20-46 (correct pattern, not hardcoded).

</details>

## market-maker
**Verdict:** This is a genuinely real, unusually honest feature — real Supabase persistence, a real grid/range tick engine executing 0x swaps via ZeroDev AA session keys on a 2-minute cron with serious money-safety guards — but it is observability-blind: a strategy can sit "active" forever while the engine silently skips every tick (no session key, Solana, RPC failure) with zero UI feedback, and the fills/orders the engine records are never shown to the user.

### Broken
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

### Fake / unwired
- GET route doc-comment claims it returns '(+ recent fills summary)' but the handler returns strategies only — mm_fills and mm_orders are written by the engine and have RLS read policies for owners, yet no API or UI ever reads them (app/api/market-maker/strategies/route.ts:10 vs :35-45; grep: mm_fills/mm_orders referenced only in engine.ts + migrations)
- quote_token_address is accepted by POST and stored (route.ts:51,110) but never sent by the modal and never read by the engine — the engine always quotes USDC (engine.ts:90-91); vestigial column presented as configurable in the schema
- No mock/hardcoded data found anywhere in this feature — the 'Presence' strategy button is disabled and honestly labeled 'Not offered — wash trading' (CreateStrategyModal.tsx:250,258), empty states say so, and PnL/inventory come from real fills. This feature meets the no-mock rule.

### Missing frontend layers
- Per-strategy fills/orders history (trade log with tx-hash links to explorers) — the data exists in mm_fills/mm_orders with owner read RLS but has zero UI
- Execution-health surface: last_run_at, last tick action/skip reason, and a 'session key active on this chain?' badge per strategy card
- Warning or block at Activate time when no active session key exists on the strategy's chain (and a hard notice for Solana strategies)
- Fallback guidance when BackgroundSnipingCard renders null (no built-in wallet) — currently a blank gap where the funding flow should be
- Edit-strategy UI (spread/levels/budget/slippage) and delete/archive for stopped strategies
- Range-specific preview (2 bounds, not a grid ladder) in the create modal
- Mark-to-market inventory USD for market-priced strategies — the card shows raw token count only (page.tsx:229-232); the server could return the DexScreener price with GET
- Confirmation dialog on Stop (single tap, described to the user as terminal)

### Missing backend
- Solana execution: engine hard-skips solana (engine.ts:83) even though Jupiter swap lib (lib/trading/jupiter.ts) and solanaSessionKeySigner.ts exist in the codebase — pipeline never wired to MM
- Fills/summary read endpoint (e.g. GET /api/market-maker/strategies?include=fills or /api/market-maker/fills?strategy_id=)
- Token decimals read uses free public RPCs (eth.llamarpc.com, polygon-rpc.com etc. — lib/sniper/priceFeed.ts:32-38) which rate-limit and cause skipped sell ticks, while an Alchemy key (in the approved matrix) already exists in lib/services/alchemy
- Single quote source: 0x only in executeSessionSwap (sessionKeyExecutor.ts:116) — no 1inch/KyberSwap/OpenOcean fallback, so a 0x outage halts all MM fills
- Single price source: DexScreener only for the reference/market price (engine.ts:67,95) — no GeckoTerminal/CoinGecko fallback; a DexScreener outage stalls every strategy (fails safe as skip, but stalls)
- No token-security gate at strategy creation — a user can budget $10k of grid buys into a honeypot; GoPlus is in the approved matrix and already integrated elsewhere in the repo
- No engine-side notification on repeated failed ticks (Telegram/push infra exists platform-wide but MM never uses it)

### Free-API recommendations
- Decimals via Alchemy (already in matrix, free 300M CU/mo): POST https://{network}.g.alchemy.com/v2/{key} eth_call decimals(), fallback chain Alchemy -> current public RPC list — eliminates the flaky llamarpc dependency on the money path
- Reference-price fallback chain: DexScreener GET https://api.dexscreener.com/latest/dex/tokens/{address} (current) -> GeckoTerminal GET https://api.geckoterminal.com/api/v2/networks/{network}/tokens/{address} (free, 30 rpm) -> CoinGecko GET https://api.coingecko.com/api/v3/simple/token_price/{platform}?contract_addresses={addr}&vs_currencies=usd (free demo tier)
- EVM quote fallback chain in executeSessionSwap: 0x GET https://api.0x.org/swap/allowance-holder/quote (current) -> 1inch GET https://api.1inch.dev/swap/v6.0/{chainId}/quote -> KyberSwap GET https://aggregator-api.kyberswap.com/{chain}/api/v1/routes -> OpenOcean GET https://open-api.openocean.finance/v4/{chain}/swap — all in the owner's locked free matrix
- Solana MM execution: Jupiter GET https://lite-api.jup.ag/swap/v1/quote + POST /swap/v1/swap (free tier) reusing lib/trading/jupiter.ts + the existing Solana session signer
- Pre-creation safety gate: GoPlus GET https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses={addr} + Honeypot.is GET https://api.honeypot.is/v2/IsHoneypot?address={addr} (EVM) / RugCheck GET https://api.rugcheck.xyz/v1/tokens/{mint}/report (Solana) — warn before a budget is committed to a honeypot
- Flag for owner: ZeroDev bundler/paymaster (rpc.zerodev.app, lib/wallet/sessionKeyAA.ts:86-95) is a third-party dependency OUTSIDE the locked free-API matrix; its free tier is limited — the whole MM+sniper auto-execution stack depends on it, so it should be explicitly approved or budgeted

### Trust Wallet fit
Nothing in the Trust Wallet ecosystem helps this feature. trustwallet/assets is only a static token-logo/metadata GitHub registry (raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png) — the MM UI does not display token logos, and token-meta already resolves logos free via Alchemy + DexScreener info.imageUrl (app/api/swap/token-meta/route.ts:91), both of which cover long-tail memecoins that the community-PR-gated Trust registry misses. wallet-core is a client-side signing library and Trust deep links open the Trust Wallet app — both irrelevant to a server-side ZeroDev AA session-key execution engine, and Trust Wallet has no order/trading/market-making developer API at all. The better free investments are the quote/price fallback chains and GoPlus gating listed above.

### Top fixes (priority order)
1. Surface execution health on every strategy card: return last_run_at plus the last tick's action/skip reason from GET (persist reason on mm_strategies or read latest mm_orders), and show a 'never executed — no session key on {chain}' warning so active-but-dead strategies are visible (engine.ts:213, page.tsx StrategyCard)
2. Gate or badge activation: when PATCH status=active, check for an active session key on the strategy's chain (same query as sessionKeyExecutor.loadActiveSession) and return a warning the UI must display; hard-warn for Solana until execution exists
3. Expose the trade log: add fills to GET /api/market-maker/strategies (mm_fills already has owner-read RLS) and render a per-strategy fill history with tx links — the realized-PnL number is currently unverifiable by the user
4. Fix the Range ladder preview in CreateStrategyModal to show the 2 actual bounds the engine trades, not a grid ladder (CreateStrategyModal.tsx:127-130)
5. Add DELETE (or archived flag) + config-edit PATCH fields, and matching edit/delete UI, so stopped strategies don't pile up untouchably
6. Move decimals reads to Alchemy and add price (GeckoTerminal/CoinGecko) + quote (1inch/KyberSwap/OpenOcean) fallbacks so one free-API outage can't stall or skip every tick
7. Mirror the $5 minimum order size client-side and fix the unsafe-integer sell sizing at engine.ts:142 (do the decimals scaling fully in BigInt from a string-parsed token amount)

<details><summary>Verified working</summary>

- Full UI->API->DB loop: dashboard lists/creates/controls strategies against real mm_strategies rows with RLS + double user_id binding (app/dashboard/market-maker/page.tsx:69-109; app/api/market-maker/strategies/route.ts:35-148; supabase/migrations/2026_06_30_market_maker_schema.sql)
- Create modal resolves REAL token symbols via /api/swap/token-meta (Alchemy + DexScreener + on-chain decimals, 404 rather than fabricate — app/api/swap/token-meta/route.ts:61-94) and renders a client ladder preview using the exact same computeLadder math as the engine (components/marketMaker/CreateStrategyModal.tsx:38-50 mirrors lib/marketMaker/engine.ts:36-53)
- Real strategy engine, not a shell: grid + range ticks with chain-scoped DexScreener reference price (lib/services/dexscreener.ts:111-118), strict on-chain decimals read that SKIPS instead of guessing (engine.ts:138-139), monotonic lifetime budget cap (engine.ts:176), post-buy inventory cap (engine.ts:179), 30-min rung cooldown (engine.ts:78,122-130), stale-manual-reference guard at 50% drift (engine.ts:101-103), and a mid-tick kill-switch re-read so Pause/Stop works even during a tick (engine.ts:116-119,144,181)
- Real execution: 0x AllowanceHolder quote + approve batched into one ZeroDev kernel userOperation (lib/trading/sessionKeyExecutor.ts:100-157), per-trade cap (176-178) and ATOMIC daily-cap reservation via aa_reserve_daily_spend advisory-lock RPC shared with the sniper (180-203; supabase/migrations/2026_06_30_aa_spend_accounting_r4.sql:45-88)
- Cron actually scheduled: mm-engine is in the 'frequent' (*/2 min) dispatch group (vercel.json:3; app/api/cron/dispatch/[group]/route.ts:27), with cron lock to prevent double-fills and instant no-work short-circuit (app/api/cron/mm-engine/route.ts:22-26)
- Real PnL accounting: cost-basis realized PnL from actual quoted fill amounts, USDC decimals chain-aware incl. BSC 18dp (engine.ts:149-167; lib/trading/usdc.ts:33-53), and a DB trigger blocking authenticated clients from tampering with accounting columns (2026_06_30_mm_audit_fixes.sql lock_mm_accounting)
- Frontend states all present: auth redirect, loading spinner, error banner, honest empty state, optimistic status update with revert on failure (page.tsx:73-116,176-192), glassmorphism nl-glass/nl-btn-neon brand styling throughout
- Buy fill-row insert failure after an on-chain swap is loudly Sentry-flagged instead of silently dropped (engine.ts:199-202)

</details>

## sniper
**Verdict:** The discover feed, criteria CRUD, autosell engine, and the cron-based execution pipeline are genuinely wired to real data (GeckoTerminal/DexScreener/GoPlus/0x/Jupiter), but the advertised low-latency webhook detection path is structurally dead, the price_target trigger and Anti-MEV/priority-fee/expiry controls are stored-but-never-enforced fakes, and the feed's primary "Quick Buy" CTA discards the token and opens a blank rule modal.

### Broken
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

### Fake / unwired
- Anti-MEV toggle + mev_protect column + 'MEV-protected' header claim ('Flashbots Protect'/'Jito Bundle'/'BloxRoute' labels in chains.ts): stored on criteria but never read by any execution code — grep of lib/trading/* shows zero references to mev_protect or priority_fee_native. app/dashboard/sniper/NewSniperModal.tsx:435-442, lib/sniper/chains.ts:43,57,71, app/dashboard/sniper/page.tsx:410
- priority_fee_native input: persisted (app/api/sniper/criteria/route.ts:200) but never used to build any transaction — pure decoration.
- expiry_hours ('Expiry (hours)') input: stored and displayed, but grep shows no code anywhere enforces expiry — snipers never expire. app/dashboard/sniper/NewSniperModal.tsx:462-464; only refs are lib/sniper/types.ts:52 and app/api/sniper/criteria/route.ts:207
- bonding_curve_pct is never written by any ingest (only the migration defines it and readers read it) — so the BondingCurveBar UI (sniperShared.tsx:214-236), the TokenCard bonding display (TokenCard.tsx:138), and the 'graduate' chime in the feed-sound feature (page.tsx:186-194 requires bondingCurvePct crossing graduatePct) can never activate. The graduation-alert sound setting is a control for a signal that does not exist.
- lib/sniper/engine/{evm,solana,ton,index,types,apiCost}.ts — the entire 'per-chain MEV-protected broadcast engine' (Jito/Flashbots/BloxRoute submit adapters) is imported by nothing (only priceFeed uses apiCost.timed); dead code that the docs and UI copy still describe as the execution layer.
- components/sniper/LiveTape.tsx and components/sniper/SnipeRiskCell.tsx are orphaned — defined, never imported by any page.
- 'Sub-2s execution' header claim + 'Avg Speed' stat: execution_time_ms is only ever written by the orphaned /api/sniper/execute route, where it measures the GoPlus/AI safety-scan duration, not a trade; the real AA/pending-trade paths never set it, so Avg Speed shows '—' forever or, worse, a safety-scan latency masquerading as execution speed. app/dashboard/sniper/page.tsx:410,453-461; app/api/sniper/execute/route.ts:139-147
- GET /api/sniper supports an audit=devsoldall filter (app/api/sniper/route.ts:131) with no corresponding UI control — half-wired.
- /api/sniper/state and /api/sniper/feed-health have no frontend consumers (grep shows zero fetches) — diagnostics-only endpoints presented in the API surface.

### Missing frontend layers
- Distinct error vs empty state for the Discover feed (non-OK /api/sniper responses render as 'No fresh pairs match these filters', page.tsx:248-260,743-746); no tier-expired/403 handling mid-session.
- Token prefill in NewSniperModal when launched from a TokenCard/drawer (token identity is discarded at page.tsx:494,527) and a real quick-buy path for feed tokens on their actual chain.
- No UI for feed chains that cannot be sniped: Base/Arbitrum/Optimism/Polygon tokens show a 'Quick Buy' button that leads to a modal without those chains — needs either chain support or an honest 'view only' affordance.
- aria-labels on icon-only NavPill tabs when labels collapse on mobile (page.tsx:564-580); WCAG AAA contrast for the pervasive text-white/40-45 microcopy on glass.
- No edit flow for existing snipers — SniperCard offers only pause/delete (page.tsx:1107-1112); the API's POST supports update-by-id (criteria/route.ts:211-212) but nothing calls it with an id.
- No failure surfacing when togglePause/removeSniper Supabase writes fail (optimistic update with unchecked errors, page.tsx:341-351).
- MatchActivity is buried at the bottom of the Snipers tab only; queued/executed decisions have no link to the resulting execution or tx.
- The devsoldall audit filter exists server-side but has no toggle in the filter row.

### Missing backend
- A price_target evaluation loop — nothing anywhere compares trigger_price_target to a live price (sniper-monitor route.ts:334-335 is a comment, not code).
- Chain-slug normalization for Alchemy webhook networks (ETH_MAINNET -> ethereum etc.) plus any webhook-subscription management: no code registers Alchemy/Helius webhooks for tracked whales or new-pair sources; the endpoint just waits for traffic that has no configured producer in-repo.
- Expiry enforcement for sniper_criteria.expiry_hours (a daily cron flipping enabled=false past expiry).
- Ingest of bonding_curve_pct (pump.fun graduation progress) — column exists, no producer.
- 0x price coverage for base/arbitrum/optimism/polygon in lib/sniper/priceFeed.ts (USDC addresses + chain IDs) so autosell can protect AA positions on those chains; TON pricing is absent entirely (explicit skip).
- Fallback chain for the feed ingest: GeckoTerminal is the single pool source; when GT is down a chain contributes nothing (acceptable honesty, but DexScreener /token-profiles or /latest/dex/search could serve as a secondary pool discovery source).
- Faster whale_activity freshness (webhook or 2-min poll) so sniper-monitor's 2-minute window has anything to match.
- A consumer or removal for /api/sniper/execute's 'queued' sniper_executions rows (they leak into Executions count and History forever).
- Cleanup/backfill for sniper_detected_tokens (webhook writes are unchecked; nothing reads the table — the UI feed reads sniper_feed_tokens instead).

### Free-API recommendations
- price_target trigger: reuse the already-built getCurrentTokenPriceUsd (0x allowance-holder /swap/allowance-holder/price for EVM — already keyed; Jupiter Price API https://api.jup.ag/price/v2?ids=<mint> free for Solana) inside sniper-monitor; for cheap bulk marks use DexScreener GET https://api.dexscreener.com/tokens/v1/{chain}/{addr1,addr2,...} (free, 300 req/min, 30 tokens/call).
- Autosell chain coverage: add USDC addresses + chainIds for base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, 8453), arbitrum (0xaf88d065e77c8cC2239327C5EDb3A432268e5831, 42161), optimism (0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85, 10), polygon (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359, 137) to lib/sniper/priceFeed.ts — 0x v2 already supports all four on the existing key. Fallback chain: 0x price -> DexScreener tokens/v1 -> GeckoTerminal /simple/networks/{net}/token_price/{addr} (free, no key).
- Solana launch detection (real sub-second, free): PumpPortal WebSocket wss://pumpportal.fun/api/data (subscribeNewToken / subscribeMigration) — also supplies bonding-curve progress to populate bonding_curve_pct; alternative: Helius enhanced webhooks (already integrated, free tier) pointed at the pump.fun program.
- EVM launch detection: keep GeckoTerminal /networks/{net}/new_pools (free, ~30 req/min — current ingest of 8 chains x 3 pages every 2 min is near the cap; add 429 backoff and consider alternating chains per tick). Fix the Alchemy webhook by mapping network enums (ETH_MAINNET->ethereum, BNB_MAINNET->bsc, AVAX_MAINNET->avalanche) before matching.
- whale_buy freshness: widen sniper-monitor's whale_activity window to >= the poll cadence (30 min) with dedup doing the dup-prevention, or register Alchemy Address Activity webhooks per tracked whale via https://dashboard.alchemy.com/api/create-webhook (free) feeding the existing /api/webhooks/alchemy-whale.
- Token security fallback: current GoPlus-only enrichment should fall back to Honeypot.is https://api.honeypot.is/v2/IsHoneypot?address= (free, EVM) when GoPlus 429s, and RugCheck https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary (free) for Solana rows — both are in the owner's approved matrix and currently unused in this feature.

### Trust Wallet fit
Trust Wallet's only relevant offering — the trustwallet/assets GitHub logo registry — is ALREADY integrated exactly where it belongs: lib/sniper/feedIngest.ts:80-104 uses raw.githubusercontent.com/trustwallet/assets as the last-resort token logo (checksum-cased path, EVM only, UI handles the 404). That is the correct ceiling of its usefulness here: the registry is PR-curated and lags weeks-to-months, so for a feed of minutes-old meme launches the hit rate is near zero — DexScreener/GeckoTerminal imageUrl (already primary/secondary) is the right source. Nothing else in the Trust Wallet developer ecosystem helps sniping: wallet-core is a native signing library irrelevant to this web AA/session-key architecture; Trust Wallet deep links (trust://) would only open a token in someone else's wallet app, undermining the in-app execution loop; and there is no Trust Wallet developer API for launch detection, pricing, or token security. Recommendation: keep the existing logo fallback, adopt nothing further.

### Top fixes (priority order)
1. Fix the webhook chain mapping (ETH_MAINNET -> ethereum etc.) in app/api/webhooks/sniper-detect/route.ts:73 so the advertised low-latency matcher can actually fire, and check the sniper_detected_tokens insert error instead of swallowing it.
2. Implement or remove the price_target trigger: either add a price-check branch to sniper-monitor using the existing priceFeed, or remove the option from NewSniperModal — right now users configure a rule that can never fire.
3. Wire the token into the snipe flow: pass the clicked token (address, chain, symbol) into NewSniperModal as a prefill, and add a real quick-buy path (stage a pending_trade directly) instead of discarding it at page.tsx:494/527.
4. Delete or wire /api/sniper/execute — nothing calls it and its 'queued' rows pollute Executions/History forever; if kept, add a consumer that completes or expires queued rows.
5. Widen sniper-monitor's whale_activity window to match the 30-minute poll cadence (or register Alchemy address-activity webhooks) so whale_buy snipers can actually trigger, and normalize the address in the dedup queries (route.ts:242,307) to match the normalized inserts.
6. Remove or honor the fake controls: mev_protect, priority_fee_native, and expiry_hours are stored but never enforced — either implement (expiry is a one-hour cron; MEV-protect means routing AA userOps through protected RPCs) or drop the UI to stop advertising protection that does not exist.
7. Extend priceFeed USDC/chainId maps to base/arbitrum/optimism/polygon so autosell can protect positions on every chain background sniping can be armed on.
8. Populate bonding_curve_pct (PumpPortal WS or pump.fun API) or remove the BondingCurveBar and the graduation chime setting — both are currently dead UI.
9. Add a distinct error state (and 403/upgrade state) to the Discover feed instead of rendering provider/DB failures as 'No fresh pairs match these filters'.
10. Send Telegram alerts for cron-detected 'matched' decisions (sniper-monitor inserts events but never notifies, unlike matcher.ts), so alert-only snipers actually alert.

<details><summary>Verified working</summary>

- Discover feed end-to-end: dispatcher cron (vercel.json frequent */2min) -> app/api/cron/sniper-feed-ingest/route.ts -> lib/sniper/feedIngest.ts (GeckoTerminal new+trending pools, DexScreener enrichment, GT token-info second pass, Trust Wallet logo last resort at lib/sniper/feedIngest.ts:96-104) -> sniper_feed_tokens -> GET /api/sniper (app/api/sniper/route.ts:91-187 with chain/liquidity/source/audit/OG/search filters, sort, count-based pagination) -> DiscoverTab/TokenCard. 100% real provider data, 6h prune keeps it fresh.
- Security enrichment: app/api/cron/sniper-feed-enrich-security/route.ts backfills GoPlus security_score/is_honeypot/buy_tax/sell_tax/holders onto feed rows (with honest skip for unindexed tokens at :85-87 and rate-limit early exit at :126-129), driving status pills and the 'Exclude honeypots' filter.
- Shadow Guardian audit layer: GET /api/sniper/audit (app/api/sniper/audit/route.ts, GoPlus-backed, honest CAUTION fallback that never fakes SAFE at :104-111) consumed by a concurrency-limited, cached client (app/dashboard/sniper/sniperShared.tsx:240-301); blocked audits disable the buy button (components/sniper/TokenCard.tsx:60,146-157).
- Token drawer: GET /api/sniper/token-detail (GoPlus + DexScreener, chain-correct best pair at app/api/sniper/token-detail/route.ts:107-111) plus working Buy/Sell deep links to /dashboard/swap, price-alert creation via /api/market/alerts, and limit-order creation via /api/trading/limit-orders (app/dashboard/sniper/SniperTokenDrawer.tsx:104-152).
- Criteria CRUD: NewSniperModal -> POST /api/sniper/criteria with tier gate, wallet-ownership verification against user_wallets_v2 (app/api/sniper/criteria/route.ts:83-157), address canonicalization, and launchpad allowlist persistence; list/pause/delete via RLS'd Supabase from page.tsx:203-218,341-351.
- Launchpad allowlist (Snipe Protection) is enforced fail-closed in both matchers: lib/sniper/matcher.ts:191-197 and app/api/cron/sniper-monitor/route.ts:157-184 resolve the token's real launchpad from sniper_feed_tokens and refuse unknown pads.
- New-pair cron matching: app/api/cron/sniper-monitor/route.ts pulls live GeckoTerminal pairs, applies liquidity/age/security filters with correct null-as-unknown semantics (:282-298), daily snipe/spend caps with running-spend race fix (:210-220), and writes sniper_match_events.
- Auto-execution: app/api/cron/sniper-auto-execute/route.ts with DB cron lock (:78-84), atomic per-match claim (:127-141), fail-closed platform kill switch (:65-72), AA session-key background buy with entry-price/tokens seeding (:215-279), and pending_trades fallback with correct live schema + rollback of orphaned rows (:295-326). Confirm loop closes in app/api/trading/pending-trades/[id]/confirm/route.ts:187-260 which promotes to 'confirmed' and computes realized PnL on sells.
- Autosell monitor: app/api/cron/sniper-autosell/route.ts — strict on-chain decimals (never assumes 18, lib/sniper/priceFeed.ts:52-76), Jupiter/0x live pricing, TP/SL/trailing evaluation, peak tracking, AA sell with partial-fill accounting (:260-299), pending_trades fallback, duplicate-sell guard (:342-351).
- Live PnL marking in Positions tab: real marks read from sniper_feed_tokens with both raw and canonical address forms (page.tsx:797-844), honest 'no live mark' when a token aged out (page.tsx:932), priced/unpriced counts in the aggregate strip.
- User kill switch round-trips (POST/GET /api/sniper/kill-switch pauses/unpauses all criteria, app/api/sniper/kill-switch/route.ts:33-59) and the UI reloads snipers after toggle (page.tsx:353-372).
- Realtime: Supabase postgres_changes subscription on sniper_executions with insert+update merge and row flash (page.tsx:310-338); match-decision trail (MatchActivity) polls /api/sniper/executions with loading/error/empty states (page.tsx:965-1024).
- Webhook signature verification is correct (timing-safe HMAC multi-key for Alchemy, secret equality for Helius, app/api/webhooks/sniper-detect/route.ts:32-61).

</details>

## context-feed
**Verdict:** The feed genuinely aggregates ~17 real free-API sources with solid dedup, persistence and alerts, but the "live" layer is partly theater: SSE dies within 5 minutes and silently downgrades forever, event timestamps are fabricated at fetch time, upstream failures render as an innocent "Waiting for activity" empty state, and every cache miss fires ~70 uncached DexScreener calls with zero 429 handling.

### Broken
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

### Fake / unwired
- Fetch-time stamped as event time: recentTimestamp() returns new Date() and is used for CoinGecko gainers/trending, DexScreener trending, Birdeye, rug alerts and social events - every cache refresh, these events re-appear as 'just happened now'; the card clock shows a fabricated time (app/api/context-feed/route.ts:120-123,325,838,944; components/ContextFeed.tsx:730)
- displayTimestamp is deliberately fabricated: staggerDisplayTimestamps rewrites the visible clock so adjacent events are >=6s apart - the UI shows times that never occurred (lib/hooks/useContextFeed.ts:48-64; rendered at components/ContextFeed.tsx:730)
- Solana 'network activity' cards invent a USD figure (valueUsd = txCount * 0.01 * SOL price) and fabricate timestamps (Date.now() - i*60000) - pure made-up numbers shown as 'TX: $...' (app/api/context-feed/route.ts:605,610)
- Muted sources (CF3) is backend-only: the filter reads user_preferences.preferences.muted_feed_sources (app/api/context-feed/route.ts:35-53; lib/contextFeed/filter.ts:189-194) but a repo-wide grep shows NO component or settings page ever writes muted_feed_sources - users have no way to mute anything; the feature is unreachable
- SSE route header comment claims shared upstream tick and client reconnect - both false (app/api/context-feed/events/route.ts:6-8,21 vs lib/hooks/useContextFeed.ts:167-172)
- Birdeye is used as a feed source requiring BIRDEYE_API_KEY (app/api/context-feed/route.ts:16,687-724; lib/services/birdeye.ts:5) - Birdeye is NOT in the owner's locked free-tier API matrix; silently returns [] when the key is absent/exhausted

### Missing frontend layers
- Error state: no visual distinction between fetch failure / 500 / rate-limited and a genuinely quiet market - failures show 'Waiting for activity...' under a pulsing Live dot (components/ContextFeed.tsx:594-605,650-653)
- Live-status honesty: the 'Live' indicator pulses even after SSE has died and even when polling is failing - no degraded/reconnecting/stale badge
- No real virtualization: VIRTUAL_CAP=80 is a plain slice (components/ContextFeed.tsx:38,669) - 80 heavy glass cards stay mounted in the DOM; no windowing (react-window/virtua) and no 'load more' since cursor pagination is unwired
- No mute-source control anywhere in the UI despite full backend support (see fake_or_unwired)
- WCAG contrast failures: 'Powered by Naka Labs' is text-[10px] text-gray-600 (#4B5563 on near-black ~3:1, fails AA let alone AAA) at components/ContextFeed.tsx:212-214; 9px text-gray-500 stat labels (~4.6:1 at tiny size) at components/ContextFeed.tsx:782,788,794,812
- Unauthenticated state: bookmarks silently stay local-only for signed-out users with no hint they won't sync (components/ContextFeed.tsx:353-364,374-385); engagement likes are accepted optimistically with no auth feedback
- Loading state is a single full-panel spinner rather than card skeletons, so tab switches blank the whole feed (components/ContextFeed.tsx:620-634)
- MarketPulseCard fires once per mount and never refreshes during a long session (requestedRef, components/context-feed/MarketPulseCard.tsx:29-31) - the '8h refresh' only happens on remount

### Missing backend
- No durable shared cache for the assembled feed: responseCache is in-memory per-lambda with a 5s TTL (app/api/context-feed/route.ts:127-128) - every cold instance rebuilds from ~70 upstream calls. Upstash Redis is in the approved matrix and unused here
- No in-flight request coalescing: N concurrent cache-miss requests each run the full 17-source Promise.all
- No 429/backoff/circuit-breaker handling for DexScreener, CoinGecko or GeckoTerminal - non-OK responses silently become [] with no retry-after respect and no source-health signal to the UI
- No real event-time pipeline: DexScreener/CG events lack true occurrence timestamps (only GeckoTerminal new pairs use pairCreatedAt, route.ts:736) - the fix is to persist first-seen time in context_feed_events and serve that, instead of stamping now() per fetch
- SSE fan-out layer absent: the persisted context_feed_events table (route.ts:206-242) is the natural Supabase Realtime publication source; instead each client gets a private 5-min self-polling function
- No Solana whale-transfer source: Solana 'news' is fabricated network-activity cards; Helius (approved, free tier) enhanced transactions are unused for this feature
- Cursor pagination exists server-side but no backend contract test / client consumer, so it can rot unnoticed

### Free-API recommendations
- Replace Birdeye (not in the approved matrix) with GeckoTerminal trending pools: GET https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token (free, no key, 30 req/min) - same fields (price, volume, liquidity, fdv) the Birdeye mapper needs
- Fix CoinGecko chain misattribution with GET https://api.coingecko.com/api/v3/coins/{id}?localization=false&tickers=false&market_data=false - read asset_platform_id / platforms to tag the real chain; cache per-coin in Upstash for 24h so it costs ~1 call per new coin
- Real Solana whale events via Helius (approved): POST https://api.helius.xyz/v0/addresses/{address}/transactions?api-key=KEY with type=TRANSFER for the whales-table Solana addresses - replaces the fabricated network-activity cards with genuine transfers
- Feed distribution: publish assembled events into the existing Supabase context_feed_events table and use Supabase Realtime (postgres_changes on that table) client-side instead of the SSE self-poll route - zero Vercel function-duration per listener, free on Supabase
- Cache the assembled per-chain feed JSON in Upstash Redis (SETEX 30-60s) with a lock key (SET NX PX) for regeneration to coalesce cold-start stampedes and keep DexScreener under its 60/min profiles-boosts cap
- Fallback chain for trending discovery: DexScreener token-boosts/top/v1 -> GeckoTerminal /networks/{net}/trending_pools -> CoinGecko /search/trending; for new listings: GeckoTerminal /networks/{net}/new_pools (already used) -> DexScreener token-profiles/latest/v1
- Token security fallback already partially present (GoPlus): add Honeypot.is GET https://api.honeypot.is/v2/IsHoneypot?address={addr}&chainID={id} (free) as second opinion for rug_alert, and RugCheck GET https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary for the missing Solana rug coverage

### Trust Wallet fit
Mostly not useful for this feature. Trust Wallet has no event, feed, market-data, or trending API - nothing it offers helps event sourcing, SSE, dedup, or filtering. The one marginal fit is the trustwallet/assets GitHub logo registry (https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png, free CDN): it could fill the missing tokenIcon on Alchemy ERC-20 transfer cards (app/api/context-feed/route.ts:528-573 sets no tokenIcon), but it only covers established tokens - the feed's core content (fresh pump.fun/GeckoTerminal launches) will never be in that registry, and DexScreener/CoinGecko/GeckoTerminal already supply info.imageUrl for discovery events. Trust Wallet deep links (https://link.trustwallet.com/open_url or asset links) could add an 'Open in Trust Wallet' action per card, but the platform already has its own in-app swap, so it would leak users out of the product. wallet-core is irrelevant (native signing library). Verdict: use the assets registry only as a last-resort icon fallback for ERC-20 transfer cards; everything else the feature needs is better served by the already-approved DexScreener/GeckoTerminal/CoinGecko image fields.

### Back-button offenders
- app/dashboard/proof/page.tsx:395 - 'Back to Dashboard' on the event-not-found state hardcodes router.push('/dashboard') instead of history back, dropping the user's feed tab/filter/scroll context (the View Proof flow entered from ContextFeed.tsx:836-839)
- app/dashboard/proof/page.tsx:453 - BackButton href="/dashboard?subtab=context" forces a hardcoded destination rather than router.back(); works only because ContextFeed separately persists state to sessionStorage, and breaks if the user reached proof from anywhere else (e.g. a shared link then browsing)

### Top fixes (priority order)
1. Fix the SSE lifecycle or replace it: either (a) client-side reconnect with exponential backoff, and stop emitting `event: error` frames for transient upstream blips (they trigger EventSource.onerror and kill the stream permanently), or better (b) delete the per-client self-polling SSE route and subscribe to the already-persisted context_feed_events table via Supabase Realtime - saves Vercel function-hours and gives true shared fan-out
2. Add an honest error state: propagate fetch failure from useContextFeed and render 'Feed unavailable - retrying' instead of 'Waiting for activity' under a fake Live dot
3. Move the assembled feed cache to Upstash Redis (30-60s TTL + regeneration lock) and add 429-aware backoff for DexScreener - the current 5s per-lambda cache guarantees rate-limit breaches at any real traffic
4. Stop fabricating times and values: persist first-seen timestamps in context_feed_events and serve those instead of stamping now() per fetch; remove the 6s displayTimestamp stagger (show relative 'first seen 4m ago'); delete the invented valueUsd on Solana network-activity cards or replace them with real Helius transfers
5. Resolve the real chain for CoinGecko events (asset_platform_id) and normalize sentiment casing at the source so badges and colors are correct
6. Ship the mute-source UI (a 'mute this source' item on each card writing muted_feed_sources) or remove the dead server path; same decision for the unwired cursor pagination (wire an infinite-scroll 'load more' or delete it and correct the misleading Archive copy at ContextFeed.tsx:904)
7. Swap Birdeye for GeckoTerminal solana trending_pools to comply with the locked free-API matrix
8. Change proof/page.tsx:395 to router.back() with a /dashboard?subtab=context fallback, matching the shared BackButton's referrer-aware pattern

<details><summary>Verified working</summary>

- Live feed end-to-end: ContextFeed.tsx -> useContextFeed (lib/hooks/useContextFeed.ts:74-197) -> GET /api/context-feed aggregating real sources (Alchemy transfers, DexScreener search/profiles/boosts, GeckoTerminal new pairs, CoinGecko gainers/trending/top-10, GoPlus rug alerts, LunarCrush social velocity, Birdeye Solana) each wrapped in a per-source timeout (app/api/context-feed/route.ts:167-183, 1303-1330)
- Server-side dedup by id + platform-symbol-chain-fullAddress key (app/api/context-feed/route.ts:1206-1223) and client-side dedup by id on merge (lib/hooks/useContextFeed.ts:84-101)
- Cross-instance archive: every fetched batch persisted to Supabase context_feed_events with 72h cleanup, archive tab reads the 24-72h window with in-memory fallback (app/api/context-feed/route.ts:206-271)
- Muted-source filtering works server-side: user_preferences.preferences.muted_feed_sources read per request (app/api/context-feed/route.ts:35-53) and applied in applyContextFilter (lib/contextFeed/filter.ts:189-194) - but see fake_or_unwired: no UI can set it
- Feed Alerts: full authenticated CRUD with zod validation, 25-alert cap, ownership-scoped admin queries (app/api/context-feed/alerts/route.ts), wired UI (components/context-feed/FeedAlertsButton.tsx), and feed-alert-monitor cron registered in the dispatch group (app/api/cron/dispatch/[group]/route.ts:30, vercel.json crons)
- Engagement (views/likes/shares) is real: aggregated from Supabase context_feed_engagement rows, no fabricated counts (app/api/engagement/route.ts:35-54)
- Bookmarks: localStorage-instant + Supabase bookmarks table sync on auth (components/ContextFeed.tsx:346-388)
- Market Pulse card: Anthropic-generated 2-3 sentence summary, 8h singleton DB cache with atomic claim to prevent thundering-herd model calls, prompt-injection hardening, auto-hides with no fabricated text (app/api/context-feed/pulse/route.ts, components/context-feed/MarketPulseCard.tsx)
- Dune cards read real materialized tables (dune_bridge_flows, dune_wash_trade_score, ...) and return null when empty - no mock cards (components/context-feed/DuneFeedCards.tsx:44, lib/dune/useSurfaces.ts:220+)
- Smart-money labeling from the platform's own whales table with correct Solana base58 vs EVM address normalization (app/api/context-feed/route.ts:449-499)
- Smart-money convergence badges: batched /api/intelligence/convergence lookup rendered on matching cards (components/ContextFeed.tsx:282-293, 740-755; app/api/intelligence/convergence/route.ts)
- Tab/filter/scroll persistence to sessionStorage with pagehide handling (components/ContextFeed.tsx:222-335)
- GoPlus security endpoint for View Proof with honest Unknown for partial LP data and 429 -> 503 Retry-After (app/api/context-feed/security/route.ts)
- Shared pill matcher fixed the previously-empty news/new_coins filters and made the Volume pill metric-based (lib/contextFeed/filter.ts:124-179)

</details>

## copy-social-trading
**Verdict:** Copy-trading has unusually deep, real plumbing (rules CRUD, atomic cap RPC, GoPlus gate, relayer, cron+webhook matcher) but is broken at the seams — live schema rejects the statuses the code writes, key entry points are dead, TP/SL and liquidity knobs are decorative, zero rules/trades exist in prod — while social-trading is a stale 'Coming Soon Q3 2025' shell that advertises the copy-trading feature that already shipped.

### Broken
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

### Fake / unwired
- Entire social-trading page is a 'Coming Soon' marketing shell with a hardcoded PLANNED_FEATURES array whose first card advertises 'Copy Trading' — a feature that already shipped at /dashboard/copy-trading — app/dashboard/social-trading/page.tsx:8-45,61-78
- Stale launch promise: 'Q3 2025 / Estimated Launch Private Beta' hardcoded on the social-trading page; today is July 2026, the date is a year past — app/dashboard/social-trading/page.tsx:105-111
- tp_pct / sl_pct (take-profit/stop-loss) are collected in the modal, validated by the API, stored, and rendered as green/red badges on rule cards — but NO code anywhere reads them for execution; there is no TP/SL monitor for copy positions (repo-wide grep: only write paths) — NewCopyRuleModal.tsx:254-255, rules/route.ts:123-124, page.tsx:312-313
- min_liquidity_usd is stored (default 50000) and SELECTed by the matcher but never compared against anything — no liquidity check exists in matcher.ts or execute route — lib/copy/matcher.ts:110 (selected, unused), app/api/copy-trading/rules/route.ts:128
- Page header claims 'Every trade passes GoPlus + your rules' — true for GoPlus, false for the min-liquidity and TP/SL rules (page.tsx:228)
- Zero production usage verified live: 0 rows in user_copy_rules and 0 in user_copy_trades ever, despite 51,749 whale_activity rows/7d — the feature has never executed once; all 'working' claims are code-verified, not production-proven

### Missing frontend layers
- copy-trading page has no error/unauthenticated/upgrade states: load() has no catch, and 401/403 responses (whole feature is pro-gated) render as 'No copy rules yet' with no sign-in or upgrade prompt — page.tsx:130-143,281-288
- Free-tier users see a fully interactive page (New rule, 24/7 Auto buttons) that can only ever 403 — no tier gate banner anywhere on the page
- AutoCopySessionModal is EVM-only (6 chains) even though a Solana session-key signer exists server-side — Solana auto-copy has no enable UI — components/copy/AutoCopySessionModal.tsx:38 vs lib/trading/solanaSessionKeySigner.ts
- Trades table: no token logos, no pagination past the 200-row limit, no explorer link for copied_tx_hash, statuses expired/blocked_* fall to unstyled gray — page.tsx:341-379
- No nav entry for either page in SidebarMenu/CommandPalette — feature is undiscoverable except via whale-tracker
- Social-trading page: stale Q3 2025 date, waitlist success-on-failure, and it duplicates a shipped feature instead of linking to it

### Missing backend
- Schema source-of-truth drift: live DB constraint includes 'alert' (added as an untracked hotfix) but repo migrations end at ('pending','success','failed','cancelled','expired') — a fresh deploy from migrations would break alerts_only mode too; and no migration anywhere re-adds 'blocked_rule'/'blocked_security' which the code still writes
- No pipeline registration on rule creation: creating a copy rule should auto-insert user_whale_follows and add the address to the Alchemy/Helius webhook subscription (both are manual dashboard steps today) — otherwise arbitrary-address rules never trigger
- No TP/SL execution engine for copy positions (rules store tp_pct/sl_pct; nothing monitors entry price vs current price; contrast with the existing stop-loss-monitor cron for stop_loss_orders)
- No liquidity enforcement: min_liquidity_usd stored but no DexScreener/GeckoTerminal liquidity lookup exists in the copy path
- GoPlus failure fails OPEN with no fallback: relayer catches GoPlus errors and proceeds (relayer.ts:100-104); no Honeypot.is or RugCheck fallback in the chain despite both being in the approved free matrix
- No sweeper for user_copy_trades rows stuck 'pending' without a matching pending_trades row (the matcher failure-path leak) — pending-trades-cleanup only walks pending_trades
- No tier re-validation at execution time: matcher/cron execute auto_copy and oneclick rules for users whose pro/max tier has lapsed (matcher.ts has no profile check; only rule creation is gated)
- No server-side whale_address format validation (EVM checksum / base58) — rules/route.ts:67 only checks non-empty

### Free-API recommendations
- DexScreener (free, no key) to enforce min_liquidity_usd: GET https://api.dexscreener.com/latest/dex/tokens/{tokenAddress} -> max(pairs[].liquidity.usd); call it in lib/copy/matcher.ts and execute route before claim_copy_trade; same response supplies token logo (info.imageUrl) for the trades table
- Security fallback chain in relayer.ts instead of fail-open: GoPlus (current) -> Honeypot.is GET https://api.honeypot.is/v2/IsHoneypot?address={token}&chainID={id} (EVM, free) -> RugCheck GET https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary (Solana, free); block only if two sources agree or first source says honeypot
- Alchemy Notify webhook management (free tier) to auto-register rule whales: PATCH https://dashboard.alchemy.com/api/update-webhook-addresses with {webhook_id, addresses_to_add:[whale]} on rule creation; Solana equivalent: PUT https://api.helius.xyz/v0/webhooks/{webhookID}?api-key=... appending accountAddresses — closes the dead-rule gap without polling
- TP/SL engine for copy positions: hourly/2-min cron mirroring stop-loss-monitor, pricing via DexScreener batch GET https://api.dexscreener.com/latest/dex/tokens/{addr1},{addr2},... (up to 30 per call, free) against user_copy_trades success rows with actual_price; fire the existing relayer sell path when tp_pct/sl_pct hit
- Jupiter (already integrated) remains correct for Solana execution; 0x/1inch/KyberSwap/OpenOcean chain already wired via lib/services/swap-aggregator — no paid API needed anywhere in this feature
- Token logos: trustwallet/assets raw CDN (https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{checksummedAddress}/logo.png) is a viable free option, but DexScreener already returns imageUrl in the same call you need for liquidity — prefer one call over two

### Trust Wallet fit
Trust Wallet's developer ecosystem offers nothing that advances copy-trading execution: there is no Trust Wallet copy-trading or account API; wallet-core is a native (C++/mobile) signing library irrelevant to this Next.js + WalletConnect web flow; Trust Wallet deep links (link.trustwallet.com) can only open the app to a send/dapp screen and cannot sign the platform's pending_trades — Trust Wallet users are already reachable through the existing Reown AppKit/WalletConnect integration (components/copy/AutoCopySessionModal.tsx already resolves any injected/WC wallet). The single marginal asset is the trustwallet/assets GitHub logo registry for token images in the rules/trades tables, and even that is second-best: DexScreener returns a token logo in the same free call this feature needs anyway for the unenforced min_liquidity_usd check. Recommendation: skip Trust Wallet integration for this feature; spend the effort on DexScreener liquidity + logos and Alchemy/Helius webhook auto-registration.

### Top fixes (priority order)
1. Reconcile user_copy_trades status values with the live CHECK constraint: either add 'blocked_rule'/'blocked_security' via a committed migration (and commit the live-only 'alert' hotfix to the repo), or change execute/route.ts to write allowed statuses — and make recordBlocked() check its insert error instead of swallowing it (execute/route.ts:100-118)
2. Stop the daily-cap lockout: on ANY relayer rejection, update the claimed row to 'failed' in the matcher (matcher.ts:371-376, mirroring execute/route.ts:332), fix the blocked_security update that violates the constraint, and add a sweeper for user_copy_trades 'pending' rows with no pending_trades row
3. Wire rule creation into the trigger pipeline: auto-insert user_whale_follows, auto-register the address on the Alchemy/Helius webhook via their management APIs, and validate the address format server-side — today a hand-typed whale rule can never fire
4. Fix the tier contradiction: allow alerts_only rule creation at free/mini (drop withTierGate('pro') to a per-mode check, which the route half-implements already at rules/route.ts:93-112) or lock the mode in the modal; add an upgrade banner to the page for gated users
5. Honor ?whale=&chain= on /dashboard/copy-trading by auto-opening NewCopyRuleModal prefilled — the watchlist and directory Copy buttons are currently dead ends
6. Remove avalanche from the modal chain list (or add its USDC address to both maps)
7. Enforce min_liquidity_usd via DexScreener and build the TP/SL monitor cron — or remove both fields from the UI; shipping unenforced risk controls on a product that moves real money is worse than not offering them
8. Replace the social-trading coming-soon page (stale 'Q3 2025') with a redirect to /dashboard/copy-trading or a real hub linking copy-trading + the existing social leaderboards API; fix the waitlist form to check the supabase error; add both features to the sidebar nav

<details><summary>Verified working</summary>

- Rules CRUD end-to-end: app/dashboard/copy-trading/page.tsx:130-193 -> GET/POST /api/copy-trading/rules (rules/route.ts:24-138, real validation + upsert on user_id,whale_address,chain) and PATCH/DELETE /api/copy-trading/rules/[id] (rules/[id]/route.ts:24-92), backed by live user_copy_rules table with RLS (supabase/migrations/2026_session5b1_batch2.sql:118-138; live columns verified match code incl. mode/pct_of_whale/tp_pct/paused)
- Manual execute flow: Telegram deep-link confirm card (page.tsx:75-120) -> POST /api/copy-trading/execute (execute/route.ts:74-344) with Idempotency-Key replay protection (execute/route.ts:95-97), rule guards, GoPlus token+address security scoring (execute/route.ts:174-197), atomic advisory-lock daily-cap claim via claim_copy_trade RPC (execute/route.ts:205-224; function verified present in live DB; migration 2026_06_27_atomic_copy_trade_cap.sql)
- Non-custodial relayer: lib/trading/relayer.ts:70-228 — GoPlus pre-check, multi-provider route discovery (0x et al via lib/services/swap-aggregator), pending_trades insert + user notification; confirm/reject/expire lifecycle correctly updates user_copy_trades (pending-trades/[id]/confirm/route.ts:178-186, reject/route.ts:81-86, cron/pending-trades-cleanup/route.ts:70-77)
- Cron is genuinely scheduled: copy-trade-monitor runs every 2 min via the dispatch/frequent group (vercel.json crons + app/api/cron/dispatch/[group]/route.ts:26-31), short-circuits when no enabled rules exist (copy-trade-monitor/route.ts:49-51), and delegates to the single canonical matcher lib/copy/matcher.ts
- Webhook fast path: alchemy-whale and helius-whale webhooks call matchCopyEvent per activity row (app/api/webhooks/alchemy-whale/route.ts:240, helius-whale/route.ts:239); whale_activity data is real and flowing (51,749 rows in last 7 days, verified live)
- 24/7 auto-copy session-key plumbing: AutoCopySessionModal.tsx EIP-712 authorization -> /api/trading/session-key, honored in relayer Layer 2.5 (relayer.ts:124-162) gated behind SESSION_KEY_SIGNER_ENABLED, with Solana + EVM signers (lib/trading/sessionKeySigner.ts:49-50, solanaSessionKeySigner.ts:41-42)
- Chain-aware whale matching: Solana base58 exact-match vs EVM case-insensitive (matcher.ts:99-116); sell-side sizing via Alchemy balance lookups (lib/trading/copyTradeSell.ts:136-152)

</details>

## onchain-trends
**Verdict:** The three pages are genuinely wired to real data (DeFiLlama TVL, CoinGecko trending/gainers) but the owner's mandated CoinGecko->DexScreener->GeckoTerminal fallback chain exists nowhere in this feature, the fallbacks that do exist are dead (CoinCap v2) or fake-shaped (DexScreener text-search of the chain name sold as "trending tokens"), and a cache-poisoning bug plus a dead "VTX Analysis" UI block undermine trust in the trends page.

### Broken
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

### Fake / unwired
- 'Trending tokens by chain' is not trending data: /api/market?type=trending-tokens calls searchPairs(chain), i.e. a DexScreener free-text search for the literal string 'ethereum'/'solana' — it returns pairs whose token NAME matches the chain name, then presents them as trending tokens for that chain (app/api/market/route.ts:68-83; lib/services/dexscreener.ts:77-83). Consumed by dna-analyzer (app/dashboard/dna-analyzer/page.tsx:345).
- 'VTX Analysis' insight block and per-card alert chip are dead UI: TrendDrawer renders card.insight under a 'VTX Analysis' brand (app/dashboard/trends/page.tsx:162-169) and InsightCard renders card.alert (page.tsx:78-80), but the API never sets `insight` or `alert` on ANY card (app/api/intelligence/on-chain-trends/route.ts:81-169 — no card object includes either field). The AI-analysis feature the drawer advertises has no backend.
- Volume and Addresses cards hardcode change24h: 0 / change7d: 0 with empty sparklines, which the card UI renders as a literal '0.00% 24h' flat reading — a fabricated 'no change' figure, since no historical data exists for those metrics (app/api/intelligence/on-chain-trends/route.ts:144,151; rendered at app/dashboard/trends/page.tsx:70-75).
- 'LIVE' badge on trends header is hardcoded — it shows green LIVE before the first fetch and during/after failures (app/dashboard/trends/page.tsx:243).
- Volume/Addresses cards depend on Bitquery, gated behind BITQUERY_API_KEY (app/api/intelligence/on-chain-trends/route.ts:126; lib/services/bitquery.ts:43-45) — Bitquery is NOT in the owner's locked free-API matrix, and without the key the cards silently never appear.
- /api/market/dex-category 'bnb-meme' preset is a DexScreener text search for the word 'meme' on BSC, not a meme-category feed (app/api/market/dex-category/route.ts:72-73) — tokens without 'meme' in their name never appear.

### Missing frontend layers
- Distinct error state + retry button on all three pages (currently error collapses into empty state — see broken items).
- Timeframe pills (1h/7d) on /dashboard/top-gainers: the UI is hard-locked to 24h with a stale comment claiming upstream can't sort other timeframes (app/dashboard/top-gainers/page.tsx:75-79), but the backend now fully supports timeframe ordering (app/api/dashboard/top-gainers/route.ts:41-42; lib/services/coingecko.ts:219-245). Built backend capability with no UI.
- Trends page stat tile 'Chains Tracked' shows data.chains.length - 1 which is 0-or-negative if the API returns a degraded chain list (app/dashboard/trends/page.tsx:291) — no guard.
- Freshness indicator tied to server updatedAt: the API returns updatedAt (route.ts:172) but the page shows client-side lastRefresh instead (app/dashboard/trends/page.tsx:190,246), so a 5-min-stale cached payload displays as 'Updated <now>'.
- Trends drawer has no deep-link/share and no link from a chain card to that chain's tokens (drawer is display-only, app/dashboard/trends/page.tsx:106-180).
- Trending/top-gainers rows show no data-source or as-of timestamp; glassmorphism (nl-glass) is otherwise consistent across all three pages.

### Missing backend
- The owner-mandated fallback chain CoinGecko -> DexScreener -> GeckoTerminal is implemented in NONE of the scoped routes: /api/dashboard/trending and /api/dashboard/top-gainers are CoinGecko-only (single point of failure), /api/market-data falls back to dead off-matrix CoinCap, /api/intelligence/on-chain-trends is DeFiLlama-only. lib/services/geckoterminal.ts exists in the repo but is not imported by any of these routes.
- No shared cache: all caching is per-lambda in-memory (lib/api/cache-manager.ts Map + module-level `cache` in on-chain-trends/route.ts:50). On Vercel serverless, every warm instance keeps its own copy, multiplying CoinGecko free-tier calls (~30 rpm demo) and causing the 429/staleness the owner complains about. Upstash Redis is in the locked matrix and unused here.
- No last-good-response persistence: when an upstream fails there is nothing stale to serve — routes return empty arrays or $0 values instead of the previous good payload.
- No stablecoin market-cap history pipeline — the stablecoin card ships an intentionally empty sparkline (route.ts:163-167) even though DeFiLlama exposes the history for free.
- No real volume/active-address change pipeline — the Bitquery cards carry hardcoded 0% deltas and no sparkline because no history is fetched.
- No per-endpoint rate-limit budgeting or backoff beyond the single 429->public retry in coingecko.ts:74-83 (the public endpoint shares the same IP rate limit, so the retry usually 429s too).

### Free-API recommendations
- Replace Bitquery Volume cards with DeFiLlama DEX overview (free, keyless, already the page's data vendor): GET https://api.llama.fi/overview/dexs/{chain}?excludeTotalDataChart=false — gives real 24h volume, change_1d/change_7d, and totalDataChart for a genuine sparkline. Kills the off-matrix Bitquery dependency and the hardcoded 0% deltas in one move.
- Stablecoin sparkline: GET https://stablecoins.llama.fi/stablecoincharts/all — daily totalCirculatingUSD history; last 14 points give the real sparkline and real 24h/7d change for the stablecoin card.
- Fix 'trending tokens by chain' with GeckoTerminal (in matrix, free, 30 rpm): GET https://api.geckoterminal.com/api/v2/networks/{network}/trending_pools — actual trending pools per chain, with base_token price, 24h change, and volume. Use DexScreener GET https://api.dexscreener.com/token-boosts/top/v1 as the secondary.
- Trending fallback chain for /api/dashboard/trending: primary CoinGecko /search/trending -> fallback GeckoTerminal /api/v2/networks/trending_pools (cross-chain) -> fallback DexScreener /token-boosts/top/v1; normalize all three to the existing EnrichedTrending shape.
- Top-gainers fallback: CoinGecko /coins/markets?order=price_change_percentage_{tf}_desc is the only clean global source — back it with an Upstash Redis last-good cache (SET trends:gainers:{tf} EX 900) and serve stale-with-flag on 429/5xx instead of an empty list. Delete the CoinCap path from /api/market-data and use the same pattern there.
- Move cache-manager to Upstash Redis (in matrix, free tier 500K commands/mo): one shared cache across lambda instances cuts CoinGecko call volume roughly by instance count and directly addresses the freshness complaint.
- Fear & greed: keep https://api.alternative.me/fng/ (free, keyless) but note it is off-matrix; CoinGecko Demo has no F&G equivalent, so either add alternative.me to the matrix or drop the widget.
- Active-addresses card: if the owner wants it without Bitquery, use a Dune (in matrix, free tier) saved query over daily active addresses per chain via /api/v1/query/{id}/results, refreshed by the existing cron infrastructure; otherwise remove the card rather than gate it on an off-matrix key.
- DeFiLlama itself (api.llama.fi) is off the locked matrix but free, keyless, and load-bearing for the whole trends page — recommend the owner formally adds it; there is no in-matrix substitute for chain TVL history.

### Trust Wallet fit
Trust Wallet offers nothing for the trends page itself (chain-level TVL/volume metrics have no Trust Wallet counterpart) and nothing better than CoinGecko for trending/gainers data. Its one genuine fit here is the trustwallet/assets GitHub logo registry as an image BACKSTOP for the DexScreener-sourced rows that ship with empty images today (app/api/market/dex-category/route.ts:33 falls back to '' and app/api/market/route.ts:80 passes info?.imageUrl which is often undefined) — and the repo already has this built and correctly implemented (EIP-55 checksumming included) in lib/services/trustwallet.ts:42-58; it just is not wired into these routes (only swap/token-meta, sniper feedIngest, and goplusService use it). The tws.trustwallet.com HMAC gateway client in the same file is inert (env-gated, endpoints unverified per its own comment at lib/services/trustwallet.ts:13-20) and its 1 req/s free tier is strictly worse than CoinGecko/GeckoTerminal for trending data — do not build on it. wallet-core and deep links are irrelevant to this feature.

### Back-button offenders
- app/dashboard/trending/page.tsx:77 — <BackButton href="/dashboard" /> forces router.push('/dashboard') (components/ui/BackButton.tsx:21-23) instead of history back; users arriving from the market page or a dashboard card get bounced to /dashboard.
- app/dashboard/top-gainers/page.tsx:110 — same hardcoded <BackButton href="/dashboard" />. (The trends page at app/dashboard/trends/page.tsx:236 uses the prop-less <BackButton /> which correctly walks history — the fix is just deleting the href prop on the other two.)

### Top fixes (priority order)
1. Fix the on-chain-trends cache poisoning: filter a copy ({ ...result, cards: result.cards.filter(...) }) instead of mutating the object stored in the module cache (app/api/intelligence/on-chain-trends/route.ts:173-179).
2. Delete the dead CoinCap fallback in /api/market-data and replace it with an Upstash Redis last-good cache plus GeckoTerminal; implement the mandated CoinGecko->DexScreener->GeckoTerminal fallback chain in /api/dashboard/trending and /api/dashboard/top-gainers.
3. Replace the fake 'trending tokens by chain' (DexScreener text search of the chain name) with GeckoTerminal /networks/{network}/trending_pools (app/api/market/route.ts:68-83).
4. Swap the Bitquery Volume/Addresses cards for DeFiLlama /overview/dexs/{chain} so the 24h/7d deltas and sparklines are real instead of hardcoded 0, and the off-matrix Bitquery key requirement disappears.
5. Stop rendering $0 TVL/stablecoin cards when DeFiLlama fails: have the route return 503 when getDLChains/getDLGlobalTvl come back empty, and give all three pages a real error state with a retry button.
6. Remove or actually implement the 'VTX Analysis' insight block and per-card alert chip — the backend never populates card.insight or card.alert (app/dashboard/trends/page.tsx:78-80,162-169).
7. Wire the real stablecoin sparkline from stablecoins.llama.fi/stablecoincharts/all.
8. Drop the hardcoded href on BackButton in trending and top-gainers pages so back goes back; re-enable the 1h/7d timeframe pills on top-gainers now that the backend orders correctly.
9. Tie the 'LIVE' badge and 'Updated' timestamp to the server's updatedAt field and data-fetch success, not to a hardcoded badge and client clock.
10. Move the in-memory cache layer to Upstash Redis so all lambda instances share one CoinGecko budget — the root cause of the freshness/429 complaints.

<details><summary>Verified working</summary>

- /dashboard/trends end-to-end: page fetches /api/intelligence/on-chain-trends (app/dashboard/trends/page.tsx:203) -> route builds real Global TVL, per-chain TVL (top 5), and stablecoin cards from live DeFiLlama endpoints api.llama.fi/v2/chains, /v2/historicalChainTvl, stablecoins.llama.fi (app/api/intelligence/on-chain-trends/route.ts:65-171, lib/services/defillama.ts:42-98). Sparklines are real 14-point TVL history, 24h/7d deltas computed from real history, alerts generated on real >10% moves (route.ts:114-121).
- /dashboard/trending end-to-end: page (app/dashboard/trending/page.tsx:43) -> /api/dashboard/trending -> CoinGecko /search/trending enriched with /coins/markets prices+sparklines (app/api/dashboard/trending/route.ts:33-53, lib/services/coingecko.ts:396-404, 380-394). Watchlist toggle wired via useWatchlist, 5-min auto-refresh, click-through routes to token detail via resolveTokenChain.
- /dashboard/top-gainers end-to-end: page (app/dashboard/top-gainers/page.tsx:80) -> /api/dashboard/top-gainers -> CoinGecko /coins/markets ordered server-side by the requested timeframe (lib/services/coingecko.ts:219-245), with honest $1M market-cap floor and gainers/losers direction filter (app/api/dashboard/top-gainers/route.ts:52-65); 2-min polling; nav state persisted via useNavState.
- /api/market-data primary path: CoinGecko /coins/markets with real category slugs, 1h/24h/7d percentages and sparklines, 5-min ISR (app/api/market-data/route.ts:9-29,52-111); consumed by components/MarketDashboard.tsx:155 and components/Markets.tsx:59.
- /api/market?type=fear-greed (alternative.me, real) and type=trending (CoinGecko /search/trending with real 24h change) (app/api/market/route.ts:20-53).
- Server-side caching + CDN headers everywhere: withCache/TTL layer (lib/api/cache-manager.ts), CoinGecko 429 fallback to unauthenticated public base (lib/services/coingecko.ts:74-83), Cache-Control s-maxage on all routes.
- Loading skeletons on trending and top-gainers list pages (app/dashboard/trending/page.tsx:88-91, app/dashboard/top-gainers/page.tsx:154-157) and spinner on trends (app/dashboard/trends/page.tsx:297-301). Mobile layouts are responsive (grid-cols-1 sm:grid-cols-2 on trends).

</details>
