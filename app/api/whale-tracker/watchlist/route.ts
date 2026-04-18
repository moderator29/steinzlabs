import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whale watchlist CRUD, backed by user_whale_follows. Pro+ gated.
 * Extras over /api/whales/follow: alert_threshold_usd per row, inline
 * label edit, min-size threshold used by the notifications pipeline.
 */

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

interface WatchlistBody {
  whale_address: string;
  chain: string;
  label?: string | null;
  alert_enabled?: boolean;
  alert_threshold_usd?: number;
  channels?: Array<"push" | "telegram" | "email">;
}

export const GET = withTierGate("pro", async (_request: NextRequest) => {
  const sb = await getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb
    .from("user_whale_follows")
    .select(
      "whale_address,chain,label,copy_mode,alert_enabled,alert_threshold_usd,alert_channels,created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlist: data ?? [] });
});

export const POST = withTierGate("pro", async (request: NextRequest) => {
  const sb = await getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as WatchlistBody;
  if (!body.whale_address || !body.chain) {
    return NextResponse.json({ error: "whale_address + chain required" }, { status: 400 });
  }

  // Basic format validation.
  const a = body.whale_address.trim();
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(a);
  const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  if (!isEvm && !isSol) {
    return NextResponse.json({ error: "invalid address format" }, { status: 400 });
  }

  const { error } = await sb.from("user_whale_follows").upsert(
    {
      user_id: user.id,
      whale_address: a,
      chain: body.chain,
      label: body.label ?? null,
      alert_enabled: body.alert_enabled ?? true,
      alert_threshold_usd: body.alert_threshold_usd ?? 50000,
      alert_channels: body.channels ?? ["push"],
      copy_mode: "alerts",
    },
    { onConflict: "user_id,whale_address,chain" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

export const PATCH = withTierGate("pro", async (request: NextRequest) => {
  const sb = await getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as WatchlistBody;
  if (!body.whale_address || !body.chain) {
    return NextResponse.json({ error: "whale_address + chain required" }, { status: 400 });
  }
  const update: Record<string, unknown> = {};
  if (body.label !== undefined) update.label = body.label;
  if (body.alert_enabled !== undefined) update.alert_enabled = body.alert_enabled;
  if (body.alert_threshold_usd !== undefined) update.alert_threshold_usd = body.alert_threshold_usd;
  if (body.channels !== undefined) update.alert_channels = body.channels;

  const { error } = await sb
    .from("user_whale_follows")
    .update(update)
    .eq("user_id", user.id)
    .eq("whale_address", body.whale_address)
    .eq("chain", body.chain);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

export const DELETE = withTierGate("pro", async (request: NextRequest) => {
  const sb = await getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const address = request.nextUrl.searchParams.get("whale_address");
  const chain = request.nextUrl.searchParams.get("chain");
  if (!address || !chain) {
    return NextResponse.json({ error: "whale_address + chain required" }, { status: 400 });
  }
  const { error } = await sb
    .from("user_whale_follows")
    .delete()
    .eq("user_id", user.id)
    .eq("whale_address", address)
    .eq("chain", chain);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
