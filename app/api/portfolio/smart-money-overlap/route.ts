import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Portfolio → Smart Money Overlap. Given the symbols a wallet holds, returns
 * the tracked-whale signal for each — net flow (accumulating vs distributing)
 * and how many whales are in it over the last 30 days. Answers "is smart money
 * with me on what I hold?"
 *
 * POST { symbols: string[] }  (the client passes the holdings it already loaded)
 *
 * Real data via the portfolio_whale_signal RPC over whale_activity. No wallet
 * address or PII is sent or stored — only token symbols.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { symbols?: unknown };
  const symbols = Array.isArray(body.symbols)
    ? Array.from(new Set(body.symbols.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim().toUpperCase()))).slice(0, 60)
    : [];
  if (symbols.length === 0) return NextResponse.json({ signals: {} });

  const since = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();
  const { data, error } = await getSupabaseAdmin().rpc('portfolio_whale_signal', { p_symbols: symbols, p_since: since });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const signals: Record<string, { netUsd: number; buyUsd: number; sellUsd: number; whales: number; stance: 'accumulating' | 'distributing' | 'neutral' }> = {};
  for (const r of (data ?? []) as Array<{ token_symbol: string; net_usd: number | null; buy_usd: number | null; sell_usd: number | null; whales: number }>) {
    const net = Number(r.net_usd ?? 0);
    // Neutral band: tiny net flow relative to activity isn't a real stance.
    const gross = Number(r.buy_usd ?? 0) + Number(r.sell_usd ?? 0);
    const stance = gross > 0 && Math.abs(net) / gross < 0.1 ? 'neutral' : net >= 0 ? 'accumulating' : 'distributing';
    signals[r.token_symbol.toUpperCase()] = {
      netUsd: net, buyUsd: Number(r.buy_usd ?? 0), sellUsd: Number(r.sell_usd ?? 0), whales: r.whales, stance,
    };
  }

  const tracked = Object.keys(signals).length;
  const accumulating = Object.values(signals).filter((s) => s.stance === 'accumulating').length;
  const distributing = Object.values(signals).filter((s) => s.stance === 'distributing').length;

  return NextResponse.json({
    signals,
    summary: { requested: symbols.length, tracked, accumulating, distributing },
    generatedAt: new Date().toISOString(),
  });
}
