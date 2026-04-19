import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage, type TelegramUpdate } from "@/lib/telegram/client";
import { checkTier, type Tier } from "@/lib/subscriptions/tierCheck";

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
  // Single round-trip: PostgREST joined select. The profiles row is fetched
  // alongside the link so we don't pay 2 sequential Supabase round-trips on
  // every command — that latency was making Telegram time out.
  const { data: link } = await supabase
    .from("user_telegram_links")
    .select("user_id, profiles!inner(tier, tier_expires_at)")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (!link?.user_id) return null;
  // PostgREST returns the related row as either an object or array depending
  // on relationship cardinality — normalise.
  const profile = Array.isArray((link as { profiles?: unknown }).profiles)
    ? ((link as { profiles: Array<{ tier?: string; tier_expires_at?: string | null }> }).profiles[0] ?? null)
    : ((link as { profiles?: { tier?: string; tier_expires_at?: string | null } }).profiles ?? null);
  const result = checkTier(profile?.tier ?? "free", profile?.tier_expires_at ?? null, "free");
  return { user_id: link.user_id as string, tier: result.currentTier, expired: result.expired };
}

function tierBadge(tier: Tier): string {
  return tier === "max" ? "🔥 MAX" : tier === "pro" ? "⭐ PRO" : tier === "mini" ? "✨ MINI" : "🆓 FREE";
}

async function sendHelp(chatId: number, linked: LinkedUser | null): Promise<void> {
  const tierLine = linked ? `Plan: *${tierBadge(linked.tier)}*` : "_Not linked yet_";
  const text =
    `*Naka Labs Bot — Commands*\n` +
    `${tierLine}\n\n` +
    `*🆓 Free*\n` +
    `• \`/start\` — onboarding\n` +
    `• \`/help\` — this menu\n` +
    `• \`/status\` — link & plan info\n` +
    `• \`/link <code>\` — connect account\n` +
    `• \`/unlink\` — disconnect\n` +
    `• \`/price <symbol>\` — token price card\n` +
    `• \`/watchlist\` — open your watchlist\n` +
    `• \`/alerts\` — recent triggered alerts\n` +
    `• \`/vtx <question>\` — ask VTX AI _(25 msgs/day on Free)_\n\n` +
    `*✨ MINI ($5/mo)*\n` +
    `• \`/whale <address>\` — wallet snapshot (whale tracker)\n` +
    `• \`/portfolio\` — multi-chain wallet PnL\n` +
    `_(also: 100 VTX msgs/day, 10 alerts, 3 wallets)_\n\n` +
    `*⭐ PRO ($9/mo)*\n` +
    `• \`/copy <whale>\` — toggle copy-trade\n` +
    `_(also: unlimited VTX, smart-money tracking, wallet clusters, bubble map)_\n\n` +
    `*🔥 MAX ($15/mo)*\n` +
    `• \`/snipe <token>\` — sniper bot config\n` +
    `_(also: unlimited wallets, priority support, early access)_\n\n` +
    `_Automatic alerts (whale moves, price targets, copy-trade fills, security events) are pushed based on your Settings → Notifications config._`;

  const buttons = linked
    ? [[OPEN_APP_BTN, SETTINGS_BTN], ...(linked.tier === "free" || linked.tier === "mini" ? [[UPGRADE_BTN]] : [])]
    : [[OPEN_APP_BTN]];

  await sendTelegramMessage(chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

function tierGateMsg(needed: Tier): string {
  const labels: Record<Tier, string> = { free: "Free", mini: "MINI", pro: "PRO", max: "MAX" };
  return `🔒 This command requires *${labels[needed]}* or higher. Upgrade at ${APP_URL}/pricing`;
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
  const linked = await getLinkedUser(chatId);

  // /start — onboarding
  if (text === "/start") {
    if (linked) {
      await sendHelp(chatId, linked);
    } else {
      await sendTelegramMessage(
        chatId,
        `*Welcome to Naka Labs* 🎯\n\n` +
          `Your on-chain intelligence co-pilot. Track whales, get alerts, copy trades, talk to VTX — all from Telegram.\n\n` +
          `*To get started:*\n` +
          `1. Tap *Open Naka Labs* below and sign in.\n` +
          `2. Go to *Settings → Notifications → Telegram*.\n` +
          `3. Tap *Generate Code*, copy the 6-digit code.\n` +
          `4. Come back here and send: \`/link 123456\`\n\n` +
          `Send \`/help\` anytime to see all commands.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🌐 Open Naka Labs", url: `${APP_URL}/settings/notifications` }],
              [{ text: "❓ See all commands", url: `https://t.me/${BOT_USERNAME}?start=help` }],
            ],
          },
        },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/help") {
    await sendHelp(chatId, linked);
    return NextResponse.json({ ok: true });
  }

  // /link 123456
  if (text.startsWith("/link")) {
    const parts = text.split(/\s+/);
    const code = parts[1]?.trim();
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
      `✅ *Account linked!*\n\nPlan: *${tierBadge(fresh?.tier ?? "free")}*\n\nYou will now receive alerts and notifications here. Tap a button below to get going.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 Show Commands", url: `https://t.me/${BOT_USERNAME}?start=help` }, OPEN_APP_BTN],
            [SETTINGS_BTN],
          ],
        },
      },
    );
    return NextResponse.json({ ok: true });
  }

  // /status
  if (text === "/status") {
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

  // /unlink
  if (text === "/unlink") {
    const { error } = await supabase.from("user_telegram_links").delete().eq("telegram_chat_id", chatId);
    if (error) await sendTelegramMessage(chatId, "Could not unlink. Try again shortly.");
    else await sendTelegramMessage(chatId, "Unlinked. You will no longer receive notifications here.");
    return NextResponse.json({ ok: true });
  }

  // From here on, all commands require linked account
  if (!linked) {
    await sendTelegramMessage(chatId, "🔗 Link your account first. Send `/start` to begin.", {
      reply_markup: { inline_keyboard: [[OPEN_APP_BTN]] },
    });
    return NextResponse.json({ ok: true });
  }

  // ─── FREE tier commands ──────────────────────────────────────────────
  if (text.startsWith("/price")) {
    const sym = text.split(/\s+/)[1]?.toUpperCase();
    if (!sym) {
      await sendTelegramMessage(chatId, "Usage: `/price ETH` or `/price SOL`");
      return NextResponse.json({ ok: true });
    }
    await sendTelegramMessage(chatId, `🔍 Looking up *${sym}*…`, {
      reply_markup: { inline_keyboard: [[{ text: `📊 Open ${sym} on Naka`, url: `${APP_URL}/market/search?q=${encodeURIComponent(sym)}` }]] },
    });
    return NextResponse.json({ ok: true });
  }

  if (text === "/watchlist") {
    await sendTelegramMessage(chatId, "📋 Your watchlist:", {
      reply_markup: { inline_keyboard: [[{ text: "🌐 Open Watchlist", url: `${APP_URL}/market/watchlist` }]] },
    });
    return NextResponse.json({ ok: true });
  }

  if (text === "/alerts") {
    await sendTelegramMessage(chatId, "🔔 Recent alerts (last 24h):", {
      reply_markup: { inline_keyboard: [[{ text: "🌐 Open Alerts", url: `${APP_URL}/dashboard/alerts` }]] },
    });
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/vtx")) {
    // VTX is gated by daily message quota (25 free / 100 mini / unlimited pro+),
    // not by tier — the in-app VTX route enforces that. The bot just routes.
    await sendTelegramMessage(chatId, "🧠 Open VTX AI for the full conversation experience (deep research, multi-step tools, charts):", {
      reply_markup: { inline_keyboard: [[{ text: "🧠 Open VTX AI", url: `${APP_URL}/dashboard/vtx-ai` }]] },
    });
    return NextResponse.json({ ok: true });
  }

  // ─── MINI+ tier (whale tracker, full wallet intelligence) ────────────
  if (text.startsWith("/whale") || text === "/portfolio") {
    const gate = checkTier(linked.tier, null, "mini");
    if (!gate.allowed) {
      await sendTelegramMessage(chatId, tierGateMsg("mini"), { reply_markup: { inline_keyboard: [[UPGRADE_BTN]] } });
      return NextResponse.json({ ok: true });
    }
    if (text === "/portfolio") {
      await sendTelegramMessage(chatId, "💼 Your portfolio:", {
        reply_markup: { inline_keyboard: [[{ text: "🌐 Open Portfolio", url: `${APP_URL}/dashboard/wallet-intelligence` }]] },
      });
    } else {
      const addr = text.split(/\s+/)[1];
      if (!addr) {
        await sendTelegramMessage(chatId, "Usage: `/whale 0xabc...`");
        return NextResponse.json({ ok: true });
      }
      await sendTelegramMessage(chatId, `🐋 Looking up wallet \`${addr.slice(0, 10)}…\``, {
        reply_markup: { inline_keyboard: [[{ text: "🌐 Open Wallet", url: `${APP_URL}/dashboard/wallet-intelligence?address=${addr}` }]] },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ─── PRO tier (copy trading) ─────────────────────────────────────────
  if (text.startsWith("/copy")) {
    const gate = checkTier(linked.tier, null, "pro");
    if (!gate.allowed) {
      await sendTelegramMessage(chatId, tierGateMsg("pro"), { reply_markup: { inline_keyboard: [[UPGRADE_BTN]] } });
      return NextResponse.json({ ok: true });
    }
    await sendTelegramMessage(chatId, "🔁 Copy Trade controls:", {
      reply_markup: { inline_keyboard: [[{ text: "🌐 Open Copy Trade", url: `${APP_URL}/dashboard/copy-trade` }]] },
    });
    return NextResponse.json({ ok: true });
  }

  // ─── MAX tier (sniper bot) ───────────────────────────────────────────
  if (text.startsWith("/snipe")) {
    const gate = checkTier(linked.tier, null, "max");
    if (!gate.allowed) {
      await sendTelegramMessage(chatId, tierGateMsg("max"), { reply_markup: { inline_keyboard: [[UPGRADE_BTN]] } });
      return NextResponse.json({ ok: true });
    }
    await sendTelegramMessage(chatId, "🔥 Sniper Bot config:", {
      reply_markup: { inline_keyboard: [[{ text: "🎯 Open Sniper", url: `${APP_URL}/dashboard/sniper` }]] },
    });
    return NextResponse.json({ ok: true });
  }

  // Default: gentle help with button
  await sendTelegramMessage(chatId, "Unknown command. Tap below or send `/help`.", {
    reply_markup: { inline_keyboard: [[{ text: "❓ Show All Commands", callback_data: "help" }]] },
  });
  return NextResponse.json({ ok: true });
}
