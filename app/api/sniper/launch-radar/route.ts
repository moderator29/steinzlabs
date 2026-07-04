import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Launch Radar — the freshest token launches that clear a real quality bar
 * (genuine liquidity + actual trading), so the shortlist worth watching rises
 * out of the thousands of new pairs.
 *
 * GET /api/sniper/launch-radar?chain=&window=6h|24h|3d&sort=newest|volume|liquidity
 *
 * Real data: sniper_feed_tokens (GeckoTerminal-ingested new-pair feed). Only
 * the populated base fields are surfaced — liquidity, 24h volume, txns, price
 * change, socials, launchpad, age. Security enrichment is NOT shown because it
 * is not populated in this feed (no fabricated safety score).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_HOURS: Record<string, number> = { '6h': 6, '24h': 24, '3d': 72 };
const MIN_LIQUIDITY = 5000;

interface FeedRow {
  chain: string; token_address: string; pair_address: string | null; symbol: string | null; name: string | null;
  logo_url: string | null; launchpad: string | null; dex: string | null;
  price_usd: number | null; market_cap_usd: number | null; liquidity_usd: number | null;
  volume_24h_usd: number | null; txns_24h: number | null; price_change_24h: number | null;
  has_social: boolean | null; socials: unknown; first_seen_at: string;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const window = WINDOW_HOURS[sp.get('window') || '24h'] ? (sp.get('window') || '24h') : '24h';
  const chain = sp.get('chain')?.trim() || null;
  const sort = ['newest', 'volume', 'liquidity'].includes(sp.get('sort') || '') ? sp.get('sort')! : 'volume';
  const sinceIso = new Date(Date.now() - WINDOW_HOURS[window] * 3_600_000).toISOString();

  const admin = getSupabaseAdmin();
  // Quality bar: fresh + real liquidity + actual trading. Order by the chosen
  // key at the DB so pagination is meaningful.
  let q = admin
    .from('sniper_feed_tokens')
    .select('chain, token_address, pair_address, symbol, name, logo_url, launchpad, dex, price_usd, market_cap_usd, liquidity_usd, volume_24h_usd, txns_24h, price_change_24h, has_social, socials, first_seen_at')
    .gte('first_seen_at', sinceIso)
    .gte('liquidity_usd', MIN_LIQUIDITY)
    .gt('volume_24h_usd', 0);
  if (chain) q = q.eq('chain', chain);
  q = sort === 'newest'
    ? q.order('first_seen_at', { ascending: false })
    : sort === 'liquidity'
      ? q.order('liquidity_usd', { ascending: false, nullsFirst: false })
      : q.order('volume_24h_usd', { ascending: false, nullsFirst: false });
  const { data, error } = await q.limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tokens = ((data ?? []) as FeedRow[]).map((t) => {
    const liq = Number(t.liquidity_usd ?? 0);
    const vol = Number(t.volume_24h_usd ?? 0);
    return {
      chain: t.chain,
      tokenAddress: t.token_address,
      pairAddress: t.pair_address,
      symbol: t.symbol,
      name: t.name,
      logoUrl: t.logo_url,
      launchpad: t.launchpad,
      dex: t.dex,
      priceUsd: t.price_usd != null ? Number(t.price_usd) : null,
      marketCapUsd: t.market_cap_usd != null ? Number(t.market_cap_usd) : null,
      liquidityUsd: liq,
      volume24hUsd: vol,
      txns24h: t.txns_24h ?? 0,
      priceChange24h: t.price_change_24h != null ? Number(t.price_change_24h) : null,
      // Turnover = 24h volume / liquidity — a real velocity read (how hot the
      // pool is trading relative to its depth), not a safety score.
      turnover: liq > 0 ? vol / liq : 0,
      hasSocial: !!t.has_social,
      firstSeenAt: t.first_seen_at,
    };
  });

  return NextResponse.json({
    window,
    chain: chain ?? 'all',
    sort,
    tokens,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
}
