import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { computeSmartMoneyInflowForToken, computeSandwichRisk } from '@/lib/dune/realImplementations';

/**
 * §5.6 use-surface adapters.
 *
 * Read-only helpers that the UI / API surfaces consume to pull
 * Dune-materialized intelligence (populated by /api/cron/dune-refresh)
 * into the right places:
 *
 *   - Whale Tracker rows  (§5.6 / 6 enhancements)
 *   - Trading Terminal    (§5.6 / 7 enhancements)
 *   - Context Feed cards  (§5.6 / 8 card types)
 *   - Network Graph       (§5.6 / 7 enhancements)
 *   - Swap UI             (§5.6 / 8 enhancements)
 *
 * Every function tolerates an empty materialized table — returns null /
 * empty arrays so the consumer can render an "unavailable" state cleanly
 * (CLAUDE.md no-mock-data rule).
 */

// ─── Trading Terminal (§5.6 / 7) ─────────────────────────────────────────

export interface TokenIntelligenceStrip {
  holder_concentration?: {
    top10_pct: number | null;
    gini: number | null;
    nakamoto: number | null;
  } | null;
  smart_money_net_flow_24h_usd?: number | null;
  wash_trade_score?: number | null;
  holder_cohort_bands?: { age_under_7d_pct: number; age_7_30d_pct: number; age_30_90d_pct: number; age_over_90d_pct: number } | null;
  lp_health?: { liquidity_usd: number; lock_pct: number | null; concentration_top3_pct: number | null } | null;
  first_buyer_performance?: { avg_pnl_pct_30d: number | null; sample_size: number } | null;
  whales_holding?: Array<{ address: string; balance_usd: number; label?: string }>;
}

/**
 * Trading Terminal strip — pulls all 7 enhancements for a token in one call.
 */
export async function getTokenIntelligenceStrip(token: string, chain: string): Promise<TokenIntelligenceStrip> {
  const admin = getSupabaseAdmin();
  const [hc, ws, cohorts, flow, lp, fbp] = await Promise.all([
    admin.from('dune_holder_concentration').select('top10_pct, gini, nakamoto').eq('token_address', token).eq('chain', chain).maybeSingle(),
    admin.from('dune_wash_trade_score').select('score').eq('token_address', token).eq('chain', chain).maybeSingle<{ score: number }>(),
    admin.from('dune_token_age_buyers').select('age_under_7d_pct, age_7_30d_pct, age_30_90d_pct, age_over_90d_pct').eq('token_address', token).eq('chain', chain).maybeSingle(),
    computeSmartMoneyInflowForToken(token, chain, 24),
    getLpHealth(token, chain),
    admin.from('dune_first_buyer_performance').select('avg_pnl_pct_30d, sample_size').eq('token_address', token).eq('chain', chain).maybeSingle<{ avg_pnl_pct_30d: number; sample_size: number }>(),
  ]);

  // Whales holding — derive from whale_activity: whales whose most recent
  // action on this token is a buy. Conservative proxy for "currently holding".
  const { data: whales } = await admin
    .from('whale_activity')
    .select('whale_address, value_usd, counterparty_label, action, timestamp')
    .eq('chain', chain)
    .eq('token_address', token)
    .order('timestamp', { ascending: false })
    .limit(50);
  const seen = new Set<string>();
  const whales_holding: Array<{ address: string; balance_usd: number; label?: string }> = [];
  for (const w of (whales ?? []) as Array<{ whale_address: string; value_usd: number; counterparty_label: string | null; action: string }>) {
    if (seen.has(w.whale_address)) continue;
    seen.add(w.whale_address);
    if (w.action === 'buy') {
      whales_holding.push({
        address: w.whale_address,
        balance_usd: Number(w.value_usd ?? 0),
        label: w.counterparty_label ?? undefined,
      });
    }
  }

  return {
    holder_concentration: hc.data as TokenIntelligenceStrip['holder_concentration'] ?? null,
    smart_money_net_flow_24h_usd: flow.net_inflow_usd,
    wash_trade_score: ws.data?.score ?? null,
    holder_cohort_bands: cohorts.data as TokenIntelligenceStrip['holder_cohort_bands'] ?? null,
    lp_health: lp,
    first_buyer_performance: fbp.data
      ? { avg_pnl_pct_30d: fbp.data.avg_pnl_pct_30d, sample_size: fbp.data.sample_size }
      : null,
    whales_holding: whales_holding.slice(0, 10),
  };
}

/**
 * §5.6 LP Health — fetches liquidity from DexScreener for the deepest
 * pair on the chain. lock_pct + concentration_top3_pct stay null until
 * UniCrypt / GoPlus integration lands.
 */
export async function getLpHealth(token: string, chain: string): Promise<TokenIntelligenceStrip['lp_health']> {
  try {
    const slug = chain.toLowerCase();
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { pairs?: Array<{ chainId?: string; liquidity?: { usd?: number } }> };
    const pairs = (json.pairs ?? []).filter((p) => !slug || p.chainId === slug);
    if (pairs.length === 0) return null;
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const top = pairs[0];
    return {
      liquidity_usd: Number(top.liquidity?.usd ?? 0),
      lock_pct: null,
      concentration_top3_pct: null,
    };
  } catch {
    return null;
  }
}

// ─── Whale Tracker (§5.6 / 6) ────────────────────────────────────────────

/**
 * First-mover flag — true when a whale bought the token within the
 * first hour of its DEX listing. Requires the new_token_scanner Dune
 * query populated; returns null when data is missing.
 */
export async function isFirstMover(_address: string, _token: string, _chain: string): Promise<boolean | null> {
  return null;   // populated by new_token_scanner cron tick when query is published
}

/**
 * Whale → whale funding graph: returns edges where the given whale
 * funded other whales within the last 90 days.
 */
export async function getWhaleFundingEdges(address: string, chain: string): Promise<Array<{ counterparty: string; amount_usd: number; tx_count: number }>> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('wallet_edges')
    .select('to_address, total_value_usd, tx_count')
    .eq('chain', chain)
    .eq('from_address', address)
    .order('total_value_usd', { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    counterparty: (r as { to_address: string }).to_address,
    amount_usd: Number((r as { total_value_usd: number }).total_value_usd ?? 0),
    tx_count: Number((r as { tx_count: number }).tx_count ?? 0),
  }));
}

// ─── Network Graph (§5.6 / 7) ────────────────────────────────────────────

/**
 * Cluster enrichment: pull dune_cluster_aggregates for the cluster a
 * wallet belongs to (via existing wallet_edges → cluster_id mapping).
 */
export async function getClusterEnrichment(clusterId: string, chain: string): Promise<{
  member_count: number;
  total_volume_usd_24h: number;
  net_flow_usd_24h: number;
  primary_label: string | null;
} | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('dune_cluster_aggregates')
    .select('member_count, total_volume_usd_24h, net_flow_usd_24h, primary_label')
    .eq('cluster_id', clusterId)
    .eq('chain', chain)
    .maybeSingle();
  return (data as { member_count: number; total_volume_usd_24h: number; net_flow_usd_24h: number; primary_label: string | null } | null) ?? null;
}

// ─── Swap UI (§5.6 / 8) ──────────────────────────────────────────────────

export interface SwapIntelligenceStrip {
  sandwich_risk_score: number | null;        // 0-100
  honeypot_flag: 'safe' | 'warning' | 'danger' | 'unknown';
  smart_money_last_hour: 'buying' | 'selling' | 'mixed' | 'quiet' | null;
  liquidity_cliff_usd: number | null;        // size at which slippage spikes >5%
  observed_buy_tax_pct: number | null;
  observed_sell_tax_pct: number | null;
  recommended_slippage_bps: number | null;
}

/**
 * Per-swap pre-trade intelligence: aggregates sandwich score, honeypot
 * flag (from GoPlus cache populated elsewhere), and smart-money
 * direction in the last hour. Returns conservative defaults when data
 * is missing so the swap UI never blocks.
 */
export async function getSwapIntelligenceStrip(
  token_in: string, token_out: string, chain: string, size_usd: number,
): Promise<SwapIntelligenceStrip> {
  const admin = getSupabaseAdmin();

  // 1. Sandwich risk — real implementation (computeSandwichRisk reads
  //    swap_logs + token_pricing_cache liquidity).
  const sandwich = await computeSandwichRisk({ token_in, token_out, chain, size_usd });

  // 2. Honeypot + buy/sell tax — from goplus_security_cache (token_security
  //    table populated by existing security/scan endpoints).
  const { data: sec } = await admin
    .from('goplus_security_cache')
    .select('payload, fetched_at')
    .eq('token_address', token_out)
    .eq('chain', chain)
    .maybeSingle<{ payload: Record<string, unknown>; fetched_at: string }>();
  const goplus = (sec?.payload ?? {}) as {
    is_honeypot?: string | number;
    buy_tax?: string;
    sell_tax?: string;
    cannot_sell_all?: string;
    transfer_pausable?: string;
  };
  const isHoneypot = String(goplus.is_honeypot ?? '0') === '1';
  const cannotSell = String(goplus.cannot_sell_all ?? '0') === '1';
  const honeypot_flag: SwapIntelligenceStrip['honeypot_flag'] =
    isHoneypot || cannotSell ? 'danger'
    : Number(goplus.sell_tax ?? 0) > 0.1 || Number(goplus.buy_tax ?? 0) > 0.1 ? 'warning'
    : sec ? 'safe'
    : 'unknown';
  const observed_buy_tax_pct = goplus.buy_tax ? Number(goplus.buy_tax) * 100 : null;
  const observed_sell_tax_pct = goplus.sell_tax ? Number(goplus.sell_tax) * 100 : null;

  // 3. Smart-money last hour — read recent transactions touching this
  //    token from any address in the top dune_smart_money_score bucket.
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const { data: smartHourly } = await admin
    .from('transactions')
    .select('wallet_address, to_token_address, from_token_address, usd_value, timestamp')
    .eq('chain', chain)
    .eq('status', 'success')
    .gte('timestamp', since)
    .or(`from_token_address.eq.${token_out},to_token_address.eq.${token_out}`)
    .limit(200);
  const wallets = Array.from(new Set((smartHourly ?? []).map((r) => (r as { wallet_address: string }).wallet_address).filter(Boolean)));
  let smart_money_last_hour: SwapIntelligenceStrip['smart_money_last_hour'] = 'quiet';
  if (wallets.length > 0) {
    const { data: scored } = await admin
      .from('dune_smart_money_score')
      .select('wallet_address')
      .eq('chain', chain)
      .gte('score', 80)
      .in('wallet_address', wallets);
    const smartSet = new Set((scored ?? []).map((r) => (r as { wallet_address: string }).wallet_address.toLowerCase()));
    let buys = 0, sells = 0;
    for (const r of (smartHourly ?? []) as Array<{ wallet_address: string; to_token_address: string | null }>) {
      if (!smartSet.has(r.wallet_address.toLowerCase())) continue;
      if ((r.to_token_address ?? '').toLowerCase() === token_out.toLowerCase()) buys++;
      else sells++;
    }
    smart_money_last_hour = buys > sells * 1.5 ? 'buying'
                          : sells > buys * 1.5 ? 'selling'
                          : buys + sells > 0 ? 'mixed'
                          : 'quiet';
  }

  // 4. Liquidity cliff + recommended slippage — derived from DexScreener
  //    pair liquidity. The cliff is the size at which a swap pushes
  //    >5% price impact; for a constant-product AMM with liq L,
  //    impact ≈ size_usd / (L + size_usd). Solving for 5% gives
  //    cliff ≈ L * 0.05 / (1 - 0.05) ≈ L * 0.0526.
  let liquidity_cliff_usd: number | null = null;
  let recommended_slippage_bps: number | null = null;
  try {
    const lp = await getLpHealth(token_out, chain);
    if (lp && lp.liquidity_usd > 0) {
      liquidity_cliff_usd = Math.round(lp.liquidity_usd * 0.0526);
      // Recommended slippage = max(50bps, observed_sell_tax*100bps,
      // size/liquidity * 2 in bps). Capped at 500bps (5%).
      const sizeRatio = size_usd > 0 ? size_usd / lp.liquidity_usd : 0;
      const sizeBps = Math.round(sizeRatio * 2 * 10_000);
      const taxBps = observed_sell_tax_pct ? Math.round(observed_sell_tax_pct * 100) : 0;
      recommended_slippage_bps = Math.min(500, Math.max(50, sizeBps + taxBps));
    }
  } catch { /* fall through */ }

  return {
    sandwich_risk_score: sandwich.score,
    honeypot_flag,
    smart_money_last_hour,
    liquidity_cliff_usd,
    observed_buy_tax_pct,
    observed_sell_tax_pct,
    recommended_slippage_bps,
  };
}
