import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

/**
 * User has signed the trade in their wallet and broadcast it client-side.
 * They POST the tx_hash back here. We:
 *   1. Mark the pending_trades row confirmed.
 *   2. Propagate tx_hash + non-authoritative transition on the source order.
 *
 * Authoritative executed amounts (actual_amount_out, actual_price,
 * actual_gas_usd, actual_slippage_bps) are NOT trusted from the client. They
 * are populated by the receipt-reconciliation cron which parses the on-chain
 * receipt directly (see /app/api/cron/receipt-reconciliation). Any client-
 * reported values are stored in client_reported_* columns for drift analysis.
 */
interface PendingRow {
  id: string;
  user_id: string;
  source_reason: string;
  source_order_id: string | null;
  source_order_table:
    | "limit_orders"
    | "dca_bots"
    | "stop_loss_orders"
    | "user_copy_trades"
    | null;
  status: string;
  expires_at: string;
  amount_in: string;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    txHash?: string;
    clientReportedAmountOut?: string;
    clientReportedPrice?: number;
  };
  if (!body.txHash || typeof body.txHash !== "string") {
    return NextResponse.json({ error: "txHash required" }, { status: 400 });
  }

  const { data: pending, error: readErr } = await supabase
    .from("pending_trades")
    .select(
      "id,user_id,source_reason,source_order_id,source_order_table,status,expires_at,amount_in",
    )
    .eq("id", params.id)
    .single<PendingRow>();
  if (readErr || !pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (pending.status !== "pending") {
    return NextResponse.json({ error: `Already ${pending.status}` }, { status: 409 });
  }
  if (new Date(pending.expires_at) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  const nowIso = new Date().toISOString();
  const admin = getSupabaseAdmin();

  await admin
    .from("pending_trades")
    .update({
      status: "confirmed",
      confirmed_tx_hash: body.txHash,
      confirmed_at: nowIso,
      client_reported_amount_out: body.clientReportedAmountOut ?? null,
      client_reported_price: body.clientReportedPrice ?? null,
    })
    .eq("id", pending.id);

  // Propagate to source order. We store tx_hash only; actual execution
  // amounts are filled in by the receipt-reconciliation cron.
  if (pending.source_order_table && pending.source_order_id) {
    switch (pending.source_order_table) {
      case "limit_orders":
        await admin
          .from("limit_orders")
          .update({
            status: "executed",
            executed_at: nowIso,
            executed_tx_hash: body.txHash,
            pending_trade_id: null,
            client_reported_amount_out: body.clientReportedAmountOut ?? null,
            client_reported_price: body.clientReportedPrice ?? null,
            updated_at: nowIso,
          })
          .eq("id", pending.source_order_id);
        break;
      case "dca_bots": {
        const { data: bot } = await admin
          .from("dca_bots")
          .select("executions_completed,total_executions")
          .eq("id", pending.source_order_id)
          .single<{ executions_completed: number; total_executions: number | null }>();
        if (bot) {
          const completed = bot.executions_completed + 1;
          const totalTargets = bot.total_executions;
          await admin.from("dca_executions").insert({
            bot_id: pending.source_order_id,
            execution_number: completed,
            tx_hash: body.txHash,
            amount_in: pending.amount_in,
            client_reported_amount_out: body.clientReportedAmountOut ?? null,
            client_reported_price: body.clientReportedPrice ?? null,
            status: "success",
          });
          await admin
            .from("dca_bots")
            .update({
              executions_completed: completed,
              status: totalTargets != null && completed >= totalTargets ? "completed" : "active",
              updated_at: nowIso,
            })
            .eq("id", pending.source_order_id);
        }
        break;
      }
      case "stop_loss_orders": {
        // Read current row to determine which triggered_* state applies from
        // the source_reason. The monitor stored reason on the pending row.
        const triggeredStatus =
          pending.source_reason === "stop_loss"
            ? "triggered_sl"
            : pending.source_reason === "take_profit"
              ? "triggered_tp"
              : pending.source_reason === "trail_stop"
                ? "triggered_trail"
                : "triggered_sl";
        await admin
          .from("stop_loss_orders")
          .update({
            status: triggeredStatus,
            triggered_at: nowIso,
            triggered_tx_hash: body.txHash,
            pending_trade_id: null,
            updated_at: nowIso,
          })
          .eq("id", pending.source_order_id);
        break;
      }
      case "user_copy_trades":
        await admin
          .from("user_copy_trades")
          .update({
            status: "success",
            copied_tx_hash: body.txHash,
          })
          .eq("id", pending.source_order_id);
        break;
    }
  }

  return NextResponse.json({ ok: true });
}
