import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cacheWithFallback } from '@/lib/cache/redis';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "Why Is It Moving?" — Claude explains a market move grounded in REAL on-chain
// supporting signals (smart-money convergence + biggest whale moves on that
// chain), never fabricated. Works for a macro card (chain + metric + change)
// or a specific token. Cached 30m per subject; auth-gated for the LLM budget.
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { chain?: string; metric?: string; label?: string; changePct?: number; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const chain = (body.chain || '').toLowerCase().trim();
  const metric = (body.label || body.metric || 'this metric').trim().slice(0, 60);
  const changePct = typeof body.changePct === 'number' ? body.changePct : null;
  const token = (body.token || '').trim();
  if (!chain && !token) return NextResponse.json({ error: 'chain or token required' }, { status: 400 });

  const cacheKey = `why:${chain}:${metric}:${token}:${changePct != null ? Math.round(changePct) : 'na'}`;
  try {
    const result = await cacheWithFallback(cacheKey, 1800, async () => {
      const sb = getSupabaseAdmin();
      const chainFilter = chain && chain !== 'all chains' && chain !== 'all' ? chain : null;

      // Real supporting signals from the platform's own indexed data.
      let convQ = sb.from('smart_money_convergence')
        .select('token_symbol, wallet_count, total_value_usd, chain')
        .eq('is_active', true)
        .order('wallet_count', { ascending: false })
        .limit(5);
      if (chainFilter) convQ = convQ.eq('chain', chainFilter);
      const { data: conv } = await convQ;

      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      let moveQ = sb.from('whale_activity')
        .select('token_symbol, action, value_usd, chain')
        .gte('timestamp', since)
        .in('action', ['buy', 'swap', 'sell'])
        .order('value_usd', { ascending: false })
        .limit(6);
      if (chainFilter) moveQ = moveQ.eq('chain', chainFilter);
      const { data: moves } = await moveQ;

      const convLines = (conv ?? []).filter((c) => c.token_symbol).map(
        (c) => `${c.token_symbol}: ${c.wallet_count} smart-money wallets, ~$${Math.round(Number(c.total_value_usd ?? 0)).toLocaleString()} combined`,
      );
      const moveLines = (moves ?? []).filter((m) => m.token_symbol).map(
        (m) => `${m.action} ${m.token_symbol} ~$${Math.round(Number(m.value_usd ?? 0)).toLocaleString()}`,
      );

      const changeStr = changePct != null ? `${changePct > 0 ? 'up' : 'down'} ${Math.abs(changePct).toFixed(1)}%` : 'moving';
      const subject = token ? `${token} on ${chain}` : `${metric} on ${chain || 'the market'}`;
      const prompt = `You are VTX, Naka Labs' on-chain analyst. ${subject} is ${changeStr} over the last 24h. Here is the platform's OWN on-chain data for context:

Smart-money convergence right now${chainFilter ? ` (${chainFilter})` : ''}:
${convLines.length ? convLines.map((l) => `- ${l}`).join('\n') : '- (no active convergence detected)'}

Biggest whale moves in the last 24h${chainFilter ? ` (${chainFilter})` : ''}:
${moveLines.length ? moveLines.map((l) => `- ${l}`).join('\n') : '- (no large whale moves recorded)'}

In 3-4 sharp sentences, explain what is likely driving this move, using ONLY the signals above plus the change figure. Be honest about corroboration: if the on-chain data supports the move, say what specifically; if the platform data does NOT clearly explain it, say so and note what a trader should watch. Do not invent tokens, wallets, or numbers not listed. No markdown headers, no financial advice.`;

      const narrative = await vtxAnalyze(prompt, 500);
      const corroborated = (conv?.length ?? 0) > 0 || (moves?.length ?? 0) > 0;
      return {
        narrative: narrative.trim(),
        signals: {
          convergence: convLines.slice(0, 4),
          whaleMoves: moveLines.slice(0, 4),
        },
        confidence: corroborated ? Math.min(80, 45 + (conv?.length ?? 0) * 5 + (moves?.length ?? 0) * 3) : 30,
      };
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[why-moving]', err);
    return NextResponse.json({ error: 'explanation_unavailable' }, { status: 502 });
  }
}
