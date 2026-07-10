import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

const API_BASE = "https://api.telegram.org";

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export interface TelegramMessage {
  message_id: number;
  from?: { id: number; username?: string; first_name?: string };
  chat: { id: number; type: string; username?: string };
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: { id: number; username?: string; first_name?: string };
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * §13b — answer a callback_query so Telegram dismisses the loading
 * spinner on the inline button. Optionally show a transient toast at
 * the top of the chat (text param). Failure is non-fatal — Telegram
 * deletes the unanswered callback after 30s anyway.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  opts: { text?: string; show_alert?: boolean } = {},
): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await fetchWithRetry(`${API_BASE}/bot${t}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(opts.text ? { text: opts.text } : {}),
        ...(opts.show_alert ? { show_alert: true } : {}),
      }),
      source: "telegram.answerCallbackQuery",
      timeoutMs: 4000,
      retries: 1,
    });
  } catch (err) {
    console.error("[telegram.answerCallback] failed:", err);
  }
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  opts: {
    parse_mode?: "Markdown" | "HTML";
    disable_web_page_preview?: boolean;
    reply_markup?: { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };
  } = {},
): Promise<boolean> {
  const t = token();
  if (!t) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set; skipping send");
    return false;
  }
  try {
    const res = await fetchWithRetry(`${API_BASE}/bot${t}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts.parse_mode ?? "Markdown",
        disable_web_page_preview: opts.disable_web_page_preview ?? true,
        ...(opts.reply_markup ? { reply_markup: opts.reply_markup } : {}),
      }),
      source: "telegram.sendMessage",
      timeoutMs: 5000,
      retries: 2,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[telegram.send] HTTP ${res.status}: ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram.send] failed:", err);
    return false;
  }
}

export async function sendTelegramPhoto(
  chatId: number | string,
  photoUrl: string,
  opts: {
    caption?: string;
    parse_mode?: "Markdown" | "HTML";
    reply_markup?: { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };
  } = {},
): Promise<void> {
  const t = token();
  if (!t) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set; skipping photo");
    return;
  }
  try {
    const res = await fetchWithRetry(`${API_BASE}/bot${t}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        ...(opts.caption ? { caption: opts.caption, parse_mode: opts.parse_mode ?? "Markdown" } : {}),
        ...(opts.reply_markup ? { reply_markup: opts.reply_markup } : {}),
      }),
      source: "telegram.sendPhoto",
      timeoutMs: 8000,
      retries: 2,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[telegram.sendPhoto] HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.error("[telegram.sendPhoto] failed:", err);
  }
}

/** Show typing indicator (auto-clears after 5s or when next message is sent). */
export async function sendTelegramTyping(chatId: number | string): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await fetch(`${API_BASE}/bot${t}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
      signal: AbortSignal.timeout(2000),
    });
  } catch { /* best effort */ }
}

// Command list shown in Telegram's native "Menu" button (bottom-left of the
// chat) and the "/" autocomplete. Single source of truth, registered via
// setMyCommands so users always have a one-tap command deck.
const BOT_COMMANDS: { command: string; description: string }[] = [
  { command: "start", description: "Open the Naka Labs command deck" },
  { command: "menu", description: "Show the button menu" },
  { command: "price", description: "Live price card, e.g. /price BTC" },
  { command: "chart", description: "Price chart, e.g. /chart ETH 7" },
  { command: "trending", description: "Top trending coins" },
  { command: "gainers", description: "Top 24h gainers" },
  { command: "feargreed", description: "Crypto Fear and Greed index" },
  { command: "whales", description: "Top whales by 30d PnL" },
  { command: "info", description: "Full token info, e.g. /info SOL" },
  { command: "security", description: "Rug check a contract address" },
  { command: "alerts", description: "Your active price alerts" },
  { command: "portfolio", description: "Your connected wallets" },
  { command: "help", description: "All commands" },
];

/** Register the slash-command menu (Telegram "Menu" button + autocomplete). */
export async function setTelegramCommands(): Promise<boolean> {
  const t = token();
  if (!t) return false;
  try {
    const res = await fetchWithRetry(`${API_BASE}/bot${t}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands: BOT_COMMANDS }),
      source: "telegram.setMyCommands",
      timeoutMs: 5000,
      retries: 1,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Make the chat "Menu" button open the native command list. */
export async function setTelegramMenuButton(): Promise<boolean> {
  const t = token();
  if (!t) return false;
  try {
    const res = await fetchWithRetry(`${API_BASE}/bot${t}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menu_button: { type: "commands" } }),
      source: "telegram.setChatMenuButton",
      timeoutMs: 5000,
      retries: 1,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function setTelegramWebhook(url: string, secret: string): Promise<boolean> {
  const t = token();
  if (!t) return false;
  try {
    const res = await fetchWithRetry(`${API_BASE}/bot${t}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Must include callback_query or inline-button taps (help menu, chart
      // refresh, etc.) are never delivered and every button silently no-ops.
      body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message", "callback_query"] }),
      source: "telegram.setWebhook",
      timeoutMs: 5000,
      retries: 1,
    });
    return res.ok;
  } catch {
    return false;
  }
}
