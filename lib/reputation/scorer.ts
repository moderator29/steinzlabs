import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * 5-component success-rate scorer (Section 1.4 spec).
 *
 *   35% copy-trade win rate     — % of copied trades that closed in profit
 *   25% whale-pick accuracy     — % of followed whales with positive 30d PnL
 *   20% portfolio performance   — 30d portfolio percentile vs all platform users
 *   10% community score         — endorsements + helpful contribs - reports
 *   10% activity score          — daily active usage / feature exploration
 *
 * Each component returns a 0..100 number (or null when there's not
 * enough data to score that axis — null components are dropped and
 * the remaining weights are renormalized so a brand-new user with
 * only activity data still gets a score, just an honest one).
 *
 * Pure functions per component so unit tests can drive them with
 * fixture inputs without hitting Supabase.
 */

export interface ScoreComponents {
  copy_trade_winrate: number | null;
  whale_pick_accuracy: number | null;
  portfolio_perf_pct: number | null;
  community_score: number | null;
  activity_score: number | null;
}

export interface ScoreResult {
  success_rate: number | null;
  total_score: number | null;
  components: ScoreComponents;
}

const WEIGHTS = {
  copy_trade_winrate:  0.35,
  whale_pick_accuracy: 0.25,
  portfolio_perf_pct:  0.20,
  community_score:     0.10,
  activity_score:      0.10,
} as const;

/**
 * Combine components into a single 0..100 score. Renormalizes weights
 * over the non-null components so a user with only activity data
 * isn't penalized to a near-zero score for lacking copy trades.
 *
 * Edge cases:
 *   - All components null → return 50 (the neutral default).
 *   - Single component → that component is the score (weight = 100%).
 */
export function combineComponents(c: ScoreComponents): number | null {
  const entries = (Object.keys(WEIGHTS) as Array<keyof ScoreComponents>)
    .map((k) => ({ k, v: c[k], w: WEIGHTS[k] }))
    .filter((e) => typeof e.v === 'number' && Number.isFinite(e.v));
  // No components → no score. Return null so a zero-activity user renders "—",
  // never a fabricated neutral 50 "success rate".
  if (entries.length === 0) return null;
  const totalW = entries.reduce((s, e) => s + e.w, 0);
  const weighted = entries.reduce((s, e) => s + (e.v as number) * e.w, 0);
  return Math.round(Math.max(0, Math.min(100, weighted / totalW)));
}

// ----------------- Per-component component readers -----------------
// Each pulls the minimum data needed to score one axis. They can be
// driven by tests by passing fixture data into combineComponents
// directly; this file is the production wiring.

export async function scoreCopyTradeWinRate(userId: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  // §user_copy_trades scorer was joining a non-existent `closed_at` column,
  // so even when trades reconciled with a real pnl_usd the win-rate query
  // returned nothing and Top Copy Traders stayed empty. Use the actual
  // `receipt_reconciled_at` column the execute pipeline writes when the
  // tx receipt lands. pnl_usd is only meaningful after reconciliation.
  const { data } = await sb
    .from('user_copy_trades')
    .select('pnl_usd, receipt_reconciled_at')
    .eq('user_id', userId)
    .not('receipt_reconciled_at', 'is', null)
    .not('pnl_usd', 'is', null)
    .gte('receipt_reconciled_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  const trades = data ?? [];
  if (trades.length < 3) return null;
  const wins = trades.filter((t) => Number(t.pnl_usd ?? 0) > 0).length;
  return Math.round((wins / trades.length) * 100);
}

export async function scoreWhalePickAccuracy(userId: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  const { data: follows } = await sb
    .from('user_whale_follows')
    .select('whale_id, whale_address, chain')
    .eq('user_id', userId);
  if (!follows || follows.length === 0) return null;

  // §S1-DATA — whale_id is NULL for follows added before the address-join
  // backfill. Resolve those by (LOWER(whale_address), chain) → whales.id
  // so accuracy scoring still works during the transition.
  const idsFromColumn = follows
    .map((f) => f.whale_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const missing = follows.filter((f) => !f.whale_id && f.whale_address && f.chain);
  let resolvedIds: string[] = [];
  if (missing.length > 0) {
    const { data: matches } = await sb
      .from('whales')
      .select('id, address, chain')
      .in('chain', Array.from(new Set(missing.map((m) => m.chain).filter(Boolean) as string[])));
    const byKey = new Map<string, string>();
    for (const w of matches ?? []) {
      byKey.set(`${w.chain}:${(w.address ?? '').toLowerCase()}`, w.id);
    }
    resolvedIds = missing
      .map((m) => byKey.get(`${m.chain}:${(m.whale_address ?? '').toLowerCase()}`))
      .filter((id): id is string => Boolean(id));
  }
  const whaleIds = Array.from(new Set([...idsFromColumn, ...resolvedIds]));
  if (whaleIds.length === 0) return null;

  const { data: whales } = await sb
    .from('whales')
    .select('id, pnl_30d_usd')
    .in('id', whaleIds);
  const scored = (whales ?? []).filter((w) => typeof w.pnl_30d_usd === 'number');
  if (scored.length === 0) return null;
  const positive = scored.filter((w) => Number(w.pnl_30d_usd) > 0).length;
  return Math.round((positive / scored.length) * 100);
}

export async function scorePortfolioPerformancePct(userId: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  // Realized PnL is NOT on swap_logs (that table has no pnl column). It lives
  // in the two executed-trade ledgers: sniper_executions (realized_at) and
  // user_copy_trades (receipt_reconciled_at). Aggregate the user's 30d total
  // across both and rank it against the active population for the percentile.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [sniperPop, copyPop] = await Promise.all([
    sb
      .from('sniper_executions')
      .select('user_id, pnl_usd, realized_at')
      .not('pnl_usd', 'is', null)
      .not('realized_at', 'is', null)
      .gte('realized_at', since)
      .limit(5000),
    sb
      .from('user_copy_trades')
      .select('user_id, pnl_usd, receipt_reconciled_at')
      .not('pnl_usd', 'is', null)
      .not('receipt_reconciled_at', 'is', null)
      .gte('receipt_reconciled_at', since)
      .limit(5000),
  ]);

  const totals = new Map<string, number>();
  for (const row of [...(sniperPop.data ?? []), ...(copyPop.data ?? [])]) {
    const uid = row.user_id;
    if (!uid) continue;
    totals.set(uid, (totals.get(uid) ?? 0) + Number(row.pnl_usd ?? 0));
  }

  // No realized trades for this user → no honest portfolio axis to score.
  if (!totals.has(userId)) return null;
  const myTotal = totals.get(userId) as number;
  const all = Array.from(totals.values()).sort((a, b) => a - b);
  if (all.length === 0) return null;
  const rankIdx = all.findIndex((v) => v >= myTotal);
  const percentile = rankIdx < 0 ? 100 : Math.round((rankIdx / all.length) * 100);
  return percentile;
}

export async function scoreCommunityScore(userId: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  const [followsRes, reportsRes] = await Promise.all([
    sb.from('social_follows').select('id', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
    sb.from('user_reports').select('id', { count: 'exact', head: true }).eq('reported_id', userId).eq('status', 'resolved'),
  ]);
  const followers = followsRes.count ?? 0;
  const resolvedReports = reportsRes.count ?? 0;
  if (followers === 0 && resolvedReports === 0) return null;
  // Logistic-ish: 100 followers ≈ 75, with a -10 penalty per resolved
  // report against this user, floor at 0.
  const base = Math.min(100, Math.round(75 * (1 - Math.exp(-followers / 60))));
  return Math.max(0, base - resolvedReports * 10);
}

export async function scoreActivityScore(userId: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, count } = await sb
    .from('feature_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  void data;
  if (count === null) return null;
  // 30 distinct usage events / month = 100. Linear cap.
  return Math.min(100, Math.round((count / 30) * 100));
}

export async function scoreUser(userId: string): Promise<ScoreResult> {
  const [copy_trade_winrate, whale_pick_accuracy, portfolio_perf_pct, community_score, activity_score] = await Promise.all([
    scoreCopyTradeWinRate(userId).catch(() => null),
    scoreWhalePickAccuracy(userId).catch(() => null),
    scorePortfolioPerformancePct(userId).catch(() => null),
    scoreCommunityScore(userId).catch(() => null),
    scoreActivityScore(userId).catch(() => null),
  ]);
  const components: ScoreComponents = {
    copy_trade_winrate,
    whale_pick_accuracy,
    portfolio_perf_pct,
    community_score,
    activity_score,
  };
  const success_rate = combineComponents(components);
  return { success_rate, total_score: success_rate, components };
}
