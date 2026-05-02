# Steinz Labs Whitepaper

Version 1.0 · 2026-05-02 · Naka Labs

> Multi-chain crypto intelligence and self-custodial trading infrastructure.

## 1. Mission

Crypto markets reward speed, depth, and discipline. The tooling around them
rewards none of those. Steinz Labs collapses the gap between custodial CEX
dashboards and disjointed on-chain explorers. One platform, one wallet,
every chain. Real-time intelligence, AI-assisted analysis, execution that
signs on the user's device — never on a server.

## 2. Product

Four layers — Intelligence, Trading, Security, Cult — served through a
Next.js 15 web app, an in-app VTX Agent, and a feature-parity Telegram bot.

See README.md for the full feature inventory and docs/slash-commands.md
for the bot reference.

## 3. Architecture

Client → Edge middleware (auth, admin gate, headers) → API routes (tier
gated, zod validated) → service layer (Anthropic, Alchemy, Helius, 0x,
Jupiter, GoPlus, Arkham, CoinGecko, Birdeye, LunarCrush) → Supabase
Postgres 17 with Row-Level Security on every public table.

Key decisions: server-trusted tier, non-custodial invariant, address
normalization (EVM lowercase, Solana case-preserving), inflight-Map dedup,
write-on-read snapshots, audit log fire-and-forget, Upstash rate limit
with in-process fallback.

## 4. Security

Non-custodial throughout. AES-256-GCM at rest for browser-stored seeds
(PBKDF2 / 100k / SHA-256). Opaque server-stored auth tokens (256-bit
random, SHA-256-hashed, single-use atomic consume, 30-min reset TTL,
24-hour verify TTL). RLS on every public table (117 verified). Server-side
admin gate in middleware. Webhook signatures fail closed in production
(Alchemy HMAC-SHA256, Helius crypto.timingSafeEqual). VTX prompt-injection
allow-list on personality/language/risk/depth.

For full disclosure policy see SECURITY.md. Backlog at SECURITY_BACKLOG.md.

## 5. Tokenomics ($NAKA)

NakaCult tier is granted automatically when the verified wallet holds
either ≥600,000 \$NAKA or any Naka Labs NFT. Verification runs on every
login and once daily via cron. Token contract address, supply schedule,
and emissions are published separately on the official launch page and
intentionally not duplicated here to avoid drift.

## 6. Team & Partners

Built by Naka Labs. Contact hello@nakalabs.xyz.

Core integrations: Anthropic Claude, Supabase, Alchemy, Helius, 0x Protocol,
Jupiter, GoPlus Labs, Arkham Intelligence, CoinGecko, DexScreener, Birdeye,
LunarCrush, Reown AppKit, Wagmi v5, Vercel, Upstash Redis, Sentry, PostHog,
Resend, Cloudflare Turnstile.

## 7. Roadmap

Roadmap is published only when items are committed and dated. Current
focus: closing SECURITY_BACKLOG.md and TECHNICAL_DEBT.md, hardening the
Cult experience for general availability, expanding chain coverage on
the trading layer.

## 8. Disclaimers

Not financial advice. Non-custodial — user is solely responsible for
seed-phrase and wallet-session security. Best-effort uptime; we do not
guarantee against third-party provider outages. Some features (sniper
bot, copy trading, on-ramps) may not be available in every jurisdiction.
The platform is provided "as is", without warranty. See LICENSE.

Trademarks: Steinz Labs, Naka Labs, NakaCult, \$NAKA are trademarks of
Naka Labs.

Licensing: licensing@nakalabs.xyz. Security disclosures:
security@nakalabs.xyz.

> Built in honor of Naka Go (中号) — the Shiba Inu who saved his breed.
