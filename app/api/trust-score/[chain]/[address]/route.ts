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

// EVM addresses are case-insensitive; Solana base58 IS case-sensitive.
// Lowercasing a Solana mint produces a different valid-looking address that
// won't resolve on-chain — so normalize only for EVM.
const EVM_CHAINS = new Set([
  "ethereum", "bsc", "base", "arbitrum", "optimism", "polygon", "avalanche",
]);
function normalizeAddress(chain: string, address: string): string {
  return EVM_CHAINS.has(chain.toLowerCase()) ? address.toLowerCase() : address;
}

interface CtxParams {
  params: Promise<{ chain: string; address: string }>;
}

export async function GET(req: NextRequest, ctx: CtxParams) {
  const { chain, address } = await ctx.params;
  if (!chain || !address) {
    return NextResponse.json({ error: "chain and address required" }, { status: 400 });
  }
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  // ?refresh=1 forces a recompute that calls GoPlus + DexScreener — gate
  // it behind the cron / admin secret so a public attacker can't burn
  // paid quota by spamming refreshes.
  if (force) {
    const cronOk = req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
    const adminOk = req.headers.get("x-migration-secret") === process.env.ADMIN_MIGRATION_SECRET;
    if (!cronOk && !adminOk) {
      return NextResponse.json({ error: "refresh requires admin secret" }, { status: 403 });
    }
  }
  const admin = getSupabaseAdmin();
  const addrNormalized = normalizeAddress(chain, address);

  if (!force) {
    const { data: cached } = await admin
      .from("naka_trust_scores")
      .select("*")
      .eq("token_address", addrNormalized)
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
      return NextResponse.json(
        {
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
        },
        { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
      );
    }
  }

  const result = await calculateTrustScore({ chain, tokenAddress: address });

  // The unique constraint backing this upsert is created in the migration as
  // a plain (token_address, chain) pair so Postgrest's onConflict matches.
  await admin.from("naka_trust_scores").upsert(
    {
      token_address: addrNormalized,
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

  return NextResponse.json(
    { cached: false, ...result },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
