import { NextRequest } from 'next/server';

const STREAM_IDLE_TIMEOUT_MS = parseInt(process.env.CLAUDE_STREAM_IDLE_TIMEOUT_MS ?? '300000', 10);

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // Keep alive every 30s
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('data: {"type":"ping"}\n\n'));
        } catch {
          clearInterval(interval);
        }
      }, 30000);

      // Close the stream after idle timeout to free server resources
      const idleTimer = setTimeout(() => {
        clearInterval(interval);
        try { controller.close(); } catch {}
      }, STREAM_IDLE_TIMEOUT_MS);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearTimeout(idleTimer);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
