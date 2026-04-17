// NOTE: Scheduled via /vercel.json (Vercel Pro plan).
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

export const maxDuration = 30;
export const runtime = "nodejs";

const NAME = "market-stats-snapshot";

interface CgGlobal {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number };
    active_cryptocurrencies: number;
  };
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  try {
    const res = await fetchWithRetry("https://api.coingecko.com/api/v3/global", {
      source: "coingecko-global",
      timeoutMs: 6000,
      retries: 2,
    });
    if (!res.ok) throw new Error(`coingecko global HTTP ${res.status}`);
    const json = (await res.json()) as CgGlobal;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("market_stats_history").insert({
      snapshot_at: new Date().toISOString(),
      total_market_cap: json.data.total_market_cap.usd,
      total_volume: json.data.total_volume.usd,
      btc_dominance: json.data.market_cap_percentage.btc,
      active_chains: 15,
    });
    if (error && !error.message?.includes("duplicate")) throw error;

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, 1);
    return NextResponse.json({ ok: true, durationMs: duration });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, 0);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
