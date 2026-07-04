# Trust Wallet Agent Kit — Integration Map

Transport is built (`lib/services/trustwallet.ts` → `twGet`, HMAC, env-gated,
circuit breaker, base `https://api.trustwallet.com`). It's additive-only:
`twGet` returns `null` when unconfigured/failing, so every wire is
`const tw = twGatewayConfigured() ? await twGet(...) : null;` placed AFTER the
existing primary and guarded by `?? primary`. Zero regression risk.

**Gate:** confirm live response shapes via `/api/trustwallet/probe?secret=…` (or
the `trustwallet_probe_log` table the cron writes) BEFORE wiring the money/price
paths — a guessed schema there is dangerous. Security/search/trending are safe
first-wave.

## Ranked wire list (best ROI first)

| # | Capability | Where | Mode |
|---|-----------|-------|------|
| 1 | security | `app/api/context-feed/security/route.ts` (GoPlus 429 dead-end) | fallback |
| 2 | security | `app/api/cron/sniper-feed-enrich-security/route.ts` (GoPlus throttle breaks batch) | fallback |
| 3 | security | `lib/trust/calculate.ts` `securityLayer` (40% weight, map to null-excludes convention) | fallback |
| 4 | security+meta | `app/api/token-scanner/route.ts` (EVM + Solana) | fallback |
| 5 | price | `app/api/vtx/token-card/route.ts` chart+resolve ladders | fallback→graceful-primary |
| 6 | price | `app/api/prices/batch/route.ts` (single CoinGecko, feeds alert monitor) | fallback |
| 7 | price | `app/api/portfolio/live-prices/route.ts` (long-tail contracts → $0) | fallback |
| 8 | market | `app/api/market/prices/route.ts` (CG→CoinCap, insert TW tickers) | fallback |
| 9 | price | `lib/sniper/priceFeed.ts` (TON returns null; money path) | graceful-primary (TON) |
| 10 | balance | `app/api/wallet/balances/route.ts` (Alchemy EVM + Helius Solana) | graceful-primary candidate |
| 11 | balance | `app/api/wallet-intelligence/multichain/route.ts` (6-way fan-out → 1 call) | fallback |
| 12 | search | `app/api/swap/token-search/route.ts` (add TW /v1/search/assets) | fallback |
| 13 | metadata+logo | `app/api/swap/token-meta/route.ts` (symbol/name/decimals) | fallback |
| 14 | price+meta | `app/api/market/token/[id]/route.ts` | fallback |
| 15 | tx-history | `app/api/wallet/transactions/route.ts` | fallback |
| 16 | swap | `app/api/swap/quote/route.ts` (0x; add TW route on no-route) | fallback |
| 17 | swap routing | `app/api/swap/routes/route.ts` (`swap-aggregator`) | fallback |
| 18 | trending | market discovery / context-feed pulse — **net-new "Trending" strip** | graceful-primary (net-new) |
| 19 | logo | `app/api/wallet/balances/route.ts`, scanner rows (`trustWalletAssetLogoUrl`) | fallback |
| 20 | security | `app/api/sniper/token-detail/route.ts` | fallback |

## Response fields (from @trustwallet/cli): `price`, `market_cap`, `price_change_24h`,
`volume_24h`, `symbol`, `decimals`, `name`, `logoUrl`, `totalSupply`,
`circulatingSupply`, `assetId`, `coinId`. Handle snake+camel case.

## First wave once probe is green (safe, high-ROI): rows 1–4 (security fallbacks),
12 (search), 18 (trending strip), 19 (logo backstop). Then price paths 5–9 after
shape confirmation, then swap 16–17.
