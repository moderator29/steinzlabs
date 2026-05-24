import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * CF1: Server-Sent Events stream for the Context Feed. Replaces the
 * client's 20s polling loop with a server-side poll (every 5s) that
 * pushes deltas. Multiple connected clients share one upstream tick.
 *
 * Client pattern:
 *   const es = new EventSource('/api/context-feed/events?chain=ethereum');
 *   es.addEventListener('events', (e) => append(JSON.parse(e.data)));
 *
 * Cards are pulled from the same /api/context-feed endpoint server-side
 * so we don't duplicate the dedup + filter + score logic. Each tick we
 * fetch the latest page and emit any rows whose id we haven't already
 * sent on this connection.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;             // 5 minutes per stream, then client reconnects

const TICK_MS = 5_000;

interface FeedEvent {
  id: string;
  [k: string]: unknown;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const chain = url.searchParams.get('chain') ?? 'all';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50'), 1), 200);
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

      // Initial hello — lets the client confirm the connection is hot.
      send('hello', { ts: Date.now(), chain, limit });

      const tick = async () => {
        if (closed) return;
        try {
          const res = await fetch(`${origin}/api/context-feed?chain=${encodeURIComponent(chain)}&limit=${limit}`, {
            // Forward the auth cookie so the personalised filter + muted
            // sources apply to the SSE stream too.
            headers: { cookie },
            cache: 'no-store',
          });
          if (!res.ok) {
            send('error', { status: res.status });
            return;
          }
          const json = await res.json() as { events?: FeedEvent[] };
          const fresh: FeedEvent[] = [];
          for (const e of json.events ?? []) {
            if (e.id && !seen.has(e.id)) {
              seen.add(e.id);
              fresh.push(e);
            }
          }
          if (fresh.length > 0) send('events', { events: fresh });
        } catch (err) {
          send('error', { message: err instanceof Error ? err.message : String(err) });
        }
      };

      // Fire-and-loop. AbortSignal isn't directly exposed to the route
      // handler in node-runtime SSE, but ReadableStream's cancel callback
      // sets `closed` for us when the client disconnects.
      await tick();
      const interval = setInterval(() => { void tick(); }, TICK_MS);
      // Heartbeat comment line every 30s so intermediate proxies (Vercel
      // edge, browsers behind nginx) don't kill the idle connection.
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
