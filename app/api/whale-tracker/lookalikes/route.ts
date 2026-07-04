import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Whale Genome — Look-Alike Wallets. GET ?address=0x…
 * Returns the target whale plus the wallets whose real trading behavior is most
 * similar (win rate, hold time, trade count, volume, score), via the
 * whale_lookalikes RPC. Real metrics only — no fabricated similarity.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row {
  address: string; chain: string; label: string | null; archetype: string | null; verified: boolean | null;
  win_rate: number | null; whale_score: number | null; avg_hold_hours: number | null;
  trade_count_30d: number | null; volume_7d_usd: number | null; similarity: number | null;
}

export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get('address') || '').trim();
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const [{ data: target }, { data: rows, error }] = await Promise.all([
    admin.from('whales').select('address, chain, label, archetype, verified, win_rate, whale_score, avg_hold_hours, trade_count_30d, volume_7d_usd, portfolio_value_usd')
      .ilike('address', address).maybeSingle(),
    admin.rpc('whale_lookalikes', { p_address: address, p_limit: 10 }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map = (r: Row) => ({
    address: r.address, chain: r.chain,
    label: r.label, archetype: r.archetype, verified: !!r.verified,
    winRate: r.win_rate != null ? Math.round(Number(r.win_rate)) : null,
    whaleScore: r.whale_score ?? null,
    avgHoldHours: r.avg_hold_hours != null ? Number(r.avg_hold_hours) : null,
    trades30d: r.trade_count_30d ?? 0,
    volume7dUsd: r.volume_7d_usd != null ? Number(r.volume_7d_usd) : 0,
    similarity: r.similarity != null ? Number(r.similarity) : null,
  });

  return NextResponse.json({
    found: !!target,
    target: target ? map({ ...(target as Record<string, unknown>), similarity: null } as unknown as Row) : { address, chain: null, label: null, archetype: null, verified: false, winRate: null, whaleScore: null, avgHoldHours: null, trades30d: 0, volume7dUsd: 0, similarity: null },
    lookalikes: ((rows ?? []) as Row[]).map(map),
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
