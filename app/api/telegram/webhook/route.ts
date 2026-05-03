import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage, answerCallbackQuery, type TelegramUpdate } from "@/lib/telegram/client";
import { checkTier, type Tier } from "@/lib/subscriptions/tierCheck";

// §13b — per-user sliding-window rate limiter. 10 commands per 60s per
// chat_id is generous for human use, harsh for an attacker spamming
// /price in a tight loop. In-memory Map is correct here because the
// Telegram webhook runs as a single Vercel function (no cross-instance
// coordination needed for this scale; if we hit multi-instance fanout
// later, swap for the Upstash Redis path used by /api/vtx-ai).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const userHits = new Map<number, number[]>();
function rateLimited(chatId: number): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (userHits.get(chatId) ?? []).filter(t => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    userHits.set(chatId, recent); // trim
    return true;
  }
  recent.push(now);
  userHits.set(chatId, recent);
  // Garbage-collect cold chat_ids opportunistically — keeps the Map
  // bounded under serverless memory limits.
  if (userHits.size > 5000) {
    for (const [k, v] of userHits) {
      if (v[v.length - 1] < cutoff) userHits.delete(k);
    }
  }
  return false;
}
import {
  handlePrice,
  handleChart,
  handleInfo,
  handleSecurity,
  handleWhalesTop,
  handleWhaleLookup,
  handleAlerts,
  handleSetAlert,
  handlePortfolio,
  handleTrending,
  handleGainers,
} from "@/lib/telegram/commands/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://steinzlabs.vercel.app";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "Nakalabsbot";

function verifyWebhook(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true; // dev mode
  return request.headers.get(WEBHOOK_SECRET_HEADER) === expected;
}

const PRICING_URL = `${APP_URL}/dashboard/pricing`;
const OPEN_APP_BTN = { text: "🌐 Open Naka Labs", url: APP_URL };
const SETTINGS_BTN = { text: "⚙️ Notification Settings", url: `${APP_URL}/settings/notifications` };
const UPGRADE_BTN = { text: "⭐ Upgrade Plan", url: PRICING_URL };

interface LinkedUser {
  user_id: string;
  tier: Tier;
  expired: boolean;
}

async function getLinkedUser(chatId: number): Promise<LinkedUser | null> {
  const supabase = getSupabaseAdmin();
  const { data: link } = await supabase
    .from("user_telegram_links")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (!link?.user_id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, tier_expires_at, role")
    .eq("id", link.user_id)
    .maybeSingle();

  const baseTier = checkTier(profile?.tier ?? "free", profile?.tier_expires_at ?? null, "free");
  const isAdmin = profile?.role === "admin";
  const tier: Tier = isAdmin ? "max" : baseTier.currentTier;
  const expired = isAdmin ? false : baseTier.expired;
  return { user_id: link.user_id as string, tier, expired };
}

function tierBadge(tier: Tier): string {
  return tier === "max" ? "🔥 MAX" : tier === "pro" ? "⭐ PRO" : tier === "mini" ? "✨ MINI" : "🆓 FREE";
}

async function sendHelp(chatId: number, linked: LinkedUser | null): Promise<void> {
  const tierLine = linked ? `Plan: *${tierBadge(linked.tier)}*` : "_Not linked yet_";
  const text =
    `*🤖 Naka Labs Bot*\n${tierLine}\n\n` +
    `*🔓 Free*\n` +
    `• \`/price BTC\` — live price card\n` +
    `• \`/chart ETH 7\` — price chart (1, 7, 30, 365 days)\n` +
    `• \`/info SOL\` — full token info\n` +
    `• \`/security <addr>\` — GoPlus rug check\n` +
    `• \`/trending\` — top trending coins\n` +
    `• \`/gainers\` — top 24h gainers\n` +
    `• \`/whales\` — top 10 whales by 30d PnL\n` +
    `• \`/alerts\` — your active price alerts\n` +
    `• \`/setalert BTC 100000\` — alert when ≥ price\n` +
    `• \`/setalert ETH <3000\` — alert when ≤ price\n` +
    `• \`/portfolio\` — your connected wallets\n\n` +
    `*✨ MINI ($5/mo)*\n` +
    `• \`/whale <addr>\` — full wallet intelligence\n\n` +
    `*⭐ PRO ($9/mo)*\n` +
    `• \`/copy <addr>\` — copy trading controls\n\n` +
    `*🔥 MAX ($15/mo)*\n` +
    `• \`/snipe <token>\` — sniper bot config\n\n` +
    `*Account*\n` +
    `• \`/start\` · \`/help\` · \`/status\` · \`/link <code>\` · \`/unlink\``;

  const buttons = linked
    ? [[OPEN_APP_BTN, SETTINGS_BTN], ...(linked.tier === "free" || linked.tier === "mini" ? [[UPGRADE_BTN]] : [])]
    : [[OPEN_APP_BTN]];

  await sendTelegramMessage(chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

function tierGateMsg(needed: Tier): string {
  const labels: Record<Tier, string> = { free: "Free", mini: "MINI", pro: "PRO", max: "MAX", naka_cult: "NAKA CULT" };
  return `🔒 This command requires *${labels[needed]}* or higher. Upgrade at ${APP_URL}/pricing`;
}

interface ParsedCmd { name: string; args: string[]; raw: string }
function parseCmd(text: string): ParsedCmd | null {
  if (!text.startsWith("/")) return null;
  // Strip @BotName suffix Telegram adds in groups: "/price@MyBot BTC" → "/price"
  const cleaned = text.replace(/^(\/[a-zA-Z0-9_]+)@\w+/, "$1");
  const parts = cleaned.trim().split(/\s+/);
  const name = parts[0]?.slice(1).toLowerCase() ?? "";
  return { name, args: parts.slice(1), raw: text };
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

  // §13b — handle inline-button taps. Buttons like "❓ All commands"
  // (callback_data: "help") were defined but had no server-side
  // handler — clicks silently no-op'd and Telegram showed a stale
  // loading spinner forever. Acknowledge the callback (dismiss
  // spinner) and route known data values to the right reply.
  if (update.callback_query) {
    const cq = update.callback_query;
    const cbChatId = cq.message?.chat.id;
    if (cbChatId == null) {
      // Inline-mode callbacks have no message.chat — just ack and bail.
      await answerCallbackQuery(cq.id);
      return NextResponse.json({ ok: true });
    }
    if (rateLimited(cbChatId)) {
      await answerCallbackQuery(cq.id, { text: "Slow down — try again in a moment.", show_alert: false });
      return NextResponse.json({ ok: true });
    }
    const data = cq.data ?? "";
    if (data === "help") {
      const linked = await getLinkedUser(cbChatId);
      await answerCallbackQuery(cq.id);
      await sendHelp(cbChatId, linked);
    } else {
      // Unknown payload — still ack so the spinner clears, then noop.
      await answerCallbackQuery(cq.id);
    }
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;
  if (rateLimited(chatId)) {
    // Don't reply with another message — that compounds the spam.
    // Telegram retries on 429 by design, but with backoff.
    return NextResponse.json({ ok: true }, { status: 429 });
  }
  const text = msg.text.trim();
  const cmd = parseCmd(text);
  if (!cmd) return NextResponse.json({ ok: true });

  const supabase = getSupabaseAdmin();
  const linked = await getLinkedUser(chatId);
  const ctx = { chatId, args: cmd.args, rawText: text };

  // ─── Account commands (no link required) ─────────────────────────────
  if (cmd.name === "start") {
    if (linked) {
      await sendHelp(chatId, linked);
    } else {
      await sendTelegramMessage(
        chatId,
        `*Welcome to Naka Labs* 🎯\n\n` +
          `Your on-chain intelligence co-pilot. Live prices, charts, whales, alerts, copy trades — all from Telegram.\n\n` +
          `*Quick start (no account needed):*\n` +
          `• \`/price BTC\` — live price\n` +
          `• \`/chart SOL 7\` — chart\n` +
          `• \`/trending\` — what's hot\n\n` +
          `*Link your account for alerts and trading:*\n` +
          `1. Tap *Open Naka Labs* below.\n` +
          `2. Settings → Notifications → Telegram.\n` +
          `3. Generate a 6-digit code.\n` +
          `4. Send: \`/link 123456\``,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🌐 Open Naka Labs", url: `${APP_URL}/settings/notifications` }],
              [{ text: "❓ All commands", callback_data: "help" }],
            ],
          },
        },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (cmd.name === "help" || cmd.name === "menu") {
    await sendHelp(chatId, linked);
    return NextResponse.json({ ok: true });
  }

  if (cmd.name === "link") {
    const code = cmd.args[0]?.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      await sendTelegramMessage(chatId, "Send `/link` followed by your 6-digit code, e.g. `/link 123456`.\n\nGet your code at:", {
        reply_markup: { inline_keyboard: [[{ text: "🔑 Generate Code", url: `${APP_URL}/settings/notifications` }]] },
      });
      return NextResponse.json({ ok: true });
    }
    const { data: pending } = await supabase
      .from("user_telegram_links")
      .select("user_id, link_code, link_code_expires_at, telegram_chat_id")
      .eq("link_code", code)
      .maybeSingle();

    if (!pending) {
      await sendTelegramMessage(chatId, "Invalid or expired code. Generate a new one in Settings.", {
        reply_markup: { inline_keyboard: [[{ text: "🔑 Generate New Code", url: `${APP_URL}/settings/notifications` }]] },
      });
      return NextResponse.json({ ok: true });
    }
    if (pending.link_code_expires_at && new Date(pending.link_code_expires_at) < new Date()) {
      await sendTelegramMessage(chatId, "This code has expired. Generate a new one.", {
        reply_markup: { inline_keyboard: [[{ text: "🔑 Generate New Code", url: `${APP_URL}/settings/notifications` }]] },
      });
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

    const fresh = await getLinkedUser(chatId);
    await sendTelegramMessage(
      chatId,
      `✅ *Account linked!*\nPlan: *${tierBadge(fresh?.tier ?? "free")}*\n\nTry \`/price BTC\` or \`/help\` for the full command list.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 Show Commands", callback_data: "help" }, OPEN_APP_BTN],
            [SETTINGS_BTN],
          ],
        },
      },
    );
    return NextResponse.json({ ok: true });
  }

  if (cmd.name === "status") {
    if (!linked) {
      await sendTelegramMessage(chatId, "❌ Not linked. Send `/start` to begin.", {
        reply_markup: { inline_keyboard: [[OPEN_APP_BTN]] },
      });
    } else {
      await sendTelegramMessage(
        chatId,
        `✅ *Linked*\nPlan: *${tierBadge(linked.tier)}*${linked.expired ? " _(expired)_" : ""}\n\nUse \`/help\` for commands or \`/unlink\` to disconnect.`,
        { reply_markup: { inline_keyboard: [[OPEN_APP_BTN, SETTINGS_BTN]] } },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (cmd.name === "unlink") {
    const { error } = await supabase.from("user_telegram_links").delete().eq("telegram_chat_id", chatId);
    if (error) await sendTelegramMessage(chatId, "Could not unlink. Try again shortly.");
    else await sendTelegramMessage(chatId, "Unlinked. You will no longer receive notifications here.");
    return NextResponse.json({ ok: true });
  }

  // ─── Public commands (no link required) ──────────────────────────────
  // We let unlinked users use read-only data commands so they can try the
  // bot before signing up. /alerts, /portfolio etc. need a linked user.
  switch (cmd.name) {
    case "price":     await handlePrice(ctx); return NextResponse.json({ ok: true });
    case "chart":     await handleChart(ctx); return NextResponse.json({ ok: true });
    case "info":      await handleInfo(ctx); return NextResponse.json({ ok: true });
    case "security":  await handleSecurity(ctx); return NextResponse.json({ ok: true });
    case "whales":    await handleWhalesTop(ctx); return NextResponse.json({ ok: true });
    case "trending":  await handleTrending(ctx); return NextResponse.json({ ok: true });
    case "gainers":   await handleGainers(ctx); return NextResponse.json({ ok: true });
  }

  // ─── Linked-required commands ────────────────────────────────────────
  if (!linked) {
    await sendTelegramMessage(chatId, "🔗 Link your account first. Send `/start` to begin.", {
      reply_markup: { inline_keyboard: [[OPEN_APP_BTN]] },
    });
    return NextResponse.json({ ok: true });
  }

  switch (cmd.name) {
    case "alerts":    await handleAlerts(linked.user_id, ctx); return NextResponse.json({ ok: true });
    case "setalert":  await handleSetAlert(linked.user_id, ctx); return NextResponse.json({ ok: true });
    case "portfolio": await handlePortfolio(linked.user_id, ctx); return NextResponse.json({ ok: true });
  }

  // ─── MINI+ ───────────────────────────────────────────────────────────
  if (cmd.name === "whale") {
    const gate = checkTier(linked.tier, null, "mini");
    if (!gate.allowed) {
      await sendTelegramMessage(chatId, tierGateMsg("mini"), { reply_markup: { inline_keyboard: [[UPGRADE_BTN]] } });
      return NextResponse.json({ ok: true });
    }
    await handleWhaleLookup(ctx);
    return NextResponse.json({ ok: true });
  }

  // ─── PRO+ (copy trading) ─────────────────────────────────────────────
  if (cmd.name === "copy") {
    const gate = checkTier(linked.tier, null, "pro");
    if (!gate.allowed) {
      await sendTelegramMessage(chatId, tierGateMsg("pro"), { reply_markup: { inline_keyboard: [[UPGRADE_BTN]] } });
      return NextResponse.json({ ok: true });
    }
    const target = cmd.args[0];
    await sendTelegramMessage(
      chatId,
      target
        ? `🔁 Copy Trade setup for \`${target.slice(0, 14)}…\` — configure modes (Alerts / One-Click / Auto) and limits in the dashboard:`
        : "🔁 Copy Trade dashboard:",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🌐 Open Copy Trade", url: target ? `${APP_URL}/dashboard/copy-trade/setup?whale=${target}` : `${APP_URL}/dashboard/copy-trade` }]],
        },
      },
    );
    return NextResponse.json({ ok: true });
  }

  // ─── MAX (sniper) ────────────────────────────────────────────────────
  if (cmd.name === "snipe") {
    const gate = checkTier(linked.tier, null, "max");
    if (!gate.allowed) {
      await sendTelegramMessage(chatId, tierGateMsg("max"), { reply_markup: { inline_keyboard: [[UPGRADE_BTN]] } });
      return NextResponse.json({ ok: true });
    }
    const target = cmd.args[0];
    await sendTelegramMessage(
      chatId,
      target ? `🔥 Sniper setup for \`${target.slice(0, 14)}…\`:` : "🔥 Sniper Bot config:",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🎯 Open Sniper", url: target ? `${APP_URL}/dashboard/sniper/new?token=${target}` : `${APP_URL}/dashboard/sniper` }]],
        },
      },
    );
    return NextResponse.json({ ok: true });
  }

  // ─── VTX passthrough ─────────────────────────────────────────────────
  if (cmd.name === "vtx") {
    await sendTelegramMessage(chatId, "🧠 Open VTX AI for the full conversation experience (deep research, multi-step tools, charts):", {
      reply_markup: { inline_keyboard: [[{ text: "🧠 Open VTX AI", url: `${APP_URL}/dashboard/vtx-ai` }]] },
    });
    return NextResponse.json({ ok: true });
  }

  // Unknown command
  await sendTelegramMessage(chatId, `Unknown command: \`/${cmd.name}\`. Send /help for the full list.`, {
    reply_markup: { inline_keyboard: [[{ text: "❓ Show All Commands", callback_data: "help" }]] },
  });
  return NextResponse.json({ ok: true });
}
