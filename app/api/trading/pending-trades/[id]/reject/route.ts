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

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pending } = await supabase
    .from("pending_trades")
    .select("id,user_id,status,source_order_table,source_order_id")
    .eq("id", params.id)
    .single();
  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (pending.status !== "pending") {
    return NextResponse.json({ error: `Already ${pending.status}` }, { status: 409 });
  }

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  await admin
    .from("pending_trades")
    .update({ status: "rejected", failure_reason: "user_rejected" })
    .eq("id", pending.id);

  // Restore source order so the trigger can fire again (user rejected this
  // firing, not the order itself). Copy-trades are terminal on reject — user
  // explicitly declined copying that specific whale tx.
  if (pending.source_order_table && pending.source_order_id) {
    switch (pending.source_order_table) {
      case "limit_orders":
        await admin
          .from("limit_orders")
          .update({ status: "active", pending_trade_id: null, updated_at: nowIso })
          .eq("id", pending.source_order_id);
        break;
      case "stop_loss_orders":
        await admin
          .from("stop_loss_orders")
          .update({
            status: "active",
            pending_trade_id: null,
            triggered_at: null,
            triggered_price: null,
            realized_pnl_usd: null,
            updated_at: nowIso,
          })
          .eq("id", pending.source_order_id);
        break;
      case "dca_bots":
        // DCA schedule already advanced at trigger time. Rejection simply
        // skips this slot — nothing to restore.
        break;
      case "user_copy_trades":
        await admin
          .from("user_copy_trades")
          .update({ status: "cancelled", failure_reason: "user_rejected" })
          .eq("id", pending.source_order_id);
        break;
    }
  }

  return NextResponse.json({ ok: true });
}
