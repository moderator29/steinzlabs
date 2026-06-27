/**
 * Sniper match endpoint — manual replay / admin backfill.
 *
 * The primary low-latency path is /api/webhooks/sniper-detect, which calls
 * matchSniperEvent() directly after recording a detected event. This route
 * exists for two cases the spec calls for:
 *
 *   1. Replaying a sniper_detected_tokens row that arrived before its
 *      criteria existed (race during onboarding) or while the matcher was
 *      down for a deploy.
 *   2. Admin / cron backfill of historical events in the same code path the
 *      webhook uses, so behavior stays identical.
 *
 * Auth: requires the cron / admin secret. Never exposed to end-users.
 */

import { NextRequest, NextResponse } from "next/server";
import { matchSniperEvent } from "@/lib/sniper/matcher";
import type { SniperChain } from "@/lib/sniper/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This route can create sniped_pending events that the money-moving
// auto-execute cron turns into real buys, so it is gated to CRON_SECRET ONLY.
// The ADMIN_MIGRATION_SECRET bypass was removed — a schema-migration secret
// must never be able to inject real-money trade triggers (the auto-execute
// cron already dropped the same bypass for this reason).
function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  return !!cronSecret && auth === `Bearer ${cronSecret}`;
}

interface ReplayBody {
  /** Inline event — bypasses the detected_tokens table. */
  chain?: SniperChain;
  trigger?: "whale_buy" | "new_token_launch";
  tokenAddress?: string;
  tokenSymbol?: string | null;
  txHash?: string | null;
  whaleAddress?: string | null;
  whaleValueUsd?: number | null;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ReplayBody;
  try {
    body = (await req.json()) as ReplayBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // (Removed: the detected_token_id replay branch queried sniper_detected_tokens,
  // a table that does not exist in the live DB, so it always 404'd. Matches are
  // driven by the inline-event payload below.)

  if (!body.chain || !body.trigger || !body.tokenAddress) {
    return NextResponse.json(
      { error: "Provide { chain, trigger, tokenAddress }" },
      { status: 400 },
    );
  }

  const outcome = await matchSniperEvent({
    chain: body.chain,
    trigger: body.trigger,
    tokenAddress: body.tokenAddress,
    tokenSymbol: body.tokenSymbol ?? null,
    txHash: body.txHash ?? null,
    whaleAddress: body.whaleAddress ?? null,
    whaleValueUsd: body.whaleValueUsd ?? null,
  });
  return NextResponse.json({ ok: true, source: "inline", outcome });
}
