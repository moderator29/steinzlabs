import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { vtxQuery, vtxStream, VTX_TOOLS, VTX_SYSTEM_PROMPT } from '@/lib/services/anthropic';

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

/**
 * Core VTX agent loop — Sonnet executor + Opus advisor.
 * Calls tools up to maxIterations times, then returns final text reply.
 * Pass onToolCall to handle tool execution; otherwise returns stop_reason='tool_use' result.
 */
export async function runVTXAgent(options: AgentRunOptions): Promise<AgentResult> {
  const { messages, system, onToolCall, maxIterations = MAX_TOOL_ITERATIONS } = options;
  const loopMessages = [...messages];
  const toolsUsed: string[] = [];
  let iterations = 0;
  let finalReply = '';

  while (iterations < maxIterations) {
    const response = await vtxQuery({ messages: loopMessages, system });

    if (response.stop_reason === 'tool_use' && onToolCall) {
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
 * No tool loop in streaming mode (streaming with tool_use requires manual SSE stitching).
 */
export async function streamVTXAgent(options: AgentStreamOptions): Promise<ReadableStream<string>> {
  const { messages, system } = options;
  return vtxStream({ messages, system });
}

export { VTX_TOOLS, VTX_SYSTEM_PROMPT };
