import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runAllDetectors, type ActivityRow } from "@/lib/clusters/detection";
import { buildClustersFromActivity } from "@/lib/clusters/orchestrator";

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

    const activity = (rows ?? []) as ActivityRow[];
    const edges = runAllDetectors(activity);

    const chunkSize = 500;
    for (let i = 0; i < edges.length; i += chunkSize) {
      const slice = edges.slice(i, i + chunkSize);
      const { error } = await supabase.from("wallet_edges").upsert(slice, {
        onConflict: "from_address,to_address,chain,edge_type",
      });
      if (!error) edgesWritten += slice.length;
    }

    // §wallet-cluster-unlock — the entire cluster pipeline (union-find,
    // archetype inference, Claude-AI naming, persistence to
    // wallet_clusters + wallet_cluster_members) was already built at
    // lib/clusters/orchestrator.ts but this cron was only writing the
    // edges and never deriving the clusters from them. As a result
    // wallet_clusters / wallet_cluster_members sat at 0 rows even though
    // wallet_edges grew to 27,841 rows. Calling buildClustersFromActivity
    // with persist:true finishes the job.
    let clustersBuilt = 0;
    try {
      const clusters = await buildClustersFromActivity(activity, { minClusterSize: 3, persist: true });
      clustersBuilt = clusters.length;
    } catch (clusterErr) {
      // Cluster derivation is best-effort — don't fail the cron run if
      // it errors out. Edges are already written above.
      Sentry.captureException(clusterErr, { tags: { cron: NAME, phase: "cluster-derivation" } });
    }

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      activityScanned: activity.length,
      edgesDetected: edges.length,
      edgesWritten,
      clustersBuilt,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
