# Steinz Labs

> Multi-chain crypto intelligence and self-custodial trading platform built for serious traders, whales, and analysts.

[Live Platform](https://nakalabs.xyz) · [Documentation](./docs/) · [Security Policy](./SECURITY.md) · [Changelog](./CHANGELOG.md)

---

## Overview

Steinz Labs is a Next.js 15 multi-chain platform delivering on-chain intelligence, AI-assisted trading analysis, whale tracking, sniper bot automation, and a non-custodial wallet across **Ethereum, Solana, BNB Chain, Polygon, Base, Arbitrum, Optimism, Avalanche, and TON**. Every tool is wired to real on-chain data — no mock feeds, no synthetic numbers.

The product is split across four layers:

- **Intelligence** — what's happening on-chain right now, who's moving, what's emerging.
- **Trading** — execute on it, safely, across any supported chain.
- **Security** — verify before you sign, protect what you hold.
- **Cult** — the NakaCult tier and the Vault for $NAKA holders and NFT owners.

---

## Features

### Intelligence Layer

- **VTX Agent** — Claude-powered AI analyst with live on-chain context, slash commands, token cards, and swap shortcuts. Sonnet for fast queries, Opus on advisor escalation.
- **Whale Tracker** — Live feed of 15K+ verified whale wallets across 8 chains. Profiles, watchlist, AI summaries, and one-click copy trading.
- **Wallet Clusters** — 5 clustering algorithms (direct transfer, common funding, coordinated trading, behavioral fingerprint, Sybil pattern) surface connected wallet groups.
- **Smart Money** — Continuously curated set of consistently profitable on-chain wallets with full transaction fingerprints and convergence alerts.
- **On-Chain Trends** — Real-time narrative and sector momentum tracking with historical context (7d / 30d) and percentile ranking.
- **Bubble Map** — Token ecosystem visualization with concentration, suspicious cluster detection, and an embedded VTX risk read.
- **Wallet Intelligence** — Drop any address, get archetype classification, P&L, win-rate, and an Alpha Intelligence Report.
- **Network Graph** — Interactive D3 visualization of wallet relationships, fund flows, and entity clustering.
- **Naka Trust Score** — Proprietary 0–100 token rating from five layers: security, liquidity, holders, market, social.
- **Network Metrics** — Chain health, gas, mempool, and infrastructure status.
- **DNA Analyzer** — Behavioral fingerprinting that classifies wallet style and recommends a copy mode.
- **Context Feed** — AI-curated on-chain news stream tagged BULLISH / HYPE / BEAR / NEUTRAL with Trust Score per event.
- **Research** — Long-form deep-dives on protocols, sectors, and market structure.

### Trading Layer

- **Multi-Chain Swap** — Powered by **0x Protocol** on EVM and **Jupiter** on Solana. 5-step safety flow runs before every swap.
- **Sniper Bot** — Sub-2-second execution across 5 chains with anti-MEV protection, server-enforced kill switch, and tier-gated access.
- **Copy Trading** — Three modes: Alerts, One-Click, Auto-Copy. Configurable allocation, slippage, and per-token blacklists.
- **Internal Wallet** — BIP39 seed-phrase wallet encrypted at rest with **AES-256-GCM** (PBKDF2 / 100k iterations / SHA-256 salt). Non-custodial by design — keys never leave the browser.
- **Approval Manager** — Token approval monitoring + revoke flow.
- **Signature Insight** — Pre-sign transaction analysis with intent labeling and value attribution.
- **Alerts** — Custom alert system over price, whale activity, and on-chain trend metrics.

### Security Layer

- **Domain Shield** — Real-time URL scanning against scam databases with community reporting layer.
- **Contract Analyzer** — VTX reads bytecode and flags dangerous functions, owner privileges, and hidden traps in plain English.
- **Risk Scanner** — Continuous wallet-portfolio risk monitoring with exposure breakdown.
- **GoPlus Integration** — Real-time honeypot, mint, and ownership checks pre-trade.
- **Naka Trust Score** — Proprietary aggregate trust score per token (see Intelligence).
- **Security Center** — Combined dashboard surfacing every active risk on the connected wallet.

### Cult Layer

- **NakaCult** — Token-gated tier for $NAKA holders (≥600K) or NFT owners.
- **The Vault** — Cinematic governance and intelligence experience.
- **The Conclave** — NAKA-weighted DAO voting on proposals.
- **The Oracle** — Daily intelligence briefings, exclusive AI assistant, and an anonymous alpha network.

### Telegram Bot

Full feature parity for the most-used flows. Slash commands include `/price`, `/chart`, `/info`, `/security`, `/whales`, `/follow`, `/portfolio`, `/balance`, `/holdings`, `/pnl`, `/alerts`, `/setalert`, `/buy`, `/sell`, `/snipe`, `/connect`, `/upgrade`. See [docs/slash-commands.md](./docs/slash-commands.md) for the full reference.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| State | Zustand + React hooks |
| Auth | Supabase Auth (email + SIWE wallet) |
| Database | Supabase Postgres 17 with Row-Level Security |
| AI | Anthropic Claude (Sonnet executor + Opus advisor) with prompt caching |
| EVM RPC | Alchemy SDK + Ethers.js + Viem |
| Solana RPC | Helius + @solana/web3.js |
| Wallet | Wagmi v5 + Reown AppKit + native BIP39 / AES-256-GCM |
| EVM Swap | 0x Protocol (Swap + Gasless) |
| Solana Swap | Jupiter Aggregator |
| Market Data | CoinGecko + DexScreener + Birdeye |
| Token Security | GoPlus Labs |
| On-chain Intel | Arkham Intelligence |
| Social Signals | LunarCrush |
| Real-time | Supabase Realtime + Server-Sent Events |
| Monitoring | Sentry + PostHog |
| Email | Resend |
| Cache + Rate Limit | Upstash Redis |
| Bot Protection | Cloudflare Turnstile |
| Hosting | Vercel |

---

## Architecture

```
                ┌─────────────────────────────────────────────────────┐
                │                  CLIENT                              │
                │  Next.js App Router · React 18 · Tailwind            │
                │  AppKit wallet bridge · BIP39/AES-256-GCM in browser │
                └──────────────────────┬──────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────────────┐
                │              EDGE / MIDDLEWARE                      │
                │  Auth (Supabase SSR) · Admin role gate              │
                │  Cookie budget guard · Security headers · HSTS      │
                └──────────────────────┬──────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
┌───────▼────────┐          ┌──────────▼────────┐          ┌─────────▼─────────┐
│   API ROUTES    │          │   SERVICE LAYER   │          │   WEBHOOKS        │
│  (Node.js)      │          │  (lib/services/)  │          │  Alchemy / Helius │
│  Tier-gated     │──────────│  Anthropic        │          │  HMAC-signed      │
│  Zod validated  │          │  Alchemy / Helius │          │  Timing-safe auth │
│  RLS-aware      │          │  0x / Jupiter     │          │  Rate-limited     │
└────────┬────────┘          │  GoPlus / Arkham  │          └─────────┬─────────┘
         │                   │  CoinGecko / etc. │                    │
         │                   └─────────┬─────────┘                    │
         │                             │                              │
         └─────────────────────────────┼──────────────────────────────┘
                                       │
                ┌──────────────────────▼──────────────────────────────┐
                │                  SUPABASE                            │
                │  Postgres 17 · RLS on every public table             │
                │  is_admin() · auth_tokens · pending_trades           │
                │  whale_* · copy_trades · vtx_query_logs · etc.       │
                └──────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

- **Server-trusted tier.** Tier (Free / Mini / Pro / Max / NakaCult) is verified server-side from `profiles.tier` via `withTierGate()`. The client cannot bypass.
- **Non-custodial invariant.** Private keys are AES-256-GCM-encrypted in the browser, never sent to the server. The server only ever sees a signed transaction.
- **Address normalization.** EVM is case-insensitive, Solana is case-sensitive. All comparisons go through `lib/utils/addressNormalize.ts`.
- **Inflight-Map dedup.** Concurrent requests for the same expensive computation share a single promise.
- **Write-on-read snapshots.** Daily snapshots (e.g. `holder_snapshots`) materialize the first time a route is hit and are reused for the rest of the day.
- **Audit log fire-and-forget.** Every admin mutation writes to `admin_audit_log` without blocking the response.
- **In-memory rate limit fallback.** Upstash Redis is primary; an in-process Map provides single-instance fallback.

---

## Getting Started

### Prerequisites

- Node.js **20+**
- npm (project uses `--legacy-peer-deps` for the wagmi v5 stack)
- A Supabase project (or access to the team's)
- API keys for the services in `.env.example`

### Installation

```bash
git clone https://github.com/moderator29/steinzlabs.git
cd steinzlabs
npm install --legacy-peer-deps
cp .env.example .env.local
# Fill in API keys — at minimum: Supabase, Anthropic, Alchemy, Helius
npm run dev
```

The app starts on `http://localhost:3000`.

### Build

```bash
npm run build
npm start
```

Type checking gate (run before pushing):

```bash
npx tsc --noEmit
```

---

## Environment Variables

See [`.env.example`](./.env.example) for the complete reference with comments. Required for local boot:

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; bypasses RLS |
| `ANTHROPIC_API_KEY` | Claude — VTX Agent |
| `ALCHEMY_API_KEY` | EVM RPC + token metadata |
| `HELIUS_API_KEY` | Solana RPC + webhooks |
| `JWT_SECRET` | Auth token signing — minimum 32 random chars |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (production: `https://nakalabs.xyz`) |

Webhook secrets, rate-limit Redis, Sentry, Telegram, and the rest are documented in `.env.example`.

---

## Project Structure

```
/app                    # Next.js App Router pages and API routes
  /api                  # Server-side route handlers (tier-gated, zod-validated)
  /admin                # Admin panel pages — middleware-gated by profiles.role
  /dashboard            # User-facing dashboard
/components             # React components (TSX)
  /admin                # Admin-only widgets
  /clusters             # Wallet cluster graph
  /whales               # Whale UI primitives
  /wallet               # AppKit bridge, deeplink, signing UI
/hooks                  # Custom React hooks
/lib
  /auth                 # adminAuth, apiAuth, withTierGate
  /services             # External API integrations (one file per provider)
  /wallet               # Internal wallet, encryption, session management
  /utils                # addressNormalize, detectDevice, deeplink
  /trading              # Relayer, executor
  /security             # GoPlus, security scanning
  /intelligence         # Proprietary scoring (holderAnalysis, cluster-detection)
/supabase
  /migrations           # SQL migrations (mirrored from Supabase MCP applies)
/middleware.ts          # Route protection, security headers, admin role gate
/docs
  /sessions             # Per-session handoff documents
  /cleanup-2026-05      # Audit findings + supabase cleanup log
```

---

## Documentation

**Repo root:**
- [Security Policy](./SECURITY.md) — vulnerability disclosure
- [Contributing Guide](./CONTRIBUTING.md) — workflow, code style, PR checklist
- [Code of Conduct](./CODE_OF_CONDUCT.md) — community standards
- [Changelog](./CHANGELOG.md) — release notes
- [Project Rules for Claude Code](./CLAUDE.md) — rules future AI sessions must follow
- [Technical Debt](./TECHNICAL_DEBT.md) — deferred Medium/Low audit findings
- [Security Backlog](./SECURITY_BACKLOG.md) — deferred Critical/High requiring owner action
- [License](./LICENSE)

**Product:**
- [Feature Documentation](./docs/feature-documentation.md) — every live feature with tier and data sources
- [Pricing](./docs/pricing.md) — Free / Mini / Pro / Max / NakaCult
- [Slash Commands](./docs/slash-commands.md) — Telegram + VTX command reference
- [Whitepaper](./docs/whitepaper.md) — strategic narrative

**Architecture:**
- [Supabase Architecture](./docs/supabase-architecture.md) — schema, RLS, functions, cron, webhooks, backups
- [Telegram Bot](./docs/TELEGRAM_BOT.md) — bot deployment + webhook setup

**Audit & Operations:**
- [Security Audit (2026-05-02)](./docs/security-audit-2026-05-02.md) — consolidated red-team report
- [Docs Audit (2026-05-02)](./docs/docs-audit-2026-05-02.md) — what's current vs stale
- [Supabase Cleanup Log](./docs/cleanup-2026-05/supabase-cleanup-log.md) — advisor 36→3 round
- [12-Agent Audit Findings](./docs/cleanup-2026-05/audit-findings.md) — verbatim agent reports
- [GitHub UI Settings Checklist](./docs/github-ui-settings-checklist.md)
- [Session Handoffs](./docs/sessions/)

---

## Security

We take security seriously. If you discover a vulnerability, please email **security@nakalabs.xyz** instead of opening a public issue. See [SECURITY.md](./SECURITY.md) for scope, safe-harbor, and severity guidance.

Key posture:

- **Row-Level Security on every public table** (`session_d_rls_advisor_cleanup` migration). Service-role catch-all + scoped policies (admin / users-own / public-read) per table.
- **Server-side admin gate** — `middleware.ts` verifies `profiles.role = 'admin'` before any `/admin/*` page renders, in addition to the API-level `verifyAdminRequest()`.
- **Opaque server-stored auth tokens** — `lib/authTokens.ts` issues 256-bit random tokens stored as SHA-256 hashes with single-use atomic consume. 30-min reset TTL, 24-hour verify TTL.
- **AES-256-GCM at rest for wallets** with PBKDF2 100k iterations. No XOR fallback.
- **Webhook signatures fail closed in production** for both Alchemy (HMAC-SHA256) and Helius (timing-safe header compare).
- **Tier-gate enforcement** server-side via `withTierGate()`. Sniper, copy trading, and VTX Pro features verify session tier from Supabase, never from the client.
- **Sentry PII scrub** strips cookies and is being extended to scrub wallet addresses and emails (see SECURITY_BACKLOG #10).

---

## License

Proprietary. All rights reserved. See [LICENSE](./LICENSE).

For licensing inquiries, contact licensing@nakalabs.xyz.

---

## Acknowledgments

Built by the Steinz Labs team in honor of **Naka Go (中号)** — the Shiba Inu who saved his breed.
