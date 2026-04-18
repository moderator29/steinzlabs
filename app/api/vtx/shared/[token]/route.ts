import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("vtx_shared_conversations")
    .select("snapshot, view_count, expires_at, created_at")
    .eq("share_token", token)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  // Increment view count (non-blocking)
  void supabase
    .from("vtx_shared_conversations")
    .update({ view_count: (data.view_count ?? 0) + 1 })
    .eq("share_token", token);

  return NextResponse.json({
    snapshot: data.snapshot,
    views: data.view_count ?? 0,
    created_at: data.created_at,
  });
}
