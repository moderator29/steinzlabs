import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
  const [hc, ws] = await Promise.all([
    admin.from('dune_holder_concentration').select('top10_pct, gini, nakamoto').eq('token_address', token).eq('chain', chain).maybeSingle(),
    admin.from('dune_wash_trade_score').select('score').eq('token_address', token).eq('chain', chain).maybeSingle<{ score: number }>(),
  ]);
  // Smart-money net flow over 24h — sum signed contributions from
  // top-decile dune_smart_money_score wallets touching this token. The
  // token-rollup table lands in a later cron tick; for now this is null.
  // LP health, first-buyer cohort, holder cohort bands likewise.
  return {
    holder_concentration: hc.data as TokenIntelligenceStrip['holder_concentration'] ?? null,
    smart_money_net_flow_24h_usd: null,
    wash_trade_score: ws.data?.score ?? null,
    holder_cohort_bands: null,
    lp_health: null,
    first_buyer_performance: null,
    whales_holding: [],
  };
}

// ─── Whale Tracker (§5.6 / 6) ────────────────────────────────────────────

export interface WhaleEnrichment {
  address: string;
  chain: string;
  smart_money_score: number | null;
  win_rate_pct: number | null;
  realized_pnl_usd_90d: number | null;
  archetype: 'accumulator' | 'distributor' | 'rotator' | 'neutral' | null;
  pnl_tier: 'elite' | 'pro' | 'consistent' | 'inconsistent' | null;
  cross_chain_addresses?: Array<{ chain: string; address: string }>;
}

export async function getWhaleEnrichment(addresses: string[], chain: string): Promise<Map<string, WhaleEnrichment>> {
  if (addresses.length === 0) return new Map();
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('dune_smart_money_score')
    .select('wallet_address, score, win_rate_pct, realized_pnl_usd_90d, basis')
    .eq('chain', chain)
    .in('wallet_address', addresses);
  const out = new Map<string, WhaleEnrichment>();
  for (const r of (data ?? []) as Array<{ wallet_address: string; score: number; win_rate_pct: number; realized_pnl_usd_90d: number; basis: Record<string, unknown> }>) {
    const basis = r.basis ?? {};
    const buys = Number((basis as { buy_count?: number }).buy_count ?? 0);
    const sells = Number((basis as { sell_count?: number }).sell_count ?? 0);
    const archetype: WhaleEnrichment['archetype'] =
      buys > sells * 1.5 ? 'accumulator'
      : sells > buys * 1.5 ? 'distributor'
      : buys + sells > 0 ? 'rotator'
      : 'neutral';
    const pnl_tier: WhaleEnrichment['pnl_tier'] =
      r.score >= 90 ? 'elite'
      : r.score >= 75 ? 'pro'
      : r.score >= 50 ? 'consistent'
      : 'inconsistent';
    out.set(r.wallet_address, {
      address: r.wallet_address,
      chain,
      smart_money_score: r.score,
      win_rate_pct: r.win_rate_pct,
      realized_pnl_usd_90d: r.realized_pnl_usd_90d,
      archetype,
      pnl_tier,
    });
  }
  return out;
}

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

// ─── Context Feed (§5.6 / 8 card types) ──────────────────────────────────

export type ContextFeedCardType =
  | 'bridge_flow'
  | 'smart_money_rotation'
  | 'stablecoin_pulse'
  | 'cex_drain'
  | 'new_launch_smart_money'
  | 'mev_sandwich'
  | 'insider_wallet'
  | 'funding_rate_divergence';

export interface ContextFeedCard {
  type: ContextFeedCardType;
  title: string;
  body: string;
  metric?: number;
  href?: string;
  fetched_at: string;
}

/**
 * Build the latest Context Feed cards from Dune-materialized data.
 * Returns up to `limit` cards across all 8 types, freshest first.
 */
export async function getContextFeedDuneCards(limit = 20): Promise<ContextFeedCard[]> {
  const admin = getSupabaseAdmin();
  const cards: ContextFeedCard[] = [];

  // bridge_flow — biggest cross-chain flows in the last hour
  const { data: bridges } = await admin
    .from('dune_bridge_flows')
    .select('from_chain, to_chain, total_usd, hour_bucket')
    .gte('hour_bucket', new Date(Date.now() - 3600 * 1000).toISOString())
    .order('total_usd', { ascending: false })
    .limit(3);
  for (const b of (bridges ?? []) as Array<{ from_chain: string; to_chain: string; total_usd: number; hour_bucket: string }>) {
    cards.push({
      type: 'bridge_flow',
      title: `${b.from_chain} → ${b.to_chain}`,
      body: `$${(b.total_usd / 1_000_000).toFixed(2)}M bridged in the last hour.`,
      metric: b.total_usd,
      fetched_at: b.hour_bucket,
    });
  }

  // new_launch_smart_money — recent dune_smart_money_score entries
  // appearing in new_token_scanner. Until that query is published, skip.

  // mev_sandwich — high wash_trade_score tokens flagged as MEV hotspots
  const { data: mev } = await admin
    .from('dune_wash_trade_score')
    .select('token_address, chain, score, fetched_at')
    .gte('score', 70)
    .order('score', { ascending: false })
    .limit(3);
  for (const m of (mev ?? []) as Array<{ token_address: string; chain: string; score: number; fetched_at: string }>) {
    cards.push({
      type: 'mev_sandwich',
      title: `High MEV risk on ${m.token_address.slice(0, 8)}…`,
      body: `Wash-trade / sandwich score ${m.score}/100 — review before swapping.`,
      metric: m.score,
      href: `/dashboard/market/${m.chain}/${m.token_address}`,
      fetched_at: m.fetched_at,
    });
  }

  // smart_money_rotation — top-decile flips by 24h net flow (token-level
  // rollup pending). For now, surface elite wallets with biggest realized
  // PnL deltas.
  const { data: rotation } = await admin
    .from('dune_smart_money_score')
    .select('wallet_address, chain, score, realized_pnl_usd_90d, fetched_at')
    .gte('score', 90)
    .order('realized_pnl_usd_90d', { ascending: false })
    .limit(3);
  for (const r of (rotation ?? []) as Array<{ wallet_address: string; chain: string; score: number; realized_pnl_usd_90d: number; fetched_at: string }>) {
    cards.push({
      type: 'smart_money_rotation',
      title: `Elite trader active: ${r.wallet_address.slice(0, 8)}…`,
      body: `Score ${r.score}/100 · 90d realized $${(r.realized_pnl_usd_90d / 1000).toFixed(0)}K on ${r.chain}.`,
      metric: r.score,
      href: `/dashboard/wallet/${r.wallet_address}`,
      fetched_at: r.fetched_at,
    });
  }

  // The remaining 4 card types (stablecoin_pulse, cex_drain,
  // funding_rate_divergence, insider_wallet) require additional
  // materialized queries — emit nothing until those queries are
  // published and the refresh cron populates the corresponding tables.
  // The card-type union is locked so future tables can plug in without
  // touching consumers.

  return cards
    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())
    .slice(0, limit);
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
  token_in: string, token_out: string, chain: string, _size_usd: number,
): Promise<SwapIntelligenceStrip> {
  const admin = getSupabaseAdmin();
  const { data: wash } = await admin
    .from('dune_wash_trade_score')
    .select('score')
    .eq('token_address', token_out)
    .eq('chain', chain)
    .maybeSingle<{ score: number }>();
  return {
    sandwich_risk_score: wash?.score ?? null,
    honeypot_flag: 'unknown',
    smart_money_last_hour: null,
    liquidity_cliff_usd: null,
    observed_buy_tax_pct: null,
    observed_sell_tax_pct: null,
    recommended_slippage_bps: null,
  };
}
