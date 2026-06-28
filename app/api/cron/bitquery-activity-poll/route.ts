import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSolanaWalletBuys, isBitqueryEnabled } from "@/lib/services/bitquery";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NAME = "bitquery-activity-poll";

/**
 * bitquery-activity-poll — ingests SOLANA whale DEX BUYS into whale_activity via
 * Bitquery, so Solana whale moves flow into the feed, alerts, and copy-trade
 * (EVM whales are already covered by the Alchemy poll cron — no webhooks needed
 * for either chain). We record only clear token acquisitions (Bitquery supplies
 * AmountInUSD) to avoid mislabeling buy/sell on the unverified schema; sells are
 * a later add. The existing whale-alert-dispatcher + copy-trade-monitor/matcher
 * then act on these rows.
 *
 * Gated on BITQUERY_API_KEY (no-op until set). Polls FOLLOWED Solana whales
 * first (what actually drives alerts/copy), then fills the per-tick budget with
 * a rotation of active Solana whales. Half-hourly to respect Bitquery quota.
 */

const MAX_WHALES_PER_TICK = 20;   // Bitquery quota guard
const POLL_CONCURRENCY = 4;
const LOOKBACK_MIN = 40;          // overlaps the 30-min cadence so nothing is missed

interface WhaleRow { whale_address: string }

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();

  if (!isBitqueryEnabled()) {
    await logCronExecution(NAME, "success", Date.now() - startedAt, "no-bitquery-key", 0);
    return NextResponse.json({ ok: true, skipped: "no-bitquery-key" });
  }

  const sb = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - LOOKBACK_MIN * 60_000).toISOString();

  try {
    // 1) Followed Solana whales (priority — these drive alerts/copy).
    const { data: follows } = await sb
      .from("user_whale_follows")
      .select("whale_address")
      .eq("chain", "solana")
      .limit(MAX_WHALES_PER_TICK);
    const addrs: string[] = [];
    const seen = new Set<string>();
    for (const f of (follows ?? []) as WhaleRow[]) {
      if (f.whale_address && !seen.has(f.whale_address)) { seen.add(f.whale_address); addrs.push(f.whale_address); }
    }

    // 2) Fill the remaining budget with a rotation of active Solana whales
    //    (offset by the hour so coverage spreads across the day).
    if (addrs.length < MAX_WHALES_PER_TICK) {
      const need = MAX_WHALES_PER_TICK - addrs.length;
      const offset = (new Date().getUTCHours() * need) % 500;
      const { data: actives } = await sb
        .from("whales")
        .select("address")
        .eq("chain", "solana")
        .eq("is_active", true)
        .order("whale_score", { ascending: false })
        .range(offset, offset + need - 1);
      for (const w of (actives ?? []) as Array<{ address: string }>) {
        if (w.address && !seen.has(w.address)) { seen.add(w.address); addrs.push(w.address); }
      }
    }

    if (addrs.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, "no-solana-whales", 0);
      return NextResponse.json({ ok: true, polled: 0, inserted: 0 });
    }

    // 3) Poll each whale's recent token buys, map → whale_activity rows.
    const settled = await mapWithConcurrency(addrs, POLL_CONCURRENCY, async (address) => {
      const buys = await getSolanaWalletBuys(address, sinceIso, 10);
      return buys.map((b) => ({
        whale_address: address,           // Solana base58 — case preserved
        chain: "solana",
        tx_hash: b.txHash,
        action: "buy",
        token_address: b.tokenMint,
        token_symbol: b.tokenSymbol,
        amount: b.amount,
        value_usd: b.valueUsd,
        counterparty: null,
        counterparty_label: null,
        block_number: null,
        timestamp: b.timestamp,
      }));
    });

    const rows = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    let inserted = 0;
    if (rows.length > 0) {
      // Dedup on (tx_hash, whale_address, chain) — same key the Alchemy poll uses.
      const { data, error } = await sb
        .from("whale_activity")
        .upsert(rows, { onConflict: "tx_hash,whale_address,chain", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      inserted = (data ?? []).length;
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, polled: addrs.length, inserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
