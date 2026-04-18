import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whale activity SSE stream.
 *
 * Polls whale_activity every 15 seconds for new rows since the last sent
 * `lastTimestamp`. Emits `event: activity` with a JSON payload per row.
 * Supports a `followed` query param (comma-separated whale_addresses) so the
 * client can scope the stream to the user's follows; without it, the stream
 * emits all recent activity above $50K.
 *
 * Why polling behind SSE instead of Redis pub/sub: Supabase's realtime channel
 * on whale_activity is the target, but polling-backed SSE is zero-infra and
 * drop-in upgrades to realtime later without changing the client contract.
 * The client experience is identical (server-pushed events, auto-reconnect).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const followedRaw = sp.get("followed");
  const minUsd = Math.max(0, parseFloat(sp.get("min_usd") ?? "50000"));
  const followed = followedRaw
    ? followedRaw
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean)
    : null;

  const encoder = new TextEncoder();
  const supabase = getSupabaseAdmin();
  let lastTimestamp = new Date().toISOString();
  let stopped = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, payload: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        } catch {
          stopped = true;
        }
      }

      send("hello", { lastTimestamp, min_usd: minUsd, followed_count: followed?.length ?? 0 });

      async function tick() {
        if (stopped) return;
        try {
          let query = supabase
            .from("whale_activity")
            .select("id, whale_address, chain, tx_hash, action, token_symbol, value_usd, counterparty_label, timestamp")
            .gt("timestamp", lastTimestamp)
            .gte("value_usd", minUsd)
            .order("timestamp", { ascending: true })
            .limit(50);
          if (followed && followed.length > 0) query = query.in("whale_address", followed);

          const { data } = await query;
          if (data && data.length > 0) {
            for (const row of data) {
              send("activity", row);
              lastTimestamp = row.timestamp;
            }
          } else {
            send("heartbeat", { ts: Date.now() });
          }
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : "stream error" });
        }
      }

      // First tick immediately, then every 15s
      await tick();
      const interval = setInterval(() => {
        void tick();
      }, 15_000);

      // Auto-close after 10 minutes (client reconnects)
      const lifetime = setTimeout(
        () => {
          stopped = true;
          clearInterval(interval);
          try { controller.close(); } catch { /* already closed */ }
        },
        10 * 60 * 1000,
      );

      request.signal.addEventListener("abort", () => {
        stopped = true;
        clearInterval(interval);
        clearTimeout(lifetime);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      stopped = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
