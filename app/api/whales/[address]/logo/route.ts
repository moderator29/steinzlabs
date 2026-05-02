/**
 * GET /api/whales/[address]/logo?chain=...&refresh=1
 *
 * Returns the resolved logo for a tracked whale and caches it on the
 * whales row (logo_url / logo_source / logo_resolved_at). Refresh forces
 * a re-pull from Arkham/ENS even if the cached row is fresh.
 *
 * Public endpoint: logos are not sensitive, and the whale-tracker UI
 * needs them on every list render. No tier gate.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveWhaleLogo } from "@/lib/whales/logo";
import { normalizeAddress, isEvmChain } from "@/lib/utils/addressNormalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRESH_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address } = await ctx.params;
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  const url = req.nextUrl;
  const chain = url.searchParams.get("chain");
  const force = url.searchParams.get("refresh") === "1";

  // chain is now required — without it, both the cache lookup and the
  // update silently match all whales sharing this address across chains,
  // which silently clobbers logos on other rows. Better to 400 than to
  // corrupt data on first call.
  if (!chain) {
    return NextResponse.json({ error: "chain query param required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  // §13 audit fix: chain-aware normalization. Solana mints are
  // case-sensitive base58 — lowercasing produces an unrelated address
  // that won't match anything. EVM stays lowercase as before.
  const addrKey = normalizeAddress(chain, address);

  // For EVM use .ilike() (checksum/casing tolerant); for Solana .eq()
  // (any case mutation = wrong wallet).
  const useIlike = isEvmChain(chain);

  // Whale rows are unique per (address, chain) — pinning the chain to the
  // query stops a write from clobbering the same address on a different
  // chain when both happen to be tracked.
  if (!force) {
    let cacheQuery = admin
      .from("whales")
      .select("logo_url, logo_source, logo_resolved_at")
      .eq("chain", chain);
    cacheQuery = useIlike ? cacheQuery.ilike("address", addrKey) : cacheQuery.eq("address", addrKey);
    const { data } = await cacheQuery.maybeSingle<{
      logo_url: string | null;
      logo_source: string | null;
      logo_resolved_at: string | null;
    }>();
    if (data?.logo_url && data.logo_resolved_at) {
      const age = Date.now() - new Date(data.logo_resolved_at).getTime();
      if (age < FRESH_TTL_MS) {
        return NextResponse.json({
          url: data.logo_url,
          source: data.logo_source ?? "unknown",
          cached: true,
        });
      }
    }
  }

  const resolved = await resolveWhaleLogo(address, chain);

  let updateQuery = admin
    .from("whales")
    .update({
      logo_url: resolved.url,
      logo_source: resolved.source,
      logo_resolved_at: new Date().toISOString(),
    })
    .eq("chain", chain);
  updateQuery = useIlike ? updateQuery.ilike("address", addrKey) : updateQuery.eq("address", addrKey);
  await updateQuery;

  return NextResponse.json({ ...resolved, cached: false });
}
