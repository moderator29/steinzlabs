import { NextRequest } from "next/server";
import { verifyCron, cronResponse } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExpiredPendingRow {
  id: string;
  source_order_table:
    | "limit_orders"
    | "dca_bots"
    | "stop_loss_orders"
    | "user_copy_trades"
    | null;
  source_order_id: string | null;
}

/**
 * Expire stale pending_trades AND restore their source orders so triggers
 * can fire again. Without this restore, limit_orders / stop_loss_orders
 * would sit in 'pending_confirmation' forever if the user never clicks.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: expired } = await admin
    .from("pending_trades")
    .update({ status: "expired", failure_reason: "confirmation_window_expired" })
    .eq("status", "pending")
    .lt("expires_at", nowIso)
    .select("id,source_order_table,source_order_id")
    .returns<ExpiredPendingRow[]>();

  const rows = expired ?? [];
  let restored = 0;

  for (const row of rows) {
    if (!row.source_order_table || !row.source_order_id) continue;
    switch (row.source_order_table) {
      case "limit_orders":
        await admin
          .from("limit_orders")
          .update({ status: "active", pending_trade_id: null, updated_at: nowIso })
          .eq("id", row.source_order_id)
          .eq("status", "pending_confirmation");
        restored++;
        break;
      case "stop_loss_orders":
        await admin
          .from("stop_loss_orders")
          .update({
            status: "active",
            pending_trade_id: null,
            triggered_price: null,
            realized_pnl_usd: null,
            updated_at: nowIso,
          })
          .eq("id", row.source_order_id)
          .eq("status", "pending_confirmation");
        restored++;
        break;
      case "user_copy_trades":
        await admin
          .from("user_copy_trades")
          .update({ status: "expired", failure_reason: "confirmation_window_expired" })
          .eq("id", row.source_order_id)
          .eq("status", "pending");
        restored++;
        break;
      case "dca_bots":
        // DCA schedule already advanced — self-healing on next interval.
        break;
    }
  }

  return cronResponse("pending-trades-cleanup", startedAt, {
    expired: rows.length,
    source_orders_restored: restored,
  });
}
