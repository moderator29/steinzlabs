import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheSet } from "@/lib/cache/redis";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "watchlist-refresh";

interface TokenSnapshot {
  price: number;
  change24h: number;
  fetchedAt: number;
}

async function fetchCoingeckoPrice(tokenId: string): Promise<TokenSnapshot | null> {
  try {
    const res = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(tokenId)}&vs_currencies=usd&include_24hr_change=true`,
      { source: "coingecko-simple", timeoutMs: 5000, retries: 2 },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const row = json[tokenId];
    if (!row || typeof row.usd !== "number") return null;
    return { price: row.usd, change24h: row.usd_24h_change ?? 0, fetchedAt: Date.now() };
  } catch {
    return null;
  }
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

    for (const tokenId of uniq) {
      const snap = await fetchCoingeckoPrice(tokenId);
      if (snap) {
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
