import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Atomic claim before a client broadcasts a pending trade (#11 funds-safety).
 *
 * The auto-sign path (auto_confirm) can otherwise broadcast the same trade
 * twice — the banner's in-memory dedupe ref doesn't survive a remount during
 * the sign window, and two open tabs each have their own ref. A claim flips
 * pending_trades.claimed_at via a conditional UPDATE that only matches if the
 * row is still pending, unexpired, and unclaimed (or its claim is stale). In
 * Postgres the UPDATE re-checks its WHERE after row-locking, so two concurrent
 * claims can't both win — only the first gets a row back; the rest get 409 and
 * must NOT broadcast. A claim older than CLAIM_TTL is reclaimable so a client
 * that died mid-sign doesn't strand the trade forever.
 */
const CLAIM_TTL_MS = 60_000;

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

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nowIso = new Date().toISOString();
  const staleIso = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  // Conditional, user-scoped claim via the admin client (mirrors confirm's
  // write path). user_id is enforced in the WHERE so RLS bypass is safe.
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pending_trades")
    .update({ claimed_at: nowIso })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .or(`claimed_at.is.null,claimed_at.lt.${staleIso}`)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    // Already claimed (another tab/instance is signing), not pending, or
    // expired — the caller must NOT broadcast.
    return NextResponse.json({ ok: false, error: "Trade is already being signed or is no longer available." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
