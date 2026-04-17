import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

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

async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(symbol)}&vs_currencies=usd`,
      { source: "cg-simple-price", timeoutMs: 4000, retries: 1 },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { usd?: number }>;
    return json[symbol]?.usd ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("stop_loss_orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

interface StopBody {
  chain: string;
  token_address: string;
  token_symbol?: string;
  position_amount: number;
  entry_price_usd?: number;
  stop_loss_pct?: number | null;
  take_profit_pct?: number | null;
  trailing_stop_percent?: number | null;
  exit_to_token_address: string;
  exit_to_token_symbol?: string;
  slippage_bps?: number;
  wallet_source: "external_evm" | "external_solana" | "builtin";
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: StopBody;
  try {
    body = (await request.json()) as StopBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!(body.position_amount > 0)) {
    return NextResponse.json({ error: "Invalid position amount" }, { status: 400 });
  }
  if (!body.token_address) {
    return NextResponse.json({ error: "Missing token_address" }, { status: 400 });
  }

  // Resolve entry price so SL/TP percent can become absolute USD triggers.
  let entry = body.entry_price_usd;
  if (!entry && body.token_symbol) {
    const p = await fetchCurrentPrice(body.token_symbol.toLowerCase());
    if (p) entry = p;
  }

  const stopLossPrice =
    entry && body.stop_loss_pct !== null && body.stop_loss_pct !== undefined
      ? entry * (1 + body.stop_loss_pct / 100)
      : null;
  const takeProfitPrice =
    entry && body.take_profit_pct !== null && body.take_profit_pct !== undefined
      ? entry * (1 + body.take_profit_pct / 100)
      : null;

  const { data, error } = await supabase
    .from("stop_loss_orders")
    .insert({
      user_id: user.id,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      position_amount: body.position_amount,
      entry_price_usd: entry ?? null,
      stop_loss_price_usd: stopLossPrice,
      take_profit_price_usd: takeProfitPrice,
      trailing_stop_percent: body.trailing_stop_percent ?? null,
      highest_price_seen: entry ?? null,
      exit_to_token_address: body.exit_to_token_address,
      exit_to_token_symbol: body.exit_to_token_symbol ?? null,
      slippage_bps: body.slippage_bps ?? 100,
      wallet_source: body.wallet_source,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
