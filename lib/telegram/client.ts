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
  opts: { parse_mode?: "Markdown" | "HTML"; disable_web_page_preview?: boolean } = {},
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
