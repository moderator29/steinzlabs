import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runAllDetectors, type ActivityRow } from "@/lib/clusters/detection";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "cluster-analysis";

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let edgesWritten = 0;
  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabase
      .from("whale_activity")
      .select("whale_address, chain, tx_hash, action, token_address, amount, value_usd, counterparty, timestamp, block_number")
      .gt("timestamp", since)
      .order("timestamp", { ascending: false })
      .limit(10_000);

    const edges = runAllDetectors((rows ?? []) as ActivityRow[]);

    const chunkSize = 500;
    for (let i = 0; i < edges.length; i += chunkSize) {
      const slice = edges.slice(i, i + chunkSize);
      const { error } = await supabase.from("wallet_edges").upsert(slice, {
        onConflict: "from_address,to_address,chain,edge_type",
      });
      if (!error) edgesWritten += slice.length;
    }

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      activityScanned: (rows ?? []).length,
      edgesDetected: edges.length,
      edgesWritten,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
