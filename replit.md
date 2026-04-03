# Naka Labs

## Overview
Next.js 15 on-chain intelligence platform powered by the $NAKA token. Dune.com-inspired dark UI (neon blue #0A1EFF — NEVER cyan #00E5FF). Privy auth (email/Google/Twitter/wallet), full auth wall (middleware blocks all /dashboard/** without session cookie), 4-item bottom nav (Home, VTX AI, Wallet, Profile), 2-tab home (Context Feed + Market), searchable all-coins market list, single-coin trading view (TradingView chart + key stats + buy/sell modal), context feed "Trade This" integration. AI-powered analytics across 12+ blockchains.

**Brand**: Everything is "Naka Labs" / "NAKA" / "Naka AI". $NAKA token drives tier access (Free/Holder/Pro).

## Tech Stack
- **Framework**: Next.js 15.0.8 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS — neon-blue design system (#0A1EFF primary), Inter + JetBrains Mono fonts
- **Auth**: Privy v3.16.0 (`@privy-io/react-auth`) — email, Google, Twitter, wallet login, embedded wallets, httpOnly JWT cookies via `jose`
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation + @hookform/resolvers
- **Database**: Supabase (legacy)
- **Blockchain**: Alchemy SDK, ethers.js
- **AI**: Anthropic AI SDK
- **Charts**: TradingView Widget (candlestick), Recharts, Lightweight Charts
- **Visualization**: D3.js (bubblemaps)
- **UI**: Lucide React, Framer Motion, Sonner toasts
- **Security**: Custom middleware, rate limiting, Zod validation, security headers, CSRF-safe httpOnly cookies
- **On-chain data**: DexScreener API (universal token search — all chains, any token/CA), CoinGecko API

## Auth (Privy)
- App ID: `cmmfxnapf01sz0cjsg53245k2` (env: `NEXT_PUBLIC_PRIVY_APP_ID`)
- App Secret: `PRIVY_APP_SECRET` (Replit secret)
- JWT: `JWT_SECRET` (Replit secret)
- **Known Issue**: Privy v3.16.0 has a Solana connector bug (`onMount is not a function`). Fixed via `scripts/patch-privy.js` (postinstall). Patches `index-Bvw5OxHl.mjs` with try-catch + optional chaining on dependency array. Error boundary in `PrivyProvider.tsx` as additional safety net.
- **Permanent fix**: Disable Solana wallets in Privy Dashboard at https://dashboard.privy.io → Login Methods.

## Auth Flow
- `/auth` — full-page sign-in (split panel: features left / login form right)
- Dashboard header shows "Sign In" button → routes to `/auth` when unauthenticated
- No auth modal on dashboard; `AuthModal.tsx` exists but is unused in main flow
- After login → redirected to `/dashboard`

## Project Structure
```
app/
├── globals.css              # Global styles, CSS variables, neon-blue design tokens
├── layout.tsx               # Root layout (PrivyProvider wrapper, suppressHydrationWarning)
├── page.tsx                 # Landing page — Dune.com-inspired, $NAKA tiers, FAQ
├── auth/                    # Full-page auth (split-panel Privy login)
├── admin/                   # Admin panel
└── dashboard/
    ├── layout.tsx           # Dashboard layout wrapper
    ├── page.tsx             # Dashboard: stat cards, bottom nav, sidebar, Sign In button
    ├── market/              # Market page: TradingView chart, DexScreener search, buy/sell, watchlist
    ├── portfolio/           # Portfolio: 4-tab (Balance | History | Unrealized PnL | P&L)
    ├── dna-analyzer/        # Trading DNA Analyzer — WALLET ONLY (rejects contracts → Token Scanner)
    ├── security/            # Token Scanner — CONTRACT ONLY (rejects wallets → DNA Analyzer)
    ├── alerts/              # Smart Alerts
    ├── builder-funding/     # Builder Funding
    ├── builder-network/     # Builder Network
    ├── community/           # Community
    ├── copy-trading/        # Copy Trading
    ├── hodl-runner/         # HODL Runner game
    ├── launchpad/           # Launchpad
    ├── messages/            # Messaging
    ├── network-metrics/     # Network Metrics
    ├── predictions/         # Predictions
    ├── pricing/             # Pricing
    ├── profile/             # Profile
    ├── project-discovery/   # Project Discovery
    ├── risk-scanner/        # Risk Scanner
    ├── smart-money/         # Smart Money
    ├── social-trading/      # Social Trading
    ├── swap/                # Multi-Chain Swap
    ├── trends/              # On-Chain Trends
    ├── vtx-ai/              # VTX AI Chat
    ├── wallet-clusters/     # Wallet Clusters
    ├── wallet-intelligence/ # Wallet Intelligence
    ├── wallet-page/         # Wallet
    ├── whale-tracker/       # Whale Tracker
    └── wgm-runner/          # STZ Runner game

app/api/
├── search/route.ts          # DexScreener universal token search (name, symbol, or CA → all chains)
├── portfolio/               # Portfolio data (EVM wallet balances + prices)
├── prices/                  # CoinGecko price feed
├── context-feed/            # Context/intelligence feed
└── ...other API routes

components/
├── providers/
│   └── PrivyProvider.tsx    # Privy auth provider + PrivyErrorBoundary class
├── AuthModal.tsx            # Auth modal (exists but unused in main flow — /auth page used instead)
├── NakaLogo.tsx             # Naka Labs logo component (wraps steinz-logo-128.png)
├── SidebarMenu.tsx          # Left sidebar (240px, neon-blue active states, category headers)
├── TradingViewChart.tsx     # TradingView candlestick chart widget
├── PriceTicker.tsx          # Live price ticker strip
├── Markets.tsx              # Markets tab component
├── ContextFeed.tsx          # Context feed tab
├── WalletConnectButton.tsx  # Wallet connection button
└── ...other components

lib/
├── auth.ts                  # JWT session management (createSession, verifySession, getSession)
├── rateLimit.ts             # In-memory rate limiter (Map-based, LRU-eviction)
├── errorHandler.ts          # API error handler (no stack trace leaks)
├── validation.ts            # Zod schemas (wallet, contract, email, search, etc.)
├── hooks/
│   ├── useAuth.ts           # usePrivy wrapper for auth state
│   └── useWallet.ts         # Wallet connection hook
└── supabase.ts              # Supabase client

middleware.ts                # Security headers (CSP, HSTS, X-Frame-Options) + DexScreener in connect-src
scripts/
└── patch-privy.js           # Patches Privy ESM to fix Solana onMount crash (postinstall)
```

## Key Files
| File | Purpose |
|---|---|
| `middleware.ts` | Security headers (CSP, HSTS, X-Frame-Options), applied to all routes |
| `next.config.js` | ESLint ignore, image domains, headers, performance opts |
| `tailwind.config.ts` | Neon-blue (#0A1EFF) design tokens, shadows, animations |
| `app/globals.css` | Glass effects, glow utilities, scrollbar styles |
| `app/api/search/route.ts` | DexScreener search API — returns any on-chain token by name/symbol/CA |
| `scripts/patch-privy.js` | Privy Solana connector crash fix (postinstall) |

## Environment Variables
| Variable | Location | Purpose |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | `.env.local` | Privy App ID (public) |
| `PRIVY_APP_SECRET` | Replit Secret | Privy server-side verification |
| `JWT_SECRET` | Replit Secret | JWT session signing |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Supabase public key |
| `SUPABASE_SERVICE_KEY` | `.env.local` | Supabase admin key |
| `ALCHEMY_API_KEY` | `.env.local` | Alchemy RPC key |

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
- When DexToken selected: key stats show DexScreener data; buy/sell replaced with "View on DexScreener"

## $NAKA Token Tiers
- **Free**: Context feed, DNA analysis (limited), basic market data
- **Holder**: Full DNA analysis, portfolio tracking, whale alerts, priority AI
- **Pro**: Everything + advanced intelligence, API access, custom alerts

## Portfolio (4 Tabs)
- **Balance**: Holdings list + allocation bar
- **History**: Portfolio value chart (time-ranged) + historical snapshots
- **Unrealized PnL**: Per-token unrealized P&L with mini sparkbars
- **Profit & Loss**: Realized P&L breakdown + win rate + range selector

## Run
```bash
npm run dev   # starts on port 5000
```

## Key Rules
- **Brand**: "Naka Labs" / "NAKA" everywhere. Logo: `/steinz-logo-128.png` (physical file unchanged, aliased via NakaLogo.tsx)
- DNA Analyzer: **WALLET addresses only** — shows clear rejection + redirect for contracts
- Token Scanner: **CONTRACT addresses only** — shows clear rejection + redirect for wallets
- **NO** tokenomics/token sale data, prediction markets, forex/stocks
- **NO** cyan #00E5FF — use #0A1EFF neon-blue only
- No Solana-specific features in our code (Privy SDK has Solana but we disable it)
- `reactStrictMode: false` in next.config.js
- `eslint.ignoreDuringBuilds: true` in next.config.js
