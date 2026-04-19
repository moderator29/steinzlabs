import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/client";

export type TradeNotificationReason =
  | "limit_order"
  | "dca"
  | "stop_loss"
  | "take_profit"
  | "trail_stop"
  | "copy_trade"
  | "vtx_chat";

export interface PendingTradeNotificationPayload {
  userId: string;
  reason: TradeNotificationReason;
  chain: string;
  fromTokenSymbol: string | null;
  toTokenSymbol: string | null;
  amountIn: string;
  expectedAmountOut: string | null;
  pendingTradeId: string;
  expiresAt: string;
}

const REASON_LABEL: Record<TradeNotificationReason, string> = {
  limit_order: "Limit order",
  dca: "DCA buy",
  stop_loss: "Stop-loss",
  take_profit: "Take-profit",
  trail_stop: "Trailing stop",
  copy_trade: "Copy trade",
  vtx_chat: "VTX swap",
};

/**
 * Notify a user that a monitor cron has detected a trigger and created a
 * pending trade. Pushes Telegram (best-effort) and never throws — trade
 * execution must not be blocked by notification failures.
 */
export async function notifyPendingTrade(p: PendingTradeNotificationPayload): Promise<void> {
  const label = REASON_LABEL[p.reason];
  const fromSym = p.fromTokenSymbol ?? "token";
  const toSym = p.toTokenSymbol ?? "token";
  const body =
    `${label} ready to confirm\n\n` +
    `${fromSym} → ${toSym} on ${p.chain.toUpperCase()}\n` +
    `Amount: ${p.amountIn} ${fromSym}\n` +
    (p.expectedAmountOut ? `Expected out: ${p.expectedAmountOut} ${toSym}\n` : "") +
    `\nOpen Naka Labs and tap Confirm within 10 minutes, or this trade will expire.`;

  try {
    const admin = getSupabaseAdmin();
    const { data: link } = await admin
      .from("user_telegram_links")
      .select("telegram_chat_id")
      .eq("user_id", p.userId)
      .maybeSingle();
    if (link?.telegram_chat_id) {
      await sendTelegramMessage(link.telegram_chat_id, body, { parse_mode: "Markdown" });
    }
  } catch (err) {
    console.error("[relayer.notify] telegram send failed", err);
  }
}
