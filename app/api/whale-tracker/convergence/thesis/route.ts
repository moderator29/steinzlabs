import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cacheWithFallback } from '@/lib/cache/redis';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Convergence AI Thesis — Claude reads the REAL converging-wallet data for one
// token and writes a tight, wallet-specific thesis: what these particular
// wallets have in common, whether it reads as organic accumulation vs a
// coordinated/wash cluster, and how early it is. Cached 1h in Redis so a
// convergence's thesis is written once and shared (protects the Anthropic
// budget — the platform's only paid API). Auth-gated to prevent anon abuse of
// the LLM. Never fabricates: the prompt is built purely from DB facts.
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { tokenAddress?: string; chain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const tokenAddress = (body.tokenAddress || '').trim().toLowerCase();
  const chain = (body.chain || '').trim().toLowerCase();
  if (!tokenAddress || !chain) {
    return NextResponse.json({ error: 'tokenAddress and chain required' }, { status: 400 });
  }

  const cacheKey = `conv-thesis:${chain}:${tokenAddress}`;
  try {
    const result = await cacheWithFallback(cacheKey, 3600, async () => {
      const sb = getSupabaseAdmin();
      const { data: conv } = await sb
        .from('smart_money_convergence')
        .select('token_symbol, chain, wallet_count, wallets, total_value_usd, detected_at')
        .eq('token_address', tokenAddress)
        .eq('chain', chain)
        .eq('is_active', true)
        .maybeSingle<{
          token_symbol: string | null; chain: string; wallet_count: number | null;
          wallets: string[] | null; total_value_usd: number | null; detected_at: string;
        }>();
      if (!conv) return { thesis: null, unavailable: true };

      const addrs = (conv.wallets ?? []).map((a) => a.toLowerCase()).slice(0, 12);
      const { data: whales } = await sb
        .from('whales')
        .select('address, label, archetype, win_rate, pnl_30d_usd, avg_hold_hours')
        .in('address', addrs);

      const walletLines = (whales ?? []).map((w: {
        address: string; label: string | null; archetype: string | null;
        win_rate: number | null; pnl_30d_usd: number | null; avg_hold_hours: number | null;
      }) => {
        const bits = [
          w.label || `${w.address.slice(0, 6)}…${w.address.slice(-4)}`,
          w.archetype ? `archetype ${w.archetype}` : null,
          typeof w.win_rate === 'number' ? `win-rate ${Math.round(w.win_rate)}%` : null,
          typeof w.pnl_30d_usd === 'number' ? `30d PnL $${Math.round(w.pnl_30d_usd).toLocaleString()}` : null,
          typeof w.avg_hold_hours === 'number' ? `avg hold ${Math.round(w.avg_hold_hours)}h` : null,
        ].filter(Boolean);
        return `- ${bits.join(', ')}`;
      }).join('\n');

      const ageHours = Math.round((Date.now() - new Date(conv.detected_at).getTime()) / 3_600_000);
      const prompt = `You are VTX, Naka Labs' on-chain intelligence agent. ${conv.wallet_count ?? addrs.length} tracked smart-money wallets have converged on buying ${conv.token_symbol ?? tokenAddress} on ${conv.chain} in the last 24h — combined ~$${Math.round(Number(conv.total_value_usd ?? 0)).toLocaleString()}, first detected ${ageHours}h ago.

The specific wallets and their track records:
${walletLines || '- (wallet reputations still backfilling)'}

Write a SHARP 3-4 sentence thesis for a trader. Cover: (1) what these particular wallets have in common (shared archetype/style/prior behaviour) that makes this meaningful; (2) whether this reads as ORGANIC accumulation vs a possible coordinated/wash cluster, and why; (3) how early this is and what a disciplined trader should watch next. Be direct and specific — reference the actual archetypes/win-rates above. Do NOT give financial advice or price targets. No preamble, no markdown headers.`;

      const thesis = await vtxAnalyze(prompt, 600);
      // Rough confidence from the strength of the signal (real inputs only).
      const namedCount = (whales ?? []).filter((w) => (w as { label: string | null }).label).length;
      const confidence = Math.min(95, 35 + (conv.wallet_count ?? 2) * 6 + namedCount * 4);
      return { thesis: thesis.trim(), confidence, walletCount: conv.wallet_count ?? addrs.length };
    });

    if ((result as { unavailable?: boolean }).unavailable) {
      return NextResponse.json({ error: 'No active convergence for this token' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('[convergence/thesis]', err);
    return NextResponse.json({ error: 'thesis_unavailable' }, { status: 502 });
  }
}
