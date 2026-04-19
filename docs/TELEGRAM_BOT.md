# Naka Labs Telegram Bot

@Nakalabsbot — official bot for the Naka Labs platform. Lets users link
their Telegram account to receive alerts and run a curated set of
read-only commands. Trading commands are gated by subscription tier.

---

## How a user connects

1. Sign in at the app (steinzlabs.vercel.app, later nakalabs.io).
2. Go to **Settings → Notifications**.
3. In the **Telegram Notifications** card, tap **Generate Connect Code**.
4. A 6-digit code appears (10-min expiry). Tap **Open Bot** → it opens
   the bot in Telegram.
5. In the bot DM, send: `/link 123456`.
6. Bot replies "✅ Account linked!" — done. The Settings card auto-flips
   to "Connected as @username" within 3 seconds (it polls).

The link is stored in `user_telegram_links` (chat_id ↔ user_id). All
outbound notifications use that mapping.

---

## Command reference

Every command is dispatched in [`app/api/telegram/webhook/route.ts`](../app/api/telegram/webhook/route.ts).
Each command checks the user's effective tier via `checkTier()` from
[`lib/subscriptions/tierCheck.ts`](../lib/subscriptions/tierCheck.ts) — the same helper used by
the rest of the platform. Expired subscriptions are auto-downgraded to
`free`.

### 🆓 Free — anyone with a linked account

| Command | What it does |
|---|---|
| `/start` | Onboarding. If unlinked, shows the connect flow with an "Open Naka Labs" button. If linked, shows the help menu. |
| `/help` | Full command list with tier badge for the current user. |
| `/status` | Shows whether linked + current plan badge (FREE / MINI / PRO / MAX). |
| `/link <code>` | Pairs the Telegram chat with the Naka account that generated the code. |
| `/unlink` | Removes the link. Stops all alerts to this chat. |
| `/price <symbol>` | Quick token price card with a deep-link to the in-app token page. |
| `/watchlist` | Opens the user's watchlist with a deep-link to the full UI. |

### ✨ MINI ($9/mo) and above

| Command | What it does |
|---|---|
| `/whale <address>` | Wallet snapshot card with deep-link to Wallet Intelligence. |
| `/alerts` | Recent alerts (last 24h) with deep-link to the Alerts page. |

### ⭐ PRO ($29/mo) and above

| Command | What it does |
|---|---|
| `/vtx <question>` | Routes the user into the VTX AI conversation page with a deep-link. |
| `/portfolio` | PnL/positions across tracked wallets with a deep-link to Dashboard. |

### 🔥 MAX ($99/mo) — early access

| Command | What it does |
|---|---|
| `/snipe <token>` | Opens the in-app sniper config. |
| `/copy <whale>` | Opens copy-trade controls for that whale. |

When a user runs a command above their tier, the bot replies with a 🔒
notice and an **Upgrade Plan** inline button → `/pricing`.

---

## Outbound notifications (no command needed)

These are pushed by background crons. The user just needs to be linked
and have the matching toggle enabled in **Settings → Notifications**:

| Cron | Notification |
|---|---|
| `whale-activity-poll` (1 min) | Whale buys/sells above the user's USD threshold |
| `alert-monitor` (1 min) | Custom price alerts the user configured |
| `copy-trade-monitor` (1 min) | Copy-trade fills |
| `limit-order-monitor` (1 min) | Limit-order executions |
| `stop-loss-monitor` (1 min) | Stop-loss triggers |
| `daily-digest` (9am UTC) | Daily wrap-up |
| `notification-digest` (every 4h) | Batched digest for users in quiet hours |
| `health-watch` (5 min) | **Admin-only** — infra status alerts to admins in `health_alert_recipients` |

All sends go through `sendTelegramMessage()` in
[`lib/telegram/client.ts`](../lib/telegram/client.ts), which honors the
user's quiet-hours config and tier-based notification channels.

---

## Tier detection

When a Telegram message arrives, `getLinkedUser(chatId)` runs:

```sql
SELECT user_id FROM user_telegram_links WHERE telegram_chat_id = $1;
SELECT subscription_tier, tier_expires_at FROM profiles WHERE id = $1;
```

then `checkTier(subscription_tier, tier_expires_at, requiredTier)`
returns `{ allowed, currentTier, expired }`. Expired = treated as
`free` until the user renews — they keep notifications they're entitled
to as a free user, but premium commands are blocked with the upgrade
button.

---

## Inline keyboard buttons

Every reply that benefits from a follow-up action ships with an inline
keyboard. Common buttons:

- **🌐 Open Naka Labs** → `${APP_URL}`
- **⚙️ Notification Settings** → `${APP_URL}/settings/notifications`
- **🔑 Generate Code** → `${APP_URL}/settings/notifications`
- **⭐ Upgrade Plan** → `${APP_URL}/pricing`
- Per-command deep-links (e.g. `/whale 0xabc` → "🌐 Open Wallet" → `/dashboard/wallet-intelligence?address=0xabc`)

The button schema is `{ inline_keyboard: [[{ text, url }, …], …] }` —
see Telegram's [InlineKeyboardMarkup docs](https://core.telegram.org/bots/api#inlinekeyboardmarkup).

---

## Webhook setup (one-time per environment)

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://steinzlabs.vercel.app/api/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"],
    "drop_pending_updates": true
  }'
```

Verify: `curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"`.

### Required env vars

| Var | Where used |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Server — sending messages, setWebhook |
| `TELEGRAM_WEBHOOK_SECRET` | Server — incoming webhook auth |
| `TELEGRAM_BOT_USERNAME` | Server — deep-link generation in webhook |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Client — Settings card uses this for `t.me/` links |
| `NEXT_PUBLIC_APP_URL` | Server + client — base URL in deep-links |

---

## How other platforms compare

- **Phantom / Coinbase / Linear** → Tier 1 (notifications only). Same as us today.
- **Banana Gun / Maestro / Trojan / BONKbot** → Tier 2 (full trading from Telegram). Custodial wallets, `/buy /sell /positions` — this is where Naka can compete on Solana sniping.
- **TON ecosystem (Notcoin, Hamster Kombat)** → Tier 3 (full mini-app inside Telegram). Best UX, most work.

We're at Tier 1 + a handful of Tier 2 read-only commands. Adding
custodial signing for `/buy /sell` is the next leap.
