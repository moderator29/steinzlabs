import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Token X-Ray — one screen that fuses every smart-money signal for a single
 * token: smart-money convergence, the tracked whales holding it, Dune's
 * independent smart-money flow, the wash-trade authenticity score, and the
 * buyer wallet-age mix. Then a plain verdict.
 *
 * GET /api/token-intel/xray?q=SYMBOL|0x...
 *
 * Real data only — reuses smart_money_convergence, the token_whale_positions
 * RPC, dune_smart_money_token_flow, dune_wash_trade_score, dune_token_age_buyers.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVM_ADDR = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface Resolved { address: string; chain: string; symbol: string | null }

// Resolve the real chain for an on-chain address via DexScreener (returns the
// deepest-liquidity pair's chainId). Used when the address isn't in our whale
// activity table so we don't mislabel a non-ETH token as ethereum.
async function chainFromDexScreener(address: string): Promise<{ chain: string; symbol: string | null } | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pairs: any[] = Array.isArray(body?.pairs) ? body.pairs : [];
    if (!pairs.length) return null;
    const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    return { chain: String(best.chainId || 'ethereum'), symbol: best.baseToken?.symbol ?? null };
  } catch {
    return null;
  }
}

// Resolve the query to a canonical (address, chain, symbol). If given a symbol,
// pick the token_address that token has the most whale activity under.
async function resolveToken(admin: ReturnType<typeof getSupabaseAdmin>, q: string): Promise<Resolved | null> {
  const isAddress = EVM_ADDR.test(q) || SOL_ADDR.test(q);
  if (isAddress) {
    const { data } = await admin
      .from('whale_activity')
      .select('token_address, token_symbol, chain')
      .ilike('token_address', q)
      .limit(1);
    const r = (data ?? [])[0] as { token_address: string; token_symbol: string | null; chain: string } | undefined;
    if (r?.chain) return { address: q, chain: r.chain, symbol: r.token_symbol ?? null };
    // Not in our activity table — resolve the REAL chain instead of assuming
    // ethereum. A Solana base58 address is unambiguous; for EVM we ask
    // DexScreener which chain the token actually trades on.
    if (SOL_ADDR.test(q) && !EVM_ADDR.test(q)) return { address: q, chain: 'solana', symbol: null };
    const dx = await chainFromDexScreener(q);
    return { address: q, chain: dx?.chain ?? 'ethereum', symbol: dx?.symbol ?? null };
  }
  // Symbol → most-active address for that symbol.
  const { data } = await admin
    .from('whale_activity')
    .select('token_address, token_symbol, chain, value_usd')
    .ilike('token_symbol', q)
    .not('token_address', 'is', null)
    .order('value_usd', { ascending: false, nullsFirst: false })
    .limit(1);
  const r = (data ?? [])[0] as { token_address: string; token_symbol: string; chain: string } | undefined;
  if (!r?.token_address) return null;
  return { address: r.token_address, chain: r.chain, symbol: r.token_symbol };
}

function washGrade(score: number | null): 'clean' | 'caution' | 'wash' | 'unknown' {
  if (score == null) return 'unknown';
  if (score >= 80) return 'clean';
  if (score >= 50) return 'caution';
  return 'wash';
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ error: 'q required (token symbol or address)' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const token = await resolveToken(admin, q);
  if (!token) return NextResponse.json({ query: q, found: false });

  const addrLc = token.address.toLowerCase();
  const since30 = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();

  const [convRes, posRes, flowRes, washRes, ageRes] = await Promise.all([
    admin.from('smart_money_convergence').select('wallet_count, total_value_usd, detected_at, is_active').ilike('token_address', token.address).order('detected_at', { ascending: false }).limit(1),
    admin.rpc('token_whale_positions', { p_symbol: token.symbol, p_address: token.address, p_since: since30, p_limit: 8 }),
    admin.from('dune_smart_money_token_flow').select('net_inflow_usd_24h, unique_wallets_24h').ilike('token_address', token.address).limit(1),
    admin.from('dune_wash_trade_score').select('score, flagged_pairs').ilike('token_address', token.address).limit(1),
    admin.from('dune_token_age_buyers').select('age_under_7d_pct, age_over_90d_pct, total_buyers').ilike('token_address', token.address).limit(1),
  ]);

  const conv = (convRes.data ?? [])[0] as { wallet_count: number; total_value_usd: number | null; detected_at: string; is_active: boolean } | undefined;
  const positions = (posRes.data ?? []) as Array<{ whale_address: string; buy_usd: number | null; sell_usd: number | null; net_usd: number | null; txs: number; first_seen: string }>;
  const flow = (flowRes.data ?? [])[0] as { net_inflow_usd_24h: number | null; unique_wallets_24h: number | null } | undefined;
  const wash = (washRes.data ?? [])[0] as { score: number | null; flagged_pairs: number | null } | undefined;
  const age = (ageRes.data ?? [])[0] as { age_under_7d_pct: number | null; age_over_90d_pct: number | null; total_buyers: number | null } | undefined;

  // Enrich whale positions with labels.
  let whales: Array<{ address: string; label: string | null; archetype: string | null; winRate: number | null; netUsd: number; firstSeen: string }> = [];
  if (positions.length) {
    const { data: wl } = await admin.from('whales').select('address, label, archetype, win_rate').in('address', positions.map((p) => p.whale_address));
    const map = new Map((wl ?? []).map((w: { address: string; label: string | null; archetype: string | null; win_rate: number | null }) => [w.address, w]));
    whales = positions.map((p) => {
      const m = map.get(p.whale_address);
      return {
        address: p.whale_address, label: m?.label ?? null, archetype: m?.archetype ?? null,
        winRate: m?.win_rate != null ? Math.round(Number(m.win_rate)) : null,
        netUsd: Number(p.net_usd ?? (Number(p.buy_usd ?? 0) - Number(p.sell_usd ?? 0))), firstSeen: p.first_seen,
      };
    });
  }

  const washScore = wash?.score != null ? Number(wash.score) : null;
  const freshPct = age?.age_under_7d_pct != null ? Number(age.age_under_7d_pct) : null;
  const flowNet = flow?.net_inflow_usd_24h != null ? Number(flow.net_inflow_usd_24h) : null;
  const whaleNet = whales.reduce((s, w) => s + w.netUsd, 0);

  // ── Verdict: a plain, transparent read from the real signals ──────────────
  const positives: string[] = [];
  const negatives: string[] = [];
  if (conv?.is_active && conv.wallet_count >= 2) positives.push(`${conv.wallet_count} smart-money wallets converging`);
  if (whales.length >= 2 && whaleNet > 0) positives.push(`${whales.length} tracked whales net-accumulating`);
  if (flowNet != null && flowNet > 0) positives.push('Dune smart money net-buying (24h)');
  if (washScore != null && washScore >= 80) positives.push('Volume looks authentic');
  if (freshPct != null && freshPct < 20) positives.push('Buyers are seasoned wallets');

  if (washScore != null && washScore < 50) negatives.push('High wash-trade risk');
  if (freshPct != null && freshPct >= 50) negatives.push('Buyers are mostly brand-new wallets');
  if (whales.length >= 2 && whaleNet < 0) negatives.push('Tracked whales net-distributing');
  if (flowNet != null && flowNet < 0) negatives.push('Dune smart money net-selling (24h)');

  let verdict: 'strong' | 'mixed' | 'caution' | 'thin';
  if (positives.length === 0 && negatives.length === 0) verdict = 'thin';
  else if (negatives.length >= 2 || (negatives.length >= 1 && positives.length === 0)) verdict = 'caution';
  else if (positives.length >= 2 && negatives.length === 0) verdict = 'strong';
  else verdict = 'mixed';

  return NextResponse.json({
    query: q,
    found: true,
    token: { address: token.address, chain: token.chain, symbol: token.symbol },
    verdict,
    positives,
    negatives,
    signals: {
      convergence: conv ? { walletCount: conv.wallet_count, totalValueUsd: conv.total_value_usd != null ? Number(conv.total_value_usd) : null, active: conv.is_active, detectedAt: conv.detected_at } : null,
      whales: { count: whales.length, netUsd: whaleNet, top: whales },
      duneFlow: flow ? { netInflowUsd: flowNet, uniqueWallets: flow.unique_wallets_24h ?? null } : null,
      wash: wash ? { score: washScore, grade: washGrade(washScore), flaggedPairs: wash.flagged_pairs ?? null } : null,
      buyerAge: age ? { freshPct, seasonedPct: age.age_over_90d_pct != null ? Number(age.age_over_90d_pct) : null, totalBuyers: age.total_buyers ?? null } : null,
    },
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=180' } });
}
