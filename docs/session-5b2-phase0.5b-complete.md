# Phase 0.5b — Complete

Two commits shipped to `session-5b2-production`.

| Task | Description | Commit |
| --- | --- | --- |
| 0.5b.2 | Market + trading terminal unified | `ed4a293` |
| 0.5b.7 | Portfolio rebuild per original spec | `04f2dba` |

Audit of pre-existing code is in [`docs/phase0.5b-market-audit.md`](phase0.5b-market-audit.md).

## What shipped

### Market + terminal
- `/dashboard/market` — token browser, reuses existing hooks + components (useMarketData, useWatchlist, CategoryPills, TokenRow, TopGainersBar), with glassmorphism polish on containers.
- `/dashboard/market/[chain]/[address]` — new unified terminal. Top bar owns identity (logo, symbol, chain, live price, inline stats, Security/Watch/Alert/Share actions + BackButton). Body mounts `TradingTerminalLayout` with URL-driven identity and the built-in TokenSelector suppressed.
- `/dashboard/trading-suite` → redirect to `/dashboard/market`.
- `TradingTerminalLayout` refactored to accept `initialChain / initialToken / initialSymbol / showTokenSelector` — old callers keep working.
- `SidebarMenu` now labels "Market" (replacing "Trading Suite"), same icon.
- `customer-service` FAQ prompt updated to describe the new route.
- `BackButton` under `components/ui/`.

### Portfolio
- New `/api/portfolio/performance` — FIFO cost basis from `transactions` table; returns series + realized PnL + stats. Never fabricates data.
- New portfolio page: hero (total + today + realized), lightweight-charts Area (cyan #00BFFF), Recharts allocation donut, holdings table routing to the unified terminal, performance tab, alpha-intelligence placeholder.

## No SQL needed

Phase 0.5b adds zero migrations. Both commits use existing tables (`transactions`, wallet data via `/api/wallet-intelligence`).

## Known limitations (carried from audit, unchanged)
- Chart indicator set is the existing ema21/ema50/volume + chart-type switcher. Expanding to the full 8-indicator / 6-drawing spec is a dedicated charting chain.
- Bottom panels on the terminal still show "All tokens". Token-filter scaffolding for per-token views is a follow-up when those panels gain a `tokenAddress` prop.
- OrderForm wallet-source lock per tab (Limit/DCA/SL → Built-in only) is enforced by the non-custodial pending-trades flow at broadcast time, not by a hard UI lock yet.

## Next

Chain 0.5c (Whale Tracker rebuild + seeding + clusters backfill + Sniper Bot) when the user says "Start 0.5c".
