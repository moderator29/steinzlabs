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
import { isEvmChain, isEvmAddress, isSolanaAddress, normalizeAddress } from "@/lib/utils/addressNormalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// A trust score is only meaningful for a real on-chain token. Free-text symbols
// ("USDC", "pepe") never resolve on GoPlus/DexScreener, so every layer degrades
// to neutral and the route would persist a plausible-looking constant ~41
// "Caution" score against a ticker — a fabricated number on a trading surface.
// Reject anything that isn't a well-formed address for the given chain.
function isValidTokenAddress(chain: string, address: string): boolean {
  if (isEvmChain(chain)) return isEvmAddress(address);
  if (chain.toLowerCase() === "solana") return isSolanaAddress(address);
  // Unknown chain: accept only if the input is shaped like a real address.
  return isEvmAddress(address) || isSolanaAddress(address);
}

interface CtxParams {
  params: Promise<{ chain: string; address: string }>;
}

export async function GET(req: NextRequest, ctx: CtxParams) {
  const { chain, address } = await ctx.params;
  if (!chain || !address) {
    return NextResponse.json({ error: "chain and address required" }, { status: 400 });
  }
  if (!isValidTokenAddress(chain, address)) {
    return NextResponse.json(
      { error: "address must be a valid on-chain token address, not a symbol" },
      { status: 400 },
    );
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
  const addrNormalized = normalizeAddress(address, chain);

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
