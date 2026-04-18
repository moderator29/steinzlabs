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

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
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
  await admin
    .from("pending_trades")
    .update({ status: "rejected", failure_reason: "user_rejected" })
    .eq("id", pending.id);

  // Mark source copy_trade as cancelled (other order types remain active for
  // retry; the user explicitly rejected just this one firing).
  if (pending.source_order_table === "user_copy_trades" && pending.source_order_id) {
    await admin
      .from("user_copy_trades")
      .update({ status: "cancelled", failure_reason: "user_rejected" })
      .eq("id", pending.source_order_id);
  }

  return NextResponse.json({ ok: true });
}
