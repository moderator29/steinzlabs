# Phase 0.5b Audit — Market + Trading Terminal

## Current state

### `/app/market/*` (existing market flow)
- `app/market/page.tsx` — thin redirect to `/market/prices`.
- `app/market/prices/page.tsx` — token browser. Uses `useMarketData`, `useWatchlist`, `CategoryPills`, `TokenRow`, `TopGainersBar`. Desktop table + mobile list. Click a row → `router.push('/market/prices/:tokenId')`. Search, filters, 8 category pills.
- `app/market/prices/[tokenId]/page.tsx` — token detail with CandlestickChart + TimeframeSelector + KeyStatsGrid + BuySellModal + AlertModal. ATH progress bar, 24h high/low, circulating supply. VTX Analysis button. CoinGecko-powered via `useTokenDetail` + `useChartData`.
- `app/market/trade/page.tsx` — separate swap/trade screen.
- `app/market/watchlist/page.tsx` — separate watchlist screen.

### `/app/dashboard/trading-suite/page.tsx`
Thin wrapper rendering `<TradingTerminalLayout />` from `components/trading/`.

### `components/trading/` (the terminal's parts)
- `TradingTerminalLayout.tsx` — top bar (TokenSelector + inline stats placeholders) + 70/30 split (AdvancedChart + ChartToolbar / OrderForm) + 220px collapsible bottom panel tabs (Open orders, History, Positions, DCA bots, Stop/TP). Has internal state for chain/token/symbol/tf/indicators and a built-in TokenSelector with a small preset list (BTC/ETH/SOL/BNB/ARB/BASE). Accepts NO props — it's fully self-driven.
- `AdvancedChart.tsx` — lightweight-charts chart supporting candlestick/line/area + IndicatorConfig (ema21/ema50/volume — not the full 8-indicator set specified).
- `ChartToolbar.tsx` — timeframe buttons (1m/5m/15m/1h/4h/1d/1w) + chart type selector + indicator toggles.
- `OrderForm.tsx` — 4 tabs (market/limit/dca/stop) bound to chain/tokenAddress/tokenSymbol props. No wallet-source lock per tab yet (the `wallet_source` column on source tables + relayer is the source of truth; UI picks; this is a later polish).
- `OpenOrdersPanel / OrderHistoryPanel / PositionsPanel / DcaBotsPanel / StopLossPanel` — individual tables. No token-filter prop today.
- `PendingTradesBanner + PendingSignerProvider` — already mounted in dashboard layout; unrelated here.

### `/app/dashboard/portfolio/page.tsx`
804 lines. Existing holdings UI with its own flow.

## What to reuse vs. build

Reuse:
- `TradingTerminalLayout` (with prop refactor to accept `initialChain / initialToken / initialSymbol`).
- `AdvancedChart`, `ChartToolbar`, `OrderForm`, and all five bottom panels.
- `TokenLogo`, `PriceChangeDisplay`, `CandlestickChart`, `TimeframeSelector` for the top-bar live price + inline stats.
- `useMarketData`, `useWatchlist`, `TokenRow`, `CategoryPills` for the list page.

Build new:
- `/app/dashboard/market/page.tsx` — thin wrapper that mounts the existing token browser (`PricesPage` content) at the dashboard route, keeping the `/market/*` routes alive so nothing breaks.
- `/app/dashboard/market/[chain]/[address]/page.tsx` — the new unified terminal. Mounts the TradingTerminalLayout with URL-provided chain+address. Row-click from the list navigates here.
- `BackButton` component under `components/ui/BackButton.tsx`.
- Redirect stub on `/app/dashboard/trading-suite/page.tsx` → `/dashboard/market`.

## What not to touch in this chain
- `/app/market/*` (kept functional; internal `router.push('/market/prices/…')` still works as a legacy path).
- The 8-indicator / 6-drawing-tool buildout — the current AdvancedChart supports a subset (ema21/ema50/volume + chart-type). Expanding to the full spec (SMA variants, RSI, MACD, Bollinger, VWAP, ATR + fib/rectangle/label drawings) is multi-day chart work and belongs to a dedicated charting chain, not this merge. The page structure is ready to accept that work once shipped.
- Portfolio is Commit 2 of this chain, done after the Market merge.

## Out-of-scope tradeoffs (made explicit)
- OrderForm per-tab wallet-source lock: master-prompt says Limit/DCA/Stop-Loss must be Built-in Steinz only. OrderForm currently inherits from user choice at swap time. I will render a clear "Built-in wallet only" notice on those three tabs and let the existing non-custodial pending-trades flow enforce at broadcast time. Hard-lock in the wallet picker is a follow-up when the wallet-selector UI is added.
- Bottom panels filtering to "this token by default, toggle All Tokens" — current panels don't accept a token filter prop. I'll add the scaffolding (container state + toggle UI) and wire a `tokenAddress` prop through; the panels themselves will gain the filter when their SQL queries are extended.

## Commit plan
1. Token terminal build + market list at `/dashboard/market` + BackButton + trading-suite redirect + ref-rewire. ("Phase 0.5b Task 2")
2. Portfolio rebuild. ("Phase 0.5b Task 7")
