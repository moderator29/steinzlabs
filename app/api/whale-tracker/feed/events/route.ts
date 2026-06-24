import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { checkTierServer } from '@/lib/subscriptions/serverTierCheck';

/**
 * SSE wrapper for the whale-tracker feed. Mirrors the pattern proven on
 * /api/context-feed/events: server-side polls /api/whale-tracker/feed
 * every 5s and emits any new rows (by id) to the client, so the page
 * can replace its 15s setInterval poll with an EventSource subscription.
 *
 * Client pattern:
 *   const es = new EventSource('/api/whale-tracker/feed/events?chain=ethereum&size=50k');
 *   es.addEventListener('rows', (e) => append(JSON.parse(e.data).rows));
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TICK_MS = 5_000;

interface FeedRow {
  id: string;
  [k: string]: unknown;
}

export async function GET(request: NextRequest) {
  // Whale tracker view is a Mini-tier feature (per the pricing page).
  const gate = await checkTierServer('mini');
  if (!gate.allowed) return NextResponse.json({ error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired }, { status: 403 });
  const url = request.nextUrl;
  // Forward every query param the underlying feed endpoint accepts so
  // the SSE stream stays in lock-step with the page filters.
  const upstreamQuery = url.search; // includes the leading '?'
  const origin = new URL(request.url).origin;
  const cookie = request.headers.get('cookie') ?? '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const seen = new Set<string>();
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try { controller.enqueue(encoder.encode(payload)); } catch { closed = true; }
      };

      send('hello', { ts: Date.now() });

      const tick = async () => {
        if (closed) return;
        try {
          const res = await fetch(`${origin}/api/whale-tracker/feed${upstreamQuery}`, {
            headers: { cookie },
            cache: 'no-store',
          });
          if (!res.ok) {
            send('error', { status: res.status });
            return;
          }
          const json = await res.json() as { rows?: FeedRow[] };
          const fresh: FeedRow[] = [];
          for (const r of json.rows ?? []) {
            if (r.id && !seen.has(r.id)) {
              seen.add(r.id);
              fresh.push(r);
            }
          }
          if (fresh.length > 0) send('rows', { rows: fresh });
        } catch (err) {
          send('error', { message: err instanceof Error ? err.message : String(err) });
        }
      };

      await tick();
      const interval = setInterval(() => { void tick(); }, TICK_MS);
      const heartbeat = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`: hb ${Date.now()}\n\n`)); } catch { closed = true; }
      }, 30_000);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}
