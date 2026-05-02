/**
 * Sniper matcher — webhook-driven counterpart to the 5-min sniper-monitor cron.
 *
 * Given a single normalised event (token detection or whale trade), match it
 * against every active sniper_criteria row, apply the same filters used by the
 * cron, and write sniper_match_events rows. For criteria with auto_execute=true
 * we set decision='sniped_pending' so /api/cron/sniper-auto-execute picks the
 * row up; otherwise decision='matched' and we fire a Telegram alert with a
 * "Snipe now" button so the user can confirm in-app.
 *
 * Why dual-path (webhook + cron):
 *   - Webhooks give sub-second latency on chains we have address-activity
 *     subscriptions for (Alchemy / Helius).
 *   - The 5-min cron keeps catching matches if a webhook is dropped, mis-signed,
 *     or the chain isn't subscribed yet. Inserts here use a 10-min dedup window
 *     by (criteria_id, matched_token_address) so the cron never double-fires.
 */

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { queueTelegramNotification } from "@/lib/telegram/notify";
import { normalizeAddress } from "@/lib/utils/addressNormalize";
import type { SniperChain } from "./chains";
import { getChainConfig } from "./chains";

export type MatchTrigger = "new_token_launch" | "whale_buy";

export interface MatchInput {
  chain: SniperChain;
  trigger: MatchTrigger;
  tokenAddress: string;
  tokenSymbol?: string | null;
  txHash?: string | null;
  /** For whale_buy. */
  whaleAddress?: string | null;
  whaleValueUsd?: number | null;
  /** For new_token_launch — what the indexer already knows about this token. */
  tokenMetrics?: {
    liquidityUsd?: number | null;
    buyTaxBps?: number | null;
    sellTaxBps?: number | null;
    holderCount?: number | null;
    securityScore?: number | null;
    isHoneypot?: boolean | null;
    listedAt?: string | null;
  };
}

interface CriteriaRow {
  id: string;
  user_id: string;
  trigger_type: string;
  chains_allowed: string[];
  auto_execute: boolean;
  enabled: boolean;
  paused: boolean;
  daily_max_snipes: number;
  daily_max_spend_usd: number;
  amount_per_snipe_usd: number;
  wallet_source: string;
  // Filters
  min_liquidity_usd: number | null;
  max_buy_tax_bps: number | null;
  max_sell_tax_bps: number | null;
  min_holder_count: number | null;
  max_age_hours: number | null;
  min_security_score: number | null;
  block_honeypots: boolean | null;
  trigger_whale_address: string | null;
}

const DEDUP_WINDOW_MS = 10 * 60_000;

function passesNewTokenFilters(c: CriteriaRow, m: MatchInput["tokenMetrics"]): boolean {
  if (!m) return true; // unknown metrics → defer to downstream security gate
  if (c.min_liquidity_usd != null && (m.liquidityUsd ?? 0) < c.min_liquidity_usd) return false;
  if (c.max_buy_tax_bps != null && (m.buyTaxBps ?? 0) > c.max_buy_tax_bps) return false;
  if (c.max_sell_tax_bps != null && (m.sellTaxBps ?? 0) > c.max_sell_tax_bps) return false;
  if (c.min_holder_count != null && (m.holderCount ?? 0) < c.min_holder_count) return false;
  if (c.min_security_score != null && (m.securityScore ?? 0) < c.min_security_score) return false;
  if (c.block_honeypots && m.isHoneypot) return false;
  if (c.max_age_hours != null && m.listedAt) {
    const ageH = (Date.now() - new Date(m.listedAt).getTime()) / 3_600_000;
    if (ageH > c.max_age_hours) return false;
  }
  return true;
}

export interface MatchOutcome {
  inserted: number;
  alerted: number;
  skipped: number;
  reasons: string[];
}

export async function matchSniperEvent(input: MatchInput): Promise<MatchOutcome> {
  const admin = getSupabaseAdmin();
  const out: MatchOutcome = { inserted: 0, alerted: 0, skipped: 0, reasons: [] };

  const { data: criteria, error } = await admin
    .from("sniper_criteria")
    .select(
      "id,user_id,trigger_type,chains_allowed,auto_execute,enabled,paused," +
        "daily_max_snipes,daily_max_spend_usd,amount_per_snipe_usd,wallet_source," +
        "min_liquidity_usd,max_buy_tax_bps,max_sell_tax_bps,min_holder_count," +
        "max_age_hours,min_security_score,block_honeypots,trigger_whale_address",
    )
    .eq("enabled", true)
    .eq("paused", false)
    .contains("chains_allowed", [input.chain]);

  if (error) {
    out.reasons.push(`criteria query failed: ${error.message}`);
    return out;
  }

  if (!criteria || criteria.length === 0) return out;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  // §13 audit fix: don't unconditionally lowercase the token address.
  // Solana mints are base58 case-sensitive — lowercasing produces a
  // valid-looking but non-existent address. normalizeAddress() picks
  // the right form per chain (EVM lowercased, Solana/TON preserved).
  const tokenKey = normalizeAddress(input.chain, input.tokenAddress);

  for (const raw of criteria as unknown as CriteriaRow[]) {
    const c = raw;

    // Trigger-type gate: don't fire whale_buy criteria on new_token_launch
    // events, or vice versa. The UI persists "new_pair" and the legacy cron
    // persists "new_token_launch" — both refer to the same trigger; matcher
    // accepts either alias. "manual" criteria are user-initiated and never
    // fire from a webhook.
    const triggerAliases: Record<string, ReadonlyArray<string>> = {
      new_token_launch: ["new_token_launch", "new_pair"],
      whale_buy: ["whale_buy"],
    };
    if (c.trigger_type === "manual") {
      out.skipped++;
      continue;
    }
    if (!triggerAliases[input.trigger].includes(c.trigger_type)) {
      out.skipped++;
      continue;
    }

    // Whale-targeted criteria: skip if the whale doesn't match.
    // Use chain-aware normalization (Solana base58 case-sensitive).
    if (
      input.trigger === "whale_buy" &&
      c.trigger_whale_address &&
      input.whaleAddress &&
      normalizeAddress(input.chain, c.trigger_whale_address) !== normalizeAddress(input.chain, input.whaleAddress)
    ) {
      out.skipped++;
      continue;
    }

    // New-token filters.
    if (input.trigger === "new_token_launch" && !passesNewTokenFilters(c, input.tokenMetrics)) {
      out.skipped++;
      continue;
    }

    // Daily caps.
    const { data: todayEvents } = await admin
      .from("sniper_match_events")
      .select("decision,details")
      .eq("criteria_id", c.id)
      .gte("created_at", todayIso)
      .in("decision", ["sniped_pending", "sniped_executed"]);

    const todayFired = todayEvents?.length ?? 0;
    const todaySpend = (todayEvents ?? []).reduce(
      (acc, e) => acc + Number((e.details as Record<string, unknown> | null)?.amount_usd ?? 0),
      0,
    );
    if (todayFired >= c.daily_max_snipes || todaySpend >= c.daily_max_spend_usd) {
      out.skipped++;
      out.reasons.push(`criteria ${c.id}: daily cap reached`);
      continue;
    }

    // Dedup window — same token, same criteria, within 10 minutes.
    const { count: dupCount } = await admin
      .from("sniper_match_events")
      .select("id", { count: "exact", head: true })
      .eq("criteria_id", c.id)
      .eq("matched_token_address", tokenKey)
      .gte("created_at", dedupSince);
    if ((dupCount ?? 0) > 0) {
      out.skipped++;
      continue;
    }

    const decision = c.auto_execute ? "sniped_pending" : "matched";
    const reason =
      input.trigger === "whale_buy"
        ? `Whale ${(input.whaleAddress ?? "").slice(0, 8)}… bought $${Number(input.whaleValueUsd ?? 0).toLocaleString()}`
        : `New token detected (${input.chain})`;

    const { error: insErr } = await admin.from("sniper_match_events").insert({
      criteria_id: c.id,
      user_id: c.user_id,
      matched_token_address: tokenKey,
      matched_chain: input.chain,
      trigger_reason: reason,
      decision,
      details: {
        amount_usd: c.amount_per_snipe_usd,
        wallet_source: c.wallet_source,
        auto_execute: c.auto_execute,
        token_symbol: input.tokenSymbol ?? null,
        tx_hash: input.txHash ?? null,
        whale_address: input.whaleAddress ?? null,
        whale_value_usd: input.whaleValueUsd ?? null,
        token_metrics: input.tokenMetrics ?? null,
      },
    });

    if (insErr) {
      out.skipped++;
      out.reasons.push(`insert failed for criteria ${c.id}: ${insErr.message}`);
      continue;
    }

    out.inserted++;

    if (decision === "matched") {
      const cfg = getChainConfig(input.chain);
      const symbol = input.tokenSymbol ?? `${input.tokenAddress.slice(0, 6)}…`;
      queueTelegramNotification({
        userId: c.user_id,
        kind: "sniper",
        title: `Sniper match: ${symbol}`,
        body:
          `${reason}\n` +
          `Chain: ${cfg?.name ?? input.chain}\n` +
          `Snipe size: $${c.amount_per_snipe_usd.toLocaleString()}\n` +
          (input.txHash ? `Tx: ${input.txHash.slice(0, 18)}…\n` : "") +
          `Tap to review.`,
        url: `/dashboard/sniper?token=${input.tokenAddress}&chain=${input.chain}`,
      });
      out.alerted++;
    }
  }

  return out;
}
