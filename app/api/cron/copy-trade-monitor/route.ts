import { NextRequest } from "next/server";
import { verifyCron, cronResponse, cronHasWork } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { matchCopyEvent, type CopyEvent } from "@/lib/copy/matcher";

// Event-level fan-out concurrency. Each matchCopyEvent call does its own
// per-rule GoPlus + aggregator + pending-trades work; 6 keeps the cron under
// maxDuration on a busy tick without saturating the aggregator rate limits.
const EVENT_CONCURRENCY = 6;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FollowRow {
  user_id: string;
  whale_address: string;
  chain: string;
}

interface WhaleActivityRow {
  whale_address: string;
  chain: string;
  tx_hash: string;
  action: string;
  token_address: string | null;
  token_symbol: string | null;
  value_usd: number | null;
  timestamp: string;
}

const LOOKBACK_SECONDS = 180; // 3 minutes

/**
 * copy-trade-monitor — the catch-up safety net for chains/events not delivered
 * by an Alchemy/Helius webhook. It used to re-implement the copy fan-out (and
 * had drifted: it executed alerts_only rules, ignored pct_of_whale / cooldown /
 * auto_copy). It now delegates every recent whale move to the SINGLE source of
 * truth — lib/copy/matcher.matchCopyEvent — so the cron and webhook paths apply
 * identical rules, caps, dedup, and modes. matchCopyEvent is idempotent per
 * (user, source_tx) via claim_copy_trade, so re-processing a move is safe.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  if (!(await cronHasWork("user_copy_rules", { column: "enabled", value: true }))) {
    return cronResponse("copy-trade-monitor", startedAt, { skipped: "no-active-copy-rules" });
  }

  const admin = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - LOOKBACK_SECONDS * 1000).toISOString();

  // 1) Followed whales (matchCopyEvent re-checks rules; this just scopes which
  //    recent activity is worth replaying through it).
  const { data: follows } = await admin
    .from("user_whale_follows")
    .select("user_id,whale_address,chain")
    .returns<FollowRow[]>();
  const followRows = follows ?? [];
  if (followRows.length === 0) {
    return cronResponse("copy-trade-monitor", startedAt, { considered: 0, triggered: 0 });
  }

  // 2) Recent actionable moves for those whales.
  const whaleAddrs = Array.from(new Set(followRows.map((f) => f.whale_address)));
  const { data: activity } = await admin
    .from("whale_activity")
    .select("whale_address,chain,tx_hash,action,token_address,token_symbol,value_usd,timestamp")
    .in("whale_address", whaleAddrs)
    .in("action", ["buy", "sell", "swap"])
    .gte("timestamp", sinceIso)
    .order("timestamp", { ascending: false })
    .limit(500)
    .returns<WhaleActivityRow[]>();

  const acts = (activity ?? []).filter((a) => a.token_address);
  if (acts.length === 0) {
    return cronResponse("copy-trade-monitor", startedAt, { considered: 0, triggered: 0 });
  }

  // 3) Dedup to one event per (chain, whale, tx) — matchCopyEvent fans out to
  //    every matching rule itself, so we only need each distinct move once.
  const seen = new Set<string>();
  const events: CopyEvent[] = [];
  for (const a of acts) {
    const key = `${a.chain}:${a.whale_address}:${a.tx_hash}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const action = a.action === "buy" || a.action === "sell" || a.action === "swap" ? a.action : "swap";
    events.push({
      whale_address: a.whale_address,
      chain: a.chain,
      tx_hash: a.tx_hash,
      action,
      token_address: a.token_address,
      token_symbol: a.token_symbol,
      value_usd: a.value_usd,
      timestamp: a.timestamp,
    });
  }

  // 4) Replay each move through the canonical matcher (bounded concurrency).
  const settled = await mapWithConcurrency(events, EVENT_CONCURRENCY, (ev) => matchCopyEvent(ev));

  let considered = 0, triggered = 0, alerted = 0, blocked = 0, failed = 0;
  for (const r of settled) {
    if (r.status !== "fulfilled") { failed++; continue; }
    considered += r.value.considered;
    triggered += r.value.triggered;
    alerted += r.value.alerted;
    blocked += r.value.blocked;
    failed += r.value.failed;
  }

  return cronResponse("copy-trade-monitor", startedAt, { considered, triggered, alerted, blocked, failed });
}
