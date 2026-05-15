import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Bubble-map agent — Phase C.
 *
 * Replaces the generic /api/vtx-ai call the bubble-map page was making
 * for in-page Q&A. This route:
 *   1. Carries a domain-specific system prompt (cluster analysis,
 *      holder concentration, rug patterns, dev-wallet detection).
 *   2. Persists the conversation to bubblemap_conversations so a
 *      returning user can reopen the same token and pick up where
 *      they left off.
 *   3. Reads context (top holders, risk, total holders, etc) from the
 *      structured payload the page already builds so Claude doesn't
 *      have to infer it from prose.
 */

interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface AgentContext {
  tokenName?: string;
  tokenSymbol?: string;
  chain?: string;
  tokenAddress?: string;
  priceUsd?: number;
  marketCap?: number;
  topHolderConcentration?: number;
  totalHolders?: number;
  riskLevel?: string;
  topHolders?: Array<{ address: string; label?: string | null; percent: number; type?: string }>;
}

interface RequestBody {
  message: string;
  history?: AgentMessage[];
  context?: AgentContext;
}

const SYSTEM_PROMPT = `You are the Naka Labs Bubble Map Agent. You help users interpret on-chain holder distributions, cluster patterns, and rug-pull risk indicators visible on the bubble map.

Speak in 2-4 sentence answers unless the user asks for depth. Use specific numbers from the provided context. When a user asks "is this safe?" weigh:
- Top-1 holder >= 20% = high concentration risk
- Top-10 holders >= 50% = coordinated dump risk
- Holders < 100 = low distribution, manipulator-friendly
- Verified entity labels (CEX / known MM) on the top wallets = safer

Identify dev-wallet patterns when present: cluster of wallets funded by the same source, all created in the same day, all holding similar amounts. Surface them by name when the context includes labelled top holders.

Refuse to make price predictions; refuse financial advice. Be honest when the bubble map data is missing or sparse.`;

async function getUser() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

function summarizeContext(ctx: AgentContext | undefined): string {
  if (!ctx) return 'No bubble map loaded.';
  const lines: string[] = ['[BUBBLE MAP CONTEXT]'];
  if (ctx.tokenName) {
    lines.push(`Token: ${ctx.tokenName}${ctx.tokenSymbol ? ` (${ctx.tokenSymbol})` : ''}`);
  }
  if (ctx.chain) lines.push(`Chain: ${ctx.chain}`);
  if (ctx.tokenAddress) lines.push(`Address: ${ctx.tokenAddress}`);
  if (typeof ctx.priceUsd === 'number') lines.push(`Price: $${ctx.priceUsd}`);
  if (typeof ctx.marketCap === 'number') lines.push(`Market cap: $${ctx.marketCap.toLocaleString()}`);
  if (typeof ctx.totalHolders === 'number') lines.push(`Total holders: ${ctx.totalHolders.toLocaleString()}`);
  if (typeof ctx.topHolderConcentration === 'number') {
    lines.push(`Top-10 concentration: ${ctx.topHolderConcentration.toFixed(1)}%`);
  }
  if (ctx.riskLevel) lines.push(`Risk verdict: ${ctx.riskLevel}`);
  if (ctx.topHolders && ctx.topHolders.length > 0) {
    lines.push('Top holders:');
    for (const h of ctx.topHolders.slice(0, 10)) {
      const tag = h.label ? ` [${h.label}]` : h.type ? ` (${h.type})` : '';
      lines.push(`  ${h.percent.toFixed(2)}% — ${h.address.slice(0, 10)}…${h.address.slice(-6)}${tag}`);
    }
  }
  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Agent not configured (missing ANTHROPIC_API_KEY).' }, { status: 503 });
    }

    const user = await getUser();
    const ctxText = summarizeContext(body.context);
    const history = (body.history ?? []).slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: `${SYSTEM_PROMPT}\n\n${ctxText}`,
      messages: [
        ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: body.message },
      ],
    });

    const reply = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    // Persist conversation when authenticated. Best-effort; agent
    // reply is returned regardless so a logged-out user still gets
    // value.
    if (user && body.context?.tokenAddress) {
      try {
        const admin = getSupabaseAdmin();
        const nextMessages = [
          ...(body.history ?? []),
          { role: 'user', content: body.message, timestamp: Date.now() },
          { role: 'assistant', content: reply, timestamp: Date.now() },
        ].slice(-30);
        await admin.from('bubblemap_conversations').upsert({
          user_id: user.id,
          token_address: body.context.tokenAddress.toLowerCase(),
          chain: body.context.chain ?? 'ethereum',
          messages: nextMessages,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,token_address,chain' });
      } catch (err) {
        console.warn('[bubblemap-agent] persist failed (non-fatal):', err);
      }
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[bubblemap-agent]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Agent failed' }, { status: 500 });
  }
}
