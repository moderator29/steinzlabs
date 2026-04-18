import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Platform-wide sniper state (enabled/disabled + reason). Unauthenticated
 * because the banner renders before a client has a session loaded.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("platform_sniper_state")
    .select("enabled,disabled_reason,disabled_at")
    .eq("id", 1)
    .single<{ enabled: boolean; disabled_reason: string | null; disabled_at: string | null }>();
  return NextResponse.json(
    data ?? { enabled: true, disabled_reason: null, disabled_at: null },
  );
}
