import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export async function GET() {
  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [limitsR, dcaR, stopsR] = await Promise.all([
    supabase
      .from("limit_orders")
      .select("id, from_token_symbol, to_token_symbol, from_amount, executed_price, status, executed_at, executed_tx_hash")
      .eq("user_id", user.id)
      .in("status", ["executed", "cancelled", "expired", "failed"])
      .order("executed_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("dca_executions")
      .select("id, bot_id, amount_in, amount_out, price_at_execution, status, executed_at, tx_hash, dca_bots(from_token_symbol, to_token_symbol, user_id)")
      .order("executed_at", { ascending: false })
      .limit(50),
    supabase
      .from("stop_loss_orders")
      .select("id, token_symbol, position_amount, triggered_price, status, triggered_at, triggered_tx_hash")
      .eq("user_id", user.id)
      .in("status", ["triggered_sl", "triggered_tp", "triggered_trail", "cancelled", "failed"])
      .order("triggered_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  interface Row {
    id: string;
    type: "limit" | "dca" | "stop";
    pair: string;
    amount: number | null;
    price: number | null;
    status: string;
    executed_at: string;
    tx_hash: string | null;
  }

  const rows: Row[] = [];
  for (const l of (limitsR.data ?? []) as Array<{
    id: string;
    from_token_symbol: string | null;
    to_token_symbol: string | null;
    from_amount: number;
    executed_price: number | null;
    status: string;
    executed_at: string | null;
    executed_tx_hash: string | null;
  }>) {
    rows.push({
      id: l.id,
      type: "limit",
      pair: `${l.from_token_symbol ?? "?"} → ${l.to_token_symbol ?? "?"}`,
      amount: l.from_amount,
      price: l.executed_price,
      status: l.status,
      executed_at: l.executed_at ?? new Date().toISOString(),
      tx_hash: l.executed_tx_hash,
    });
  }

  for (const d of (dcaR.data ?? []) as Array<{
    id: string;
    amount_in: number;
    amount_out: number | null;
    price_at_execution: number | null;
    status: string;
    executed_at: string;
    tx_hash: string | null;
    dca_bots: { from_token_symbol: string | null; to_token_symbol: string | null; user_id: string } | null;
  }>) {
    if (d.dca_bots?.user_id !== user.id) continue;
    rows.push({
      id: d.id,
      type: "dca",
      pair: `${d.dca_bots?.from_token_symbol ?? "?"} → ${d.dca_bots?.to_token_symbol ?? "?"}`,
      amount: d.amount_in,
      price: d.price_at_execution,
      status: d.status,
      executed_at: d.executed_at,
      tx_hash: d.tx_hash,
    });
  }

  for (const s of (stopsR.data ?? []) as Array<{
    id: string;
    token_symbol: string | null;
    position_amount: number;
    triggered_price: number | null;
    status: string;
    triggered_at: string | null;
    triggered_tx_hash: string | null;
  }>) {
    rows.push({
      id: s.id,
      type: "stop",
      pair: s.token_symbol ?? "?",
      amount: s.position_amount,
      price: s.triggered_price,
      status: s.status,
      executed_at: s.triggered_at ?? new Date().toISOString(),
      tx_hash: s.triggered_tx_hash,
    });
  }

  rows.sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());
  return NextResponse.json({ rows: rows.slice(0, 100) });
}
