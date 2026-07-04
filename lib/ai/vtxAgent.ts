import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { vtxQuery, vtxStreamRaw, VTX_TOOLS, VTX_SYSTEM_PROMPT } from '@/lib/services/anthropic';
import { executeVTXTool } from '@/lib/ai/vtxToolExecutor';

export const MAX_TOOL_ITERATIONS = 5;

export interface AgentRunOptions {
  messages: Anthropic.MessageParam[];
  system?: string;
  onToolCall?: (name: string, input: Record<string, unknown>) => Promise<string>;
  maxIterations?: number;
  stream?: false;
}

export interface AgentStreamOptions extends Omit<AgentRunOptions, 'stream'> {
  stream: true;
}

export interface AgentResult {
  reply: string;
  toolsUsed: string[];
  iterations: number;
}

// Default tool handler — the shared VTX executor with no authenticated user.
// vtxQuery hands the model the FULL VTX_TOOLS list, so a runner without a
// tool handler dead-ends on the first tool_use turn ("VTX could not generate
// a response"). Every caller gets working read-only tools by default;
// user-scoped tools (prepare_swap, alerts, copy-trade) return an honest
// authentication_required error when no userId-bound handler is supplied.
const defaultToolCall = (name: string, input: Record<string, unknown>): Promise<string> =>
  executeVTXTool(name, input, null);

// Run a single tool call defensively: a tool that throws (or returns a
// non-string) becomes a well-formed error tool_result string instead of
// rejecting Promise.all and killing the whole agent turn.
async function safeToolCall(
  onToolCall: (name: string, input: Record<string, unknown>) => Promise<string>,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  try {
    const out = await onToolCall(name, input);
    return typeof out === 'string' ? out : JSON.stringify(out ?? { ok: false, error: 'tool returned no content' });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'tool execution failed' });
  }
}

/**
 * Core VTX agent loop — Sonnet executor + Opus advisor.
 * Calls tools up to maxIterations times, then returns final text reply.
 * Tools execute through the shared VTX tool executor unless a custom
 * onToolCall is supplied (e.g. to bind an authenticated userId).
 */
export async function runVTXAgent(options: AgentRunOptions): Promise<AgentResult> {
  const { messages, system, onToolCall = defaultToolCall, maxIterations = MAX_TOOL_ITERATIONS } = options;
  const loopMessages = [...messages];
  const toolsUsed: string[] = [];
  let iterations = 0;
  let finalReply = '';

  while (iterations <= maxIterations) {
    // At the cap, force a tools-free turn so the model MUST synthesize a text
    // answer from what it already gathered. Without this, a model that still
    // wanted a tool on the final turn returned a tool_use block with no text
    // and the user got "VTX could not generate a response" (off-by-one).
    const capped = iterations >= maxIterations;
    const response = await vtxQuery({ messages: loopMessages, system, ...(capped ? { tools: [] } : {}) });

    if (!capped && response.stop_reason === 'tool_use') {
      const toolBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      const results = await Promise.all(
        toolBlocks.map(async (b) => {
          toolsUsed.push(b.name);
          const content = await safeToolCall(onToolCall, b.name, b.input as Record<string, unknown>);
          return { type: 'tool_result' as const, tool_use_id: b.id, content };
        })
      );
      loopMessages.push({ role: 'assistant', content: response.content });
      loopMessages.push({ role: 'user', content: results });
      iterations++;
      continue;
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    finalReply = textBlock?.text ?? '';
    break;
  }

  return { reply: finalReply || 'VTX could not generate a response.', toolsUsed, iterations };
}

/**
 * Streaming VTX agent — returns SSE-compatible ReadableStream<string>.
 * Streams text deltas live; when the model calls a tool it finalizes the
 * turn, executes the tool via the shared executor (or the caller-supplied
 * onToolCall), appends the result, and re-opens the stream — up to
 * maxIterations. Previously streaming had no tool loop, so any tool-worthy
 * query streamed zero deltas and ended silently.
 */
export async function streamVTXAgent(options: AgentStreamOptions): Promise<ReadableStream<string>> {
  const { messages, system, onToolCall = defaultToolCall, maxIterations = MAX_TOOL_ITERATIONS } = options;
  const loopMessages = [...messages];

  return new ReadableStream<string>({
    async start(controller) {
      try {
        let iterations = 0;
        while (true) {
          // At the cap, force a tools-free turn so the model synthesizes and
          // streams a final text answer instead of ending silently on an
          // unfulfilled tool_use (off-by-one that dropped the last turn).
          const capped = iterations >= maxIterations;
          const stream = vtxStreamRaw({ messages: loopMessages, system, ...(capped ? { tools: [] } : {}) });
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(event.delta.text);
            }
          }
          const finalMsg: Anthropic.Message = await stream.finalMessage();
          if (!capped && finalMsg.stop_reason === 'tool_use') {
            const toolBlocks = finalMsg.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            );
            const results = await Promise.all(
              toolBlocks.map(async (b) => ({
                type: 'tool_result' as const,
                tool_use_id: b.id,
                content: await safeToolCall(onToolCall, b.name, b.input as Record<string, unknown>),
              }))
            );
            loopMessages.push({ role: 'assistant', content: finalMsg.content });
            loopMessages.push({ role: 'user', content: results });
            iterations++;
            continue;
          }
          break;
        }
        controller.close();
      } catch (err) {
        controller.error(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}

export { VTX_TOOLS, VTX_SYSTEM_PROMPT };
