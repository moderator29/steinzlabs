import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBestPair } from '@/lib/services/dexscreener';

/**
 * VTX Sentinel evaluator — the autonomous watch brain.
 *
 * Unlike single-threshold Smart Alerts (user sets "price > X"), a Sentinel
 * decides for itself what is MATERIAL about its target and only speaks when
 * something real changes. Every signal it reports is measured from live data
 * (DexScreener for token price/liquidity/FDV, whale_activity + convergence for
 * cohort behaviour). It NEVER fabricates a change: the first check just records
 * a baseline (no alert), and later checks only fire on a real delta vs that
 * baseline. Honest by construction.
 */

export interface TokenSnapshot {
  kind: 'token';
  symbol: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  convergenceWallets: number;
  at: string;
}
export interface WalletSnapshot {
  kind: 'wallet';
  lastMoveCount: number;
  at: string;
}
export type Snapshot = TokenSnapshot | WalletSnapshot;

export interface SentinelRow {
  id: string;
  user_id: string;
  target_type: 'token' | 'wallet';
  target: string;
  chain: string;
  label: string | null;
  last_checked_at: string | null;
  last_snapshot: Snapshot | null;
}

export interface EvalResult {
  changes: string[];
  snapshot: Snapshot;
}

// Material-change thresholds. Deliberately conservative so the Sentinel is
// signal, not noise.
const PRICE_MOVE_PCT = 25;      // ±25% price move since last check
const LIQ_DROP_RATIO = 0.7;     // liquidity fell below 70% of prior (a 30%+ pull)
const CONVERGENCE_MIN = 3;      // ≥3 cohort wallets = a real convergence
const LARGE_MOVE_USD = 25_000;  // a single cohort trade worth flagging

async function tokenSnapshot(sb: SupabaseClient, chain: string, token: string): Promise<TokenSnapshot> {
  const best = await getBestPair(token).catch(() => null);
  let convergenceWallets = 0;
  try {
    const { data } = await sb
      .from('smart_money_convergence')
      .select('wallet_count')
      .eq('is_active', true)
      .ilike('token_address', token)
      .order('wallet_count', { ascending: false })
      .limit(1)
      .maybeSingle();
    convergenceWallets = Number((data as { wallet_count?: number } | null)?.wallet_count ?? 0);
  } catch { /* convergence is optional enrichment */ }

  return {
    kind: 'token',
    symbol: best?.baseToken?.symbol ?? null,
    priceUsd: best ? Number(best.priceUsd) || null : null,
    liquidityUsd: best ? Number(best.liquidity?.usd) || null : null,
    fdvUsd: best ? Number(best.fdv) || Number(best.marketCap) || null : null,
    convergenceWallets,
    at: new Date().toISOString(),
  };
}

function diffToken(prev: TokenSnapshot | null, cur: TokenSnapshot): string[] {
  if (!prev) return []; // first check = baseline only, never a spurious alert
  const changes: string[] = [];
  const sym = cur.symbol || 'token';

  if (prev.priceUsd && cur.priceUsd) {
    const pct = ((cur.priceUsd - prev.priceUsd) / prev.priceUsd) * 100;
    if (Math.abs(pct) >= PRICE_MOVE_PCT) {
      changes.push(`${sym} price ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(0)}% since last check ($${prev.priceUsd.toPrecision(3)} → $${cur.priceUsd.toPrecision(3)}).`);
    }
  }
  if (prev.liquidityUsd && cur.liquidityUsd != null && cur.liquidityUsd < prev.liquidityUsd * LIQ_DROP_RATIO) {
    const dropPct = ((prev.liquidityUsd - cur.liquidityUsd) / prev.liquidityUsd) * 100;
    changes.push(`${sym} liquidity dropped ${dropPct.toFixed(0)}% ($${Math.round(prev.liquidityUsd).toLocaleString()} → $${Math.round(cur.liquidityUsd).toLocaleString()}): a rug-enabling move.`);
  }
  if (cur.convergenceWallets >= CONVERGENCE_MIN && cur.convergenceWallets > (prev.convergenceWallets ?? 0)) {
    changes.push(`Smart money is converging on ${sym}: ${cur.convergenceWallets} cohort wallets now accumulating (was ${prev.convergenceWallets ?? 0}).`);
  }
  return changes;
}

async function evaluateWallet(sb: SupabaseClient, s: SentinelRow): Promise<EvalResult> {
  // Look at cohort moves since the last check (or the last 35 min on first run).
  const cutoff = s.last_checked_at ?? new Date(Date.now() - 35 * 60_000).toISOString();
  const isFirst = !s.last_snapshot;
  let q = sb.from('whale_activity')
    .select('token_symbol, action, value_usd, timestamp')
    .ilike('whale_address', s.target)
    .gt('timestamp', cutoff)
    .order('value_usd', { ascending: false })
    .limit(10);
  if (s.chain) q = q.eq('chain', s.chain);
  const { data } = await q;
  const moves = (data ?? []) as Array<{ token_symbol: string | null; action: string; value_usd: number | null; timestamp: string }>;

  const changes: string[] = [];
  if (!isFirst) {
    const large = moves.filter((m) => Number(m.value_usd ?? 0) >= LARGE_MOVE_USD);
    for (const m of large.slice(0, 3)) {
      changes.push(`${(m.action || 'move').toUpperCase()} $${Math.round(Number(m.value_usd)).toLocaleString()} of ${m.token_symbol || 'a token'}.`);
    }
    if (large.length > 3) changes.push(`…and ${large.length - 3} more large move(s).`);
  }
  return {
    changes,
    snapshot: { kind: 'wallet', lastMoveCount: moves.length, at: new Date().toISOString() },
  };
}

export async function evaluateSentinel(sb: SupabaseClient, s: SentinelRow): Promise<EvalResult> {
  if (s.target_type === 'token') {
    const cur = await tokenSnapshot(sb, s.chain, s.target);
    const prev = s.last_snapshot && s.last_snapshot.kind === 'token' ? s.last_snapshot : null;
    return { changes: diffToken(prev, cur), snapshot: cur };
  }
  return evaluateWallet(sb, s);
}
