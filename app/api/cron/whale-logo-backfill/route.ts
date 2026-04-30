/**
 * Weekly cron — refresh logos for active whales whose logo is missing or
 * older than 7 days. Bounded batch (50 per tick) so a single run never
 * blows past Vercel's 300s cap or eats Arkham quota.
 */

import { NextRequest } from "next/server";
import { verifyCron, cronResponse, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveWhaleLogo } from "@/lib/whales/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STALE_AFTER_MS = 7 * 24 * 3600 * 1000;
const BATCH = 50;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  const cutoffIso = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  const { data: whales } = await admin
    .from("whales")
    .select("address, chain, logo_resolved_at")
    .eq("is_active", true)
    .or(`logo_url.is.null,logo_resolved_at.lt.${cutoffIso}`)
    .order("portfolio_value_usd", { ascending: false, nullsFirst: false })
    .limit(BATCH);

  if (!whales || whales.length === 0) {
    return cronResponse("whale-logo-backfill", startedAt, { refreshed: 0 });
  }

  let refreshed = 0;
  let failed = 0;
  for (const w of whales as Array<{ address: string; chain: string | null }>) {
    try {
      const resolved = await resolveWhaleLogo(w.address, w.chain);
      await admin
        .from("whales")
        .update({
          logo_url: resolved.url,
          logo_source: resolved.source,
          logo_resolved_at: new Date().toISOString(),
        })
        .ilike("address", w.address.toLowerCase());
      refreshed++;
    } catch {
      failed++;
    }
  }

  await logCronExecution("whale-logo-backfill", "success", Date.now() - startedAt, undefined, refreshed);
  return cronResponse("whale-logo-backfill", startedAt, { refreshed, failed });
}
