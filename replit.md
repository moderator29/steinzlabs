# Naka Labs

## Overview
Next.js 14 application using App Router, TypeScript, and Tailwind CSS. On-chain intelligence platform for crypto analytics with AI-powered whale tracking, security scanning, and predictions market. Rebranded from Steinz Labs to Naka Labs ($NAKA).

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with Dune.com-inspired professional dark theme (Inter, JetBrains Mono fonts)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation + @hookform/resolvers
- **Auth/Database**: Supabase (direct client via @supabase/supabase-js)
- **Blockchain**: Alchemy SDK
- **AI**: Anthropic AI SDK
- **Charts**: TradingView Widget (candlestick charts for all tokens, auto-maps to BINANCE/BYBIT exchanges), Recharts, Lightweight Charts
- **UI**: Lucide React icons, Framer Motion animations, Sonner toasts
- **Utilities**: clsx, tailwind-merge, class-variance-authority, date-fns, axios, crypto-js, sharp, image-hash, string-similarity

## Project Structure
```
app/
├── globals.css              # Global styles, professional design system, clean animations
├── layout.tsx               # Root layout
├── page.tsx                 # Landing page (Dune.com-inspired: clean nav, hero, stats, features, security, FAQ, CTA, footer)
├── admin/
│   └── page.tsx             # Admin panel (password: 195656, review system with 6 tabs)
└── dashboard/
    ├── layout.tsx           # Dashboard layout wrapper
    ├── page.tsx             # Dashboard with 6-tab bottom nav + Home sub-tabs
    ├── alerts/              # Smart Alerts management (toggle, delete, create)
    ├── builder-funding/     # Builder funding portal with milestone escrow
    ├── builder-network/     # Builder directory with skills, ratings, availability
    ├── dna-analyzer/        # Trading DNA Analyzer (traits, win rate, AI recs)
    ├── launchpad/           # Project launchpad (fundraising progress, filters)
    ├── messages/            # Group messaging (Telegram-style)
    ├── network-metrics/     # Network stats per chain (gas, TPS, TVL, validators)
    ├── predictions/         # Polymarket-style predictions market
    ├── profile/             # Full profile with Activity/Settings/Achievements tabs
    ├── project-discovery/   # Project discovery with search & filters
    ├── risk-scanner/        # AI Portfolio Risk Scanner (full scan, risk breakdown)
    ├── security/            # Security Center (token scanner, contract analyzer, rug/phishing)
    ├── smart-money/         # Smart Money Watchlist (top wallets, follow/unfollow)
    ├── social-trading/      # Social Trading
    ├── wgm-runner/          # NAKA Runner (3-lane cyberpunk endless runner, sprite-based character skins)
    ├── swap/                # Multi-Chain Swap (token swap with slippage, routing)
    ├── trends/              # On-Chain Trends (metrics per chain, hot indicators)
    ├── vtx-ai/              # VTX AI full-page assistant (chat, quick actions)
    ├── wallet-clusters/     # Wallet Clusters (grouped wallets, risk tags)
    ├── wallet-intelligence/ # Wallet Intelligence (scan any address, AI assessment)
    └── whale-tracker/       # Whale Tracker (live feed of buys/sells/transfers)
components/
├── ContextFeed.tsx          # Context Feed tab with chain sub-tabs
├── TradingViewChart.tsx     # TradingView candlestick widget
├── ViewProofModal.tsx       # On-chain proof modal
├── Markets.tsx              # Markets tab (token list with filters)
├── Predictions.tsx          # Predictions market
├── SocialTab.tsx            # Social Trading tab
├── VtxAiTab.tsx             # VTX AI assistant tab
├── DiscoverTab.tsx          # Project Discovery tab
├── WalletTab.tsx            # Wallet tab
├── WalletConnectButton.tsx  # Reusable wallet connect/disconnect button
├── ProfileTab.tsx           # Profile tab
├── NakaLogo.tsx             # Logo component (renders /naka-logo.svg)
├── AuthModal.tsx            # Full-page auth experience (email, Google OAuth, wallet connect)
├── SidebarMenu.tsx          # Clean slide-out sidebar navigation
├── FloatingBackButton.tsx   # Minimal back button for sub-pages
├── ThemeToggle.tsx          # Dark/Light/Bingo theme toggle
└── PriceTicker.tsx          # Live crypto price ticker
```

## Design System
- **Background**: #0B0D14 (clean dark)
- **Surface**: #12141D, Card: #161822, Elevated: #1C1F2E
- **Borders**: #232637, Subtle: #1A1D2B
- **Accent Colors**: Teal (#00D4AA), Indigo (#6366F1)
- **Status**: Success (#22C55E), Warning (#EAB308), Danger (#EF4444)
- **Text**: Primary (#F9FAFB), Secondary (#9CA3AF), Tertiary (#6B7280)
- **Fonts**: Inter (headings + body), JetBrains Mono (code)
- **Theme Modes**: Dark, Light, Bingo — toggled via ThemeToggle, stored in localStorage `naka_theme`, applied via `[data-theme]` CSS selectors
- **Design Philosophy**: 70% Dune.com, 20% fresh, 10% Helium. Professional, institutional-grade. No neon/cyberpunk effects. Clean solid buttons, subtle hover states, professional data tables.
- **Button Styles**: `.btn-primary` (white bg, dark text), `.btn-secondary` (outline), `.btn-gradient` (accent gradient)
- **CSS Utilities**: `.glass`, `.glass-card-enhanced`, `.gradient-text`, `.card-hover`, `.grid-pattern`, `.dot-pattern`, `.section-divider`, `.stat-card`, `.feature-card`, `.scrollbar-hide`, `.font-heading`
- **Animations**: Minimal and professional. `animate-fadeInUp`, `animate-fadeIn`, `animate-slide-up`, `animate-reveal-up`, `animate-float-subtle`. Stagger classes `.stagger-1` through `.stagger-8`.
- **Auth System**: Full-page AuthModal with Google OAuth (primary), wallet connect, email sign in/up. Terms footer.
- **Logo**: SVG at `/public/naka-logo.svg` (dark rounded rect with "NN" lettering in white + gradient). Component: `components/NakaLogo.tsx`.

## Security Headers (next.config.js)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()

## API Routes
```
app/api/
├── ca-lookup/               # CA lookup (DexScreener + GoPlus)
├── dna-analyzer/            # AI DNA analysis via Anthropic Claude
├── game-scores/             # HODL Runner leaderboard (in-memory)
├── wgm-scores/              # NAKA Runner leaderboard (in-memory)
├── token-scanner/           # Token security scanner
├── wallet-intelligence/     # Wallet analysis (Alchemy for EVM, Solana RPC for SOL)
├── portfolio/               # Portfolio data
├── prices/                  # Real-time crypto prices (30 coins via CoinGecko)
├── market-data/             # Market data with trending/gainers/losers
├── context-feed/            # Multi-chain context feed
├── predictions/             # Predictions market API
├── vtx-ai/                  # VTX AI assistant (Anthropic Claude)
├── platform-stats/          # Platform stats
├── customer-service/        # AI customer service chat
└── builder-submissions/     # Builder Network & Funding Portal API
```

## Running
- **Dev**: `npm run dev` (port 5000)
- **Build**: `npm run build`
- **Start**: `npm run start` (port 5000)

## Environment Variables
Configured in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public config
- `SUPABASE_SERVICE_KEY` — Supabase service role (server-side only)
- `ALCHEMY_API_KEY` — Alchemy blockchain API
- `ANTHROPIC_API_KEY` — Anthropic AI
- `COINGECKO_API_KEY` — CoinGecko market data
- `LUNARCRUSH_KEY_1` through `LUNARCRUSH_KEY_4` — LunarCrush social metrics
- `HELIUS_KEY_1`, `HELIUS_KEY_2` — Helius Solana RPC

## Key Notes
- Admin panel password: 195656, URL: `/admin` (hidden from sidebar)
- Social links: X (https://x.com/nakalabs), Telegram (https://t.me/nakalabs)
- NAKA GO branding: Logo at `/public/nakago-logo.jpg`, displayed in landing page footer
- Non-custodial wallet: ethers@6.13.4, `/dashboard/wallet-page`, XOR+base64 encrypted key storage
- VTX AI tiers: Free = 15 msgs/day (IP-tracked), Pro = unlimited
- Context feed: History preserved (200 events), bookmarks in localStorage `naka_bookmarks`
- Project uses root-level `app/` and `lib/` directories (no `src/` prefix)
- `@/*` path alias maps to project root (`./`)
- TradingView: All tokens use TradingView by default via `getTradingViewSymbol()`
