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
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { matchSniperEvent } from "@/lib/sniper/matcher";
import type { SniperChain } from "@/lib/sniper/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_MIGRATION_SECRET;
  const auth = req.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (adminSecret && req.headers.get("x-migration-secret") === adminSecret) return true;
  return false;
}

interface ReplayBody {
  detected_token_id?: string;
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

  if (body.detected_token_id) {
    const { data, error } = await getSupabaseAdmin()
      .from("sniper_detected_tokens")
      .select("chain, token_address, token_symbol, from_address, amount_usd, tx_hash")
      .eq("id", body.detected_token_id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Detected token not found" }, { status: 404 });
    }
    const trigger: "whale_buy" | "new_token_launch" = data.from_address
      ? "whale_buy"
      : "new_token_launch";
    const outcome = await matchSniperEvent({
      chain: data.chain as SniperChain,
      trigger,
      tokenAddress: data.token_address,
      tokenSymbol: data.token_symbol,
      txHash: data.tx_hash,
      whaleAddress: trigger === "whale_buy" ? data.from_address : null,
      whaleValueUsd: trigger === "whale_buy" ? data.amount_usd : null,
    });
    return NextResponse.json({ ok: true, source: "detected_token", outcome });
  }

  if (!body.chain || !body.trigger || !body.tokenAddress) {
    return NextResponse.json(
      { error: "Provide detected_token_id OR { chain, trigger, tokenAddress }" },
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
