import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { priceActivityUsdBatch } from "@/lib/whales/priceActivity";

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

    // Re-price the newest unpriced rows for the WHOLE directory (ungated — the
    // feed is platform-wide, not follow-scoped) but only inside the feed's
    // visible window, so we never fabricate a historical USD value for an
    // ancient transfer the feed will never show.
    const sinceIso = new Date(Date.now() - BACKFILL_WINDOW_HOURS * 3600 * 1000).toISOString();
    // Batch pricing (GeckoTerminal multi endpoint) is ~30x cheaper per token,
    // so we can scan a much larger slice per pass and actually drain the
    // NULL backlog instead of re-scanning the same newest 200 forever.
    //
    // Order OLDEST-in-window first. The in-window NULL backlog (~1.9k) exceeds
    // this batch, so newest-first would re-scan the same freshest 600 each pass
    // and let rows ranked past the batch age out of the 8d window permanently
    // unpriced — the very starvation this backfill exists to prevent. Fresh
    // rows are already priced at ingest (poll cron + webhooks); the stragglers
    // this safety-net targets are precisely the older-in-window rows about to
    // leave the window, so pricing them first is what actually drains it.
    const { data: rows, error } = await sb
      .from("whale_activity")
      .select("id, chain, token_address, token_symbol, amount")
      .or("value_usd.is.null,value_usd.eq.0")
      .gte("timestamp", sinceIso)
      .order("timestamp", { ascending: true })
      .limit(600);
    if (error) {
      Sentry.captureException(error, { tags: { cron: NAME } });
      await logCronExecution(NAME, "failed", Date.now() - startedAt, error.message, 0);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const list = (rows ?? []) as Array<{
      id: string;
      chain: string;
      token_address: string | null;
      token_symbol: string | null;
      amount: number | null;
    }>;
    scanned = list.length;

    // Price the whole slice in one batch (dedupes per token + bulk GT calls).
    const values = await priceActivityUsdBatch(
      list.map((r) => ({
        chain: r.chain,
        token_address: r.token_address,
        token_symbol: r.token_symbol,
        amount: r.amount,
      })),
    );
    await Promise.all(
      list.map(async (r, i) => {
        const value = values[i];
        if (value == null || value <= 0) return;
        const { error: upErr } = await sb
          .from("whale_activity")
          .update({ value_usd: value })
          .eq("id", r.id);
        if (!upErr) priced++;
      }),
    );

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, priced);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, scanned, priced });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
