import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { priceActivityUsd } from "@/lib/whales/priceActivity";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "whale-activity-price";

/**
 * Backfills whale_activity.value_usd for rows the ingest path left unpriced
 * (webhooks insert 0, the poll cron inserts null). The whale feed filters
 * value_usd >= minUsd, so without this the feed is empty. Runs frequently and
 * prices the newest unpriced rows each pass.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let scanned = 0;
  let priced = 0;

  try {
    const sb = getSupabaseAdmin();
    const { data: rows, error } = await sb
      .from("whale_activity")
      .select("id, chain, token_address, token_symbol, amount")
      .or("value_usd.is.null,value_usd.eq.0")
      .order("timestamp", { ascending: false })
      .limit(200);
    if (error) {
      Sentry.captureException(error, { tags: { cron: NAME } });
      await logCronExecution(NAME, "failed", Date.now() - startedAt, error.message, 0);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    scanned = rows?.length ?? 0;
    for (const r of (rows ?? []) as Array<{
      id: string;
      chain: string;
      token_address: string | null;
      token_symbol: string | null;
      amount: number | null;
    }>) {
      const value = await priceActivityUsd({
        chain: r.chain,
        token_address: r.token_address,
        token_symbol: r.token_symbol,
        amount: r.amount,
      });
      if (value != null && value > 0) {
        const { error: upErr } = await sb
          .from("whale_activity")
          .update({ value_usd: value })
          .eq("id", r.id);
        if (!upErr) priced++;
      }
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, priced);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, scanned, priced });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
