import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  const supabase = await getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status");
  let query = supabase
    .from("limit_orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

interface LimitOrderBody {
  chain: string;
  from_token_address: string;
  from_token_symbol?: string;
  to_token_address: string;
  to_token_symbol?: string;
  from_amount: number;
  trigger_price_usd: number;
  trigger_direction: "above" | "below";
  slippage_bps?: number;
  expires_at?: string | null;
  wallet_source: "external_evm" | "external_solana" | "builtin";
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: LimitOrderBody;
  try {
    body = (await request.json()) as LimitOrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.chain || !body.from_token_address || !body.to_token_address) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!(body.from_amount > 0) || !(body.trigger_price_usd > 0)) {
    return NextResponse.json({ error: "Invalid amount or price" }, { status: 400 });
  }
  if (body.trigger_direction !== "above" && body.trigger_direction !== "below") {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("limit_orders")
    .insert({
      user_id: user.id,
      chain: body.chain,
      from_token_address: body.from_token_address,
      from_token_symbol: body.from_token_symbol ?? null,
      to_token_address: body.to_token_address,
      to_token_symbol: body.to_token_symbol ?? null,
      from_amount: body.from_amount,
      trigger_price_usd: body.trigger_price_usd,
      trigger_direction: body.trigger_direction,
      slippage_bps: body.slippage_bps ?? 100,
      expires_at: body.expires_at ?? null,
      wallet_source: body.wallet_source,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
