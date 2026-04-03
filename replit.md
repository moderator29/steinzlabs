# Naka Labs

## Overview
Next.js 15 on-chain intelligence platform powered by the $NAKA token. Dune.com-inspired dark UI (neon blue #0A1EFF — NEVER cyan #00E5FF). Supabase email/password auth (signup with first/last name, username, email, password; login with email OR username + password; persistent sessions). Full auth wall (middleware blocks all /dashboard/** without session cookie), 4-item bottom nav (Home, VTX AI, Wallet, Profile), 2-tab home (Context Feed + Market), searchable all-coins market list, single-coin trading view (TradingView chart + key stats + buy/sell modal), context feed "Trade This" integration. AI-powered analytics across 12+ blockchains.

**Brand**: Everything is "Naka Labs" / "NAKA" / "Naka AI". $NAKA token drives tier access (Free/Holder/Pro).

## Tech Stack
- **Framework**: Next.js 15.0.8 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS — neon-blue design system (#0A1EFF primary), Inter + JetBrains Mono fonts
- **Auth**: Supabase Auth (email/password) — fully client-side, profiles table for username/name storage
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation + @hookform/resolvers
- **Database**: Supabase (auth + profiles)
- **Blockchain**: Alchemy SDK, ethers.js
- **AI**: Anthropic AI SDK
- **Charts**: TradingView Widget (candlestick), Recharts, Lightweight Charts
- **Visualization**: D3.js (bubblemaps)
- **UI**: Lucide React, Framer Motion, Sonner toasts, custom Toast/ToastProvider
- **Security**: Custom middleware, rate limiting, Zod validation, security headers
- **On-chain data**: DexScreener API (universal token search — all chains, any token/CA), CoinGecko API

## Auth (Supabase)
- **Client**: `@supabase/supabase-js` — client-side only (browser connects directly to Supabase)
- **Signup**: First name, last name, username (unique), email, password → `supabase.auth.signUp()` + profile insert
- **Login**: Email OR username + password → username resolves to email via profiles table → `supabase.auth.signInWithPassword()`
- **Session**: Supabase manages JWT tokens in localStorage, cookies set by Supabase client (sb-*-auth-token)
- **Middleware**: Checks for `sb-*-auth-token` cookies to protect /dashboard/** routes
- **Logout**: `supabase.auth.signOut()` → redirect to /login
- **Important**: Email confirmation should be DISABLED in Supabase Dashboard for immediate login after signup

## Auth Flow
- **Nav**: "Log In" (text link → opens LoginModal overlay) + "Sign Up" (white button → /signup page) — Arkham-style
- **LoginModal** (`components/LoginModal.tsx`): Dark card overlay on landing page, email/password + Google OAuth, ESC/click-outside to close
- `/login` — full-page sign-in (email OR username + password)
- `/signup` — full-page registration with live password requirements checklist (8–100 chars, lowercase, uppercase, number, special char), rate limiting (5 attempts/60s cooldown), Google OAuth at top
- `/auth/callback` — handles OAuth redirects, auto-creates profiles for Google users
- **Google OAuth**: Requires enabling Google provider in Supabase Dashboard (Auth → Providers → Google)
- **LaunchAppButton**: Routes new users to /signup, returning users (localStorage `naka_has_session`) to /login
- Dashboard header shows user info when authenticated
- After login → redirected to `/dashboard`
- After signup → auto-login → redirected to `/dashboard`

## Supabase Database
- **profiles table**: `id` (UUID, FK to auth.users), `first_name`, `last_name`, `username` (unique), `email`, `created_at`
- RLS enabled with policies for user profile access and public username lookup

## Project Structure
```
app/
├── globals.css              # Global styles, CSS variables, neon-blue design tokens
├── layout.tsx               # Root layout (AuthProvider + ToastProvider wrapper)
├── page.tsx                 # Landing page — Dune.com-inspired, $NAKA tiers, FAQ
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
├── NakaLogo.tsx             # Naka Labs logo component (wraps steinz-logo-128.png)
├── SidebarMenu.tsx          # Left sidebar (260px, categories: Overview, Market, Intelligence, Tools, Account)
├── ThemeToggle.tsx          # Dropdown theme toggle (Dark/Light/Bingo), returns null until mounted
├── LoginModal.tsx           # Login modal overlay (email/password + Google OAuth)
├── LaunchAppButton.tsx      # Smart CTA (new users → /signup, returning → /login)
├── ProfileTab.tsx           # User profile tab with sign out
├── TradingViewChart.tsx     # TradingView candlestick chart widget
├── PriceTicker.tsx          # Live price ticker strip
├── Markets.tsx              # Markets tab component
├── ContextFeed.tsx          # Context feed tab
└── ...other components

lib/
├── supabase.ts              # Supabase client (browser) + getSupabaseAdmin (server)
├── rateLimit.ts             # In-memory rate limiter
├── errorHandler.ts          # API error handler
├── validation.ts            # Zod schemas
├── hooks/
│   ├── useAuth.ts           # Supabase auth hook (AuthContext, useAuthProvider)
│   └── useWallet.ts         # Wallet connection hook
└── supabase.ts              # Supabase client

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
| `next.config.js` | ESLint ignore, image domains, headers, performance opts |
| `tailwind.config.ts` | Neon-blue (#0A1EFF) design tokens, shadows, animations |
| `app/globals.css` | Glass effects, glow utilities, scrollbar styles |

## Environment Variables
| Variable | Location | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_KEY` | Replit Secret | Supabase service role key (server-side only) |
| `JWT_SECRET` | Replit Secret | JWT session signing (legacy) |
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

## $NAKA Token Tiers
- **Free**: Context feed, DNA analysis (limited), basic market data
- **Holder**: Full DNA analysis, portfolio tracking, whale alerts, priority AI
- **Pro**: Everything + advanced intelligence, API access, custom alerts

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
- **Auth is fully client-side** — Supabase JS client runs in the browser, NOT via API routes (Replit server can't reach external APIs)
- `reactStrictMode: false` in next.config.js
- `eslint.ignoreDuringBuilds: true` in next.config.js
