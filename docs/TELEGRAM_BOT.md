# Naka Labs Telegram Bot

@Nakalabsbot — official bot for the Naka Labs platform. Lets users link
their Telegram account to receive alerts and run a curated set of
read-only commands. Trading commands are gated by subscription tier.

Tier prices match [`app/dashboard/pricing/page.tsx`](../app/dashboard/pricing/page.tsx) — the on-chain source of truth.

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

### 🆓 Free ($0) — anyone with a linked account

| Command | What it does |
|---|---|
| `/start` | Onboarding. Opens the tap-first inline menu (main menu). If unlinked, My Account shows the connect flow. |
| `/menu` | Reopens the inline menu at the main screen. |
| `/help` | Full command list with tier badge for the current user. |
| `/whales` | Top whales by 30d realized PnL, read live from the `whales` table. |
| `/status` | Shows whether linked + current plan badge (FREE / MINI / PRO / MAX). |
| `/link <code>` | Pairs the Telegram chat with the Naka account that generated the code. |
| `/unlink` | Removes the link. Stops all alerts to this chat. |
| `/price <symbol>` | Quick token price card with a deep-link to the in-app token page. |
| `/watchlist` | Opens the user's watchlist with a deep-link to the full UI. |
| `/alerts` | Opens recent triggered alerts (last 24h). |
| `/vtx <question>` | Routes to VTX AI in-app. **Quota-gated**: 25 msgs/day on Free, 100 on Mini, unlimited on Pro+. |

### ✨ Mini ($5/mo) and above

| Command | What it does |
|---|---|
| `/whale <address>` | Wallet snapshot card with deep-link to Wallet Intelligence (gated because Whale Tracker is Mini+). |
| `/portfolio` | PnL/positions across tracked wallets (multi-chain wallet intelligence is Mini+). |

### ⭐ Pro ($9/mo) and above

| Command | What it does |
|---|---|
| `/copy <whale>` | Opens copy-trade controls for a whale (copy-trading is Pro). |

### 🔥 Max ($15/mo)

| Command | What it does |
|---|---|
| `/snipe <token>` | Opens the in-app sniper config (Sniper Bot is Max-only). |

When a user runs a command above their tier, the bot replies with a 🔒
notice and an **Upgrade Plan** inline button → `/dashboard/pricing`.

---

## Outbound notifications (no command needed)

These are pushed by background crons. The user just needs to be linked
and have the matching toggle enabled in **Settings → Notifications**:

| Cron | Notification |
|---|---|
| `whale-activity-poll` (1 min) | Whale buys/sells above the user's USD threshold |
| `alert-monitor` (1 min) | Custom price alerts the user configured |
| `copy-trade-monitor` (1 min) | Copy-trade fills (Pro+) |
| `limit-order-monitor` (1 min) | Limit-order executions |
| `stop-loss-monitor` (1 min) | Stop-loss triggers |
| `daily-digest` (9am UTC) | Daily wrap-up |
| `notification-digest` (every 4h) | Batched digest for users in quiet hours |
| `health-watch` (5 min) | **Admin-only** — infra status alerts to admins in `health_alert_recipients` |

All sends go through `sendTelegramMessage()` in
[`lib/telegram/client.ts`](../lib/telegram/client.ts).

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

## Inline menu navigation

`/start` and `/menu` open a tap-first command deck built in
[`lib/telegram/menu.ts`](../lib/telegram/menu.ts). It is **one persistent
message that rewrites itself in place** as the user navigates, so the chat
never fills with stale bubbles. Every screen renders `parse_mode: "HTML"`
(only `& < >` need escaping), which is safe for arbitrary token, whale and
news text.

The main menu (`home`) leads into six submenus, each with a **🔙 Back**
button that returns to `home`:

- **🐋 Whale Alerts**: top wallets by 30d realized PnL, read live from the `whales` table, with a link into the in-app Whale Tracker.
- **🧠 Smart Money**: highest-conviction wallets by Naka whale score, same source table, ranked by score.
- **📰 Naka News**: live headlines from the same multi-source aggregator as the in-app News tab, each headline a tappable link.
- **📊 Markets**: launcher for the live market-data commands (`/price`, `/chart`, `/info`) plus one-tap BTC / ETH / SOL, Trending, Gainers, and Fear & Greed.
- **👤 My Account**: live link status, plan badge and active-alert count, or the connect steps if the chat is not linked yet.
- **🆘 Help**: the full command reference with tier badges.

Navigation uses callback buttons (`nav:<node>`, `menu:<action>`); external
actions stay URL buttons (**🌐 Open Naka Labs**, **⚙️ Settings**,
**⭐ Upgrade Plan**, and per-command deep-links). When an in-place edit fails
(for example the source bubble was a photo caption), the bot falls back to a
fresh send so a button never dead-ends.

All screens are grounded in real data: whale and smart-money screens read the
`whales` table, News reads the live aggregator, and My Account reads the live
link and alert rows. Nothing is fabricated.

Schema: `{ inline_keyboard: [[{ text, url | callback_data }, …], …] }`. See
Telegram's [InlineKeyboardMarkup docs](https://core.telegram.org/bots/api#inlinekeyboardmarkup).

---

## Webhook setup (one-time per environment)

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://steinzlabs.vercel.app/api/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"],
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
