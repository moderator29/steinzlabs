import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { priceActivityUsd } from "@/lib/whales/priceActivity";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "whale-activity-price";

// Only backfill rows inside the feed's max visible window. The feed never shows
// activity older than 7d, and pricing an ancient transfer at *today's* token
// price would fabricate a historical USD value that was never real. Rows older
// than this stay null on purpose — they're never displayed, so there's nothing
// to fabricate. Slight margin (8d) over the 7d feed window for clock skew.
const BACKFILL_WINDOW_HOURS = 24 * 8;

/**
 * Safety-net backfill for whale_activity.value_usd. The poll cron and webhooks
 * now price at ingest, but a transient price-API failure can still leave a
 * recent row unpriced (null) or a webhook can land a 0. The feed filters
 * value_usd >= minUsd, so any unpriced recent row is invisible. This re-prices
 * the newest unpriced rows inside the feed window each pass (ungated — the feed
 * is platform-wide, not follow-scoped). Never touches the historical backlog.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let scanned = 0;
  let priced = 0;

  try {
    const sb = getSupabaseAdmin();

    const sinceIso = new Date(Date.now() - BACKFILL_WINDOW_HOURS * 3600 * 1000).toISOString();
    const { data: rows, error } = await sb
      .from("whale_activity")
      .select("id, chain, token_address, token_symbol, amount")
      .or("value_usd.is.null,value_usd.eq.0")
      .gte("timestamp", sinceIso)
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
