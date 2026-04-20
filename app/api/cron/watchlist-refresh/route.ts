import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheSet } from "@/lib/cache/redis";
import { getTokenPriceDetailed } from "@/lib/services/coingecko";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "watchlist-refresh";

interface TokenSnapshot {
  price: number;
  change24h: number;
  fetchedAt: number;
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let refreshed = 0;
  try {
    const supabase = getSupabaseAdmin();
    const { data: rows } = await supabase
      .from("watchlist")
      .select("token_id, chain")
      .limit(2000);
    const uniq = new Set<string>();
    (rows ?? []).forEach((r: { token_id: string; chain: string }) => {
      if (r.chain === "ethereum" || r.chain === "evm" || r.chain === "multi" || !r.chain) {
        uniq.add(r.token_id);
      }
    });

    // Single batched call through the unified service — replaces N individual
    // /simple/price round-trips with one and goes through the shared cache.
    const ids = Array.from(uniq);
    if (ids.length > 0) {
      const prices = await getTokenPriceDetailed(ids).catch(() => ({} as Record<string, { price: number; change24h: number }>));
      for (const tokenId of ids) {
        const row = prices[tokenId];
        if (!row || row.price <= 0) continue;
        const snap: TokenSnapshot = { price: row.price, change24h: row.change24h, fetchedAt: Date.now() };
        await cacheSet(`watchlist:snap:${tokenId}`, snap, 600);
        refreshed++;
      }
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, refreshed);
    return NextResponse.json({ ok: true, durationMs: duration, refreshed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, refreshed);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
