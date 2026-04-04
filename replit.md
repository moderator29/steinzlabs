# STEINZ LABS

## Overview
Next.js 15 on-chain intelligence platform. Dune.com-inspired dark UI (neon blue #0A1EFF — NEVER cyan #00E5FF). Supabase email/password auth (signup with first/last name, username, email, password; login with email OR username + password; persistent sessions). Full auth wall (middleware blocks all /dashboard/** without session cookie), 4-item bottom nav (Home, VTX Agent, Wallet, Profile), 2-tab home (Context Feed + Market), searchable all-coins market list, single-coin trading view (TradingView chart + key stats + buy/sell modal), context feed "Trade This" integration. AI-powered analytics across 12+ blockchains.

**Brand**: STEINZ LABS — NO token, no $STEINZ, no $NAKA. Just "STEINZ LABS" as the platform name. Tiers: Free ($0) / Pro ($19/mo, $190/yr) / Premium ($99/mo, $990/yr). Payment integration coming soon (no Stripe).

## Tech Stack
- **Framework**: Next.js 15.0.8 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS — neon-blue design system (#0A1EFF primary), Inter + JetBrains Mono fonts
- **Auth**: Supabase Auth (email/password only — no Google/Apple OAuth) — profiles table for username/name storage
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation + @hookform/resolvers
- **Database**: Supabase (auth + profiles + scans + positions + threats + followed_entities + alerts + entity_cache)
- **Blockchain**: Alchemy SDK, ethers.js, @solana/web3.js
- **On-chain Intelligence**: Arkham Intelligence API (address intel, entity lookup, token holders, wallet connections, scam detection)
- **Trading Execution**: Jupiter Aggregator (Solana swaps), 1inch API (EVM swaps), unified execution router with Shadow Guardian pre-trade scanning
- **Security**: Shadow Guardian (pre-trade scanning, scam detection, AI risk assessment) + Wallet Reputation scoring
- **AI**: Anthropic Claude claude-sonnet-4-20250514 (risk analysis, trade intelligence)
- **Charts**: TradingView Widget (candlestick), Recharts, Lightweight Charts
- **Visualization**: D3.js (bubblemaps)
- **UI**: Lucide React, Framer Motion, Sonner toasts, custom Toast/ToastProvider
- **Security**: Custom middleware, rate limiting, Zod validation, security headers
- **On-chain data**: DexScreener API, CoinGecko API, Pump.fun API — universal multi-chain search with Arkham enrichment
- **Money Radar**: Copy trading engine — follow Arkham entities, detect trades, auto-exit positions
- **Real-time**: WebSocket price feeds via DEXScreener
- **Holder Intelligence**: Deep Arkham-powered holder analysis, composition breakdown, smart money detection, scammer analysis
- **Bubblemaps**: Custom bubble visualization built into View Proof page (no external links to bubblemaps.io)
- **VTX Agent**: Next-gen UI with dark #060A12 background, tools panel (8 tools grid), agent settings panel (web search toggle, response style concise/detailed, auto-context toggle), animated typing indicator, timestamps on messages, persistent settings via localStorage. Plain-text responses only (no ** or -- markdown), uses all APIs (Arkham, Alchemy, CoinGecko, DexScreener). Server-side strips markdown. Settings (responseStyle, autoContext) sent to API and applied to system prompt.
- **Wallet**: Non-custodial, max 5 wallets per user. No "Connect Wallet" anywhere, use STEINZ built-in wallet only. Auto-reconnect (lib/wallet/autoConnect.ts) persists wallet connections across sessions (48hr expiry). Biometric auth (components/wallet/BiometricAuth.tsx) for transaction confirmation via WebAuthn.
- **Admin Panel**: /dashboard/admin. Password-protected (195656). Dashboard overview (user stats, platform metrics, recent signups), user management (search, paginated list, tier badges), email broadcast (Resend-powered, tier targeting), system health (service status, API endpoint directory). API routes: /api/admin/stats, /api/admin/users, /api/admin/broadcast.
- **Back Button**: Top-left, no circle, plain arrow (FloatingBackButton.tsx)
- **Security Center**: Contract addresses only — rejects wallet addresses with clear error
- **Wallet Intelligence**: Wallet addresses only — rejects contract addresses with eth_getCode check
- **View Proof**: Full page at /dashboard/proof (not a modal popup). Shows AI analysis, bubble visualization, trust score, blockchain verification, buy/swap buttons to internal swap page.
- **Swap Page**: /dashboard/swap — Raydium-style professional UI with token selector modal, real-time quote API (/api/swap), chain selector, slippage settings panel, route visualization, price impact display. Supports Jupiter (Solana) and 1inch (EVM) backends.
- **Swap API**: /api/swap — Quote endpoint returning rate, price impact, min received, gas estimate, route info. Token address resolution for all major chains.
- **Profile Security**: Opens account security settings subpage (not Security Center scanner)
- **Sidebar**: Trading category with STEINZ Terminal (PRO badge), Swap, Exchanges. No Market item. No NEW badges on Exchanges.
- **Smart Money**: Professional tracker UI with summary stats, recent moves feed, search/filter, expandable wallet cards with chain tags, analytics, and wallet intelligence deep-link.
- **Dashboard Header**: STEINZ logo left, "STEINZ Terminal" text small on right side. Price ticker removed.
- **Context Feed**: No ARKHAM badge (uses "INTEL" label instead). No external Bubblemaps links. Initial fetch 50 events, merges up to 200. Archive tab for events >24hrs old.
- **Exchange APIs**: Jupiter Aggregator (Solana), 1inch (EVM chains), unified execution router in lib/trading/. Shadow Guardian pre-trade scanning. Exchange hub page (/dashboard/exchanges) with live Binance ticker data, CEX/DEX directory, and API status monitoring.
- **Archive Page**: /dashboard/archive — standalone page for events >24h. Filterable by type and chain.
- **Wallet Intelligence Tabs**: Wallet tab (wallet address analysis + AI assessment) and Contract tab (security scan with honeypot detection, tax analysis). Uses /api/token-scanner for contract scans.
- **Middleware**: Security headers only (X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, HSTS, Permissions-Policy). CSP removed to prevent production script blocking.

## Auth (Supabase)
- **Client**: `@supabase/supabase-js` — client-side only (browser connects directly to Supabase)
- **Signup**: First name, last name, username (unique), email, password → `supabase.auth.signUp()` + profile insert
- **Login**: Email OR username + password → username resolves to email via profiles table → `supabase.auth.signInWithPassword()`
- **Session**: Supabase manages JWT tokens in localStorage, cookies set by Supabase client (sb-*-auth-token)
- **Middleware**: Checks for `steinz_session` or `sb-*-auth-token` cookies to protect /dashboard/** routes
- **Logout**: `supabase.auth.signOut()` → redirect to /login
- **Important**: Email confirmation should be DISABLED in Supabase Dashboard for immediate login after signup
- **Cookie/localStorage keys**: `steinz_session`, `steinz_has_session`, `steinz_remember_me`, `steinz-auth-token`

## Auth Flow
- **Nav**: "Log In" (text link → /login) + "Sign Up" (white button → /signup page)
- `/login` — full-page sign-in (email OR username + password), form renders immediately (no auth spinner blocking)
- `/signup` — full-page registration with live password requirements checklist (8–100 chars, lowercase, uppercase, number, special char), rate limiting (5 attempts/60s cooldown), full-width name fields
- **LaunchAppButton**: Routes new users to /signup, returning users (localStorage `steinz_has_session`) to /login
- Dashboard header shows user info when authenticated
- After login → redirected to `/dashboard`
- After signup → auto-login → redirected to `/dashboard`

## Supabase Database
- **profiles**: `id` (UUID, FK to auth.users), `first_name`, `last_name`, `username` (unique), `email`, `created_at`
- **users**: `id`, `wallet_address` (unique), `reputation_score`, `reputation_status`, `is_verified_entity`, `entity_id`, `entity_name`, `blocked`, `last_seen`
- **scans**: `id`, `user_id` (FK users), `token_address`, `scan_result` (JSONB), `allowed`, `blocked`, `risk_score`, `reason`
- **positions**: `id`, `user_id` (FK users), `token_address`, `token_symbol`, `chain`, `entry_price`, `amount`, `value_usd`, `status`, `auto_exit_enabled`, `following_entity`
- **threats**: `id`, `user_id` (FK users), `severity`, `token_address`, `token_symbol`, `threat_type`, `threat_data` (JSONB), `recommendation`, `acknowledged`
- **followed_entities**: `id`, `user_id` (FK users), `entity_id`, `entity_name`, `entity_type`, `notify_trades`, `notify_large_moves`, `wallets` (JSONB)
- **alerts**: `id`, `user_id` (FK users), `alert_type`, `entity_id`, `token_address`, `condition_type`, `condition_value` (JSONB), `triggered`, `triggered_at`
- **entity_cache**: `id`, `entity_id` (unique), `entity_data` (JSONB), `portfolio_data` (JSONB), `performance_data` (JSONB), `last_updated`
- SQL migration: `scripts/create-tables.sql` — run in Supabase SQL Editor
- RLS enabled on profiles with policies for user access and public username lookup

## Project Structure
```
app/
├── globals.css              # Global styles, CSS variables, neon-blue design tokens
├── layout.tsx               # Root layout (AuthProvider + ToastProvider wrapper)
├── page.tsx                 # Landing page — Dune.com-inspired, pricing tiers, FAQ
├── login/                   # Login page (email OR username + password)
├── signup/                  # Signup page (first name, last name, username, email, password)
├── auth/                    # Legacy redirect → /login
├── admin/                   # Admin panel
└── dashboard/
    ├── layout.tsx           # Dashboard layout wrapper
    ├── page.tsx             # Dashboard: stat cards, bottom nav, sidebar
    ├── market/              # Market page: TradingView chart, DexScreener search, buy/sell, watchlist
    ├── portfolio/           # Portfolio: 4-tab (Balance | History | Unrealized PnL | P&L)
    ├── dna-analyzer/        # Trading DNA Analyzer — WALLET ONLY (rejects contracts → Token Scanner)
    ├── security/            # Token Scanner — CONTRACT ONLY (rejects wallets → DNA Analyzer)
    └── ...other dashboard pages

components/
├── providers/
│   └── AuthProvider.tsx     # Supabase auth context provider
├── Toast.tsx                # Toast notification system + ToastProvider
├── SteinzLogo.tsx           # STEINZ LABS logo component (wraps steinz-logo-128.png)
├── SidebarMenu.tsx          # Left sidebar (260px, categories: Overview, Market, Intelligence, Tools, Account)
├── ThemeToggle.tsx          # Dropdown theme toggle (Dark/Light/Bingo), returns null until mounted
├── ContextFeed.tsx          # Context feed with engagement stats, chain filters, bookmarks, archive
├── LaunchAppButton.tsx      # Smart CTA (new users → /signup, returning → /login)
├── ProfileTab.tsx           # User profile tab with sign out
├── TradingViewChart.tsx     # TradingView candlestick chart widget
├── PriceTicker.tsx          # Live price ticker strip
├── Markets.tsx              # Markets tab component
├── ContextFeed.tsx          # Context feed tab
└── ...other components

lib/
├── supabase.ts              # Supabase client (browser)
├── supabaseAdmin.ts         # Supabase admin client (server-only)
├── rateLimit.ts             # In-memory rate limiter
├── errorHandler.ts          # API error handler
├── validation.ts            # Zod schemas
├── arkham/
│   ├── types.ts             # Arkham Intelligence type definitions (ArkhamEntity, ArkhamHolder, etc.)
│   └── api.ts               # Arkham API wrapper (address intel, holders, entities, scam detection)
├── trading/
│   ├── types.ts             # TradeQuote, TradeExecution, PriceUpdate, RouteInfo types
│   ├── jupiter.ts           # Jupiter Aggregator API (Solana swaps — quote + execute)
│   ├── oneinch.ts           # 1inch API (EVM swaps — 7 chains supported)
│   └── execution.ts         # Unified trade router — Shadow Guardian pre-scan → execute → save position
├── market/
│   └── priceFeeds.ts        # WebSocket price feed manager (DEXScreener WS, pub/sub, auto-reconnect)
├── search/
│   ├── types.ts             # SearchResult type (with Arkham enrichment fields)
│   ├── dexscreener.ts       # DEXScreener search (all chains)
│   ├── coingecko.ts         # CoinGecko search (multi-chain)
│   ├── pumpfun.ts           # Pump.fun search (Solana launches)
│   └── universalSearch.ts   # Aggregates all sources, deduplicates, enriches with Arkham data
├── moneyRadar/
│   ├── types.ts             # FollowedEntity, EntityTrade, CopyTradeParams types
│   ├── monitor.ts           # Entity monitoring engine (60s polling, trade detection, auto-exit)
│   └── copyTrade.ts         # Copy trade execution (follows entity buys/sells)
├── intelligence/
│   ├── holderAnalysis.ts    # Deep holder intelligence (Arkham enrichment, composition, safety, smart money, scammer analysis, Bubblemaps data)
│   └── historicalTracking.ts # Historical snapshots, DEXScreener liquidity analysis, pattern matching
├── data/
│   ├── tokenMetadata.ts     # Multi-source token metadata (CoinGecko→DEXScreener fallback chain)
│   └── realTimePrices.ts    # Real-time price feeds (Jupiter→DEXScreener→CoinGecko)
├── revenue/
│   └── feeSystem.ts         # Revenue fee system (0.5% swaps, 1% copy trades), treasury recording
├── subscriptions/
│   └── tiers.ts             # FREE/PRO/PREMIUM tier definitions, feature gating, pricing
├── security/
│   ├── types.ts             # Security type definitions (ScanResult, WalletReputation, PortfolioThreat)
│   ├── shadowGuardian.ts    # Shadow Guardian pre-trade scanner (scam detection + AI risk analysis)
│   └── walletReputation.ts  # Wallet reputation scoring system
├── anthropic/
│   └── api.ts               # Anthropic Claude API wrapper for AI risk analysis
├── database/
│   └── supabase.ts          # Database helper functions (users, scans, positions, threats)
├── hooks/
│   ├── useAuth.ts           # Supabase auth hook (AuthContext, useAuthProvider)
│   └── useWallet.ts         # Wallet connection hook

middleware.ts                # Security headers + auth cookie check for /dashboard/**
```

## Key Files
| File | Purpose |
|---|---|
| `middleware.ts` | Security headers (CSP, HSTS, X-Frame-Options) + auth guard for /dashboard/** |
| `lib/supabase.ts` | Supabase browser client + admin client factory |
| `lib/hooks/useAuth.ts` | Auth context with session management, profile fetching, sign out |
| `components/providers/AuthProvider.tsx` | Wraps app with auth context |
| `app/login/page.tsx` | Login page (email or username + password) |
| `app/signup/page.tsx` | Signup page (full registration form) |
| `next.config.js` | ESLint ignore, image remotePatterns, production cache headers, performance opts |
| `tailwind.config.ts` | Neon-blue (#0A1EFF) design tokens, shadows, animations |
| `app/globals.css` | Glass effects, glow utilities, scrollbar styles |

## API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/trade/quote` | POST | Get optimal swap quote (Jupiter for Solana, 1inch for EVM) |
| `/api/trade/execute` | POST | Prepare trade execution (frontend signs tx client-side) |
| `/api/search/coins?q=` | GET | Universal multi-chain search (DEXScreener + CoinGecko + Pump.fun + Arkham enrichment) |
| `/api/moneyRadar/follow` | POST | Follow an Arkham entity (saves wallets to DB) |
| `/api/moneyRadar/copy` | POST | Execute copy trade based on entity's trade |
| `/api/portfolio/holdings?wallet=&chain=` | GET | Get Solana/EVM token holdings for wallet |
| `/api/intelligence/holders?token=&chain=&limit=` | GET | Deep holder intelligence with Arkham enrichment |
| `/api/intelligence/bubblemaps?token=&chain=` | GET | Bubblemaps visualization data (nodes, links, metadata) |
| `/api/bubble-map?token=&chain=` | GET | Bubble map nodes/links with DEXScreener+Arkham data |
| `/api/revenue/stats` | GET | Revenue statistics (total, by type, trade count) |
| `/api/subscription?userId=` | GET | User subscription tier, features, pricing |

## Environment Variables
| Variable | Location | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_KEY` | Replit Secret | Supabase service role key (server-side only) |
| `JWT_SECRET` | Replit Secret | JWT session signing (legacy) |
| `ALCHEMY_API_KEY` | `.env.local` | Alchemy RPC key |
| `ARKHAM_API_KEY` | Replit Secret | Arkham Intelligence API key |
| `ANTHROPIC_API_KEY` | Replit Secret | Anthropic Claude API key (needed for AI risk analysis) |
| `SOLANA_RPC_URL` | `.env.local` | Solana RPC endpoint (defaults to public mainnet) |
| `ONEINCH_API_KEY` | Replit Secret | 1inch API key (EVM swaps) |

## Design System
- **Primary accent**: `#0A1EFF` (neon blue) — buttons, active states, borders, glows — NEVER #00E5FF cyan
- **Background**: `#0A0E1A` (deep navy)
- **Cards**: `#111827` surface
- **Text**: white / gray-400 muted
- **Success**: `#10B981` emerald
- **Warning**: `#F59E0B` amber
- **Danger**: `#EF4444` red
- **Secondary**: `#7C3AED` purple (AI badges, DNA analyzer)
- **Font**: Inter (heading/body) + JetBrains Mono (mono/price data)

## DexScreener Integration
- API: `https://api.dexscreener.com/latest/dex/search?q=<query>` and `/tokens/<address>`
- Used in: Market page token selector (search by name, symbol, or contract address across all chains)
- Results show: symbol, name, chain badge, price, 24h%, volume, liquidity, FDV

## Pricing Tiers
- **Free**: Context feed, DNA analysis (limited), basic market data
- **STEINZ Pro**: Full DNA analysis, portfolio tracking, whale alerts, priority AI, unlimited VTX AI
- **STEINZ Enterprise**: Everything in Pro + API access, custom alerts

## Run
```bash
npm run dev   # starts on port 5000
```

## Key Rules
- **Brand**: "STEINZ LABS" everywhere. NO token. Logo: `/steinz-logo-128.png` via SteinzLogo.tsx
- DNA Analyzer: **WALLET addresses only** — shows clear rejection + redirect for contracts
- Token Scanner: **CONTRACT addresses only** — shows clear rejection + redirect for wallets
- **NO** tokenomics/token sale data, prediction markets, forex/stocks
- **NO** cyan #00E5FF — use #0A1EFF neon-blue only
- **Auth is fully client-side**: Supabase JS client runs in the browser, NOT via API routes (Replit server can't reach external APIs)
- **NO markdown artifacts**: No em-dashes, double-dashes, asterisks, or hash marks in any user-facing text. Use commas, periods, or pipes instead.
- `reactStrictMode: false` in next.config.js
- `eslint.ignoreDuringBuilds: true` in next.config.js
