import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Whale Compare — side-by-side comparison of 2–4 tracked wallets.
 *
 * GET /api/whale-tracker/compare?addresses=0xA,0xB,...
 *
 * Real data only: the curated `whales` table (reputation, PnL, archetype,
 * hold time) plus `whale_activity` (117k rows) for each wallet's held-token
 * mix and the cross-wallet token overlap — the "what are they BOTH in" signal.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WhaleRow {
  address: string; chain: string; label: string | null; entity_type: string | null;
  win_rate: number | null; whale_score: number | null;
  pnl_7d_usd: number | null; pnl_30d_usd: number | null;
  portfolio_value_usd: number | null; volume_7d_usd: number | null;
  trade_count_30d: number | null; avg_hold_hours: number | null;
  archetype: string | null; verified: boolean | null; last_active_at: string | null; logo_url: string | null;
}

interface TopToken { symbol: string; valueUsd: number }

interface ComparedWallet {
  address: string; label: string | null; entityType: string | null; chain: string;
  archetype: string | null; winRate: number | null; whaleScore: number | null;
  pnl30dUsd: number | null; pnl7dUsd: number | null; portfolioUsd: number | null;
  volume7dUsd: number | null; trades30d: number | null; avgHoldHours: number | null;
  verified: boolean; lastActive: string | null; logoUrl: string | null;
  topTokens: TopToken[];
}

const BUY_ACTIONS = new Set(['buy', 'transfer_in', 'swap']);

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get('addresses') || '').trim();
  if (!raw) return NextResponse.json({ error: 'addresses required (comma-separated, 2-4)' }, { status: 400 });

  const requested = Array.from(new Set(raw.split(',').map((a) => a.trim()).filter(Boolean))).slice(0, 4);
  if (requested.length < 2) return NextResponse.json({ error: 'provide 2-4 addresses to compare' }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Resolve the whale rows case-insensitively (EVM), preserving whatever the
  // table stores as the canonical address for the activity lookup.
  const orFilter = requested.map((a) => `address.ilike.${a}`).join(',');
  const { data: whaleRows } = await admin
    .from('whales')
    .select('address, chain, label, entity_type, win_rate, whale_score, pnl_7d_usd, pnl_30d_usd, portfolio_value_usd, volume_7d_usd, trade_count_30d, avg_hold_hours, archetype, verified, last_active_at, logo_url')
    .or(orFilter)
    .limit(4);

  const whales = (whaleRows ?? []) as WhaleRow[];
  if (whales.length === 0) {
    return NextResponse.json({ wallets: [], overlap: [], notFound: requested });
  }

  const canonical = whales.map((w) => w.address);

  // Pull recent activity for all compared wallets in one query and aggregate
  // each wallet's buy-side token mix in JS (Supabase JS has no GROUP BY).
  const { data: acts } = await admin
    .from('whale_activity')
    .select('whale_address, action, token_symbol, value_usd')
    .in('whale_address', canonical)
    .order('timestamp', { ascending: false })
    .limit(2000);

  // wallet -> (symbol -> summed buy value)
  const byWallet = new Map<string, Map<string, number>>();
  for (const a of (acts ?? []) as Array<{ whale_address: string; action: string | null; token_symbol: string | null; value_usd: number | null }>) {
    if (!a.token_symbol || !BUY_ACTIONS.has((a.action ?? '').toLowerCase())) continue;
    const sym = a.token_symbol.toUpperCase();
    const m = byWallet.get(a.whale_address) ?? new Map<string, number>();
    m.set(sym, (m.get(sym) ?? 0) + Number(a.value_usd ?? 0));
    byWallet.set(a.whale_address, m);
  }

  const wallets: ComparedWallet[] = whales.map((w) => {
    const mix = byWallet.get(w.address) ?? new Map<string, number>();
    const topTokens: TopToken[] = Array.from(mix.entries())
      .map(([symbol, valueUsd]) => ({ symbol, valueUsd }))
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .slice(0, 8);
    return {
      address: w.address,
      label: w.label,
      entityType: w.entity_type,
      chain: w.chain,
      archetype: w.archetype,
      winRate: w.win_rate != null ? Math.round(Number(w.win_rate)) : null,
      whaleScore: w.whale_score,
      pnl30dUsd: w.pnl_30d_usd != null ? Number(w.pnl_30d_usd) : null,
      pnl7dUsd: w.pnl_7d_usd != null ? Number(w.pnl_7d_usd) : null,
      portfolioUsd: w.portfolio_value_usd != null ? Number(w.portfolio_value_usd) : null,
      volume7dUsd: w.volume_7d_usd != null ? Number(w.volume_7d_usd) : null,
      trades30d: w.trade_count_30d,
      avgHoldHours: w.avg_hold_hours != null ? Number(w.avg_hold_hours) : null,
      verified: !!w.verified,
      lastActive: w.last_active_at,
      logoUrl: w.logo_url,
      topTokens,
    };
  });

  // Cross-wallet token overlap — tokens ≥2 of the compared wallets bought.
  const tokenWallets = new Map<string, Set<string>>();
  for (const [addr, mix] of byWallet.entries()) {
    for (const sym of mix.keys()) {
      const s = tokenWallets.get(sym) ?? new Set<string>();
      s.add(addr);
      tokenWallets.set(sym, s);
    }
  }
  const overlap = Array.from(tokenWallets.entries())
    .filter(([, s]) => s.size >= 2)
    .map(([symbol, s]) => ({ symbol, wallets: Array.from(s), count: s.size }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol))
    .slice(0, 20);

  return NextResponse.json({ wallets, overlap });
}
