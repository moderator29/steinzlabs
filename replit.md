# Steinz Labs

## Overview
Next.js 14 application using App Router, TypeScript, and Tailwind CSS. On-chain intelligence platform for crypto analytics with AI-powered whale tracking, security scanning, and predictions market.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom dark theme (Space Grotesk, Inter, JetBrains Mono fonts)
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
├── globals.css              # Global styles, fonts, animations, glass/gradient/glow utilities
├── layout.tsx               # Root layout
├── page.tsx                 # Landing page (fixed nav, hero, stats, features, security, whitepaper, FAQ, CTA, footer)
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
    ├── predictions/         # Polymarket-style predictions market (auto-generated from CoinGecko/Pump.fun, YES/NO pools, payout calculator, DexScreener charts, countdown timers, resolved tab)
    ├── profile/             # Full profile with Activity/Settings/Achievements tabs
    ├── project-discovery/   # Project discovery with search & filters
    ├── risk-scanner/        # AI Portfolio Risk Scanner (full scan, risk breakdown)
    ├── security/            # Security Center (token scanner, contract analyzer, rug/phishing)
    ├── smart-money/         # Smart Money Watchlist (top wallets, follow/unfollow)
    ├── social-trading/      # Social/copy trading with leaderboard
    ├── swap/                # Multi-Chain Swap (token swap with slippage, routing)
    ├── trends/              # On-Chain Trends (metrics per chain, hot indicators)
    ├── vtx-ai/              # VTX AI full-page assistant (chat, quick actions)
    ├── wallet-clusters/     # Wallet Clusters (grouped wallets, risk tags)
    ├── wallet-intelligence/ # Wallet Intelligence (scan any address, AI assessment)
    └── whale-tracker/       # Whale Tracker (live feed of buys/sells/transfers)
components/
├── ContextFeed.tsx          # Context Feed tab with chain sub-tabs (All Chains, Solana, Ethereum, BSC, Polygon), gradient tab styling, chain badges, live indicator, 5s auto-refresh
├── TradingViewChart.tsx     # TradingView candlestick widget with SYMBOL_MAP (60+ tokens), getTradingViewSymbol(), isKnownTradingViewSymbol()
├── ViewProofModal.tsx       # On-chain proof modal (TradingView chart + DexScreener fallback, buy button, trust score, voting)
├── Markets.tsx              # Markets tab (token list with filters)
├── Predictions.tsx          # Predictions market (active predictions with vote yes/no)
├── SocialTab.tsx            # Social Trading tab (connect wallet + messages)
├── VtxAiTab.tsx             # VTX AI assistant tab (chat + quick actions)
├── DiscoverTab.tsx          # Project Discovery tab (search, filters, project cards)
├── WalletTab.tsx            # Wallet tab (balance, send/receive, connect via useWallet hook)
├── WalletConnectButton.tsx  # Reusable wallet connect/disconnect button with dropdown (MetaMask + Phantom, mobile deep links)
├── ProfileTab.tsx           # Profile tab (stats, settings, achievements, notification center, uses useWallet hook)
└── SidebarMenu.tsx          # Slide-out sidebar with working navigation (Core, Intelligence, Tools, Discover)
lib/
├── supabase.ts              # Supabase client + admin (service role) client
├── wallet.ts                # MetaMask + Phantom wallet connect/disconnect utilities
└── hooks/
    ├── useContextFeed.ts      # Context feed hook with chain filter param (ChainFilter type), 5s auto-refresh, deduplication
    ├── useAuth.ts            # Auth hook (sign in/up, wallet connect, localStorage session)
    ├── useWallet.ts          # Centralized wallet state hook (connect/disconnect MetaMask & Phantom, Supabase upsert, cross-component sync via custom events, mobile deep links)
    ├── usePrices.ts          # Live price feed hook (BTC, ETH, SOL from /api/prices)
    └── useTheme.ts           # Theme toggle hook (dark/light/bingo modes)
app/api/
├── prices/route.ts           # Real-time crypto prices — 30 coins via CoinGecko markets endpoint
├── market-data/route.ts      # Market data with trending/gainers/losers (CoinGecko)
├── token-scanner/route.ts    # Token contract security scanner
├── context-feed/route.ts     # Multi-chain context feed with ?chain= param (all/solana/ethereum/bsc/polygon). 5s cache, 50+ events. Sources: Alchemy ETH whales+ERC20, Helius Solana, Pump.fun 10 tokens, DexScreener trending+profiles+DEX searches (Raydium, Meteora, Jupiter, Orca, PancakeSwap, FourMeme, Uniswap, SushiSwap, QuickSwap). ETH: PEPE/SHIB/LINK/UNI/ARB searches. BSC: fourmeme+four.meme searches. 5s auto-refresh.
├── predictions/route.ts      # Predictions market API. Auto-generates from CoinGecko ($2+ min), Pump.fun, DexScreener DEXes (Raydium/PancakeSwap/Uniswap with chartPairAddress). 2-min cache refresh, in-memory pools, 3% fee, payout math. 4 resolved predictions.
├── engagement/route.ts       # Event engagement tracking (views, likes, shares, comments)
├── coin-discovery/route.ts   # Coin discovery — top 50 coins with full market data (CoinGecko)
├── vtx-ai/route.ts           # VTX AI assistant (Anthropic Claude, enhanced with Fear&Greed, gas prices, wallet analysis, platform context)
├── portfolio/route.ts        # Portfolio API (Alchemy token balances + CoinGecko prices)
├── wallet-intelligence/route.ts  # Real wallet analysis (Alchemy ETH balances, Solana RPC, auto-chain detection)
├── whale-tracker/route.ts    # Real whale tracking (Alchemy large transfers, CoinGecko market activity, 60s cache)
├── notifications/route.ts    # Real notifications (CoinGecko price alerts, trending, security alerts)
└── builder-submissions/route.ts  # Builder Network & Funding Portal API (applications, projects, milestones, endorsements, admin actions)
```

## Pages & Navigation
- `/` — Landing page with scroll-reactive nav, animated hero with gradient mesh + hex grid + floating particles + data stream + spotlight effect + concentric hero rings, intersection observer section reveals, live PriceTicker, stats row, feature cards, "How It Works" 4-step section, security suite, whitepaper, FAQ, CTA with pricing link, footer
- `/dashboard` — Main app with 6-tab bottom nav, AuthModal gate, theme toggle, live PriceTicker:
  - **Home** — Sub-tabs: Context Feed, Markets, Predictions (with live price ticker bar)
  - **Social** — Social trading with messages & connect wallet
  - **VTX AI** — AI assistant with chat input + quick actions (Market Overview, Portfolio, Risk, Signals)
  - **Discover** — Project Discovery with search, category filters, project cards
  - **Wallet** — Balance display, Send/Receive/Scan actions, Connect Wallet CTA
  - **Profile** — Guest user stats, Achievements, Analytics, Settings, Support, Sign Out
- `/dashboard/project-discovery` — Project grid with category filters and search
- `/dashboard/builder-funding` — Launchpad with milestone-based escrow, progress bars, submit form
- `/dashboard/predictions` — Full predictions market with TradingView candlestick charts, YES/NO voting, pool sizes, payout calculator
- `/dashboard/messages` — Discord/Telegram hybrid chat with channels, reactions, pinned messages
- `/dashboard/social-trading` — Top traders, copy trading, leaderboard, following
- `/dashboard/portfolio` — Wallet holdings, token balances, P&L tracking
- `/dashboard/profile` — Extended profile with Activity, Settings (notifications/preferences/privacy), Achievements
- `/admin` — Password-protected admin panel (195656, hidden from sidebar) with 7 tabs:
  - Platform Overview: user stats, system health indicators, activity preview
  - Context Feed Stats: engagement metrics, trending hashtags
  - Predictions Market: active predictions, resolved, staked value, leaderboard
  - Builder Funding: submission review workflow with approve/reject actions
  - Top Tokens: CoinGecko top 10 with prices/volumes
  - Recent Activity: typed event feed (prediction, feed, funding, user, alert)
  - Quick Actions: force refresh, clear cache, review flagged content, send alerts
- `/s/[id]` — Short share link page (fetches from /api/share?id=shortId)

## Design System
- **Background**: #0A0E1A (dark navy)
- **Card**: #111827, Elevated: #1A2235
- **Accent Colors**: Cyan (#00E5FF), Purple (#7C3AED)
- **Status**: Success (#10B981), Warning (#F59E0B), Danger (#EF4444)
- **Fonts**: Space Grotesk (headings), Inter (body), JetBrains Mono (code)
- **Theme Modes**: Dark, Light, Bingo (default) — toggled via ThemeToggle component, stored in localStorage as `steinz_theme`, applied via `[data-theme]` CSS selectors
- **CSS Utilities**: `.glass`, `.glass-card-enhanced`, `.gradient-text`, `.btn-gradient`, `.card-hover`, `.glow-card`, `.grid-pattern`, `.dot-pattern`, `.hero-mesh`, `.hero-mesh-enhanced`, `.aurora-bg`, `.morph-blob`, `.shimmer-btn`, `.gradient-border`, `.holographic-border`, `.neon-text`, `.neon-text-subtle`, `.cyber-line`, `.scrollbar-hide`, `.font-heading`, `.animate-float-subtle`, `.noise-overlay`, `.logo-glow`, `.btn-glow`, `.hero-ring`, `.hero-title`, `.feature-card`, `.security-card`, `.security-icon-glow`, `.section-divider`, `.stat-card`, `.stat-card-glow`, `.step-card`, `.data-stream-line`, `.pulse-dot`, `.depth-shadow`, `.radial-spotlight`, `.gradient-flow-bg`, `.dashboard-card-enter`, `.bottom-nav-item`, `.tab-indicator`, `.animate-ripple`
- **Animations**: `animate-float`, `animate-float-subtle`, `animate-float-3d`, `animate-fadeInUp`, `animate-fadeIn`, `animate-fadeInScale`, `animate-borderGlow`, `animate-textGradient`, `animate-shimmer`, `animate-pulse-glow`, `animate-glow-pulse`, `animate-spin-slow`, `animate-slide-up`, `animate-slide-in-left`, `animate-slide-in-right`, `animate-reveal-up`, `animate-breathe`, `animate-scanline`, `animate-neon-flicker`, `animate-particle`, `data-stream`, `ripple`, `gradient-flow`, `border-trace`
- **Stagger classes**: `.stagger-1` through `.stagger-8` for sequential entrance animations
- **Scroll offset**: `[id] { scroll-margin-top: 80px }` for fixed nav anchor links
- **Auth System**: AuthModal with email sign in/up (Supabase), Google OAuth (Supabase), wallet connect (MetaMask + Phantom via lib/wallet.ts). Session stored in localStorage.
- **Dashboard Nav**: Bottom nav uses `.bottom-nav-item` with `.active` indicator; notification bell hidden when not signed in

## Running
- **Dev**: `npm run dev` (port 5000)
- **Build**: `npm run build`
- **Start**: `npm run start` (port 5000)
- **Lint**: `npm run lint`

## Environment Variables
Configured in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public config
- `SUPABASE_SERVICE_KEY` — Supabase service role (server-side only)
- `ALCHEMY_API_KEY` — Alchemy blockchain API
- `ANTHROPIC_API_KEY` — Anthropic AI
- `COINGECKO_API_KEY` — CoinGecko market data
- `LUNARCRUSH_KEY_1` through `LUNARCRUSH_KEY_4` — LunarCrush social metrics
- `HELIUS_KEY_1`, `HELIUS_KEY_2` — Helius Solana RPC

## Performance Optimizations
- **Lazy Loading**: All dashboard tab components (ContextFeed, Markets, Predictions, SocialTab, VtxAiTab, DiscoverTab, WalletTab, ProfileTab) use `React.lazy()` with Suspense fallback spinners
- **Loading Skeletons**: `app/dashboard/loading.tsx` and `app/dashboard/predictions/loading.tsx` show animated skeleton UI during page transitions
- **Route Prefetching**: SidebarMenu prefetches all 23 dashboard routes on mount via `router.prefetch()`
- **API Caching**: All API routes return `Cache-Control` headers (s-maxage + stale-while-revalidate). Context feed: 5s/15s, Prices: 30s/60s, Predictions: 10s/30s
- **Polling Optimization**: Context feed polls every 15s (was 5s), slows to 60s when tab hidden. Removed cache-busting `t=Date.now()` param. Engagement views batched and delayed 2s
- **React.memo**: BottomNav, SidebarItem components wrapped in memo to prevent unnecessary re-renders
- **Bundle Splitting**: `optimizePackageImports` for lucide-react, date-fns, recharts in next.config.js
- **Compression**: gzip enabled (`compress: true`), WebP/AVIF image formats, 1hr image cache TTL
- **Debounce Hook**: `lib/hooks/useDebounce.ts` available for search inputs (300ms default)
- **Engagement Optimization**: View tracking limited to 5 events at a time with 2s debounce, prevents hundreds of POST requests

## Notes
- `image-hash` version updated from ^5.5.0 to ^7.0.1 (v5.x does not exist on npm)
- Project uses root-level `app/` and `lib/` directories (no `src/` prefix)
- `@/*` path alias maps to project root (`./`)
- Many features now connected to real APIs (GoPlus security, CoinGecko prices, Alchemy blockchain data, CoinGecko whale activity)
- Verified badge image: `public/verified-badge.png` (yellow checkmark, used across builder/social pages)
- Landing page uses CSS-only entrance animations (no React state transitions)
- Admin panel password: 195656, URL: `/admin` (also accessible via sidebar menu). Features: hamburger sidebar with 11 sections (Overview, Market Data, Trading Suite, Predictions, Builder Network, Funding Portal, Whale Activity, Security, API Health, Notifications, Settings). Builder Network + Funding Portal sections fetch real data from /api/builder-submissions. Admin can approve/reject builders and projects, approve milestones.
- Social links: X (https://x.com/steinzlabs), Telegram (https://t.me/steinzlabs) — in landing page footer
- Promo videos: `attached_assets/generated_videos/` — steinz_hero_reveal.mp4, steinz_feature_walkthrough.mp4, steinz_nothing_like_this.mp4, steinz_labs_intro.mp4
- Trading Suite: `/dashboard/trading-suite` — 7 tabs (Trending, Top, New Pairs, Pulse, Perpetuals, Positions, LIVE). Real CoinGecko trending + market data, DexScreener new pairs, Fear & Greed index. Paste CA feature, watchlist (localStorage). Perpetuals & LIVE streams = coming soon. API: `/api/trading-suite/route.ts` (30s cache)
- Social Trading: Functional hub with 3 tabs (Leaderboard, My Profile, Following). Trader cards with PnL%, win rate, followers, strategy tags. Copy trading with allocation settings. Profile creation stored in localStorage. Verified badge for top traders.
- Sidebar order: Dashboard → Portfolio → Full Trading Suite (HOT) → Trading DNA Analyzer → Intelligence → Tools (Pricing moved here) → Discover
- Share links: In-memory Map (8-char hex ID), route `/s/[id]`, resets on server restart
- TradingView: All tokens use TradingView by default via `getTradingViewSymbol()`. Known symbols get exact exchange mapping; unknown tokens fall back to `BINANCE:{SYMBOL}USDT`
- Logo: Custom swirling vortex (cyan/blue/purple), transparent PNG. Files: `public/steinz-logo-32.png`, `public/steinz-logo-64.png`, `public/steinz-logo-128.png`, `public/steinz-logo-192.png`, `public/steinz-logo-full.png`. Component: `components/SteinzLogo.tsx` renders `<img>` tag. Favicon: `app/favicon.ico`.
