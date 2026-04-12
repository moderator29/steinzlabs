import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runVTXAgent, streamVTXAgent } from '@/lib/ai/vtxAgent';
import { VTX_SYSTEM_PROMPT } from '@/lib/services/anthropic';

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).min(1),
  stream: z.boolean().optional().default(false),
  system: z.string().optional(),
  maxTokens: z.number().int().min(100).max(8192).optional(),
});

/**
 * /api/vtx-ai/chat — lightweight chat endpoint backed by vtxAgent.
 * Supports both streaming (SSE) and non-streaming JSON responses.
 * Used by internal components that need a clean message-array interface
 * without the full slash-command / rate-limit / live-data overhead of /api/vtx-ai.
 */
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, stream, system } = parsed.data;

  // ── Streaming response ──────────────────────────────────────────────────────
  if (stream) {
    try {
      const textStream = await streamVTXAgent({
        stream: true,
        messages,
        system: system ?? VTX_SYSTEM_PROMPT,
      });
      const encoder = new TextEncoder();
      const sse = new ReadableStream({
        async start(controller) {
          const reader = textStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: value })}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(sse, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Stream failed' }, { status: 500 });
    }
  }

  // ── Non-streaming response ──────────────────────────────────────────────────
  try {
    const result = await runVTXAgent({
      messages,
      system: system ?? VTX_SYSTEM_PROMPT,
    });
    return NextResponse.json({ reply: result.reply, toolsUsed: result.toolsUsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
