import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const cookieStore = cookies();
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
 *   2. Propagate status + tx_hash to the source order (limit_orders, dca_bots,
 *      stop_loss_orders, or user_copy_trades) so downstream UI updates.
 *
 * On-chain confirmation (wait for receipt, compute executed price/amount) is
 * the client's responsibility before POST — or a subsequent follow-up cron
 * can reconcile executed_amount_out from the receipt; we accept tx_hash here
 * as the source of truth for "order fired".
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    txHash?: string;
    amountOut?: string;
    executedPrice?: number;
  };
  if (!body.txHash || typeof body.txHash !== "string") {
    return NextResponse.json({ error: "txHash required" }, { status: 400 });
  }

  const { data: pending, error: readErr } = await supabase
    .from("pending_trades")
    .select("id,user_id,source_reason,source_order_id,source_order_table,status,expires_at")
    .eq("id", params.id)
    .single();
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
    })
    .eq("id", pending.id);

  // Propagate to source order.
  if (pending.source_order_table && pending.source_order_id) {
    switch (pending.source_order_table) {
      case "limit_orders":
        await admin
          .from("limit_orders")
          .update({
            status: "executed",
            executed_at: nowIso,
            executed_tx_hash: body.txHash,
            executed_amount_out: body.amountOut ?? null,
            executed_price: body.executedPrice ?? null,
            updated_at: nowIso,
          })
          .eq("id", pending.source_order_id);
        break;
      case "dca_bots": {
        const { data: bot } = await admin
          .from("dca_bots")
          .select(
            "executions_completed,total_invested_usd,total_received_amount,avg_entry_price,total_executions",
          )
          .eq("id", pending.source_order_id)
          .single();
        if (bot) {
          const completed = (bot as { executions_completed: number }).executions_completed + 1;
          const totalTargets = (bot as { total_executions: number | null }).total_executions;
          await admin.from("dca_executions").insert({
            bot_id: pending.source_order_id,
            execution_number: completed,
            tx_hash: body.txHash,
            amount_in: (pending as unknown as { amount_in: string }).amount_in ?? null,
            amount_out: body.amountOut ?? null,
            price_at_execution: body.executedPrice ?? null,
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
      case "stop_loss_orders":
        await admin
          .from("stop_loss_orders")
          .update({
            triggered_tx_hash: body.txHash,
            updated_at: nowIso,
          })
          .eq("id", pending.source_order_id);
        break;
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
