/**
 * GET /api/trust-score/[chain]/[address]?refresh=1
 *
 * Returns the §7 Naka Trust Score for a token. 1-hour cache in
 * naka_trust_scores; ?refresh=1 forces recomputation. Public endpoint —
 * the score is meant to be visible everywhere (TokenCard, swap card,
 * sniper, etc.).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { bandFor, calculateTrustScore } from "@/lib/trust/calculate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CtxParams {
  params: Promise<{ chain: string; address: string }>;
}

export async function GET(req: NextRequest, ctx: CtxParams) {
  const { chain, address } = await ctx.params;
  if (!chain || !address) {
    return NextResponse.json({ error: "chain and address required" }, { status: 400 });
  }
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const admin = getSupabaseAdmin();
  const addrLower = address.toLowerCase();

  if (!force) {
    const { data: cached } = await admin
      .from("naka_trust_scores")
      .select("*")
      .ilike("token_address", addrLower)
      .eq("chain", chain)
      .maybeSingle<{
        score: number;
        layer_security: number;
        layer_liquidity: number;
        layer_holders: number;
        layer_market: number;
        layer_social: number;
        details: Record<string, unknown>;
        computed_at: string;
      }>();
    if (cached && Date.now() - new Date(cached.computed_at).getTime() < CACHE_TTL_MS) {
      const band = bandFor(cached.score);
      return NextResponse.json({
        cached: true,
        score: cached.score,
        band: band.band,
        bandLabel: band.label,
        bandColor: band.color,
        layers: {
          security: cached.layer_security,
          liquidity: cached.layer_liquidity,
          holders: cached.layer_holders,
          market: cached.layer_market,
          social: cached.layer_social,
        },
        details: cached.details,
        computedAt: cached.computed_at,
      });
    }
  }

  const result = await calculateTrustScore({ chain, tokenAddress: address });

  await admin.from("naka_trust_scores").upsert(
    {
      token_address: addrLower,
      chain,
      score: result.score,
      layer_security: result.layers.security,
      layer_liquidity: result.layers.liquidity,
      layer_holders: result.layers.holders,
      layer_market: result.layers.market,
      layer_social: result.layers.social,
      details: result.details,
      computed_at: result.computedAt,
    },
    { onConflict: "token_address,chain" },
  );

  return NextResponse.json({ cached: false, ...result });
}
