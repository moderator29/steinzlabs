import { NextRequest } from "next/server";
import { verifyCron, cronResponse, cronHasWork } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getNewEvmPairs } from "@/lib/services/geckoterminal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CriteriaRow {
  id: string;
  user_id: string;
  trigger_type: "new_token_launch" | "new_pair" | "whale_buy" | "price_target";
  chains_allowed: string[];
  min_liquidity_usd: number;
  max_buy_tax_bps: number;
  max_sell_tax_bps: number;
  min_holder_count: number;
  max_age_hours: number;
  min_security_score: number;
  block_honeypots: boolean;
  trigger_whale_address: string | null;
  trigger_price_target: number | null;
  amount_per_snipe_usd: number;
  daily_max_snipes: number;
  daily_max_spend_usd: number;
  auto_execute: boolean;
  wallet_source: string;
}

interface WhaleActivityRow {
  whale_address: string;
  chain: string;
  action: string;
  token_address: string | null;
  value_usd: number | null;
  timestamp: string;
  tx_hash: string | null;
}

interface TokenRow {
  token_address: string;
  chain: string;
  liquidity_usd: number | null;
  buy_tax_bps: number | null;
  sell_tax_bps: number | null;
  holder_count: number | null;
  security_score: number | null;
  is_honeypot: boolean | null;
  listed_at: string | null;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  if (!(await cronHasWork("sniper_criteria", { column: "enabled", value: true }))) {
    return cronResponse("sniper-monitor", startedAt, { skipped: "no-active-sniper-criteria" });
  }

  const admin = getSupabaseAdmin();

  // Check platform kill switch first
  const { data: platformState } = await admin
    .from("platform_sniper_state")
    .select("enabled")
    .eq("id", 1)
    .single<{ enabled: boolean }>();

  if (platformState && !platformState.enabled) {
    return cronResponse("sniper-monitor", startedAt, { skipped: "platform_disabled" });
  }

  // Load all enabled criteria
  const { data: allCriteria } = await admin
    .from("sniper_criteria")
    .select("*")
    .eq("enabled", true);

  const allEnabled = (allCriteria ?? []) as CriteriaRow[];
  if (allEnabled.length === 0) {
    return cronResponse("sniper-monitor", startedAt, { criteria: 0 });
  }

  // Per-user concurrency cap. A user with 100 enabled criteria used to get
  // all 100 processed every tick — N x DexScreener / Supabase queries that
  // could OOM the lambda and starve other users. Round-robin by taking the
  // oldest-first N criteria per user; the rest tick on the next run because
  // sniper-criteria.id ordering is stable.
  const PER_USER_TICK_CAP = 10;
  const perUserCounts = new Map<string, number>();
  const criteria = allEnabled.filter((c) => {
    const n = perUserCounts.get(c.user_id) ?? 0;
    if (n >= PER_USER_TICK_CAP) return false;
    perUserCounts.set(c.user_id, n + 1);
    return true;
  });

  // Collect all chains we need to watch
  const chainsNeeded = new Set(criteria.flatMap((c) => c.chains_allowed));

  // Fetch whale activity from last 2 minutes (cron runs every 1 min, 2 min window for overlap tolerance)
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: recentActivity } = await admin
    .from("whale_activity")
    .select("whale_address,chain,action,token_address,value_usd,timestamp,tx_hash")
    .in("chain", Array.from(chainsNeeded))
    .gte("timestamp", since)
    .in("action", ["buy", "swap"]);

  const activity = (recentActivity ?? []) as WhaleActivityRow[];

  // For new_token_launch / new_pair: pull live pairs directly from DexScreener.
  // The /api/sniper UI feed reads the same source — this keeps "what the user
  // sees in the feed" and "what the matcher considers" consistent.
  //
  // Previously this read from `token_metadata` (a Supabase table) but nothing
  // in the codebase populates that table, so the matcher could never fire
  // for new-pair triggers. Reading DexScreener directly removes that broken
  // dependency. Each criteria's `max_age_hours` is still respected via the
  // pairCreatedAt filter below. If max_age_hours is null/0 (NewSniperModal
  // doesn't set it), we default to 24h so the filter doesn't reject all
  // candidates with an invalid date math.
  const maxAgeHoursRaw = Math.max(...criteria.map((c) => Number(c.max_age_hours) || 0));
  const maxAgeHours = Number.isFinite(maxAgeHoursRaw) && maxAgeHoursRaw > 0 ? maxAgeHoursRaw : 24;
  const minLiqAcrossCriteria = Math.min(...criteria.map((c) => Number(c.min_liquidity_usd) || 0));
  const fetchFloor = Number.isFinite(minLiqAcrossCriteria) ? Math.max(0, minLiqAcrossCriteria) : 0;

  const newTokens: TokenRow[] = [];
  for (const chain of chainsNeeded) {
    try {
      const pairs = await getNewEvmPairs(fetchFloor, chain);
      for (const p of pairs) {
        newTokens.push({
          token_address: p.baseToken.address,
          chain: p.chainId,
          liquidity_usd: p.liquidity?.usd ?? null,
          buy_tax_bps: null,        // GoPlus enrichment happens at execute-time
          sell_tax_bps: null,
          holder_count: null,
          security_score: null,     // null = "not yet enriched"; criteria with
                                    // a non-zero min_security_score will skip
                                    // until /api/sniper POST scoring lands
          is_honeypot: null,
          listed_at: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null,
        });
      }
    } catch {
      // DexScreener flaked for this chain — skip, retry next tick.
    }
  }

  let matched = 0;
  const events: Array<Record<string, unknown>> = [];

  for (const c of criteria) {
    // Per-user daily spend/snipe guard
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: todayEvents } = await admin
      .from("sniper_match_events")
      .select("decision,details")
      .eq("criteria_id", c.id)
      .gte("created_at", todayStart.toISOString())
      .in("decision", ["sniped_pending", "sniped_executed"]);

    const todayFired = (todayEvents ?? []).length;
    const todaySpend = (todayEvents ?? []).reduce(
      (acc, e) => acc + Number((e.details as Record<string, unknown>)?.amount_usd ?? 0),
      0,
    );

    if (todayFired >= c.daily_max_snipes || todaySpend >= c.daily_max_spend_usd) {
      continue; // daily cap reached for this criteria
    }

    const remainingSnipes = c.daily_max_snipes - todayFired;
    const spendCap = c.daily_max_spend_usd;
    const perSnipeCost = Math.max(0, Number(c.amount_per_snipe_usd) || 0);
    let firedToday = 0;
    // Race fix: pre-existing code computed todaySpend once at the top of the
    // loop, so a criteria at $450/$500 with 5 candidates × $100 would push
    // all 5 events and overshoot the cap. Track the running spend including
    // this tick's about-to-be-inserted events and re-check before each push.
    let runningSpend = todaySpend;
    const tickCapReached = () =>
      firedToday >= remainingSnipes || runningSpend + perSnipeCost > spendCap;

    // ── whale_buy trigger ──────────────────────────────────────────────────
    if (c.trigger_type === "whale_buy") {
      const candidates = activity.filter(
        (a) =>
          c.chains_allowed.includes(a.chain) &&
          (!c.trigger_whale_address ||
            a.whale_address.toLowerCase() === c.trigger_whale_address.toLowerCase()) &&
          (a.value_usd ?? 0) > 0,
      );

      for (const a of candidates) {
        if (tickCapReached()) break;
        if (!a.token_address) continue;

        // Dedup: already matched this token+criteria in last 10 min
        const { count } = await admin
          .from("sniper_match_events")
          .select("id", { count: "exact", head: true })
          .eq("criteria_id", c.id)
          .eq("matched_token_address", a.token_address)
          .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
        if ((count ?? 0) > 0) continue;

        const decision = c.auto_execute ? "sniped_pending" : "matched";
        const event = {
          criteria_id: c.id,
          user_id: c.user_id,
          matched_token_address: a.token_address.toLowerCase(),
          matched_chain: a.chain,
          trigger_reason: `Whale ${a.whale_address.slice(0, 8)}… bought $${(a.value_usd ?? 0).toLocaleString()}`,
          decision,
          details: {
            amount_usd: c.amount_per_snipe_usd,
            whale_address: a.whale_address,
            whale_value_usd: a.value_usd,
            tx_hash: a.tx_hash,
            auto_execute: c.auto_execute,
            wallet_source: c.wallet_source,
          },
        };
        events.push(event);
        firedToday++;
        runningSpend += perSnipeCost;
        matched++;
      }
    }

    // ── new_token_launch trigger ───────────────────────────────────────────
    // Accepts both legacy "new_token_launch" and the UI-persisted "new_pair"
    // value as aliases for the same trigger. Without this, any criteria
    // created via NewSniperModal would silently never match in the cron.
    if (c.trigger_type === "new_token_launch" || c.trigger_type === "new_pair") {
      const cutoff = new Date(Date.now() - c.max_age_hours * 3_600_000).toISOString();
      // Apply the criteria filters against the DexScreener-sourced pairs.
      // Fields not yet enriched (buy_tax, sell_tax, holders, security_score,
      // is_honeypot) come through as null — treat null as "unknown, allow"
      // for tax / holder / honeypot, and as "skip" only for security_score
      // when the user explicitly set a min. Without this we'd reject every
      // candidate on the very first tick.
      const candidates = newTokens.filter(
        (t) =>
          c.chains_allowed.includes(t.chain) &&
          (t.listed_at ?? "") >= cutoff &&
          (t.liquidity_usd ?? 0) >= c.min_liquidity_usd &&
          (t.buy_tax_bps == null || t.buy_tax_bps <= c.max_buy_tax_bps) &&
          (t.sell_tax_bps == null || t.sell_tax_bps <= c.max_sell_tax_bps) &&
          (t.holder_count == null || t.holder_count >= c.min_holder_count) &&
          (c.min_security_score === 0 || (t.security_score ?? 0) >= c.min_security_score) &&
          (!c.block_honeypots || t.is_honeypot !== true),
      );

      for (const t of candidates) {
        if (tickCapReached()) break;

        const { count } = await admin
          .from("sniper_match_events")
          .select("id", { count: "exact", head: true })
          .eq("criteria_id", c.id)
          .eq("matched_token_address", t.token_address)
          .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
        if ((count ?? 0) > 0) continue;

        const decision = c.auto_execute ? "sniped_pending" : "matched";
        events.push({
          criteria_id: c.id,
          user_id: c.user_id,
          matched_token_address: t.token_address.toLowerCase(),
          matched_chain: t.chain,
          trigger_reason: `New token listed — liquidity $${(t.liquidity_usd ?? 0).toLocaleString()}, score ${t.security_score ?? "?"}`,
          decision,
          details: {
            amount_usd: c.amount_per_snipe_usd,
            liquidity_usd: t.liquidity_usd,
            security_score: t.security_score,
            holder_count: t.holder_count,
            auto_execute: c.auto_execute,
            wallet_source: c.wallet_source,
          },
        });
        firedToday++;
        runningSpend += perSnipeCost;
        matched++;
      }
    }

    // price_target trigger: token_metadata table must have a current_price_usd column.
    // Emitting matched events only; actual price checks require a price feed integration.
  }

  if (events.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < events.length; i += BATCH) {
      await admin.from("sniper_match_events").insert(events.slice(i, i + BATCH));
    }
  }

  return cronResponse("sniper-monitor", startedAt, {
    criteria: criteria.length,
    activity_rows: activity.length,
    new_tokens: newTokens.length,
    events_inserted: events.length,
    matched,
  });
}
