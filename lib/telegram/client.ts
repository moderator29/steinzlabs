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

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  opts: {
    parse_mode?: "Markdown" | "HTML";
    disable_web_page_preview?: boolean;
    reply_markup?: { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };
  } = {},
): Promise<void> {
  const t = token();
  if (!t) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set; skipping send");
    return;
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
    }
  } catch (err) {
    console.error("[telegram.send] failed:", err);
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

export async function setTelegramWebhook(url: string, secret: string): Promise<boolean> {
  const t = token();
  if (!t) return false;
  try {
    const res = await fetchWithRetry(`${API_BASE}/bot${t}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"] }),
      source: "telegram.setWebhook",
      timeoutMs: 5000,
      retries: 1,
    });
    return res.ok;
  } catch {
    return false;
  }
}
