import { NextRequest } from "next/server";
import { verifyCron, cronResponse } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CriteriaRow {
  id: string;
  user_id: string;
  trigger_type: "new_token_launch" | "whale_buy" | "price_target";
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
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
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

  const criteria = (allCriteria ?? []) as CriteriaRow[];
  if (criteria.length === 0) {
    return cronResponse("sniper-monitor", startedAt, { criteria: 0 });
  }

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

  // For new_token_launch: fetch tokens listed in last max_age_hours window
  const maxAgeHours = Math.max(...criteria.map((c) => c.max_age_hours));
  const tokenSince = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString();
  const { data: recentTokens } = await admin
    .from("token_metadata")
    .select("token_address,chain,liquidity_usd,buy_tax_bps,sell_tax_bps,holder_count,security_score,is_honeypot,listed_at")
    .in("chain", Array.from(chainsNeeded))
    .gte("listed_at", tokenSince);

  const newTokens = (recentTokens ?? []) as TokenRow[];

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
    let firedToday = 0;

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
        if (firedToday >= remainingSnipes) break;
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
        matched++;
      }
    }

    // ── new_token_launch trigger ───────────────────────────────────────────
    if (c.trigger_type === "new_token_launch") {
      const cutoff = new Date(Date.now() - c.max_age_hours * 3_600_000).toISOString();
      const candidates = newTokens.filter(
        (t) =>
          c.chains_allowed.includes(t.chain) &&
          (t.listed_at ?? "") >= cutoff &&
          (t.liquidity_usd ?? 0) >= c.min_liquidity_usd &&
          (t.buy_tax_bps ?? 0) <= c.max_buy_tax_bps &&
          (t.sell_tax_bps ?? 0) <= c.max_sell_tax_bps &&
          (t.holder_count ?? 0) >= c.min_holder_count &&
          (t.security_score ?? 0) >= c.min_security_score &&
          (!c.block_honeypots || !t.is_honeypot),
      );

      for (const t of candidates) {
        if (firedToday >= remainingSnipes) break;

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
