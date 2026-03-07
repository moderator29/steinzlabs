# Steinz Labs

## Overview
Next.js 14 application using App Router, TypeScript, and Tailwind CSS. On-chain intelligence platform for crypto analytics with AI-powered whale tracking, security scanning, trading, and portfolio management. Features Privy-based authentication with embedded wallets and a Dune.com-inspired UI design system.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with neon-blue design system (Inter + JetBrains Mono fonts)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation + @hookform/resolvers
- **Auth**: Privy (@privy-io/react-auth) with embedded wallets, httpOnly JWT cookies via jose
- **Database**: Supabase (legacy, being migrated)
- **Blockchain**: Alchemy SDK, ethers.js
- **AI**: Anthropic AI SDK
- **Charts**: TradingView Widget (candlestick charts), Recharts, Lightweight Charts
- **Visualization**: D3.js (holder distribution bubblemaps)
- **UI**: Lucide React icons, Framer Motion animations, Sonner toasts
- **Security**: Custom middleware with rate limiting, Zod input validation, security headers
- **Utilities**: clsx, tailwind-merge, class-variance-authority, date-fns, axios, crypto-js, sharp, image-hash, string-similarity

## Project Structure
```
app/
├── globals.css              # Global styles with CSS variables, neon-blue design tokens
├── layout.tsx               # Root layout (wrapped with PrivyProvider)
├── page.tsx                 # Landing page (Dune.com-inspired, professional dark theme)
├── admin/
│   └── page.tsx             # Admin panel (password: 195656)
└── dashboard/
    ├── layout.tsx           # Dashboard layout wrapper
    ├── page.tsx             # Dashboard with stat cards, bottom nav, sidebar
    ├── alerts/              # Smart Alerts management
    ├── builder-funding/     # Builder funding portal
    ├── builder-network/     # Builder directory
    ├── dna-analyzer/        # Trading DNA Analyzer (WALLET addresses only, rejects contracts)
    ├── launchpad/           # Project launchpad
    ├── market/              # Market/Trading page (checkprice.com-inspired, TradingView chart, buy/sell, watchlist)
    ├── messages/            # Group messaging
    ├── network-metrics/     # Network stats per chain
    ├── predictions/         # Predictions market
    ├── profile/             # User profile
    ├── project-discovery/   # Project discovery
    ├── risk-scanner/        # AI Portfolio Risk Scanner
    ├── security/            # Security Center (CONTRACT addresses only, rejects wallets)
    ├── smart-money/         # Smart Money Watchlist
    ├── social-trading/      # Social Trading
    ├── wgm-runner/          # STZ Runner game
    ├── swap/                # Multi-Chain Swap
    ├── trends/              # On-Chain Trends
    ├── vtx-ai/              # VTX AI assistant
    ├── wallet-clusters/     # Wallet Clusters
    ├── wallet-intelligence/ # Wallet Intelligence
    └── whale-tracker/       # Whale Tracker

components/
├── providers/
│   └── PrivyProvider.tsx    # Privy auth provider (email, Google, Twitter, wallet login)
├── AuthModal.tsx            # Privy-based auth modal with welcome flow
├── ContextFeed.tsx          # Context Feed with chain sub-tabs
├── TradingViewChart.tsx     # TradingView candlestick widget
├── ViewProofModal.tsx       # On-chain proof modal
├── Markets.tsx              # Markets tab
├── SidebarMenu.tsx          # Left-anchored sidebar (Dune-style, 240px, neon-blue active states)
├── SteinzLogo.tsx           # Logo component
└── ...                      # Other tab components

lib/
├── auth.ts                  # JWT session management (httpOnly cookies, jose)
├── rateLimit.ts             # In-memory rate limiter with LRU cache
├── errorHandler.ts          # Error handler (never exposes stack traces)
├── validation.ts            # Zod validation schemas for all API inputs
├── supabase.ts              # Supabase client (legacy)
├── wallet.ts                # MetaMask + Phantom wallet utilities
└── hooks/
    ├── useAuth.ts           # Auth hook (uses Privy)
    ├── useWallet.ts         # Wallet state hook
    ├── useContextFeed.ts    # Context feed hook
    ├── usePrices.ts         # Live price feed
    └── useTheme.ts          # Theme toggle (dark/light/bingo)

middleware.ts                # Security middleware (headers, CSP, HSTS, rate limiting)
```

## Security Infrastructure
- **Middleware** (`middleware.ts`): Applies security headers to all routes — X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, HSTS, Referrer-Policy, Permissions-Policy, CSP
- **Rate Limiting** (`lib/rateLimit.ts`): In-memory LRU cache, configurable interval/maxRequests, 429 responses with Retry-After headers
- **Error Handler** (`lib/errorHandler.ts`): Never exposes stack traces in production, `handleApiError()`, `apiResponse()`, `apiErrorResponse()`, `createApiError()`
- **Input Validation** (`lib/validation.ts`): Zod schemas for wallet addresses, contract addresses, emails, pagination, search, game scores, etc.
- **Next.js Config** (`next.config.js`): Security headers, CSP allowing Privy domains, HSTS

## Authentication (Privy)
- **Provider**: `components/providers/PrivyProvider.tsx` wraps the entire app
- **Login Methods**: Email, Google, Twitter, Wallet (MetaMask, WalletConnect)
- **Embedded Wallets**: Auto-created for users without wallets on signup
- **Session Management**: Server-side JWT sessions via httpOnly cookies (`lib/auth.ts`)
- **Callback API**: `/api/auth/privy-callback` verifies Privy tokens and creates sessions
- **App ID**: Stored in `NEXT_PUBLIC_PRIVY_APP_ID` env var
- **App Secret**: Stored in `PRIVY_APP_SECRET` secret

## Design System
- **Primary Accent**: Neon Blue (#0A1EFF) with full color scale (50-900)
- **Secondary**: Cyan (#00E5FF), Purple (#7C3AED)
- **Background**: #0A0E1A (dark navy)
- **Card/Surface**: #111827, Elevated: #1A2235
- **Status**: Success (#10B981), Warning (#F59E0B), Danger (#EF4444)
- **Fonts**: Inter (headings + body), JetBrains Mono (code/data)
- **Theme Modes**: Dark (default), Light, Bingo — via `[data-theme]` CSS selectors
- **CSS Variables**: `:root` defines `--primary`, `--primary-rgb`, `--accent`, `--bg-*`, `--text-*`, `--border`
- **Neon Shadows**: `shadow-neon`, `shadow-neon-lg`, `shadow-neon-blue-glow`
- **Key Classes**: `.glass`, `.glass-strong`, `.gradient-text-blue`, `.btn-neon`, `.glass-card-enhanced`, `.grid-pattern`

## Address Type Detection
- **DNA Analyzer**: WALLET addresses only. Checks bytecode via RPC `eth_getCode`. If contract detected → shows rejection UI with link to Token Scanner
- **Token Scanner**: CONTRACT addresses only. Checks bytecode via RPC `eth_getCode`. If wallet detected → shows rejection UI with link to DNA Analyzer

## Market/Trading Page
- **Route**: `/dashboard/market`
- **Layout**: Chart-first (TradingView), key stats bar, buy/sell buttons, watchlist sidebar
- **Features**: Token selector with search, category filters (All, Majors, DeFi, DePN), time intervals (1H-1M), Portfolio/Trade History/Trades/Stats tabs
- **Data**: Live prices from `/api/prices`, 30-second auto-refresh

## API Routes
```
app/api/
├── auth/privy-callback/     # Privy token verification + session creation
├── ca-lookup/               # CA lookup (DexScreener + GoPlus)
├── dna-analyzer/            # AI DNA analysis via Anthropic Claude
├── game-scores/             # HODL Runner leaderboard
├── wgm-scores/              # WGM Runner leaderboard
├── token-scanner/           # Token security scanner (contract-only, rejects wallets)
├── wallet-intelligence/     # Wallet analysis (Alchemy for EVM, Solana RPC)
├── portfolio/               # Portfolio data
├── prices/                  # Real-time crypto prices (30 coins via CoinGecko)
├── market-data/             # Market data with trending/gainers/losers
├── context-feed/            # Multi-chain context feed
├── predictions/             # Predictions market
├── engagement/              # Event engagement tracking
├── coin-discovery/          # Top 50 coins discovery
├── vtx-ai/                  # VTX AI assistant (Anthropic Claude)
├── whale-tracker/           # Whale tracking
├── notifications/           # Price alerts, trending
├── builder-submissions/     # Builder Network API
├── platform-stats/          # Platform statistics
├── customer-service/        # AI customer support
├── trading-suite/           # Trading suite data
├── project-listing/         # Project listing management
└── share/                   # Share links
```

## Running
- **Dev**: `npm run dev` (port 5000)
- **Build**: `npm run build`
- **Start**: `npm run start` (port 5000)

## Environment Variables
- `NEXT_PUBLIC_PRIVY_APP_ID` — Privy App ID
- `PRIVY_APP_SECRET` — Privy App Secret (server-side only)
- `JWT_SECRET` — JWT signing key for sessions
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase (legacy)
- `ALCHEMY_API_KEY` — Alchemy blockchain API
- `ANTHROPIC_API_KEY` — Anthropic AI
- `COINGECKO_API_KEY` — CoinGecko market data
- `HELIUS_KEY_1`, `HELIUS_KEY_2` — Helius Solana RPC

## Performance Optimizations
- Lazy loading for all dashboard tab components
- Loading skeletons during page transitions
- Route prefetching in sidebar
- API response caching with Cache-Control headers
- Bundle splitting via `optimizePackageImports`
- gzip compression, WebP/AVIF images
- React.memo on frequently re-rendered components

## Key Notes
- Project uses root-level `app/` and `lib/` directories (no `src/` prefix)
- `@/*` path alias maps to project root
- `eslint: { ignoreDuringBuilds: true }` in next.config.js
- Admin panel: password 195656, URL `/admin`
- Logo files: `public/steinz-logo-*.png`
- Social: X (@steinzlabs), Telegram (@steinzlabs)
- NAKA GO branding in footer
- STZ Runner game at `/dashboard/wgm-runner`
