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

  // Order by least-recently-attempted (logo_resolved_at ASC, never-attempted
  // first) rather than by portfolio value. This backfill re-selects on
  // `logo_url.is.null`, and resolveWhaleLogo can legitimately return a null url
  // (no logo exists) while we still stamp logo_resolved_at below — so those
  // whales stay null-logo and match forever. Ordering by portfolio_value DESC
  // meant the top BATCH by value were re-probed every run while the long tail
  // of null-logo whales (521 of 954 active) was never reached. ASC on
  // logo_resolved_at rotates the whole set through, draining fairly and
  // re-attempting each on a fixed cycle instead of starving the tail.
  const { data: whales } = await admin
    .from("whales")
    .select("address, chain, logo_resolved_at")
    .eq("is_active", true)
    .or(`logo_url.is.null,logo_resolved_at.lt.${cutoffIso}`)
    .order("logo_resolved_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  if (!whales || whales.length === 0) {
    return cronResponse("whale-logo-backfill", startedAt, { refreshed: 0 });
  }

  let refreshed = 0;
  let failed = 0;
  for (const w of whales as Array<{ address: string; chain: string | null }>) {
    try {
      const resolved = await resolveWhaleLogo(w.address, w.chain);
      let updateQuery = admin
        .from("whales")
        .update({
          logo_url: resolved.url,
          logo_source: resolved.source,
          logo_resolved_at: new Date().toISOString(),
        })
        .ilike("address", w.address.toLowerCase());
      // Pin the chain so a row on a sibling chain isn't overwritten.
      if (w.chain) updateQuery = updateQuery.eq("chain", w.chain);
      await updateQuery;
      refreshed++;
    } catch {
      failed++;
    }
  }

  await logCronExecution("whale-logo-backfill", "success", Date.now() - startedAt, undefined, refreshed);
  return cronResponse("whale-logo-backfill", startedAt, { refreshed, failed });
}
