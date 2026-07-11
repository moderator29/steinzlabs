import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage, answerCallbackQuery, type TelegramUpdate } from "@/lib/telegram/client";
import { renderMenu, isMenuNode, type MenuLinked } from "@/lib/telegram/menu";
import { checkTier, type Tier } from "@/lib/subscriptions/tierCheck";
import { safeCompareStrings } from "@/lib/security/webhookAuth";

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
  handleFearGreed,
  handleMyHoldings,
  handlePnl,
  handleTrades,
} from "@/lib/telegram/commands/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://steinzlabs.vercel.app";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "Nakalabsbot";

function verifyWebhook(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  // TG1: fail closed in production. The prior `if (!expected) return true`
  // meant a misconfigured prod deployment would accept ANY POST claiming
  // to be Telegram — an unauthenticated public endpoint that could fan
  // out messages to every linked chat. We only allow the bypass in
  // explicit non-production environments.
  if (!expected) {
    const env = process.env.NODE_ENV ?? 'production';
    if (env === 'production') return false;
    return true;
  }
  // Constant-time compare — plain `===` leaks the secret token via timing.
  return safeCompareStrings(request.headers.get(WEBHOOK_SECRET_HEADER) ?? '', expected);
}

// TG4: check the platform_settings.telegram_paused kill switch. Cached
// in-process for 30s so we don't issue a Supabase round-trip on every
// webhook tick during an active conversation.
let pausedCache: { value: boolean; expiresAt: number } | null = null;
async function isTelegramPaused(): Promise<boolean> {
  if (pausedCache && pausedCache.expiresAt > Date.now()) return pausedCache.value;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('platform_settings')
      .select('telegram_paused')
      .limit(1)
      .maybeSingle<{ telegram_paused: boolean | null }>();
    const value = Boolean(data?.telegram_paused);
    pausedCache = { value, expiresAt: Date.now() + 30_000 };
    return value;
  } catch {
    return false;
  }
}

const PRICING_URL = `${APP_URL}/dashboard/pricing`;
const OPEN_APP_BTN = { text: "🌐 Open Naka Labs", url: APP_URL };
const SETTINGS_BTN = { text: "⚙️ Notification Settings", url: `${APP_URL}/settings` };
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

// Adapt the webhook's LinkedUser to the shape the menu module consumes. Null
// stays null so the menu can render its "not linked yet" state.
function toMenuLinked(linked: LinkedUser | null): MenuLinked | null {
  return linked ? { userId: linked.user_id, tier: linked.tier, expired: linked.expired } : null;
}

function tierGateMsg(needed: Tier): string {
  const labels: Record<Tier, string> = { free: "Free", mini: "MINI", pro: "PRO", max: "MAX" };
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

  // TG4: kill switch. Short-circuit before doing any work so the bot
  // goes truly quiet (no DB lookups, no outbound replies) during a
  // deliberate outage. Telegram retries the webhook for an hour by
  // default, after which they drop — that's the intended behaviour
  // while the switch is on.
  if (await isTelegramPaused()) {
    return NextResponse.json({ ok: true, paused: true });
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
      await answerCallbackQuery(cq.id, { text: "Slow down. Try again in a moment.", show_alert: false });
      return NextResponse.json({ ok: true });
    }
    // TG2: callback router. Buttons send a callback_data string; we
    // dispatch on the prefix before the colon so handlers for related
    // actions stay grouped. Known prefixes: chart:<symbol>:<days>,
    // holders:<token>:<chain>, unsub:<alert_id>, alert:<dir>:<sym>:<px>,
    // refresh:<command>:<args…>. Any unknown action acks the spinner
    // and noops so old buttons still degrade gracefully.
    const data = cq.data ?? "";
    const cbMessageId = cq.message?.message_id ?? null;
    // nav:<node> — Rosebot-style in-place navigation. Rewrite the current
    // bubble into the requested main-menu / submenu screen. Legacy callbacks
    // "help" and "commands" (from older messages still in users' chats) map
    // onto the new deck so no button ever dead-ends.
    if (data.startsWith("nav:") || data === "help" || data === "commands") {
      const node = data === "help" ? "home" : data === "commands" ? "help" : data.slice(4);
      await answerCallbackQuery(cq.id);
      const linked = await getLinkedUser(cbChatId);
      await renderMenu(cbChatId, cbMessageId, isMenuNode(node) ? node : "home", toMenuLinked(linked));
      return NextResponse.json({ ok: true });
    }
    const [action, ...rest] = data.split(":");
    try {
      const { handleCallbackAction } = await import('@/lib/telegram/commands/handlers');
      const handled = await handleCallbackAction(cbChatId, action, rest, cq.id);
      if (!handled) await answerCallbackQuery(cq.id);
    } catch {
      await answerCallbackQuery(cq.id, { text: "Something went wrong. Try the command again.", show_alert: false });
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
  if (cmd.name === "start" || cmd.name === "menu") {
    // Fresh send (no message to edit) of the branded main deck. All further
    // navigation happens by editing this same bubble (see nav:* above).
    await renderMenu(chatId, null, "home", toMenuLinked(linked));
    return NextResponse.json({ ok: true });
  }

  if (cmd.name === "help") {
    await renderMenu(chatId, null, "help", toMenuLinked(linked));
    return NextResponse.json({ ok: true });
  }

  if (cmd.name === "link") {
    const code = cmd.args[0]?.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      await sendTelegramMessage(chatId, "Send `/link` followed by your 6-digit code, e.g. `/link 123456`.\n\nGet your code at:", {
        reply_markup: { inline_keyboard: [[{ text: "🔑 Generate Code", url: `${APP_URL}/settings` }]] },
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
        reply_markup: { inline_keyboard: [[{ text: "🔑 Generate New Code", url: `${APP_URL}/settings` }]] },
      });
      return NextResponse.json({ ok: true });
    }
    if (pending.link_code_expires_at && new Date(pending.link_code_expires_at) < new Date()) {
      await sendTelegramMessage(chatId, "This code has expired. Generate a new one.", {
        reply_markup: { inline_keyboard: [[{ text: "🔑 Generate New Code", url: `${APP_URL}/settings` }]] },
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
            [{ text: "📋 Show Commands", callback_data: "nav:help" }, OPEN_APP_BTN],
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
    case "feargreed": await handleFearGreed(ctx); return NextResponse.json({ ok: true });
    case "myholdings": await handleMyHoldings(ctx); return NextResponse.json({ ok: true });
    case "holdings":   await handleMyHoldings(ctx); return NextResponse.json({ ok: true });
    case "pnl":        await handlePnl(ctx); return NextResponse.json({ ok: true });
    case "trades":     await handleTrades(ctx); return NextResponse.json({ ok: true });
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
        ? `🔁 Copy Trade setup for \`${target.slice(0, 14)}…\`. Configure modes (Alerts / One-Click / Auto) and limits in the dashboard:`
        : "🔁 Copy Trade dashboard:",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🌐 Open Copy Trade", url: target ? `${APP_URL}/dashboard/copy-trading?whale=${target}` : `${APP_URL}/dashboard/copy-trading` }]],
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
    reply_markup: { inline_keyboard: [[{ text: "❓ Show All Commands", callback_data: "nav:help" }]] },
  });
  return NextResponse.json({ ok: true });
}
