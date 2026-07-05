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
  | 'cex_inflow'
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
// Compact USD with a full T/B/M/K ladder — a $11.4B realized PnL must read
// "$11.4B", never "$11414317K" (the old hard-/1000 "K" bug).
function fmtUsdC(n: number): string {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  if (v >= 1e12) return `${sign}$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${sign}$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(1)}K`;
  return `${sign}$${v.toFixed(0)}`;
}

// A contract/wallet that is null, empty, or the zero/burn address is junk data —
// never surface it as a feed card (kills "High MEV risk on 0x000000…").
const ZERO_ADDR = /^0x0+$/i;
function isRealAddress(a: string | null | undefined): a is string {
  if (!a || typeof a !== 'string') return false;
  const t = a.trim();
  if (t.length < 8) return false;
  if (ZERO_ADDR.test(t)) return false;
  if (/^0x0{4,}/i.test(t)) return false; // 0x0000… prefixes
  return true;
}

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
      body: `${fmtUsdC(b.total_usd)} bridged in the last hour.`,
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
    if (!isRealAddress(m.token_address)) continue; // skip null/zero-address junk
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
    if (!isRealAddress(r.wallet_address)) continue; // skip null/zero-address junk
    cards.push({
      type: 'smart_money_rotation',
      title: `Elite trader active: ${r.wallet_address.slice(0, 8)}…`,
      body: `Score ${r.score}/100 · 90d realized ${fmtUsdC(r.realized_pnl_usd_90d)} on ${r.chain}.`,
      metric: r.score,
      href: `/dashboard/wallet/${r.wallet_address}`,
      fetched_at: r.fetched_at,
    });
  }

  // stablecoin_pulse — sum the last hour of stablecoin net flows across
  // chains (dune_stablecoin_pulse populated by extended dune-refresh cron).
  const { data: pulse } = await admin
    .from('dune_stablecoin_pulse')
    .select('chain, hour_bucket, usdc_net_flow_usd, usdt_net_flow_usd, dai_net_flow_usd')
    .gte('hour_bucket', new Date(Date.now() - 3600 * 1000).toISOString())
    .limit(3);
  for (const p of (pulse ?? []) as Array<{ chain: string; hour_bucket: string; usdc_net_flow_usd: number; usdt_net_flow_usd: number; dai_net_flow_usd: number }>) {
    const total = Number(p.usdc_net_flow_usd ?? 0) + Number(p.usdt_net_flow_usd ?? 0) + Number(p.dai_net_flow_usd ?? 0);
    if (Math.abs(total) < 1_000_000) continue;
    cards.push({
      type: 'stablecoin_pulse',
      title: `Stablecoin ${total >= 0 ? 'inflow' : 'outflow'} on ${p.chain}`,
      body: `Net ${total >= 0 ? '+' : ''}$${(total / 1_000_000).toFixed(2)}M in the last hour across USDC/USDT/DAI.`,
      metric: total,
      fetched_at: p.hour_bucket,
    });
  }

  // cex_drain — biggest net CEX outflow in the last hour (negative
  // net_inflow_usd from dune_cex_flow means coins leaving the exchange,
  // which historically precedes price rises).
  const { data: drain } = await admin
    .from('dune_cex_flow')
    .select('chain, exchange, net_inflow_usd, hour_bucket')
    .gte('hour_bucket', new Date(Date.now() - 3600 * 1000).toISOString())
    .lt('net_inflow_usd', 0)
    .order('net_inflow_usd', { ascending: true })
    .limit(3);
  for (const d of (drain ?? []) as Array<{ chain: string; exchange: string; net_inflow_usd: number; hour_bucket: string }>) {
    cards.push({
      type: 'cex_drain',
      title: `${d.exchange} outflow on ${d.chain}`,
      body: `$${(Math.abs(d.net_inflow_usd) / 1_000_000).toFixed(2)}M withdrawn in the last hour.`,
      metric: Math.abs(d.net_inflow_usd),
      fetched_at: d.hour_bucket,
    });
  }

  // cex_inflow — biggest net CEX INflow in the last hour (positive
  // net_inflow_usd means coins moving ONTO the exchange, which historically
  // precedes sell pressure). The drain query above only selected net<0, so
  // half the signal (deposits) was silently dropped — this surfaces it.
  const { data: inflow } = await admin
    .from('dune_cex_flow')
    .select('chain, exchange, net_inflow_usd, hour_bucket')
    .gte('hour_bucket', new Date(Date.now() - 3600 * 1000).toISOString())
    .gt('net_inflow_usd', 0)
    .order('net_inflow_usd', { ascending: false })
    .limit(3);
  for (const d of (inflow ?? []) as Array<{ chain: string; exchange: string; net_inflow_usd: number; hour_bucket: string }>) {
    cards.push({
      type: 'cex_inflow',
      title: `${d.exchange} inflow on ${d.chain}`,
      body: `$${(d.net_inflow_usd / 1_000_000).toFixed(2)}M deposited to the exchange in the last hour.`,
      metric: d.net_inflow_usd,
      fetched_at: d.hour_bucket,
    });
  }

  // insider_wallet — wallets that bought a token before its public
  // listing (negative lead_time_hours from dune_insider_wallets).
  // Populated by /api/cron/insider-wallet-detector.
  const { data: insiders } = await admin
    .from('dune_insider_wallets')
    .select('wallet_address, token_address, chain, lead_time_hours, buy_usd, detected_at')
    .gte('detected_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .lt('lead_time_hours', -1)                                  // strict: bought ≥1h before listing
    .order('lead_time_hours', { ascending: true })
    .limit(3);
  for (const i of (insiders ?? []) as Array<{ wallet_address: string; token_address: string; chain: string; lead_time_hours: number; buy_usd: number; detected_at: string }>) {
    const hours = Math.abs(i.lead_time_hours);
    cards.push({
      type: 'insider_wallet',
      title: `Insider wallet detected on ${i.chain}`,
      body: `${i.wallet_address.slice(0, 8)}… bought ${hours.toFixed(1)}h before public listing ($${Math.round(i.buy_usd ?? 0).toLocaleString()}).`,
      metric: hours,
      href: `/dashboard/market/${i.chain}/${i.token_address}`,
      fetched_at: i.detected_at,
    });
  }

  // funding_rate_divergence — perps trading at a meaningfully different
  // price than spot (>1% gap or extreme funding). Populated by
  // /api/cron/funding-rates-snapshot from Hyperliquid + CoinGecko spot.
  const { data: funding } = await admin
    .from('funding_rate_snapshots')
    .select('exchange, symbol, funding_rate_hr, divergence_pct, fetched_at')
    .gte('fetched_at', new Date(Date.now() - 2 * 3600 * 1000).toISOString())
    .or('divergence_pct.gte.1,divergence_pct.lte.-1,funding_rate_hr.gte.0.001,funding_rate_hr.lte.-0.001')
    .order('fetched_at', { ascending: false })
    .limit(3);
  for (const f of (funding ?? []) as Array<{ exchange: string; symbol: string; funding_rate_hr: number; divergence_pct: number | null; fetched_at: string }>) {
    const divPct = f.divergence_pct;
    const fundPctAnnual = f.funding_rate_hr * 24 * 365 * 100;     // annualized %
    const divText = divPct !== null && Math.abs(divPct) >= 1
      ? `Perp ${divPct >= 0 ? '+' : ''}${divPct.toFixed(2)}% vs spot`
      : `Funding ${fundPctAnnual >= 0 ? '+' : ''}${fundPctAnnual.toFixed(1)}% APR`;
    cards.push({
      type: 'funding_rate_divergence',
      title: `${f.symbol} ${f.exchange} divergence`,
      body: `${divText}. Positive = longs paying shorts; negative = shorts paying longs.`,
      metric: divPct ?? fundPctAnnual,
      fetched_at: f.fetched_at,
    });
  }

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
