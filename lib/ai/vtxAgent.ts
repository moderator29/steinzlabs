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
    const response = await vtxQuery({ messages: loopMessages, system });

    if (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      const toolBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      const results = await Promise.all(
        toolBlocks.map(async (b) => {
          toolsUsed.push(b.name);
          const content = await onToolCall(b.name, b.input as Record<string, unknown>);
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
          const stream = vtxStreamRaw({ messages: loopMessages, system });
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(event.delta.text);
            }
          }
          const finalMsg: Anthropic.Message = await stream.finalMessage();
          if (finalMsg.stop_reason === 'tool_use' && iterations < maxIterations) {
            const toolBlocks = finalMsg.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            );
            const results = await Promise.all(
              toolBlocks.map(async (b) => ({
                type: 'tool_result' as const,
                tool_use_id: b.id,
                content: await onToolCall(b.name, b.input as Record<string, unknown>),
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
