import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

const TIER_THRESHOLDS: Array<{ tier: "scout" | "analyst" | "detective" | "officer"; min: number }> = [
  { tier: "officer", min: 1000 },
  { tier: "detective", min: 250 },
  { tier: "analyst", min: 50 },
  { tier: "scout", min: 0 },
];

function tierFor(points: number) {
  return TIER_THRESHOLDS.find((t) => points >= t.min)?.tier ?? "scout";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vote } = (await request.json()) as { vote: 1 | -1 };
  if (vote !== 1 && vote !== -1) return NextResponse.json({ error: "Invalid vote" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error: voteErr } = await admin.from("cluster_label_votes").upsert(
    { label_id: id, user_id: user.id, vote },
    { onConflict: "label_id,user_id" },
  );
  if (voteErr) return NextResponse.json({ error: voteErr.message }, { status: 500 });

  // Recompute totals
  const { data: up } = await admin.from("cluster_label_votes").select("label_id", { count: "exact", head: true }).eq("label_id", id).eq("vote", 1);
  const { data: down } = await admin.from("cluster_label_votes").select("label_id", { count: "exact", head: true }).eq("label_id", id).eq("vote", -1);
  const upvotes = (up as unknown as { count: number })?.count ?? 0;
  const downvotes = (down as unknown as { count: number })?.count ?? 0;

  const status = upvotes >= 5 && upvotes - downvotes >= 3 ? "approved" : upvotes - downvotes <= -3 ? "rejected" : "pending";
  const { data: label } = await admin
    .from("cluster_labels")
    .update({ upvotes, downvotes, status })
    .eq("id", id)
    .select("submitted_by, status")
    .single();

  // Award reputation on first approval
  if (label?.status === "approved" && label.submitted_by) {
    const { data: rep } = await admin.from("user_reputation").select("*").eq("user_id", label.submitted_by).maybeSingle();
    const nextPoints = (rep?.points ?? 0) + 10;
    const nextApproved = (rep?.approved_labels ?? 0) + 1;
    await admin.from("user_reputation").upsert(
      {
        user_id: label.submitted_by,
        points: nextPoints,
        approved_labels: nextApproved,
        tier: tierFor(nextPoints),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  return NextResponse.json({ ok: true, upvotes, downvotes, status });
}
