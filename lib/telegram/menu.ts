import "server-only";
import { sendTelegramMessage, editTelegramMessage } from "@/lib/telegram/client";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchNewsDrop } from "@/lib/telegram/news";
import type { Tier } from "@/lib/subscriptions/tierCheck";
import {
  b,
  i,
  code,
  link,
  escapeHtml,
  fmtUsd,
  fmtPct,
  shortAddress,
  relativeTime,
  type InlineButton,
  type InlineKeyboardMarkup,
} from "@/lib/telegram/templates";

/**
 * Naka Labs Telegram command deck — Rosebot-style inline navigation.
 *
 * ONE persistent message that rewrites itself as the user taps: main menu ->
 * submenu -> back, never a wall of stale bubbles. Every screen renders HTML
 * (parse_mode "HTML") so only `& < >` need escaping — provably safe for
 * arbitrary token/whale/news text, unlike MarkdownV2 where a stray `.` or `-`
 * breaks the whole send.
 *
 * Real data only: whale screens read the `whales` table, News reads the same
 * multi-source aggregator as the in-app News tab, Account reads the live link +
 * alert rows. Nothing here fabricates a number, headline or address.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://steinzlabs.vercel.app";

/** Minimal linked-account shape the menu needs (passed in by the webhook). */
export interface MenuLinked {
  userId: string;
  tier: Tier;
  expired: boolean;
}

/** Navigation node keys. `home` is the main menu; the rest are submenus. */
export type MenuNode = "home" | "whales" | "smart" | "news" | "market" | "account" | "help";

export function isMenuNode(v: string): v is MenuNode {
  return v === "home" || v === "whales" || v === "smart" || v === "news" || v === "market" || v === "account" || v === "help";
}

function tierBadge(tier: Tier): string {
  return tier === "max" ? "🔥 MAX" : tier === "pro" ? "⭐ PRO" : tier === "mini" ? "✨ MINI" : "🆓 FREE";
}

const RULE = "━━━━━━━━━━━━━━━";

// ── shared button primitives ────────────────────────────────────────────────
const BACK_BTN: InlineButton = { text: "🔙 Back", callback_data: "nav:home" };
const OPEN_APP_BTN: InlineButton = { text: "🌐 Open Naka Labs", url: APP_URL };
const SETTINGS_BTN: InlineButton = { text: "⚙️ Settings", url: `${APP_URL}/settings` };
const UPGRADE_BTN: InlineButton = { text: "⭐ Upgrade Plan", url: `${APP_URL}/dashboard/pricing` };

interface Screen {
  text: string;
  keyboard: InlineKeyboardMarkup;
}

// ═════════════════════════════════════════════════════════════════════════════
// Screen builders. Each returns the exact text + inline keyboard for one node.
// ═════════════════════════════════════════════════════════════════════════════

function homeScreen(linked: MenuLinked | null): Screen {
  const status = linked
    ? `${b("Plan")}  ${tierBadge(linked.tier)}${linked.expired ? "  " + i("(expired)") : ""}`
    : i("Not linked yet. Open My Account to connect.");
  const text = [
    `🐺 ${b("NAKA LABS")}`,
    i("On-chain intelligence, one tap away"),
    "",
    status,
    "",
    "Live whale flow, smart-money leaders, curated news and market data. Pick a section below, or type a command like " + code("/price BTC") + ".",
  ].join("\n");

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "🐋 Whale Alerts", callback_data: "nav:whales" },
        { text: "🧠 Smart Money", callback_data: "nav:smart" },
      ],
      [
        { text: "📰 Naka News", callback_data: "nav:news" },
        { text: "📊 Markets", callback_data: "nav:market" },
      ],
      [
        { text: "👤 My Account", callback_data: "nav:account" },
        { text: "🆘 Help", callback_data: "nav:help" },
      ],
      [OPEN_APP_BTN],
    ],
  };
  return { text, keyboard };
}

// ── Whale Alerts: live top wallets by 30d PnL ───────────────────────────────
async function whalesScreen(): Promise<Screen> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("whales")
    .select("address, label, chain, pnl_30d_usd, win_rate, verified")
    .order("pnl_30d_usd", { ascending: false, nullsFirst: false })
    .limit(8);

  const rows = data ?? [];
  const body = rows.length
    ? rows
        .map((w, idx) => {
          const name = (w.label as string | null) ?? shortAddress(w.address as string);
          const check = w.verified ? " ✓" : "";
          const pnl = w.pnl_30d_usd != null ? fmtUsd(Number(w.pnl_30d_usd), { sign: true }) : "—";
          const wr = w.win_rate != null ? `${Math.round(Number(w.win_rate))}% WR` : "n/a";
          return `${b(`${idx + 1}.`)} ${escapeHtml(name)}${check}  ${pnl} · ${escapeHtml(String(w.chain ?? "—"))} · ${wr}`;
        })
        .join("\n")
    : i("No whale data available right now. Check back shortly.");

  const text = [
    `🐋 ${b("WHALE ALERTS")}`,
    i("Top wallets by 30d realized PnL"),
    "",
    body,
    "",
    i("Tap Open Tracker for live moves, follow and copy-trade."),
  ].join("\n");

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "nav:whales" },
        { text: "🐋 Open Tracker", url: `${APP_URL}/dashboard/whale-tracker` },
      ],
      [BACK_BTN, OPEN_APP_BTN],
    ],
  };
  return { text, keyboard };
}

// ── Smart Money: live top wallets by Naka whale score ───────────────────────
async function smartScreen(): Promise<Screen> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("whales")
    .select("address, label, chain, whale_score, win_rate, follower_count, verified")
    .order("whale_score", { ascending: false, nullsFirst: false })
    .limit(8);

  const rows = data ?? [];
  const body = rows.length
    ? rows
        .map((w, idx) => {
          const name = (w.label as string | null) ?? shortAddress(w.address as string);
          const check = w.verified ? " ✓" : "";
          const score = w.whale_score != null ? `${w.whale_score}/100` : "—";
          const wr = w.win_rate != null ? `${Math.round(Number(w.win_rate))}% WR` : "n/a";
          return `${b(`${idx + 1}.`)} ${escapeHtml(name)}${check}  ${b(score)} · ${wr}`;
        })
        .join("\n")
    : i("No smart-money data available right now. Check back shortly.");

  const text = [
    `🧠 ${b("SMART MONEY")}`,
    i("Highest-conviction wallets by Naka score"),
    "",
    body,
    "",
    i("Score blends win rate, PnL consistency and holding discipline."),
  ].join("\n");

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "nav:smart" },
        { text: "🧠 Open Leaderboard", url: `${APP_URL}/dashboard/whale-tracker` },
      ],
      [BACK_BTN, OPEN_APP_BTN],
    ],
  };
  return { text, keyboard };
}

// ── Naka News: live headlines from the in-app aggregator ────────────────────
async function newsScreen(): Promise<Screen> {
  const drop = await fetchNewsDrop(6);
  let body: string;
  const articleButtons: InlineButton[] = [];
  if (drop && drop.headlines.length) {
    body = drop.headlines
      .map((h, idx) => {
        const when = relativeTime(h.publishedAt);
        const meta = [h.source, when].filter(Boolean).join(" · ");
        return `${b(`${idx + 1}.`)} ${link(h.title, h.url)}\n${i(meta)}`;
      })
      .join("\n\n");
    drop.headlines.slice(0, 6).forEach((h, idx) => {
      articleButtons.push({ text: String(idx + 1), url: h.url });
    });
  } else {
    body = i("No fresh headlines right now. Check back shortly.");
  }

  const text = [`📰 ${b("NAKA NEWS")}`, i("Top crypto headlines right now"), "", body].join("\n");

  const rows: InlineButton[][] = [];
  if (articleButtons.length) {
    rows.push(articleButtons.slice(0, 3));
    if (articleButtons.length > 3) rows.push(articleButtons.slice(3, 6));
  }
  rows.push([
    { text: "🔄 Refresh", callback_data: "nav:news" },
    { text: "🗞️ News Feed", url: `${APP_URL}/dashboard?subtab=news` },
  ]);
  rows.push([BACK_BTN, OPEN_APP_BTN]);

  return { text, keyboard: { inline_keyboard: rows } };
}

// ── Markets: launcher for the live market-data commands ─────────────────────
function marketScreen(): Screen {
  const text = [
    `📊 ${b("MARKETS")}`,
    i("Live prices, charts and sentiment"),
    "",
    "Tap a token for a price card, or search any coin:",
    `${code("/price SOL")}   ${code("/chart ETH 7")}   ${code("/info BTC")}`,
    "",
    "Explore the market pulse below.",
  ].join("\n");

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "💰 BTC", callback_data: "menu:price:BTC" },
        { text: "💰 ETH", callback_data: "menu:price:ETH" },
        { text: "💰 SOL", callback_data: "menu:price:SOL" },
      ],
      [
        { text: "🔥 Trending", callback_data: "menu:trending" },
        { text: "🚀 Gainers", callback_data: "menu:gainers" },
      ],
      [{ text: "😱 Fear & Greed", callback_data: "menu:feargreed" }],
      [BACK_BTN, OPEN_APP_BTN],
    ],
  };
  return { text, keyboard };
}

// ── My Account: live link + tier + alert state ──────────────────────────────
async function accountScreen(linked: MenuLinked | null): Promise<Screen> {
  if (!linked) {
    const text = [
      `👤 ${b("MY ACCOUNT")}`,
      i("Not linked yet"),
      "",
      "Link your Naka Labs account to unlock alerts, portfolio and copy trading here in Telegram.",
      "",
      `${b("1.")} Open Settings on the app`,
      `${b("2.")} Notifications → Telegram → generate a 6-digit code`,
      `${b("3.")} Send ${code("/link 123456")} back here`,
    ].join("\n");
    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: "🔑 Generate Link Code", url: `${APP_URL}/settings` }],
          [BACK_BTN, OPEN_APP_BTN],
        ],
      },
    };
  }

  const supabase = getSupabaseAdmin();
  const { count: activeAlerts } = await supabase
    .from("price_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", linked.userId)
    .eq("triggered", false);

  const text = [
    `👤 ${b("MY ACCOUNT")}`,
    i("Linked to Naka Labs"),
    "",
    `${b("Plan")}  ${tierBadge(linked.tier)}${linked.expired ? "  " + i("(expired, renew to keep alerts)") : ""}`,
    `${b("Active alerts")}  ${activeAlerts ?? 0}`,
    "",
    "Manage everything below, or type " + code("/unlink") + " to disconnect.",
  ].join("\n");

  const rows: InlineButton[][] = [
    [
      { text: "🔔 Alerts", url: `${APP_URL}/dashboard/alerts` },
      { text: "💼 Portfolio", url: `${APP_URL}/dashboard/portfolio` },
    ],
    [SETTINGS_BTN],
  ];
  if (linked.tier === "free" || linked.tier === "mini") rows.push([UPGRADE_BTN]);
  rows.push([BACK_BTN, OPEN_APP_BTN]);

  return { text, keyboard: { inline_keyboard: rows } };
}

// ── Help: full command reference ────────────────────────────────────────────
function helpScreen(): Screen {
  const text = [
    `🆘 ${b("HELP")}`,
    i("Everything the bot can do"),
    RULE,
    b("Free"),
    `${code("/price BTC")}  live price card`,
    `${code("/chart ETH 7")}  price chart (1, 7, 30, 365d)`,
    `${code("/info SOL")}  full token info`,
    `${code("/security 0x..")}  contract rug check`,
    `${code("/trending")}  top trending coins`,
    `${code("/gainers")}  top 24h gainers`,
    `${code("/feargreed")}  market sentiment`,
    `${code("/whales")}  top whales by 30d PnL`,
    "",
    b("Linked account"),
    `${code("/alerts")} · ${code("/setalert BTC 100000")} · ${code("/portfolio")}`,
    `${code("/pnl 30")} · ${code("/trades")}`,
    "",
    b("Tiered"),
    `${code("/whale 0x..")} ✨ MINI · ${code("/copy 0x..")} ⭐ PRO · ${code("/snipe token")} 🔥 MAX`,
    "",
    b("Account"),
    `${code("/start")} · ${code("/menu")} · ${code("/status")} · ${code("/link <code>")} · ${code("/unlink")}`,
  ].join("\n");

  return {
    text,
    keyboard: {
      inline_keyboard: [
        [{ text: "🆘 Support", url: `${APP_URL}/support` }, OPEN_APP_BTN],
        [BACK_BTN],
      ],
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Dispatcher. Builds the requested screen and either edits the existing message
// (button tap -> in-place navigation) or sends a fresh one (/start, /menu).
// ═════════════════════════════════════════════════════════════════════════════

async function buildScreen(node: MenuNode, linked: MenuLinked | null): Promise<Screen> {
  switch (node) {
    case "whales":
      return whalesScreen();
    case "smart":
      return smartScreen();
    case "news":
      return newsScreen();
    case "market":
      return marketScreen();
    case "account":
      return accountScreen(linked);
    case "help":
      return helpScreen();
    case "home":
    default:
      return homeScreen(linked);
  }
}

/**
 * Render a menu node. When `messageId` is set the current bubble is rewritten
 * in place (premium, no-spam navigation); when null a new message is sent
 * (/start, /menu). If an edit fails - e.g. the source bubble was a photo
 * caption, which cannot become a text message - we fall back to a fresh send so
 * the user is never left staring at a dead button.
 */
export async function renderMenu(
  chatId: number,
  messageId: number | null,
  node: MenuNode,
  linked: MenuLinked | null,
): Promise<void> {
  const { text, keyboard } = await buildScreen(node, linked);
  if (messageId != null) {
    const ok = await editTelegramMessage(chatId, messageId, text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    if (ok) return;
  }
  await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
}
