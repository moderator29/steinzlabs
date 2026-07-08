import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Token Whale Lens — which tracked whales are in a given token, their net
 * position, and when they entered.
 *
 * GET /api/whale-tracker/token?q=AAVE|0x...&window=24h|7d|30d
 *
 * Real aggregation over whale_activity via the token_whale_positions RPC,
 * enriched with the whales table (label, archetype, win_rate).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_HOURS: Record<string, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
const EVM_ADDR = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface PositionRow {
  whale_address: string; buy_usd: number | null; sell_usd: number | null;
  net_usd: number | null; txs: number; first_seen: string; last_seen: string;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ error: 'q required (token symbol or address)' }, { status: 400 });
  const window = WINDOW_HOURS[req.nextUrl.searchParams.get('window') || '7d'] ? (req.nextUrl.searchParams.get('window') || '7d') : '7d';
  const sinceIso = new Date(Date.now() - WINDOW_HOURS[window] * 3_600_000).toISOString();

  const isAddress = EVM_ADDR.test(q) || SOL_ADDR.test(q);
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.rpc('token_whale_positions', {
    p_symbol: isAddress ? null : q,
    p_address: isAddress ? q : null,
    p_since: sinceIso,
    p_limit: 40,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as PositionRow[];
  if (rows.length === 0) {
    return NextResponse.json({ query: q, window, found: false, positions: [], summary: null });
  }

  // Enrich with whale reputation.
  const addresses = rows.map((r) => r.whale_address);
  const { data: whaleRows } = await admin
    .from('whales')
    .select('address, label, archetype, win_rate, whale_score, chain, verified, naka_number')
    .in('address', addresses);
  const meta = new Map((whaleRows ?? []).map((w: { address: string; label: string | null; archetype: string | null; win_rate: number | null; whale_score: number | null; chain: string; verified: boolean | null; naka_number: number | null }) => [w.address, w]));

  const positions = rows.map((r) => {
    const m = meta.get(r.whale_address);
    const buyUsd = Number(r.buy_usd ?? 0);
    const sellUsd = Number(r.sell_usd ?? 0);
    const netUsd = Number(r.net_usd ?? buyUsd - sellUsd);
    return {
      address: r.whale_address,
      label: m?.label ?? null,
      nakaNumber: m?.naka_number ?? null,
      archetype: m?.archetype ?? null,
      winRate: m?.win_rate != null ? Math.round(Number(m.win_rate)) : null,
      whaleScore: m?.whale_score ?? null,
      chain: m?.chain ?? null,
      verified: !!m?.verified,
      buyUsd, sellUsd, netUsd, txs: r.txs,
      firstSeen: r.first_seen, lastSeen: r.last_seen,
      side: netUsd >= 0 ? 'accumulating' as const : 'distributing' as const,
    };
  });

  const totalBuy = positions.reduce((s, p) => s + p.buyUsd, 0);
  const totalSell = positions.reduce((s, p) => s + p.sellUsd, 0);
  const accumulating = positions.filter((p) => p.side === 'accumulating').length;

  return NextResponse.json({
    query: q,
    window,
    found: true,
    summary: {
      whales: positions.length,
      totalBuy,
      totalSell,
      net: totalBuy - totalSell,
      accumulating,
      distributing: positions.length - accumulating,
    },
    positions,
  }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=180' } });
}
