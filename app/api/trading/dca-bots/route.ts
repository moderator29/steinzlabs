import { NextRequest, NextResponse } from "next/server";
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

  const { data, error } = await supabase
    .from("dca_bots")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bots: data ?? [] });
}

interface DcaBody {
  chain: string;
  from_token_address: string;
  from_token_symbol?: string;
  to_token_address: string;
  to_token_symbol?: string;
  amount_per_execution: number;
  interval_seconds: number;
  total_executions?: number | null;
  slippage_bps?: number;
  max_price_usd?: number | null;
  min_price_usd?: number | null;
  wallet_source: "external_evm" | "external_solana" | "builtin";
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: DcaBody;
  try {
    body = (await request.json()) as DcaBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!(body.amount_per_execution > 0) || !(body.interval_seconds >= 3600)) {
    return NextResponse.json({ error: "Invalid amount or interval (min 1h)" }, { status: 400 });
  }

  const next = new Date(Date.now() + body.interval_seconds * 1000).toISOString();

  const { data, error } = await supabase
    .from("dca_bots")
    .insert({
      user_id: user.id,
      chain: body.chain,
      from_token_address: body.from_token_address,
      from_token_symbol: body.from_token_symbol ?? null,
      to_token_address: body.to_token_address,
      to_token_symbol: body.to_token_symbol ?? null,
      amount_per_execution: body.amount_per_execution,
      interval_seconds: body.interval_seconds,
      total_executions: body.total_executions ?? null,
      next_execution_at: next,
      slippage_bps: body.slippage_bps ?? 100,
      max_price_usd: body.max_price_usd ?? null,
      min_price_usd: body.min_price_usd ?? null,
      wallet_source: body.wallet_source,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bot: data });
}
