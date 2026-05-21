import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cacheWithFallback } from '@/lib/cache/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §whale-tracker-grade — smart-money convergence read endpoint.
 *
 * The /api/cron/smart-money-convergence cron writes the
 * smart_money_convergence table (wallet_count, total_value_usd,
 * detected_at, is_active) but nothing in the UI ever read it. This
 * endpoint exposes the active convergence rows so the Context Feed can
 * surface "N whales entered $X in 24h" badges on cards that match.
 *
 * Batched by design — caller passes a comma-separated token-symbol list
 * and receives a single map back, keyed by uppercase symbol, so one
 * round-trip covers a whole feed page.
 *
 *   GET /api/intelligence/convergence?tokens=SOL,BONK,WIF&chain=solana
 *   → { SOL: { wallet_count: 4, total_value_usd: 280000 }, ... }
 *
 * Cache is short (15s) because the underlying cron refreshes hourly
 * but UI re-fetches every feed mount; cache absorbs the per-mount
 * stampede across a tab full of users.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tokensParam = (sp.get('tokens') ?? '').trim();
  const chain = (sp.get('chain') ?? '').trim() || null;
  if (!tokensParam) return NextResponse.json({});

  const tokens = Array.from(new Set(
    tokensParam.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean),
  )).slice(0, 50);
  if (tokens.length === 0) return NextResponse.json({});

  const cacheKey = `convergence:${chain ?? 'all'}:${tokens.join(',')}`;
  try {
    const data = await cacheWithFallback(cacheKey, 15, async () => {
      const sb = getSupabaseAdmin();
      let q = sb
        .from('smart_money_convergence')
        .select('token_symbol, chain, wallet_count, total_value_usd, detected_at')
        .eq('is_active', true)
        .in('token_symbol', tokens);
      if (chain) q = q.eq('chain', chain);
      const { data: rows, error } = await q;
      if (error) throw error;
      const map: Record<string, { wallet_count: number; total_value_usd: number; detected_at: string }> = {};
      for (const r of (rows ?? []) as Array<{
        token_symbol: string;
        chain: string;
        wallet_count: number | null;
        total_value_usd: number | null;
        detected_at: string;
      }>) {
        const key = (r.token_symbol ?? '').toUpperCase();
        if (!key) continue;
        // Keep the most recent / highest-count entry per token.
        const prev = map[key];
        if (!prev || (r.wallet_count ?? 0) > prev.wallet_count) {
          map[key] = {
            wallet_count: r.wallet_count ?? 0,
            total_value_usd: Number(r.total_value_usd ?? 0),
            detected_at: r.detected_at,
          };
        }
      }
      return map;
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[intelligence/convergence]', err);
    return NextResponse.json({}, { status: 502 });
  }
}
