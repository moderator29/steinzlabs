import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "token-popularity-aggregator";

interface WatchlistRow {
  token_id: string;
  chain: string;
  user_id: string;
  created_at: string;
  tier?: string | null;
}

function windowCutoff(label: "24h" | "7d" | "30d"): Date {
  const now = Date.now();
  if (label === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (label === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  return new Date(now - 30 * 24 * 60 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let inserted = 0;
  try {
    const supabase = getSupabaseAdmin();
    const { data: rows } = await supabase
      .from("watchlist")
      .select("token_id, chain, user_id, created_at")
      .limit(20_000);
    const all = (rows ?? []) as WatchlistRow[];

    // Join user tiers in a batch
    const userIds = Array.from(new Set(all.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, tier")
      .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const tierById = new Map<string, string>();
    (profiles ?? []).forEach((p: { id: string; tier: string | null }) => {
      tierById.set(p.id, p.tier ?? "free");
    });

    const windows: Array<"24h" | "7d" | "30d"> = ["24h", "7d", "30d"];
    const capturedAt = new Date().toISOString();

    for (const win of windows) {
      const cutoff = windowCutoff(win);
      const scoped = all.filter((r) => new Date(r.created_at) >= cutoff);
      const buckets = new Map<string, { count: number; watchers: Set<string>; token_id: string; chain: string; tier: string }>();
      for (const r of scoped) {
        const tier = tierById.get(r.user_id) ?? "free";
        const key = `${r.chain}:${r.token_id}:${tier}`;
        const b = buckets.get(key) ?? {
          count: 0,
          watchers: new Set<string>(),
          token_id: r.token_id,
          chain: r.chain,
          tier,
        };
        b.count += 1;
        b.watchers.add(r.user_id);
        buckets.set(key, b);
      }

      const records = Array.from(buckets.values()).map((b) => ({
        token_id: b.token_id,
        chain: b.chain,
        user_tier: b.tier,
        popularity_score: b.count,
        watcher_count: b.watchers.size,
        window_label: win,
        captured_at: capturedAt,
      }));

      if (records.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < records.length; i += chunkSize) {
          const { error } = await supabase
            .from("token_popularity_history")
            .insert(records.slice(i, i + chunkSize));
          if (error) {
            console.error(`[${NAME}] insert chunk failed`, error);
          } else {
            inserted += Math.min(chunkSize, records.length - i);
          }
        }
      }
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: duration, inserted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, inserted);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
