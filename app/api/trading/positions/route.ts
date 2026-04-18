import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
 * Derive positions from DCA bots + active stop-loss orders as a best-effort
 * view until on-chain portfolio balances are wired through /lib/wallet.
 */
export async function GET() {
  const supabase = await getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [botsR, stopsR] = await Promise.all([
    supabase
      .from("dca_bots")
      .select("to_token_address, to_token_symbol, chain, total_received_amount, avg_entry_price, total_invested_usd")
      .eq("user_id", user.id)
      .in("status", ["active", "paused", "completed"]),
    supabase
      .from("stop_loss_orders")
      .select("token_address, token_symbol, chain, position_amount, entry_price_usd")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const positions = new Map<
    string,
    {
      token_address: string;
      token_symbol: string;
      chain: string;
      amount: number;
      avg_entry_usd: number | null;
      current_price_usd: number | null;
      pnl_usd: number | null;
      pnl_pct: number | null;
    }
  >();

  for (const b of (botsR.data ?? []) as Array<{
    to_token_address: string;
    to_token_symbol: string | null;
    chain: string;
    total_received_amount: number;
    avg_entry_price: number | null;
    total_invested_usd: number;
  }>) {
    const key = `${b.chain}:${b.to_token_address}`;
    const entry = positions.get(key);
    if (entry) {
      entry.amount += b.total_received_amount ?? 0;
    } else {
      positions.set(key, {
        token_address: b.to_token_address,
        token_symbol: b.to_token_symbol ?? "?",
        chain: b.chain,
        amount: b.total_received_amount ?? 0,
        avg_entry_usd: b.avg_entry_price,
        current_price_usd: null,
        pnl_usd: null,
        pnl_pct: null,
      });
    }
  }

  for (const s of (stopsR.data ?? []) as Array<{
    token_address: string;
    token_symbol: string | null;
    chain: string;
    position_amount: number;
    entry_price_usd: number | null;
  }>) {
    const key = `${s.chain}:${s.token_address}`;
    if (!positions.has(key)) {
      positions.set(key, {
        token_address: s.token_address,
        token_symbol: s.token_symbol ?? "?",
        chain: s.chain,
        amount: s.position_amount,
        avg_entry_usd: s.entry_price_usd,
        current_price_usd: null,
        pnl_usd: null,
        pnl_pct: null,
      });
    }
  }

  return NextResponse.json({ positions: Array.from(positions.values()) });
}
