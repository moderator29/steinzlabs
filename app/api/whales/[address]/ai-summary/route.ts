/**
 * §2.9: Whale AI Analysis — generates a risk/style/performance summary
 * using Claude. Cached 24h per whale (address+chain key) so a single
 * whale doesn't rack up API calls when 20 users view it.
 *
 * Response shape:
 *   {
 *     cached: boolean,
 *     rating_30d: number (0-10),
 *     rating_10d: number (0-10),
 *     sentiment: 'bullish' | 'bearish' | 'neutral',
 *     style: string,               // one-liner trading style
 *     summary: string,             // 2-3 sentence narrative
 *     generatedAt: ISO timestamp
 *   }
 *
 * Gated: Pro+ only (consistent with whale-tracker feature gating).
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SummaryResult {
  cached: boolean;
  rating_30d: number;
  rating_10d: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  style: string;
  summary: string;
  recommended_copy_mode: 'alerts_only' | 'oneclick' | 'auto_copy' | null;
  generatedAt: string;
}

interface RouteCtx { params: Promise<{ address: string }> }

async function handler(req: NextRequest, ctx: RouteCtx) {
  const { address } = await ctx.params;
  const chain = req.nextUrl.searchParams.get('chain') || '';
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Check cache first. Stored in whale_ai_summaries keyed (address, chain).
  // 24h TTL. Non-existent table? Bail gracefully and generate fresh.
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: cached } = await supabase
    .from('whale_ai_summaries')
    .select('*')
    .eq('whale_address', address.toLowerCase())
    .eq('chain', chain)
    .gte('generated_at', cutoff)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      cached: true,
      rating_30d: cached.rating_30d,
      rating_10d: cached.rating_10d,
      sentiment: cached.sentiment,
      style: cached.style,
      summary: cached.summary,
      recommended_copy_mode: (cached as { recommended_copy_mode?: SummaryResult['recommended_copy_mode'] })
        .recommended_copy_mode ?? null,
      generatedAt: cached.generated_at,
    } satisfies SummaryResult);
  }

  // Pull the whale record so we can feed real numbers into the prompt.
  const { data: whale } = await supabase
    .from('whales')
    .select('label, entity_type, portfolio_value_usd, pnl_30d_usd, pnl_7d_usd, win_rate, trade_count_30d, whale_score')
    .eq('address', address.toLowerCase())
    .eq('chain', chain)
    .maybeSingle();

  if (!whale) {
    return NextResponse.json({ error: 'Whale not found in database' }, { status: 404 });
  }

  // Also pull last 20 activity rows for trading-pattern context
  const { data: activity } = await supabase
    .from('whale_activity')
    .select('action, token_symbol, value_usd, timestamp')
    .eq('whale_address', address.toLowerCase())
    .eq('chain', chain)
    .order('timestamp', { ascending: false })
    .limit(20);

  const prompt = buildPrompt(address, chain, whale, activity ?? []);

  let rawText: string;
  try {
    rawText = await vtxAnalyze(prompt, 500);
  } catch (err: any) {
    return NextResponse.json(
      { error: `AI generation failed: ${err?.message ?? 'unknown'}` },
      { status: 502 },
    );
  }

  const parsed = parseResponse(rawText);
  if (!parsed) {
    return NextResponse.json(
      { error: 'AI returned malformed response', raw: rawText },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();

  // Persist to cache. Upsert on (whale_address, chain). Non-fatal if the
  // table doesn't exist yet — return fresh result anyway.
  await supabase.from('whale_ai_summaries').upsert({
    whale_address: address.toLowerCase(),
    chain,
    rating_30d: parsed.rating_30d,
    rating_10d: parsed.rating_10d,
    sentiment: parsed.sentiment,
    style: parsed.style,
    summary: parsed.summary,
    recommended_copy_mode: parsed.recommended_copy_mode,
    generated_at: now,
  }, { onConflict: 'whale_address,chain' });

  return NextResponse.json({
    cached: false,
    ...parsed,
    generatedAt: now,
  } satisfies SummaryResult);
}

export const GET = withTierGate('pro', handler);

function buildPrompt(
  address: string,
  chain: string,
  whale: any,
  activity: any[],
): string {
  const activityLines = activity.slice(0, 10).map((a) =>
    `  - ${new Date(a.timestamp).toISOString().slice(0, 10)} · ${a.action} ${a.token_symbol ?? '?'} · $${Math.round(a.value_usd ?? 0).toLocaleString()}`,
  ).join('\n') || '  (no recent activity indexed)';

  return `You are analyzing an on-chain whale wallet. Produce a risk + performance summary as strict JSON.

Wallet: ${address} on ${chain}
Label: ${whale.label ?? 'unlabeled'}
Entity type: ${whale.entity_type ?? 'unknown'}
Portfolio USD: ${whale.portfolio_value_usd ?? 'unknown'}
30d PnL USD: ${whale.pnl_30d_usd ?? 'unknown'}
7d PnL USD: ${whale.pnl_7d_usd ?? 'unknown'}
Win rate (30d): ${whale.win_rate !== null ? (whale.win_rate * 100).toFixed(0) + '%' : 'insufficient data'}
Trades (30d): ${whale.trade_count_30d ?? 'unknown'}
Whale score: ${whale.whale_score ?? 50}/100

Recent activity:
${activityLines}

Return ONLY a JSON object, no prose before or after, with these exact keys:
{
  "rating_30d": <integer 0-10>,
  "rating_10d": <integer 0-10>,
  "sentiment": "bullish" | "bearish" | "neutral",
  "style": "<one-line trading style, e.g. 'Aggressive L1 accumulator' or 'Passive long-term holder'>",
  "summary": "<2-3 sentences covering (a) strategy pattern, (b) recent performance, (c) notable risks>",
  "recommended_copy_mode": "alerts_only" | "oneclick" | "auto_copy"
}

Base your ratings on: PnL sign and magnitude, win rate, portfolio size, and activity consistency.
For recommended_copy_mode: pick "alerts_only" if the trader is volatile / unpredictable / has thin data; "oneclick" if their pattern is consistent enough that a user should at least see every move; "auto_copy" only if performance is strong, win rate is high, and trade cadence is reasonable. If data is sparse, prefer "alerts_only" and mention uncertainty in the summary.`;
}

function parseResponse(raw: string): {
  rating_30d: number;
  rating_10d: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  style: string;
  summary: string;
  recommended_copy_mode: SummaryResult['recommended_copy_mode'];
} | null {
  // Strip markdown fences Claude sometimes adds even when told not to.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const r30 = Math.max(0, Math.min(10, Math.round(parsed.rating_30d)));
    const r10 = Math.max(0, Math.min(10, Math.round(parsed.rating_10d)));
    const sentiment = ['bullish', 'bearish', 'neutral'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral';
    const style = typeof parsed.style === 'string' ? parsed.style.slice(0, 120) : 'Unknown';
    const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 600) : '';
    const mode = ['alerts_only', 'oneclick', 'auto_copy'].includes(parsed.recommended_copy_mode)
      ? (parsed.recommended_copy_mode as SummaryResult['recommended_copy_mode'])
      : null;
    if (!summary) return null;
    return { rating_30d: r30, rating_10d: r10, sentiment, style, summary, recommended_copy_mode: mode };
  } catch {
    return null;
  }
}
