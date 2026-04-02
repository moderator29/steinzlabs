# Steinz Labs

## Overview
Next.js 15 on-chain intelligence platform with Dune.com-inspired dark UI (neon blue #0A1EFF), Privy auth (email/Google/Twitter/wallet), security hardening, and AI-powered analytics. Supports 12+ blockchains with real-time whale tracking, trading DNA analysis, token security scanning, and a full Market/Trading page.

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

## Auth (Privy)
- App ID: `cmmfxnapf01sz0cjsg53245k2` (env: `NEXT_PUBLIC_PRIVY_APP_ID`)
- App Secret: `PRIVY_APP_SECRET` (Replit secret)
- JWT: `JWT_SECRET` (Replit secret)
- **Known Issue**: Privy v3.16.0 has a Solana connector bug (`onMount is not a function`). Fixed via `scripts/patch-privy.js` (postinstall). Patches `index-Bvw5OxHl.mjs` with try-catch + optional chaining on dependency array. Error boundary in `PrivyProvider.tsx` as additional safety net.
- **Permanent fix**: Disable Solana wallets in Privy Dashboard at https://dashboard.privy.io → Login Methods.

## Project Structure
```
app/
├── globals.css              # Global styles, CSS variables, neon-blue design tokens
├── layout.tsx               # Root layout (PrivyProvider wrapper, suppressHydrationWarning)
├── page.tsx                 # Landing page — Dune.com-inspired, animated counters, FAQ
├── admin/                   # Admin panel
└── dashboard/
    ├── layout.tsx           # Dashboard layout wrapper
    ├── page.tsx             # Dashboard: stat cards, bottom nav, sidebar, auth modal
    ├── market/              # Market page: TradingView chart, token selector, buy/sell, watchlist
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
    ├── portfolio/           # Portfolio
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

components/
├── providers/
│   └── PrivyProvider.tsx    # Privy auth provider + PrivyErrorBoundary class
├── AuthModal.tsx            # Auth modal (Privy login trigger + welcome flow)
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

scripts/
└── patch-privy.js           # Patches Privy ESM to fix Solana onMount crash
                             # Applied via postinstall in package.json
```

## Key Files
| File | Purpose |
|---|---|
| `middleware.ts` | Security headers (CSP, HSTS, X-Frame-Options), applied to all routes |
| `next.config.js` | ESLint ignore, image domains, headers, performance opts |
| `tailwind.config.ts` | Neon-blue (#0A1EFF) design tokens, shadows, animations |
| `app/globals.css` | Glass effects, glow utilities, scrollbar styles |
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
- **Primary accent**: `#0A1EFF` (neon blue) — buttons, active states, borders, glows
- **Background**: `#0A0E1A` (deep navy)
- **Cards**: `#111827` surface
- **Text**: white / gray-400 muted
- **Success**: `#10B981` emerald
- **Warning**: `#F59E0B` amber
- **Danger**: `#EF4444` red
- **Secondary**: `#7C3AED` purple (AI badges, DNA analyzer)
- **Font**: Inter (heading/body) + JetBrains Mono (mono/price data)

## Run
```bash
npm run dev   # starts on port 5000
```

## Key Rules
- DNA Analyzer: **WALLET addresses only** — shows clear rejection + redirect for contracts
- Token Scanner: **CONTRACT addresses only** — shows clear rejection + redirect for wallets  
- No tokenomics, no prediction markets, no forex/stocks
- No Solana-specific features in our code (Privy SDK has Solana but we disable it)
- `reactStrictMode: false` in next.config.js
- `eslint.ignoreDuringBuilds: true` in next.config.js
