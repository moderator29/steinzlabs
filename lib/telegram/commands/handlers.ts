import "server-only";
import { sendTelegramMessage, sendTelegramPhoto, sendTelegramTyping } from "@/lib/telegram/client";
import { getMarketsByIds, getTokenDetail } from "@/lib/services/coingecko";
import { resolveCoinId } from "./resolveSymbol";
import { buildPriceChartUrl } from "./chartImage";
import { fmtPct, fmtPctEmoji, fmtUSD, fmtNum, escapeMd } from "./format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://steinzlabs.vercel.app";

interface CmdContext {
  chatId: number;
  args: string[];
  rawText: string;
}

// ─── /price ──────────────────────────────────────────────────────────────────
export async function handlePrice(ctx: CmdContext): Promise<void> {
  const sym = ctx.args[0];
  if (!sym) {
    await sendTelegramMessage(ctx.chatId, "Usage: `/price BTC`, `/price SOL`, `/price ethereum`");
    return;
  }

  await sendTelegramTyping(ctx.chatId);
  const resolved = await resolveCoinId(sym);
  if (!resolved) {
    await sendTelegramMessage(ctx.chatId, `❌ No token found for *${escapeMd(sym)}*. Try a ticker (BTC) or full name.`);
    return;
  }

  const [markets] = await Promise.all([getMarketsByIds([resolved.id], false)]);
  const m = markets[0];
  if (!m) {
    await sendTelegramMessage(ctx.chatId, `❌ Couldn't fetch market data for *${escapeMd(resolved.symbol)}*.`);
    return;
  }

  const text =
    `📊 *${escapeMd(m.name)}* (${escapeMd(m.symbol.toUpperCase())})\n\n` +
    `💰 Price: *${fmtUSD(m.current_price)}*\n` +
    `${fmtPctEmoji(m.price_change_percentage_24h)} 24h\n\n` +
    `💎 Market Cap: ${fmtUSD(m.market_cap)}\n` +
    `📊 24h Volume: ${fmtUSD(m.total_volume)}\n` +
    `🏆 Rank: #${m.market_cap_rank ?? "—"}\n` +
    `🔼 24h High: ${fmtUSD(m.high_24h)}\n` +
    `🔽 24h Low: ${fmtUSD(m.low_24h)}`;

  await sendTelegramMessage(ctx.chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📈 Chart", callback_data: `chart:${resolved.id}:${m.symbol}` },
          { text: "🔔 Set Alert", url: `${APP_URL}/dashboard/alerts/new?token=${resolved.id}` },
        ],
        [{ text: "💱 Buy on Naka", url: `${APP_URL}/market/swap?token=${resolved.id}` }],
      ],
    },
  });
}

// ─── /chart ──────────────────────────────────────────────────────────────────
export async function handleChart(ctx: CmdContext): Promise<void> {
  const sym = ctx.args[0];
  if (!sym) {
    await sendTelegramMessage(ctx.chatId, "Usage: `/chart BTC` or `/chart SOL 7` (days)");
    return;
  }
  const days = Math.max(1, Math.min(365, parseInt(ctx.args[1] ?? "1", 10) || 1));

  await sendTelegramTyping(ctx.chatId);
  const resolved = await resolveCoinId(sym);
  if (!resolved) {
    await sendTelegramMessage(ctx.chatId, `❌ No token found for *${escapeMd(sym)}*.`);
    return;
  }

  const [markets, chartUrl] = await Promise.all([
    getMarketsByIds([resolved.id], false),
    buildPriceChartUrl(resolved.id, days, resolved.symbol),
  ]);
  const m = markets[0];

  if (!chartUrl) {
    // Fall back to text-only price card so user gets *something*.
    await handlePrice(ctx);
    return;
  }

  const caption = m
    ? `*${escapeMd(m.name)}* (${escapeMd(m.symbol.toUpperCase())}) · ${fmtUSD(m.current_price)} · ${fmtPctEmoji(m.price_change_percentage_24h)} 24h`
    : `${escapeMd(resolved.name)} · ${days <= 1 ? "24h" : `${days}d`} chart`;

  await sendTelegramPhoto(ctx.chatId, chartUrl, {
    caption,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "1D", callback_data: `chart:${resolved.id}:${resolved.symbol}:1` },
          { text: "7D", callback_data: `chart:${resolved.id}:${resolved.symbol}:7` },
          { text: "30D", callback_data: `chart:${resolved.id}:${resolved.symbol}:30` },
          { text: "1Y", callback_data: `chart:${resolved.id}:${resolved.symbol}:365` },
        ],
        [{ text: "💱 Trade", url: `${APP_URL}/market/swap?token=${resolved.id}` }],
      ],
    },
  });
}

// ─── /info ──────────────────────────────────────────────────────────────────
export async function handleInfo(ctx: CmdContext): Promise<void> {
  const sym = ctx.args[0];
  if (!sym) {
    await sendTelegramMessage(ctx.chatId, "Usage: `/info BTC`");
    return;
  }
  await sendTelegramTyping(ctx.chatId);
  const resolved = await resolveCoinId(sym);
  if (!resolved) {
    await sendTelegramMessage(ctx.chatId, `❌ No token found for *${escapeMd(sym)}*.`);
    return;
  }

  let detail;
  try {
    detail = await getTokenDetail(resolved.id);
  } catch {
    await sendTelegramMessage(ctx.chatId, `❌ Couldn't fetch info for *${escapeMd(resolved.symbol)}*.`);
    return;
  }

  const md = detail.market_data;
  const desc = (detail.description?.en ?? "").replace(/<[^>]+>/g, "").split(". ")[0] || "";
  const text =
    `ℹ️ *${escapeMd(detail.name)}* (${escapeMd(detail.symbol.toUpperCase())}) · #${detail.market_cap_rank ?? "—"}\n\n` +
    `💰 Price: ${fmtUSD(md.current_price.usd)}\n` +
    `${fmtPctEmoji(md.price_change_percentage_24h)} 24h · ${fmtPctEmoji(md.price_change_percentage_7d)} 7d · ${fmtPctEmoji(md.price_change_percentage_30d)} 30d\n\n` +
    `💎 Market Cap: ${fmtUSD(md.market_cap.usd)}\n` +
    `🏛️ FDV: ${fmtUSD(md.fully_diluted_valuation?.usd ?? 0)}\n` +
    `📊 Volume 24h: ${fmtUSD(md.total_volume.usd)}\n` +
    `🔄 Circulating: ${fmtNum(md.circulating_supply)}\n` +
    `📦 Max Supply: ${md.max_supply ? fmtNum(md.max_supply) : "Uncapped"}\n` +
    `🏆 ATH: ${fmtUSD(md.ath.usd)} (${fmtPct(md.ath_change_percentage.usd)})\n\n` +
    (desc ? `_${escapeMd(desc.slice(0, 280))}${desc.length > 280 ? "…" : ""}_` : "");

  await sendTelegramMessage(ctx.chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📈 Chart", callback_data: `chart:${resolved.id}:${detail.symbol}:1` },
          { text: "🔍 Holders", callback_data: `holders:${resolved.id}` },
        ],
        [{ text: "💱 Trade", url: `${APP_URL}/market/swap?token=${resolved.id}` }],
      ],
    },
  });
}

// ─── /security ──────────────────────────────────────────────────────────────
export async function handleSecurity(ctx: CmdContext): Promise<void> {
  const addr = ctx.args[0];
  if (!addr || !/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
    await sendTelegramMessage(ctx.chatId, "Usage: `/security 0xabc...` (EVM contract or Solana mint)");
    return;
  }

  await sendTelegramTyping(ctx.chatId);
  const isEvm = addr.startsWith("0x");
  // GoPlus has free public endpoint — no key needed for basic checks.
  const chainId = "1"; // default to Ethereum; user can override later
  const url = isEvm
    ? `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${addr}`
    : `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${addr}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = await res.json();
    const r = (j?.result?.[addr.toLowerCase()] ?? j?.result?.[addr]) as Record<string, unknown> | undefined;
    if (!r) {
      await sendTelegramMessage(ctx.chatId, `⚠️ GoPlus has no data for that address yet.`);
      return;
    }

    const flag = (k: string) => (r[k] === "1" ? "❌" : r[k] === "0" ? "✅" : "❓");
    const lines = isEvm
      ? [
          `${flag("is_open_source")} Verified contract`,
          `${flag("is_proxy")} Proxy contract (false = better)`,
          `${flag("is_mintable")} Mintable (false = better)`,
          `${flag("is_honeypot")} Honeypot detected`,
          `${flag("transfer_pausable")} Transfers pausable`,
          `${flag("can_take_back_ownership")} Owner can reclaim`,
          `${flag("hidden_owner")} Hidden owner`,
          `Buy tax: *${r.buy_tax ?? "—"}*  |  Sell tax: *${r.sell_tax ?? "—"}*`,
          `Holders: *${r.holder_count ?? "—"}*  |  LP holders: *${r.lp_holder_count ?? "—"}*`,
        ]
      : [
          `${flag("trusted_token")} Trusted token (Jupiter)`,
          `${flag("balance_mutable_authority")} Balance mutable`,
          `${flag("freezable")} Freezable`,
          `${flag("non_transferable")} Non-transferable`,
          `Holders: *${r.holders_count ?? "—"}*`,
        ];

    await sendTelegramMessage(
      ctx.chatId,
      `🛡️ *Security Check*\n\`${addr.slice(0, 14)}…\`\n\n${lines.join("\n")}\n\n_Powered by GoPlus_`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🔍 Full Report", url: `${APP_URL}/security/scan?address=${addr}` }]],
        },
      },
    );
  } catch (err) {
    console.error("[telegram.security]", err);
    await sendTelegramMessage(ctx.chatId, "❌ Security service unavailable. Try again shortly.");
  }
}

// ─── /whales ────────────────────────────────────────────────────────────────
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function handleWhalesTop(ctx: CmdContext): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("whales")
    .select("address, label, chain, pnl_30d_usd, win_rate, last_active_at, verified")
    .order("pnl_30d_usd", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    await sendTelegramMessage(ctx.chatId, "📭 No whale data available right now.");
    return;
  }

  const lines = data.map((w, i) => {
    const name = (w.label as string | null) ?? `${(w.address as string).slice(0, 6)}…${(w.address as string).slice(-4)}`;
    const verified = w.verified ? " ✓" : "";
    const pnl = w.pnl_30d_usd != null ? fmtUSD(Number(w.pnl_30d_usd), { sign: true }) : "—";
    const wr = w.win_rate != null ? `${(Number(w.win_rate) * 100).toFixed(0)}%` : "—";
    return `${i + 1}. *${escapeMd(name)}*${verified} · ${pnl} · WR ${wr} · ${w.chain ?? "—"}`;
  });

  await sendTelegramMessage(
    ctx.chatId,
    `🐋 *Top 10 Whales · 30d PnL*\n\n${lines.join("\n")}\n\nTap a whale for details.`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "🌐 Open Whale Tracker", url: `${APP_URL}/dashboard/whale-tracker` }]],
      },
    },
  );
}

export async function handleWhaleLookup(ctx: CmdContext): Promise<void> {
  const addr = ctx.args[0];
  if (!addr) {
    await sendTelegramMessage(ctx.chatId, "Usage: `/whale 0xabc...`");
    return;
  }

  await sendTelegramTyping(ctx.chatId);
  const supabase = getSupabaseAdmin();
  const { data: w } = await supabase
    .from("whales")
    .select("address, label, chain, archetype, portfolio_value_usd, pnl_30d_usd, pnl_7d_usd, pnl_90d_usd, win_rate, trade_count_30d, avg_hold_hours, whale_score, follower_count, verified, last_active_at, x_handle")
    .eq("address", addr.toLowerCase())
    .maybeSingle();

  if (!w) {
    await sendTelegramMessage(
      ctx.chatId,
      `🔍 \`${addr.slice(0, 14)}…\` is not yet tracked. Submit it to add to the directory.`,
      { reply_markup: { inline_keyboard: [[{ text: "➕ Submit Whale", url: `${APP_URL}/dashboard/whale-tracker/submit` }]] } },
    );
    return;
  }

  const name = (w.label as string | null) ?? `${(w.address as string).slice(0, 6)}…${(w.address as string).slice(-4)}`;
  const verified = w.verified ? " ✓" : "";
  const lastActive = w.last_active_at ? new Date(w.last_active_at as string).toUTCString().slice(5, 22) : "—";
  const archetype = w.archetype ? `\nArchetype: *${escapeMd(w.archetype as string)}*` : "";
  const xHandle = w.x_handle ? `\nX: @${escapeMd(w.x_handle as string)}` : "";
  const text =
    `🐋 *${escapeMd(name)}*${verified}\n\`${w.address}\`\n\n` +
    `Chain: *${w.chain ?? "—"}*${archetype}${xHandle}\n` +
    `Whale score: *${w.whale_score ?? "—"}/100*\n` +
    `Followers: *${w.follower_count ?? 0}*\n` +
    `Portfolio: *${w.portfolio_value_usd != null ? fmtUSD(Number(w.portfolio_value_usd)) : "—"}*\n` +
    `Win rate: *${w.win_rate != null ? (Number(w.win_rate) * 100).toFixed(1) + "%" : "—"}*\n\n` +
    `*PnL*\n` +
    `• 7d:  ${w.pnl_7d_usd != null ? fmtUSD(Number(w.pnl_7d_usd), { sign: true }) : "—"}\n` +
    `• 30d: ${w.pnl_30d_usd != null ? fmtUSD(Number(w.pnl_30d_usd), { sign: true }) : "—"}\n` +
    `• 90d: ${w.pnl_90d_usd != null ? fmtUSD(Number(w.pnl_90d_usd), { sign: true }) : "—"}\n\n` +
    `*30d Activity*\n` +
    `• Trades: ${w.trade_count_30d ?? "—"}\n` +
    `• Avg hold: ${w.avg_hold_hours != null ? `${Number(w.avg_hold_hours).toFixed(1)}h` : "—"}\n\n` +
    `Last active: _${lastActive}_`;

  await sendTelegramMessage(ctx.chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔁 Copy Trade", url: `${APP_URL}/dashboard/copy-trade/setup?whale=${w.address}` },
          { text: "👁️ Follow", url: `${APP_URL}/dashboard/whale-tracker/${w.address}` },
        ],
      ],
    },
  });
}

// ─── /alerts ────────────────────────────────────────────────────────────────
export async function handleAlerts(userId: string, ctx: CmdContext): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("price_alerts")
    .select("id, token_symbol, price, direction, triggered, triggered_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (!data || data.length === 0) {
    await sendTelegramMessage(ctx.chatId, "🔔 No alerts yet.\n\nCreate one: `/setalert BTC 100000`", {
      reply_markup: { inline_keyboard: [[{ text: "🌐 Manage Alerts", url: `${APP_URL}/dashboard/alerts` }]] },
    });
    return;
  }

  const lines = data.map((a, i) => {
    const status = a.triggered ? "✅ triggered" : "🔔 active";
    const arrow = a.direction === "above" ? "≥" : "≤";
    return `${i + 1}. *${escapeMd(a.token_symbol as string)}* ${arrow} ${fmtUSD(Number(a.price))} · ${status}`;
  });

  await sendTelegramMessage(ctx.chatId, `🔔 *Your Alerts*\n\n${lines.join("\n")}`, {
    reply_markup: { inline_keyboard: [[{ text: "🌐 Manage", url: `${APP_URL}/dashboard/alerts` }]] },
  });
}

export async function handleSetAlert(userId: string, ctx: CmdContext): Promise<void> {
  const sym = ctx.args[0];
  const priceStr = ctx.args[1];
  if (!sym || !priceStr) {
    await sendTelegramMessage(ctx.chatId, "Usage: `/setalert BTC 100000` (alert when BTC ≥ $100k)\n`/setalert ETH <3000` (alert when ETH ≤ $3k)");
    return;
  }

  const direction = priceStr.startsWith("<") ? "below" : "above";
  const target = parseFloat(priceStr.replace(/[<>$,]/g, ""));
  if (!isFinite(target) || target <= 0) {
    await sendTelegramMessage(ctx.chatId, "❌ Invalid price. Try: `/setalert BTC 100000`");
    return;
  }

  const resolved = await resolveCoinId(sym);
  if (!resolved) {
    await sendTelegramMessage(ctx.chatId, `❌ No token found for *${escapeMd(sym)}*.`);
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("price_alerts").insert({
    user_id: userId,
    token_id: resolved.id,
    token_symbol: resolved.symbol,
    price: target,
    direction,
    triggered: false,
  });

  if (error) {
    console.error("[telegram.setalert]", error);
    await sendTelegramMessage(ctx.chatId, "❌ Couldn't save alert. Try again.");
    return;
  }

  await sendTelegramMessage(
    ctx.chatId,
    `✅ Alert set: *${resolved.symbol}* ${direction === "above" ? "≥" : "≤"} ${fmtUSD(target)}\n\nWe'll ping you here when it hits.`,
  );
}

// ─── /portfolio ─────────────────────────────────────────────────────────────
interface WalletEntry { address: string; chain?: string; label?: string }

export async function handlePortfolio(userId: string, ctx: CmdContext): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("user_wallets_v2")
    .select("wallets, default_address")
    .eq("user_id", userId)
    .maybeSingle();

  const wallets = (row?.wallets as WalletEntry[] | null) ?? [];
  if (wallets.length === 0) {
    await sendTelegramMessage(ctx.chatId, "💼 No wallets connected.\n\nConnect your wallet on the dashboard:", {
      reply_markup: { inline_keyboard: [[{ text: "🌐 Connect Wallet", url: `${APP_URL}/dashboard/wallet-intelligence` }]] },
    });
    return;
  }

  const lines = wallets.slice(0, 10).map(w => {
    const isDefault = row?.default_address && w.address === row.default_address;
    const tag = isDefault ? " ⭐" : "";
    const label = w.label ?? `${w.address.slice(0, 6)}…${w.address.slice(-4)}`;
    return `• *${escapeMd(label)}*${tag} · ${w.chain ?? "—"}\n  \`${w.address}\``;
  });

  await sendTelegramMessage(
    ctx.chatId,
    `💼 *Your Wallets*\n\n${lines.join("\n\n")}\n\nFor live PnL, holdings, and intelligence:`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "📊 Open Portfolio", url: `${APP_URL}/dashboard/wallet-intelligence` }]],
      },
    },
  );
}

// ─── /trending ──────────────────────────────────────────────────────────────
import { getTrendingTokens } from "@/lib/services/coingecko";

export async function handleTrending(ctx: CmdContext): Promise<void> {
  await sendTelegramTyping(ctx.chatId);
  try {
    const trending = await getTrendingTokens();
    if (!trending.length) {
      await sendTelegramMessage(ctx.chatId, "📭 No trending data right now.");
      return;
    }
    const lines = trending.slice(0, 10).map((t, i) => {
      const change = t.data?.price_change_percentage_24h?.usd;
      return `${i + 1}. *${escapeMd(t.name)}* (${escapeMd(t.symbol.toUpperCase())}) · #${t.market_cap_rank ?? "—"}${change != null ? ` · ${fmtPctEmoji(change)}` : ""}`;
    });
    await sendTelegramMessage(ctx.chatId, `🔥 *Trending now*\n\n${lines.join("\n")}`);
  } catch (err) {
    console.error("[telegram.trending]", err);
    await sendTelegramMessage(ctx.chatId, "❌ Trending unavailable. Try again shortly.");
  }
}

// ─── /gainers ───────────────────────────────────────────────────────────────
import { getTopGainers } from "@/lib/services/coingecko";

export async function handleGainers(ctx: CmdContext): Promise<void> {
  await sendTelegramTyping(ctx.chatId);
  try {
    const gainers = await getTopGainers(10);
    if (!gainers.length) {
      await sendTelegramMessage(ctx.chatId, "📭 No gainers data right now.");
      return;
    }
    const lines = gainers.map((g, i) => {
      return `${i + 1}. *${escapeMd(g.name)}* (${escapeMd(g.symbol.toUpperCase())}) · ${fmtUSD(g.current_price)} · ${fmtPctEmoji(g.price_change_percentage_24h)}`;
    });
    await sendTelegramMessage(ctx.chatId, `📈 *Top Gainers · 24h*\n\n${lines.join("\n")}`);
  } catch (err) {
    console.error("[telegram.gainers]", err);
    await sendTelegramMessage(ctx.chatId, "❌ Gainers unavailable. Try again shortly.");
  }
}
