# Pricing

Five tiers. Four are paid via card; the fifth (NakaCult) is token-gated and not for sale. Subscriptions are monthly; downgrade is immediate at the end of the current period.

| Tier | Price | Audience |
|------|-------|----------|
| **Free** | $0 | Casual users, traders evaluating the platform |
| **Mini** | $5 / month | Active retail traders |
| **Pro** | $9 / month | Serious traders, multi-chain users, sniper users |
| **Max** | $15 / month | Power users, alpha hunters, multi-account operators |
| **NakaCult** | Token-gated | Hold ≥ 600,000 $NAKA **or** any Naka Labs NFT |

---

## Free — $0

**Includes:**

- Dashboard access (top gainers, trending, news feed)
- Context Feed with real-time on-chain news (read-only)
- Market browsing across all chains
- VTX Agent with **25 messages / day** rate limit
- Whale Tracker — top 20 whales per chain, public profiles
- Wallet Intelligence on any address (lookup, no save)
- On-chain Trends viewer
- Network Metrics
- Naka Trust Score for any token
- Domain Shield
- Internal wallet (create / import / send / receive)
- Basic swap (0x for EVM, Jupiter for Solana) up to **$500 / trade**
- Telegram bot — read-only commands (`/price`, `/chart`, `/info`, `/security`, `/whales`, `/whale`, `/portfolio`, `/balance`, `/holdings`, `/pnl 24h`)
- Up to **3 active price alerts**
- Standard support (community + email, 72h response)

**Limitations:**

- No whale watchlist (`/follow`)
- No copy trading
- No sniper bot
- No 7d / 30d / 45d P&L
- No Pro Whale AI summaries
- No Wallet Clusters detail view (preview only)
- VTX Agent: Sonnet only, no Opus advisor escalation

---

## Mini — $5 / month

Everything in Free, plus:

- VTX Agent: **150 messages / day**
- Whale **watchlist** with `/follow`, `/unfollow`, `/myfollows`
- 7d / 30d / 45d P&L on `/pnl`
- Up to **15 active alerts** (price + whale activity)
- Telegram bot: trading commands (`/buy`, `/sell` with sign deeplink)
- Faster cron polling on tracked whales (60s vs 5min on Free)
- Email support, 24h response

---

## Pro — $9 / month

Everything in Mini, plus:

- VTX Agent: **400 messages / day** with **Opus advisor** on hard decisions
- **Sniper Bot** — multi-chain sub-2s execution (Ethereum, Base, BNB, Polygon, Solana)
- **Copy Trading** — Alerts mode + One-Click mode
- **Whale AI summaries** — auto-generated profiles with sentiment, style, and recommended copy mode
- **Smart Money** convergence alerts (real-time when N+ smart wallets buy the same token)
- **Wallet Clusters** — full graph view with all 5 algorithms (direct transfer, common funding, coordinated trading, behavioral fingerprint, Sybil pattern)
- **Bubble Map** with VTX risk read
- Up to **50 active alerts** including trend-metric thresholds
- **DNA Analyzer** — full archetype classification + Alpha Intelligence Report
- **Approval Manager** with one-click revoke
- **Signature Insight** pre-sign analysis
- Priority support, 8h response

---

## Max — $15 / month

Everything in Pro, plus:

- VTX Agent: **unlimited** queries (fair-use policy applies — see Limitations)
- **Copy Trading** — Auto-Copy mode with custom allocation, slippage, and per-token blacklists
- **Multi-account** — link up to **5 wallets** for unified portfolio view
- **Custom alert webhooks** — send alerts to your own URL (Slack, Discord, Telegram, custom)
- **Research** — full library access including premium reports
- **Network Graph** export (JSON / CSV)
- **Risk Scanner** real-time portfolio monitoring
- **Concierge support** — direct DM with the team, 4h response

---

## NakaCult — Token-gated

Not purchasable. Granted automatically when you hold either:

- **≥ 600,000 $NAKA** in a verified wallet, **or**
- **Any Naka Labs NFT** (genesis or commemorative drop)

Verification runs on every login and once daily via cron. Drop below the threshold and access auto-revokes at the next sync.

Includes everything in **Max**, plus:

- **The Vault** — cinematic governance and intelligence experience
- **The Conclave** — NAKA-weighted DAO voting on proposals
- **The Oracle** — daily intelligence briefings, exclusive Cult-only AI assistant, and access to the **anonymous alpha network**
- **First-look access** on new features (~14 days before public)
- **Cult-only** Whale categories and curated wallet lists
- **Naka Trust Score** custom-tuned for the Cult feed
- **Direct line** to the founders for product input

---

## Cross-cutting limitations

- **Trading limits.** Per-trade caps:
  - Free: $500
  - Mini: $5,000
  - Pro: $50,000
  - Max / NakaCult: no cap (subject to RPC and aggregator constraints)
- **Sniper.** Per-snipe budget cap of $500 across all paid tiers; the kill switch is server-side via `platform_settings.sniper_enabled`.
- **VTX fair use.** Max tier "unlimited" means no daily cap, but a soft 1,000-message-per-day fair-use line. Sustained excess triggers a manual review.
- **Telegram rate limits.** 30 commands per chat per minute on every tier (Telegram's own rate limit, not ours).
- **Webhook delivery.** Custom webhooks are best-effort; we retry 3× with exponential backoff and then drop. Failed deliveries are visible in `/dashboard/alerts`.

---

## Billing & Cancellation

- Card billing through the standard checkout flow.
- Prorated refunds are not issued; cancel before the next renewal to avoid the next charge.
- Tier change takes effect on the next renewal except for upgrades, which are immediate (with prorated charge).
- NakaCult is verified continuously — no billing involved.

---

## Support tiers (response targets)

| Tier | Channel | Response target |
|------|---------|-----------------|
| Free | Email + community | 72h |
| Mini | Email | 24h |
| Pro | Email + in-app chat | 8h |
| Max | Concierge DM | 4h |
| NakaCult | Founder DM | Best-effort, typically same-day |
