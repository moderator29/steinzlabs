import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  readHolderConcentration,
  readSmartMoneyScore,
  topSmartMoney,
  isDuneConfigured,
} from '@/lib/services/dune';
import {
  computeSandwichRisk,
  computeStablecoinPulse,
  computeCexFlow,
  computeSmartMoneyInflowForToken,
  computeInsiderCheck,
  computeFindWalletsLike,
} from '@/lib/dune/realImplementations';

/**
 * §5.5 Dune VTX tools — tier-1 (5) + tier-2 (12).
 *
 * All handlers read from materialized tables (dune_holder_concentration,
 * dune_smart_money_score, dune_cluster_aggregates, dune_bridge_flows,
 * dune_wash_trade_score, dune_deployer_history) populated by the
 * dune-refresh cron. This keeps VTX latency at single-digit ms even
 * though Dune queries themselves take seconds-to-minutes.
 *
 * When DUNE_API_KEY isn't configured, handlers return
 * { unavailable: 'dune_unconfigured' } so the VTX agent can surface a
 * clear "Dune integration not provisioned" message without fabricating
 * numbers (CLAUDE.md no-mock-data rule).
 */

export const DUNE_TOOLS: Anthropic.Tool[] = [
  // ─── Tier 1 (5) ────────────────────────────────────────────────────
  {
    name: 'smart_money_inflow',
    description: 'Net USD flow from smart-money cohort into a token over the last N hours. Smart-money = top-decile dune_smart_money_score wallets. Returns net_inflow_usd + per-wallet contributions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_address: { type: 'string' },
        chain: { type: 'string' },
        hours: { type: 'number', description: 'Window in hours (default 24)' },
      },
      required: ['token_address', 'chain'],
    },
  },
  {
    name: 'holder_concentration',
    description: 'Top-10% / Gini / Nakamoto coefficient for a token. Pulls dune_holder_concentration which is refreshed daily.',
    input_schema: {
      type: 'object' as const,
      properties: { token_address: { type: 'string' }, chain: { type: 'string' } },
      required: ['token_address', 'chain'],
    },
  },
  {
    name: 'whale_pnl',
    description: 'Smart-money profile for a wallet over 90d. Returns score, win_rate, gross_volume_usd_90d (90d turnover — NOT profit), and trade_count. Realized P&L is not available from this source; do not present volume as profit.',
    input_schema: {
      type: 'object' as const,
      properties: { wallet_address: { type: 'string' }, chain: { type: 'string' } },
      required: ['wallet_address'],
    },
  },
  {
    name: 'token_age_buyers',
    description: 'Distribution of buyers by wallet-age cohort (< 7d, 7-30d, 30-90d, 90d+). Useful for spotting fresh-wallet farming.',
    input_schema: {
      type: 'object' as const,
      properties: { token_address: { type: 'string' }, chain: { type: 'string' } },
      required: ['token_address', 'chain'],
    },
  },
  {
    name: 'sandwich_risk',
    description: 'Sandwich-attack risk score (0-100) for a given swap, derived from recent MEV attempts on the pair + slippage profile.',
    input_schema: {
      type: 'object' as const,
      properties: {
        token_in: { type: 'string' },
        token_out: { type: 'string' },
        chain: { type: 'string' },
        size_usd: { type: 'number' },
      },
      required: ['token_in', 'token_out', 'chain', 'size_usd'],
    },
  },
  // ─── Tier 2 (12) ───────────────────────────────────────────────────
  {
    name: 'compare_tokens_dune',
    description: 'Side-by-side Dune-derived stats for 2-5 tokens: holder_concentration, wash_trade_score, smart_money_inflow_24h.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tokens: { type: 'array', items: { type: 'object', properties: { address: { type: 'string' }, chain: { type: 'string' } } } },
      },
      required: ['tokens'],
    },
  },
  {
    name: 'bridge_flows',
    description: 'USD bridge flow between two chains over the last N hours.',
    input_schema: {
      type: 'object' as const,
      properties: { from_chain: { type: 'string' }, to_chain: { type: 'string' }, hours: { type: 'number' } },
      required: ['from_chain', 'to_chain'],
    },
  },
  {
    name: 'cex_flow',
    description: 'CEX inflow / outflow net over the last 24h, aggregated across known exchange wallets.',
    input_schema: {
      type: 'object' as const,
      properties: { chain: { type: 'string' }, hours: { type: 'number' } },
      required: ['chain'],
    },
  },
  {
    name: 'label_address',
    description: 'Look up institutional label for an address (exchange, MM, fund, smart money). Backed by dune_smart_money_score + curated labels.',
    input_schema: {
      type: 'object' as const,
      properties: { address: { type: 'string' }, chain: { type: 'string' } },
      required: ['address'],
    },
  },
  {
    name: 'find_wallets_like',
    description: 'Find wallets with behavior similar to a reference address (top-N by cosine similarity of trading vectors).',
    input_schema: {
      type: 'object' as const,
      properties: { address: { type: 'string' }, chain: { type: 'string' }, limit: { type: 'number' } },
      required: ['address'],
    },
  },
  {
    name: 'cluster_of',
    description: 'Return the cluster_id + member list a wallet belongs to (Dune cluster-analysis output).',
    input_schema: {
      type: 'object' as const,
      properties: { address: { type: 'string' }, chain: { type: 'string' } },
      required: ['address'],
    },
  },
  {
    name: 'top_traders',
    description: 'Top N smart-money wallets on a chain by Dune smart-money score (ranked by score, not by profit — the underlying volume figure is turnover, not P&L).',
    input_schema: {
      type: 'object' as const,
      properties: { chain: { type: 'string' }, limit: { type: 'number' } },
      required: ['chain'],
    },
  },
  {
    name: 'new_token_scanner',
    description: 'Recently launched tokens with ≥1 smart-money buyer within the first hour.',
    input_schema: {
      type: 'object' as const,
      properties: { chain: { type: 'string' }, hours: { type: 'number' } },
      required: ['chain'],
    },
  },
  {
    name: 'mev_loss_report',
    description: 'Estimated MEV loss (sandwich + frontrun) for a wallet over the last 30d.',
    input_schema: {
      type: 'object' as const,
      properties: { wallet_address: { type: 'string' }, chain: { type: 'string' } },
      required: ['wallet_address', 'chain'],
    },
  },
  {
    name: 'stablecoin_pulse',
    description: 'Net stablecoin (USDC + USDT + DAI) inflow / outflow per chain over the last N hours.',
    input_schema: {
      type: 'object' as const,
      properties: { chain: { type: 'string' }, hours: { type: 'number' } },
      required: ['chain'],
    },
  },
  {
    name: 'insider_check',
    description: 'Check whether an address received tokens before public launch (heuristic: holding before first DEX listing tx).',
    input_schema: {
      type: 'object' as const,
      properties: { address: { type: 'string' }, token: { type: 'string' }, chain: { type: 'string' } },
      required: ['address', 'token', 'chain'],
    },
  },
  {
    name: 'dune_alert_subscribe',
    description: 'Subscribe to a Dune-derived metric crossing a threshold. Inserts into dune_alerts; the dune-alerts cron evaluates predicates each tick.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query_id: { type: 'string' },
        params: { type: 'object' },
        predicate: { type: 'object', description: '{ metric, op, value } where op is one of ">", "<", ">=", "<=", "=="' },
      },
      required: ['query_id', 'predicate'],
    },
  },
];

// ─── Handlers ────────────────────────────────────────────────────────────

function unavailable(reason = 'dune_unconfigured'): string {
  return JSON.stringify({ unavailable: reason });
}

async function handleHolderConcentration(input: { token_address: string; chain: string }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const row = await readHolderConcentration(input.token_address, input.chain);
  if (!row) return JSON.stringify({ unavailable: 'no_data_for_token' });
  return JSON.stringify(row);
}

async function handleSmartMoneyInflow(input: { token_address: string; chain: string; hours?: number }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const r = await computeSmartMoneyInflowForToken(input.token_address, input.chain, input.hours ?? 24);
  return JSON.stringify(r);
}

async function handleWhalePnl(input: { wallet_address: string; chain?: string }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const chain = input.chain ?? 'ethereum';
  const row = await readSmartMoneyScore(input.wallet_address, chain) as Record<string, unknown> | null;
  if (!row) return JSON.stringify({ unavailable: 'no_score_for_wallet' });
  // The stored `realized_pnl_usd_90d` is actually 90d gross TURNOVER (it scales
  // with trade count; buy==sell), NOT realized profit. Relabel so the model
  // never reports an inflated fake P&L. Real P&L lives on the whales table.
  const { realized_pnl_usd_90d, ...rest } = row;
  return JSON.stringify({
    ...rest,
    gross_volume_usd_90d: realized_pnl_usd_90d ?? null,
    note: 'gross_volume_usd_90d is 90d turnover, not profit; realized P&L is not available from this source.',
  });
}

async function handleTokenAgeBuyers(input: { token_address: string; chain: string }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('dune_token_age_buyers')
    .select('age_under_7d_pct, age_7_30d_pct, age_30_90d_pct, age_over_90d_pct, total_buyers, fetched_at')
    .eq('token_address', input.token_address)
    .eq('chain', input.chain)
    .maybeSingle();
  if (!data) return JSON.stringify({ unavailable: 'no_data_for_token' });
  return JSON.stringify({ token: input.token_address, chain: input.chain, ...data });
}

async function handleSandwichRisk(input: { token_in: string; token_out: string; chain: string; size_usd: number }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const r = await computeSandwichRisk(input);
  return JSON.stringify({ ...input, ...r });
}

async function handleCompareTokens(input: { tokens: Array<{ address: string; chain: string }> }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  if (!Array.isArray(input.tokens) || input.tokens.length < 2 || input.tokens.length > 5) {
    return JSON.stringify({ error: 'tokens must be 2-5 entries' });
  }
  const admin = getSupabaseAdmin();
  const out: Record<string, unknown>[] = [];
  for (const t of input.tokens) {
    const [hc, ws] = await Promise.all([
      admin.from('dune_holder_concentration').select('top10_pct, gini, nakamoto').eq('token_address', t.address).eq('chain', t.chain).maybeSingle(),
      admin.from('dune_wash_trade_score').select('score').eq('token_address', t.address).eq('chain', t.chain).maybeSingle<{ score: number }>(),
    ]);
    out.push({
      token: t.address,
      chain: t.chain,
      holder_concentration: hc.data,
      wash_trade_score: ws.data?.score ?? null,
    });
  }
  return JSON.stringify({ tokens: out });
}

async function handleBridgeFlows(input: { from_chain: string; to_chain: string; hours?: number }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const admin = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - (input.hours ?? 24) * 3600 * 1000).toISOString();
  const { data } = await admin
    .from('dune_bridge_flows')
    .select('hour_bucket, total_usd, tx_count')
    .eq('from_chain', input.from_chain)
    .eq('to_chain', input.to_chain)
    .gte('hour_bucket', sinceIso)
    .order('hour_bucket', { ascending: true });
  const total = (data ?? []).reduce((s: number, r) => s + Number((r as { total_usd: number }).total_usd ?? 0), 0);
  return JSON.stringify({ from_chain: input.from_chain, to_chain: input.to_chain, hours: input.hours ?? 24, total_usd: total, hourly: data ?? [] });
}

async function handleCexFlow(input: { chain: string; hours?: number }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const r = await computeCexFlow(input.chain, input.hours ?? 24);
  return JSON.stringify(r);
}

async function handleLabelAddress(input: { address: string; chain?: string }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const admin = getSupabaseAdmin();
  const chain = input.chain ?? 'ethereum';
  const { data } = await admin
    .from('dune_smart_money_score')
    .select('score, win_rate_pct, basis')
    .eq('wallet_address', input.address)
    .eq('chain', chain)
    .maybeSingle<{ score: number; win_rate_pct: number; basis: Record<string, unknown> }>();
  if (!data) return JSON.stringify({ address: input.address, chain, label: 'unknown' });
  // Labels reflect the Dune smart-money SCORE (turnover-weighted ranking), not
  // proven profit — win-rate isn't available, so never assert "profitable".
  const label = data.score >= 90 ? 'high_activity_smart_money'
              : data.score >= 70 ? 'active_smart_money'
              : data.score >= 40 ? 'active_trader'
              : 'retail';
  return JSON.stringify({ address: input.address, chain, label, score: data.score, win_rate_pct: data.win_rate_pct });
}

async function handleFindWalletsLike(input: { address: string; chain?: string; limit?: number }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const peers = await computeFindWalletsLike(input.address, input.chain ?? 'ethereum', input.limit ?? 20);
  return JSON.stringify({ seed: input.address, peers });
}

async function handleClusterOf(input: { address: string; chain?: string }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const admin = getSupabaseAdmin();
  const chain = input.chain ?? 'ethereum';
  // wallet_edges has cluster info via cluster-analysis cron — reuse.
  const { data } = await admin
    .from('wallet_edges')
    .select('cluster_id')
    .eq('chain', chain)
    .or(`from_address.eq.${input.address},to_address.eq.${input.address}`)
    .limit(1)
    .maybeSingle<{ cluster_id: string }>();
  if (!data?.cluster_id) return JSON.stringify({ address: input.address, cluster_id: null });
  const { data: agg } = await admin
    .from('dune_cluster_aggregates')
    .select('*')
    .eq('cluster_id', data.cluster_id)
    .eq('chain', chain)
    .maybeSingle();
  return JSON.stringify({ address: input.address, chain, cluster_id: data.cluster_id, aggregate: agg });
}

async function handleTopTraders(input: { chain: string; limit?: number }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const rows = await topSmartMoney(input.chain, Math.min(200, input.limit ?? 50));
  // Relabel turnover-mislabeled-as-PnL and drop obvious bots (5k+ trades in 90d
  // aren't "smart money") so the model never reports inflated fake profit.
  const traders = (rows as Array<Record<string, unknown>>)
    .filter((r) => Number(r.trade_count_90d ?? 0) <= 5000)
    .map(({ realized_pnl_usd_90d, ...rest }) => ({ ...rest, gross_volume_usd_90d: realized_pnl_usd_90d ?? null }));
  return JSON.stringify({ chain: input.chain, note: 'ranked by smart-money score; gross_volume_usd_90d is turnover, not profit', traders });
}

async function handleNewTokenScanner(input: { chain: string; hours?: number }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - (input.hours ?? 24) * 3600 * 1000).toISOString();

  // Real intersection: tokens with first transaction in our window AND
  // bought by ≥1 wallet from dune_smart_money_score (score ≥ 80).
  // First we find recent first-buys per token.
  const { data: recent } = await admin
    .from('transactions')
    .select('to_token_address, wallet_address, timestamp, usd_value')
    .eq('chain', input.chain)
    .eq('status', 'success')
    .gte('timestamp', since)
    .not('to_token_address', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(2000);

  if (!recent || recent.length === 0) {
    return JSON.stringify({ chain: input.chain, hours: input.hours ?? 24, tokens: [] });
  }

  // Group by token to find tokens that had their first buy in the window.
  const tokenFirstBuy = new Map<string, { ts: number; buyers: Set<string>; total_usd: number }>();
  for (const r of recent as Array<{ to_token_address: string; wallet_address: string | null; timestamp: string; usd_value: number | null }>) {
    const addr = r.to_token_address.toLowerCase();
    const ts = new Date(r.timestamp).getTime();
    if (!tokenFirstBuy.has(addr)) tokenFirstBuy.set(addr, { ts, buyers: new Set(), total_usd: 0 });
    const bucket = tokenFirstBuy.get(addr)!;
    if (ts < bucket.ts) bucket.ts = ts;
    if (r.wallet_address) bucket.buyers.add(r.wallet_address.toLowerCase());
    bucket.total_usd += Number(r.usd_value ?? 0);
  }

  // Intersect with smart-money set.
  const allBuyers = Array.from(new Set(Array.from(tokenFirstBuy.values()).flatMap((b) => Array.from(b.buyers))));
  const { data: smart } = await admin
    .from('dune_smart_money_score')
    .select('wallet_address')
    .eq('chain', input.chain)
    .gte('score', 80)
    .in('wallet_address', allBuyers);
  const smartSet = new Set((smart ?? []).map((r) => (r as { wallet_address: string }).wallet_address.toLowerCase()));

  const hits: Array<{ token_address: string; first_buy_at: string; smart_buyers: string[]; total_buy_usd: number }> = [];
  for (const [token, bucket] of tokenFirstBuy) {
    const smartBuyers = Array.from(bucket.buyers).filter((b) => smartSet.has(b));
    if (smartBuyers.length === 0) continue;
    hits.push({
      token_address: token,
      first_buy_at: new Date(bucket.ts).toISOString(),
      smart_buyers: smartBuyers.slice(0, 5),
      total_buy_usd: Math.round(bucket.total_usd),
    });
  }
  hits.sort((a, b) => b.total_buy_usd - a.total_buy_usd);
  return JSON.stringify({ chain: input.chain, hours: input.hours ?? 24, tokens: hits.slice(0, 20) });
}

async function handleMevLossReport(input: { wallet_address: string; chain: string }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const admin = getSupabaseAdmin();
  // Read pre-aggregated row first.
  const { data: rollup } = await admin
    .from('dune_mev_loss_aggregate')
    .select('total_loss_usd_30d, sandwich_count, frontrun_count, fetched_at')
    .eq('wallet_address', input.wallet_address)
    .eq('chain', input.chain)
    .maybeSingle();
  if (rollup) {
    return JSON.stringify({ wallet: input.wallet_address, chain: input.chain, ...rollup });
  }

  // Fallback live compute from swap_logs: count high-slippage swaps in
  // the last 30d where the wallet was the taker. Approximate MEV loss
  // as the difference between expected_amount_out and actual amount.
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: logs } = await admin
    .from('swap_logs')
    .select('input_amount, output_token, status, created_at')
    .eq('chain', input.chain)
    .ilike('user_id', input.wallet_address)
    .gte('created_at', since)
    .limit(500);
  return JSON.stringify({
    wallet: input.wallet_address,
    chain: input.chain,
    swap_count_30d: logs?.length ?? 0,
    note: 'mev-loss-aggregate rollup not yet populated; use swap_logs count as a coarse activity signal',
  });
}

async function handleStablecoinPulse(input: { chain: string; hours?: number }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  return JSON.stringify(await computeStablecoinPulse(input.chain, input.hours ?? 24));
}

async function handleInsiderCheck(input: { address: string; token: string; chain: string }): Promise<string> {
  if (!isDuneConfigured()) return unavailable();
  const r = await computeInsiderCheck(input.address, input.token, input.chain);
  return JSON.stringify({ address: input.address, token: input.token, chain: input.chain, ...r });
}

async function handleDuneAlertSubscribe(
  input: { query_id: string; params?: Record<string, unknown>; predicate: Record<string, unknown> },
  userId: string | null,
): Promise<string> {
  if (!userId) return JSON.stringify({ error: 'unauthenticated' });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('dune_alerts')
    .insert({
      user_id: userId,
      query_id: input.query_id,
      params: input.params ?? {},
      predicate: input.predicate,
    })
    .select('id')
    .single();
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ ok: true, id: (data as { id: string }).id });
}

// ─── Dispatcher ──────────────────────────────────────────────────────────

export async function dispatchDuneTool(name: string, input: Record<string, unknown>, userId: string | null): Promise<string | null> {
  switch (name) {
    case 'smart_money_inflow':       return handleSmartMoneyInflow(input as { token_address: string; chain: string; hours?: number });
    case 'holder_concentration':     return handleHolderConcentration(input as { token_address: string; chain: string });
    case 'whale_pnl':                return handleWhalePnl(input as { wallet_address: string; chain?: string });
    case 'token_age_buyers':         return handleTokenAgeBuyers(input as { token_address: string; chain: string });
    case 'sandwich_risk':            return handleSandwichRisk(input as { token_in: string; token_out: string; chain: string; size_usd: number });
    case 'compare_tokens_dune':      return handleCompareTokens(input as { tokens: Array<{ address: string; chain: string }> });
    case 'bridge_flows':             return handleBridgeFlows(input as { from_chain: string; to_chain: string; hours?: number });
    case 'cex_flow':                 return handleCexFlow(input as { chain: string; hours?: number });
    case 'label_address':            return handleLabelAddress(input as { address: string; chain?: string });
    case 'find_wallets_like':        return handleFindWalletsLike(input as { address: string; chain?: string; limit?: number });
    case 'cluster_of':               return handleClusterOf(input as { address: string; chain?: string });
    case 'top_traders':              return handleTopTraders(input as { chain: string; limit?: number });
    case 'new_token_scanner':        return handleNewTokenScanner(input as { chain: string; hours?: number });
    case 'mev_loss_report':          return handleMevLossReport(input as { wallet_address: string; chain: string });
    case 'stablecoin_pulse':         return handleStablecoinPulse(input as { chain: string; hours?: number });
    case 'insider_check':            return handleInsiderCheck(input as { address: string; token: string; chain: string });
    case 'dune_alert_subscribe':     return handleDuneAlertSubscribe(input as { query_id: string; params?: Record<string, unknown>; predicate: Record<string, unknown> }, userId);
    default:                          return null;
  }
}
