# Slash Commands Reference

Steinz Labs exposes slash commands in two surfaces:

1. **Telegram bot** — `@SteinzLabsBot` (or whichever handle the production bot is registered under). Full command set, available 24/7 to anyone with a Telegram account.
2. **VTX Agent (in-app chat)** — server-driven shortcuts inside the dashboard's VTX panel. A subset of the Telegram set, plus chat-only flows.

Tier requirements are enforced server-side. Free-tier users hitting a Pro+ command get a tier-upgrade response with the specific tier required.

---

## Telegram bot

### Account & connection

| Command | Args | Tier | What it does |
|---------|------|------|--------------|
| `/start` | — | Free | Welcome message, intro, link to `/help`. |
| `/help` | — | Free | Full command list grouped by category. |
| `/connect` | — | Free | Opens a one-time deeplink that pairs the Telegram chat with a Steinz Labs account. After pairing, all wallet- and tier-aware commands resolve against that account. |
| `/disconnect` | — | Free | Unpairs Telegram from the linked Steinz Labs account. Wipes the cached pairing on the bot side. |
| `/settings` | — | Free | Shows current preferences (notification cadence, default chain, alert delivery). Returns inline buttons to toggle. |
| `/upgrade` | — | Free | Returns the pricing card and a deeplink to the upgrade flow on the website. |
| `/menu` | — | Free | Inline keyboard menu listing the top-level commands by category. |

### Market data

| Command | Args | Tier | What it does |
|---------|------|------|--------------|
| `/price` | `<symbol-or-address> [chain]` | Free | Returns spot price, 24h change, market cap, and volume. CoinGecko for majors, DexScreener for memes / pump.fun. |
| `/chart` | `<symbol-or-address> [tf=1h\|4h\|1d\|1w]` | Free | Returns a candlestick image for the given timeframe (default 1h). Powered by Lightweight Charts server-side render. |
| `/info` | `<symbol-or-address> [chain]` | Free | Token metadata: name, symbol, decimals, total supply, deployer, age, audit status, social links. |
| `/security` | `<address> [chain]` | Free | GoPlus token-security check: honeypot, taxes, holder concentration, mint/burn flags, owner privileges. Returns the Naka Trust Score (0–100) and a short verdict. |

### Whales

| Command | Args | Tier | What it does |
|---------|------|------|--------------|
| `/whales` | `[chain]` | Free | Top 20 whales for a chain by 45d PnL. Pro+ users see the full directory. |
| `/whale` | `<address-or-id>` | Free | Whale profile card: label, win rate, 45d PnL, last trade, recent positions. AI summary (`/whale-ai`) is Pro+. |
| `/follow` | `<address>` | Mini+ | Adds the whale to your watchlist; you'll get pings on every qualifying trade. |
| `/unfollow` | `<address>` | Mini+ | Removes a whale from your watchlist. |
| `/myfollows` | — | Mini+ | Lists your followed whales with last-trade timestamps. |

### Portfolio

| Command | Args | Tier | What it does |
|---------|------|------|--------------|
| `/portfolio` | `[address]` | Free | Aggregated holdings (USD value, P&L, 24h change). With no arg, uses your linked wallet. With an arg, runs a public read on the supplied address (no auth required, but rate-limited). |
| `/balance` | `[address] [chain]` | Free | Native balance for a chain. Defaults to your linked wallet if no arg. |
| `/holdings` | `[address] [min_usd=10]` | Free | Token-level holdings with a minimum USD filter. |
| `/pnl` | `[address] [period=24h\|7d\|30d\|45d]` | Mini+ | Realized + unrealized P&L for the period. Free tier sees 24h only. |

### Alerts

| Command | Args | Tier | What it does |
|---------|------|------|--------------|
| `/alerts` | — | Free | Lists your active alerts (price, whale, trend). |
| `/setalert` | `<symbol> <op> <value>` | Mini+ | Creates a price alert — `op` is one of `>`, `<`, `>=`, `<=`. Example: `/setalert SOL > 200`. Free tier capped at 3 active alerts. |
| `/removealert` | `<id>` | Free | Removes an alert by its short id from `/alerts`. |

### Trading

> **Non-custodial invariant.** All trading commands route through the user's connected wallet. The Telegram bot never holds keys.

| Command | Args | Tier | What it does |
|---------|------|------|--------------|
| `/buy` | `<symbol-or-address> <usd-amount> [chain] [slippage=1]` | Mini+ | Quotes a buy via 0x (EVM) or Jupiter (Solana). Returns a deeplink to the in-app sign flow. Free tier sees the quote but the sign deeplink is gated. |
| `/sell` | `<symbol-or-address> <pct\|usd-amount> [chain] [slippage=1]` | Mini+ | Same as `/buy` but in reverse. `pct` accepts `25%`, `50%`, etc. |
| `/snipe` | `<address> <usd-amount> [chain] [slippage=2]` | Pro+ | Adds the token to the sniper queue; the 5-step safety flow runs server-side and queues a `sniper_executions` row only if all checks pass. Server-side kill switch on `platform_settings.sniper_enabled` overrides everything. Per-snipe budget cap = $500. |

### Defaults & error behavior

- `[chain]` defaults to `ethereum` if the address shape is EVM, `solana` if base58, otherwise prompts.
- All commands return Telegram MarkdownV2 — no HTML.
- Rate limit: 30 commands per chat per minute. Exceeded → "slow down" reply with a `Retry-After` window.
- Unknown / malformed: returns an inline `?` with the closest match suggestion based on Levenshtein distance.

---

## VTX Agent (in-app chat)

The VTX panel inside the dashboard supports a smaller slash-command set for high-frequency lookups. Commands are parsed before the message is sent to Claude — they short-circuit the AI call and return cached/structured data directly.

| Command | Args | Tier | What it does |
|---------|------|------|--------------|
| `/portfolio` | `[address]` | Free | Same as Telegram. Renders an inline portfolio card. |
| `/scan` | `<address> [chain]` | Free | Token security check + Naka Trust Score. Renders a structured card with the layer breakdown. |
| `/swap` | `<from> <to> [usd-amount]` | Mini+ | Opens the swap drawer pre-filled with the quoted route. |
| `/whale` | `<address-or-id>` | Free | Whale profile card embedded in the chat. |
| `/clear` | — | Free | Clears the visible conversation history (server-side `vtx_query_logs` retains for usage analytics). |

Anything that isn't a recognized slash command falls through to a regular Claude turn, with the VTX system prompt and live data context.

---

## Notes for developers

- Telegram parser lives in `lib/telegram/commands/`. Each command is a single file exporting `(ctx, args) => Promise<Response>`.
- Symbol resolution is shared with VTX via `lib/telegram/commands/resolveSymbol.ts` — see [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) for known gaps in the symbol map.
- Tier gates use `withTierGate()` from `lib/subscriptions/apiTierGate.ts` so the same enforcement runs in HTTP routes and Telegram callbacks.
- Webhook auth: production `TELEGRAM_WEBHOOK_SECRET` must be set. The `/api/telegram/webhook` route compares `X-Telegram-Bot-Api-Secret-Token` against the env value with constant-time compare.
