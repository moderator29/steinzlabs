import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { guardRoute } from '@/lib/api/guardRoute';
import { CAPABILITY_SCHEMA, runCapability, type CapabilityInput } from '@/lib/askChain/capabilities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ask the Chain — natural language → live on-chain answer.
// Claude picks ONE capability + typed params (never raw SQL); the server runs
// the parameterized query over allowlisted public tables; Claude then narrates
// the real rows. Auth + rate-limit gated to protect the Anthropic budget.

const MODEL = 'claude-sonnet-5';

export async function POST(req: NextRequest) {
  // Full LLM tool loop — auth required, medium rate limit.
  const guard = await guardRoute(req, { rate: 'med', allowAnon: false });
  if (!guard.ok) return guard.response;

  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const question = (body.question || '').trim().slice(0, 400);
  if (!question) return NextResponse.json({ error: 'Ask a question' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI is not configured' }, { status: 503 });
  const client = new Anthropic({ apiKey });

  try {
    // 1) Map NL → structured capability (forced tool use).
    const plan = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system:
        'You are Ask the Chain, Naka Labs\' on-chain query router. Map the user\'s question to exactly one capability and fill its parameters. Only use the query_onchain tool. If the question cannot be answered by any capability, still pick the closest one. Never invent data.',
      tools: [{
        name: 'query_onchain',
        description: 'Query live Naka Labs on-chain data (whales, whale activity, smart-money convergence, token risk).',
        input_schema: CAPABILITY_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      }],
      tool_choice: { type: 'tool', name: 'query_onchain' },
      messages: [{ role: 'user', content: question }],
    });

    const toolUse = plan.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
    if (!toolUse) {
      return NextResponse.json({ answer: 'I could not turn that into an on-chain query. Try asking about whales, convergence, or a token.', rows: [], columns: [] });
    }
    const input = toolUse.input as CapabilityInput;
    const result = await runCapability(input);

    // 2) Narrate the REAL rows (no fabrication — Claude only sees the returned data).
    const dataForModel = JSON.stringify({ capability: result.capability, columns: result.columns, rows: result.rows.slice(0, 25) });
    const narration = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system:
        'You are VTX, Naka Labs\' on-chain analyst. Answer the user\'s question using ONLY the JSON rows provided — never invent numbers, wallets, or tokens. Be concise (2-4 sentences), specific, and reference the actual values. If rows is empty, say so plainly and suggest a nearby question. No markdown headers, no financial advice.',
      messages: [{
        role: 'user',
        content: `Question: ${question}\n\nContext hint: ${result.summaryHint}\n\nData:\n${dataForModel}`,
      }],
    });
    const answerBlock = narration.content.find((b) => b.type === 'text') as Anthropic.TextBlock | undefined;

    return NextResponse.json({
      answer: (answerBlock?.text ?? '').trim() || result.summaryHint,
      capability: result.capability,
      columns: result.columns,
      rows: result.rows,
    });
  } catch (err) {
    console.error('[ask-chain]', err);
    return NextResponse.json({ error: 'Ask the Chain is unavailable right now.' }, { status: 502 });
  }
}
