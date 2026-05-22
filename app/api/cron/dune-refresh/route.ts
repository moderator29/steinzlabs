import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { runDuneQuery, isDuneConfigured, getBudgetStatus } from '@/lib/services/dune';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §5.4 — refresh the 7 materialized Dune tables on tier-appropriate
 * cadence. The cron runs daily; per-query freshness is governed by
 * passing different ttl_seconds to runDuneQuery (which honors our cache
 * layer + monthly credit budget).
 *
 * Owner sets DUNE_QUERY_* env vars to the actual Dune query IDs once
 * published. The cron loops over the configured ones; missing IDs just
 * skip that table this tick.
 *
 * §5.7 caching tier table:
 *   daily       → 24h TTL  → ~30 credits/day → ~900/mo per query
 *   hourly      → 60min TTL → ~720 credits/day → keep tight
 *   on-demand   → no scheduled refresh, only cache-on-read
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface RefreshTarget {
  table: string;
  query_env: string;
  ttl_seconds: number;
  cost_credits: number;
  mapper: (rows: unknown[]) => Array<Record<string, unknown>>;
  primary_key: string[];
}

function mapHolderConcentration(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      token_address: String(x.token_address ?? x.token ?? ''),
      chain: String(x.chain ?? 'ethereum'),
      top1_pct: x.top1_pct ?? null,
      top10_pct: x.top10_pct ?? null,
      top50_pct: x.top50_pct ?? null,
      top100_pct: x.top100_pct ?? null,
      gini: x.gini ?? null,
      nakamoto: x.nakamoto ?? null,
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.token_address);
}

function mapSmartMoneyScore(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      wallet_address: String(x.wallet_address ?? x.wallet ?? ''),
      chain: String(x.chain ?? 'ethereum'),
      score: Number(x.score ?? 0),
      win_rate_pct: x.win_rate_pct ?? null,
      realized_pnl_usd_90d: x.realized_pnl_usd_90d ?? null,
      trade_count_90d: x.trade_count_90d ?? null,
      basis: x.basis ?? {},
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.wallet_address);
}

function mapBridgeFlows(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      from_chain: String(x.from_chain ?? ''),
      to_chain: String(x.to_chain ?? ''),
      hour_bucket: x.hour_bucket ?? new Date().toISOString(),
      total_usd: Number(x.total_usd ?? 0),
      tx_count: Number(x.tx_count ?? 0),
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.from_chain && r.to_chain);
}

function mapWashTradeScore(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      token_address: String(x.token_address ?? ''),
      chain: String(x.chain ?? 'ethereum'),
      score: Number(x.score ?? 0),
      flagged_pairs: Number(x.flagged_pairs ?? 0),
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.token_address);
}

function mapDeployerHistory(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      deployer_address: String(x.deployer_address ?? ''),
      chain: String(x.chain ?? 'ethereum'),
      total_deployed: Number(x.total_deployed ?? 0),
      total_rugged: Number(x.total_rugged ?? 0),
      total_successful: Number(x.total_successful ?? 0),
      oldest_deploy_at: x.oldest_deploy_at ?? null,
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.deployer_address);
}

function mapClusterAggregates(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      cluster_id: String(x.cluster_id ?? ''),
      chain: String(x.chain ?? 'ethereum'),
      member_count: Number(x.member_count ?? 0),
      total_volume_usd_24h: Number(x.total_volume_usd_24h ?? 0),
      net_flow_usd_24h: Number(x.net_flow_usd_24h ?? 0),
      primary_label: x.primary_label ?? null,
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.cluster_id);
}

// ─── §5 audit-gap mappers (5 new tables) ─────────────────────────────────

function mapTokenAgeBuyers(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      token_address: String(x.token_address ?? ''),
      chain: String(x.chain ?? 'ethereum'),
      age_under_7d_pct: x.age_under_7d_pct ?? null,
      age_7_30d_pct: x.age_7_30d_pct ?? null,
      age_30_90d_pct: x.age_30_90d_pct ?? null,
      age_over_90d_pct: x.age_over_90d_pct ?? null,
      total_buyers: x.total_buyers ?? null,
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.token_address);
}

function mapSmartMoneyTokenFlow(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      token_address: String(x.token_address ?? ''),
      chain: String(x.chain ?? 'ethereum'),
      net_inflow_usd_24h: Number(x.net_inflow_usd_24h ?? 0),
      buyers_24h: Number(x.buyers_24h ?? 0),
      sellers_24h: Number(x.sellers_24h ?? 0),
      unique_wallets_24h: Number(x.unique_wallets_24h ?? 0),
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.token_address);
}

function mapStablecoinPulse(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      chain: String(x.chain ?? 'ethereum'),
      hour_bucket: x.hour_bucket ?? new Date().toISOString(),
      usdc_net_flow_usd: Number(x.usdc_net_flow_usd ?? 0),
      usdt_net_flow_usd: Number(x.usdt_net_flow_usd ?? 0),
      dai_net_flow_usd: Number(x.dai_net_flow_usd ?? 0),
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.chain);
}

function mapCexFlow(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      chain: String(x.chain ?? 'ethereum'),
      exchange: String(x.exchange ?? ''),
      hour_bucket: x.hour_bucket ?? new Date().toISOString(),
      net_inflow_usd: Number(x.net_inflow_usd ?? 0),
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.exchange);
}

function mapMevLossAggregate(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      wallet_address: String(x.wallet_address ?? ''),
      chain: String(x.chain ?? 'ethereum'),
      total_loss_usd_30d: Number(x.total_loss_usd_30d ?? 0),
      sandwich_count: Number(x.sandwich_count ?? 0),
      frontrun_count: Number(x.frontrun_count ?? 0),
      fetched_at: new Date().toISOString(),
    };
  }).filter((r) => r.wallet_address);
}

const TARGETS: RefreshTarget[] = [
  { table: 'dune_holder_concentration', query_env: 'DUNE_QUERY_HOLDER_CONCENTRATION', ttl_seconds: 86_400, cost_credits: 30, mapper: mapHolderConcentration, primary_key: ['token_address', 'chain'] },
  { table: 'dune_smart_money_score',     query_env: 'DUNE_QUERY_SMART_MONEY',         ttl_seconds: 86_400, cost_credits: 50, mapper: mapSmartMoneyScore,    primary_key: ['wallet_address', 'chain'] },
  { table: 'dune_bridge_flows',          query_env: 'DUNE_QUERY_BRIDGE_FLOWS',        ttl_seconds: 3_600,  cost_credits: 20, mapper: mapBridgeFlows,        primary_key: ['from_chain', 'to_chain', 'hour_bucket'] },
  { table: 'dune_wash_trade_score',      query_env: 'DUNE_QUERY_WASH_TRADE',          ttl_seconds: 86_400, cost_credits: 30, mapper: mapWashTradeScore,     primary_key: ['token_address', 'chain'] },
  { table: 'dune_deployer_history',      query_env: 'DUNE_QUERY_DEPLOYER_HISTORY',    ttl_seconds: 86_400, cost_credits: 30, mapper: mapDeployerHistory,    primary_key: ['deployer_address', 'chain'] },
  { table: 'dune_cluster_aggregates',    query_env: 'DUNE_QUERY_CLUSTER_AGGREGATES',  ttl_seconds: 86_400, cost_credits: 40, mapper: mapClusterAggregates,  primary_key: ['cluster_id', 'chain'] },
  // §5 audit-gap rollups (2026_05_22 migration adds the underlying tables).
  // Each maps from a separate Dune query — DUNE_QUERY_TOKEN_AGE_BUYERS,
  // DUNE_QUERY_SMART_MONEY_FLOW, DUNE_QUERY_STABLECOIN_PULSE,
  // DUNE_QUERY_CEX_FLOW, DUNE_QUERY_MEV_LOSS — owner publishes each on
  // dune.com then pastes the IDs into Vercel envs. Missing IDs are
  // skipped with reason=no_query_id (no behavior change).
  { table: 'dune_token_age_buyers',       query_env: 'DUNE_QUERY_TOKEN_AGE_BUYERS',    ttl_seconds: 86_400, cost_credits: 25, mapper: mapTokenAgeBuyers,     primary_key: ['token_address', 'chain'] },
  { table: 'dune_smart_money_token_flow', query_env: 'DUNE_QUERY_SMART_MONEY_FLOW',    ttl_seconds: 21_600, cost_credits: 50, mapper: mapSmartMoneyTokenFlow, primary_key: ['token_address', 'chain'] },
  { table: 'dune_stablecoin_pulse',       query_env: 'DUNE_QUERY_STABLECOIN_PULSE',    ttl_seconds: 3_600,  cost_credits: 20, mapper: mapStablecoinPulse,     primary_key: ['chain', 'hour_bucket'] },
  { table: 'dune_cex_flow',               query_env: 'DUNE_QUERY_CEX_FLOW',            ttl_seconds: 3_600,  cost_credits: 20, mapper: mapCexFlow,             primary_key: ['chain', 'exchange', 'hour_bucket'] },
  { table: 'dune_mev_loss_aggregate',     query_env: 'DUNE_QUERY_MEV_LOSS',            ttl_seconds: 86_400, cost_credits: 30, mapper: mapMevLossAggregate,    primary_key: ['wallet_address', 'chain'] },
];

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  if (!isDuneConfigured()) {
    return cronResponse('dune-refresh', startedAt, { skipped: 'dune_unconfigured' });
  }

  const budget = await getBudgetStatus();
  if (budget.block) {
    return cronResponse('dune-refresh', startedAt, { skipped: 'budget_blocked', utilization: budget.utilization });
  }
  if (budget.warn) {
    // Soft warning — still proceed but log it.
    try {
      const admin = getSupabaseAdmin();
      await admin.from('system_alerts').insert({
        source: 'dune-refresh',
        tier: 1,
        message: `Dune credit utilization at ${(budget.utilization * 100).toFixed(0)}% — consider upgrading plan`,
        metadata: { used: budget.used, cap: budget.cap },
      });
    } catch { /* telemetry — non-fatal */ }
  }

  const admin = getSupabaseAdmin();
  let totalRefreshed = 0;
  const perTable: Array<{ table: string; rows: number; skipped?: string }> = [];

  for (const t of TARGETS) {
    const queryId = process.env[t.query_env];
    if (!queryId) {
      perTable.push({ table: t.table, rows: 0, skipped: 'no_query_id' });
      continue;
    }
    try {
      const r = await runDuneQuery({ query_id: queryId, ttl_seconds: t.ttl_seconds, cost_credits: t.cost_credits });
      if (!r.ok) {
        perTable.push({ table: t.table, rows: 0, skipped: r.reason });
        continue;
      }
      const mapped = t.mapper(r.rows);
      if (mapped.length === 0) {
        perTable.push({ table: t.table, rows: 0, skipped: 'empty_result' });
        continue;
      }
      const { error } = await admin.from(t.table).upsert(mapped, { onConflict: t.primary_key.join(',') });
      if (error) {
        perTable.push({ table: t.table, rows: 0, skipped: error.message });
        continue;
      }
      perTable.push({ table: t.table, rows: mapped.length });
      totalRefreshed += mapped.length;
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'dune-refresh', table: t.table } });
      perTable.push({ table: t.table, rows: 0, skipped: 'exception' });
    }
  }

  return cronResponse('dune-refresh', startedAt, {
    total_refreshed: totalRefreshed,
    budget_utilization: budget.utilization,
    per_table: perTable,
  });
}
