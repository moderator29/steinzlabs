import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkTierServer } from "@/lib/subscriptions/serverTierCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

export async function GET() {
  // Copy trading is a Pro-tier feature (per the pricing page).
  const gate = await checkTierServer('pro');
  if (!gate.allowed) return NextResponse.json({ error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired }, { status: 403 });
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trades } = await supabase
    .from("user_copy_trades")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const all = trades ?? [];
  const executed = all.filter((t) => t.status === "success");
  const alerts = all.filter((t) => t.status === "alert");
  // Guard/rule blocks are recorded with status 'blocked_rule' / 'blocked_security'
  // (see /api/copy-trading/execute recordBlocked + the status CHECK constraint),
  // not 'failed'/'cancelled'. The old filter matched neither, so the dashboard's
  // "Blocked · security + rule guards" card silently under-counted every trade the
  // caps and GoPlus checks actually stopped. Count the real block statuses.
  const blocked = all.filter(
    (t) =>
      t.status === "blocked_rule" ||
      t.status === "blocked_security" ||
      t.status === "failed" ||
      t.status === "cancelled",
  );
  const totalPnl = executed.reduce(
    (acc: number, t: { pnl_usd: number | null }) => acc + (t.pnl_usd ?? 0),
    0,
  );
  const totalInvested = executed.reduce(
    (acc: number, t: { amount_usd: number | null }) => acc + (t.amount_usd ?? 0),
    0,
  );

  return NextResponse.json({
    trades: all,
    stats: {
      total: all.length,
      executed: executed.length,
      alerts: alerts.length,
      blocked: blocked.length,
      totalInvested,
      totalPnl,
    },
  });
}
