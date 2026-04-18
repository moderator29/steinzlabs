import { NextRequest } from "next/server";
import { verifyCron, cronResponse } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data } = await admin
    .from("pending_trades")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", nowIso)
    .select("id");

  return cronResponse("pending-trades-cleanup", startedAt, { expired: data?.length ?? 0 });
}
