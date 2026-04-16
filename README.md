# STEINZ LABS

On-chain crypto intelligence platform built for serious traders.

## Overview

STEINZ LABS is a full-stack on-chain intelligence operating system that gives traders institutional-grade analytics in a consumer-grade interface. The platform aggregates real-time blockchain data across 12+ chains, applies proprietary scoring models, and surfaces actionable intelligence through a unified dashboard. From wallet DNA analysis and smart money tracking to token safety scanning and multi-chain swaps, every tool is built for traders who need speed, depth, and precision.

## Features

### Intelligence Layer
- **Context Feed** — Real-time AI-curated on-chain intelligence stream. Every event tagged BULLISH, HYPE, BEAR, or NEUTRAL with Trust Score. Bookmarks, history, and multi-chain filters.
- **VTX AI Engine** — Natural language on-chain analyst. Ask anything, get live data-backed answers in seconds. Free and Pro tiers with live web search integration.
- **Trading DNA Analyzer** — Drop any wallet address and decode its full behavioral and performance profile. Win rates, P&L, archetype classification, and Alpha Intelligence Report.
- **Wallet Intelligence** — Classify every active wallet: Whales, Smart Money, Retail, Bots, Dormant. Real-time cluster following and deep wallet relationship mapping.
- **Smart Money Watchlist** — Curated feed of consistently top-performing on-chain wallets. Full transaction fingerprints and one-click copy trading.
- **Whale Tracker** — Real-time monitoring of large on-chain movements with configurable alert thresholds across chains.
- **Network Graph** — Interactive visualization of wallet relationships, fund flows, and entity clustering.

### Security & Risk
- **Token Safety Scanner** — 0-100 Trust Score on any contract. Verification status, liquidity lock, holder concentration, tax analysis, dev history, and honeypot simulation.
- **Contract Analyzer** — Paste any contract address. VTX AI reads the bytecode and explains exactly what it does in plain English. Flags dangerous functions, owner privileges, and hidden traps.
- **Rug Pull Detector** — Full deployer history, serial rugger flagging, liquidity removal pattern analysis, and community-powered scam reporting.
- **Domain Shield** — Every link checked in real time. Domain age, scam database cross-reference, community reports. SAFE / SUSPICIOUS / PHISHING verdict.
- **Risk Scanner** — Portfolio-level risk scoring with exposure breakdown by chain, sector, and concentration.

### Trading
- **Multi-Chain Swap** — Trade across 12+ chains inside the intelligence layer. Safety check runs before every swap. Best price routing via Jupiter (Solana) and 0x Protocol (EVM).
- **Copy Trading** — One-click wallet mirroring with configurable size limits and token filters.
- **Sniper** — Automated entry on new token launches with configurable trust score gates.
- **Trading Suite** — Advanced order types, position tracking, and cross-chain P&L dashboard.

### Portfolio & Analytics
- **Portfolio Tracker** — Connect wallet, auto-sync all holdings, USD values, P&L, 24h change, and historical chart. Zero manual input required.
- **Signature Insight** — Full decoded transaction history with intent labeling and value attribution.
- **Predictions** — Create and participate in on-chain prediction markets. Stake positions, earn rewards, build your win rate.
- **Trend Analysis** — Cross-chain narrative and sector momentum tracking with historical data.

### Discovery & Research
- **Project Discovery** — Curated pipeline of vetted early-stage on-chain projects.
- **Launchpad** — Token launch platform with integrated trust scoring and community vetting.
- **Builder Network** — Directory of active on-chain builders and projects seeking funding or community.
- **Research** — Deep-dive reports on protocols, sectors, and market structure.
- **Social Trading** — Community alpha sharing with reputation scoring and verifiable track records.

### Engagement
- **WGM Runner** — Gamified daily engagement with on-chain rewards.
- **HODL Runner** — Long-term holding streaks with yield incentives.
- **Leaderboards** — Cross-platform performance rankings.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth + Firebase (Google/Apple OAuth) |
| State Management | Zustand |
| Charts | Recharts, Lightweight Charts, D3.js |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| Email | Resend |
| EVM Data | Alchemy SDK, Ethers.js |
| Solana Data | Alchemy Solana RPC, @solana/web3.js |
| Market Data | CoinGecko API, DexScreener API |
| On-chain Intel | Arkham Intelligence API |
| Token Security | GoPlus Labs |
| EVM Trading | 0x Protocol (Swap + Gasless) |
| Solana Trading | Jupiter Aggregator |
| AI Engine | VTX Intelligence Engine |
| Bot Protection | Cloudflare Turnstile |

## Environment Variables

Copy and configure the following variables in your `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=

# Authentication
JWT_SECRET=
SESSION_SECRET=

# Site
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_BASE_URL=

# Blockchain Data
ALCHEMY_API_KEY=
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_ALCHEMY_RPC=
NEXT_PUBLIC_ALCHEMY_SOLANA_RPC=
SOLANA_RPC_URL=

# Market & Intelligence Data
ARKHAM_API_KEY=
COINGECKO_API_KEY=
NEXT_PUBLIC_ETHERSCAN_API_KEY=
ETHERSCAN_API_KEY=
ETHPLORER_API_KEY=

# AI Engine
ANTHROPIC_API_KEY=

# Trading
ONEINCH_API_KEY=

# Email
RESEND_API_KEY=
SENDGRID_API_KEY=

# Treasury
TREASURY_WALLET_EVM=
TREASURY_WALLET_SOLANA=

# Admin
ADMIN_PASSWORD=

# Bot Protection
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

## Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn
- A Supabase project
- API keys for the services listed above

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd steinz-labs

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run the development server
npm run dev
```

The application will be available at `http://localhost:5000`.

### Build for Production

```bash
npm run build
npm start
```

## Architecture

STEINZ LABS is built on the Next.js 15 App Router with a clear separation between client and server code.

```
/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # Server-side API handlers (REST endpoints)
│   │   ├── vtx-ai/        # VTX AI intelligence engine
│   │   ├── dna-analysis/  # Wallet DNA analyzer
│   │   ├── context-feed/  # Real-time intelligence stream
│   │   ├── token-scanner/ # Contract trust scoring
│   │   ├── whale-tracker/ # Large wallet movement monitoring
│   │   └── ...            # 30+ additional API endpoints
│   └── dashboard/         # Protected dashboard routes
│       ├── vtx-ai/        # AI analyst interface
│       ├── wallet-intelligence/ # Wallet classification
│       ├── smart-money/   # High-performance wallet tracking
│       └── ...            # 40+ dashboard views
├── components/            # Shared React components
├── lib/                   # Server-side utilities and integrations
│   ├── anthropic/         # AI engine integration
│   ├── arkham/            # Arkham Intelligence client
│   ├── intelligence/      # Proprietary scoring models
│   ├── trading/           # DEX integration layer
│   ├── wallet/            # Multi-chain wallet utilities
│   └── security/          # Security and validation utilities
└── middleware.ts           # Route protection and session validation
```

**Key architectural decisions:**

- **API-first**: All data fetching happens through typed server-side API routes. Client components never call external APIs directly.
- **Server/Client boundary**: Heavy computation, API key usage, and database access are strictly server-side. Client components receive only serialized data.
- **Multi-chain abstraction**: A unified wallet interface normalizes EVM and Solana data models so the UI never deals with chain-specific quirks.
- **Rate limiting**: Built-in rate limiting on all public API endpoints to prevent abuse.
- **Trust Score engine**: Proprietary scoring algorithm combining on-chain signals, historical behavior, and community data into a single 0-100 metric.

## Security

- **Non-custodial**: STEINZ LABS only reads public blockchain data. No private keys are ever requested, stored, or transmitted.
- **Session management**: JWT-based sessions signed with `SESSION_SECRET`, validated on every protected request via middleware.
- **Server-side secrets**: All API keys are server-side only. No sensitive credentials are exposed to the client bundle.
- **Input validation**: All API inputs validated with Zod schemas before processing.
- **Rate limiting**: Per-IP rate limiting on all API routes to prevent scraping and abuse.
- **Bot protection**: Cloudflare Turnstile integration on authentication flows.
- **SQL injection prevention**: All database queries use parameterized statements via the Supabase SDK.
- **Honeypot simulation**: Token scanner runs simulated buy/sell transactions to detect honeypot contracts before users trade.
- **Phishing detection**: Real-time URL scanning against known scam databases with community reporting layer.
