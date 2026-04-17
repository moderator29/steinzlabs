import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage, type TelegramUpdate } from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";

function verifyWebhook(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true; // dev mode
  return request.headers.get(WEBHOOK_SECRET_HEADER) === expected;
}

export async function POST(request: NextRequest) {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const supabase = getSupabaseAdmin();

  // /start — onboarding
  if (text === "/start" || text === "/help") {
    await sendTelegramMessage(
      chatId,
      "*Naka Labs Bot*\n\n" +
        "Link your account to receive alerts, whale pings, and VTX summaries in Telegram.\n\n" +
        "1. In the Naka Labs app, go to Settings → Notifications → Telegram.\n" +
        "2. Copy your 6-digit link code.\n" +
        "3. Send it here as `/link 123456`.\n\n" +
        "Other commands:\n" +
        "• `/status` — show link status\n" +
        "• `/unlink` — disconnect this chat",
    );
    return NextResponse.json({ ok: true });
  }

  // /link 123456
  if (text.startsWith("/link")) {
    const parts = text.split(/\s+/);
    const code = parts[1]?.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      await sendTelegramMessage(chatId, "Send `/link` followed by your 6-digit code, e.g. `/link 123456`.");
      return NextResponse.json({ ok: true });
    }
    const { data: pending } = await supabase
      .from("user_telegram_links")
      .select("user_id, link_code, link_code_expires_at, telegram_chat_id")
      .eq("link_code", code)
      .maybeSingle();

    if (!pending) {
      await sendTelegramMessage(chatId, "Invalid or expired code. Generate a new one in Settings → Notifications → Telegram.");
      return NextResponse.json({ ok: true });
    }
    if (pending.link_code_expires_at && new Date(pending.link_code_expires_at) < new Date()) {
      await sendTelegramMessage(chatId, "This code has expired. Generate a new one in Settings.");
      return NextResponse.json({ ok: true });
    }
    if (pending.telegram_chat_id && Number(pending.telegram_chat_id) !== chatId) {
      await sendTelegramMessage(chatId, "This code is already linked to a different Telegram account.");
      return NextResponse.json({ ok: true });
    }

    const { error: updErr } = await supabase
      .from("user_telegram_links")
      .update({
        telegram_chat_id: chatId,
        telegram_username: msg.from?.username ?? null,
        linked_at: new Date().toISOString(),
        link_code: null,
        link_code_expires_at: null,
      })
      .eq("user_id", pending.user_id);

    if (updErr) {
      console.error("[telegram.link] update failed:", updErr);
      await sendTelegramMessage(chatId, "Internal error linking your account. Try again shortly.");
      return NextResponse.json({ ok: true });
    }

    await sendTelegramMessage(
      chatId,
      "✅ *Account linked!*\n\nYou will now receive alerts and notifications here. Use `/unlink` to disconnect.",
    );
    return NextResponse.json({ ok: true });
  }

  // /status
  if (text === "/status") {
    const { data: link } = await supabase
      .from("user_telegram_links")
      .select("user_id, linked_at")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();
    if (!link) {
      await sendTelegramMessage(chatId, "Not linked. Send `/start` to see how to link your account.");
    } else {
      await sendTelegramMessage(
        chatId,
        `✅ Linked since ${new Date(link.linked_at).toLocaleDateString()}. Send \`/unlink\` to disconnect.`,
      );
    }
    return NextResponse.json({ ok: true });
  }

  // /unlink
  if (text === "/unlink") {
    const { error } = await supabase
      .from("user_telegram_links")
      .delete()
      .eq("telegram_chat_id", chatId);
    if (error) {
      await sendTelegramMessage(chatId, "Could not unlink. Try again shortly.");
    } else {
      await sendTelegramMessage(chatId, "Unlinked. You will no longer receive notifications here.");
    }
    return NextResponse.json({ ok: true });
  }

  // Default: gentle help
  await sendTelegramMessage(chatId, "Unknown command. Send `/help` for available commands.");
  return NextResponse.json({ ok: true });
}
