import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getSolanaWalletBuys, getEvmWalletBuys,
  getSolanaWalletSells, getEvmWalletSells,
  isBitqueryEnabled,
} from "@/lib/services/bitquery";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NAME = "bitquery-activity-poll";

/**
 * bitquery-activity-poll — ingests whale DEX BUYS into whale_activity via
 * Bitquery for BOTH EVM and Solana, so whale moves flow into the feed, alerts,
 * and copy-trade with NO Alchemy/Helius webhooks (fully Bitquery-driven; the
 * Alchemy poll cron is now a redundant backup). We record only clear token
 * acquisitions (Bitquery supplies AmountInUSD) to avoid mislabeling buy/sell;
 * sells are a later add. The existing whale-alert-dispatcher +
 * copy-trade-monitor/matcher then act on these rows.
 *
 * Gated on BITQUERY_API_KEY (no-op until set). Polls FOLLOWED whales first (what
 * actually drives alerts/copy), then fills the per-tick budget with a rotation
 * of active whales. Half-hourly to respect Bitquery quota.
 */

const MAX_WHALES_PER_TICK = 24;   // Bitquery quota guard
const POLL_CONCURRENCY = 4;
const LOOKBACK_MIN = 40;          // overlaps the 30-min cadence so nothing is missed
// Bitquery-supported EVM chains for per-wallet activity (others fall back to the
// Alchemy poll cron).
const BITQUERY_EVM = new Set(["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc"]);

interface WhaleRef { address: string; chain: string }

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
    // 1) Followed whales (priority — these drive alerts/copy), any chain.
    const { data: follows } = await sb
      .from("user_whale_follows")
      .select("whale_address, chain")
      .limit(MAX_WHALES_PER_TICK);
    const refs: WhaleRef[] = [];
    const seen = new Set<string>();
    const add = (address: string, chain: string) => {
      const c = (chain || "").toLowerCase();
      if (!address || (c !== "solana" && !BITQUERY_EVM.has(c))) return;
      const key = `${c}:${address}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push({ address, chain: c });
    };
    for (const f of (follows ?? []) as Array<{ whale_address: string; chain: string }>) {
      add(f.whale_address, f.chain);
    }

    // 2) Fill the remaining budget with a rotation of active whales (offset by
    //    the hour so coverage spreads across the day).
    if (refs.length < MAX_WHALES_PER_TICK) {
      const need = MAX_WHALES_PER_TICK - refs.length;
      const offset = (new Date().getUTCHours() * need) % 800;
      const { data: actives } = await sb
        .from("whales")
        .select("address, chain")
        .eq("is_active", true)
        .order("whale_score", { ascending: false })
        .range(offset, offset + need - 1);
      for (const w of (actives ?? []) as Array<{ address: string; chain: string }>) {
        add(w.address, w.chain);
      }
    }

    if (refs.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, "no-whales", 0);
      return NextResponse.json({ ok: true, polled: 0, inserted: 0 });
    }

    // 3) Poll each whale's recent token buys AND sells (right query per chain),
    //    map → rows. Both directions drive alerts/copy: buys are the entry
    //    signal, sells the exit signal. Buy/sell are queried in parallel.
    const settled = await mapWithConcurrency(refs, POLL_CONCURRENCY, async (ref) => {
      const isSol = ref.chain === "solana";
      const [buys, sells] = await Promise.all([
        isSol ? getSolanaWalletBuys(ref.address, sinceIso, 10) : getEvmWalletBuys(ref.chain, ref.address, sinceIso, 10),
        isSol ? getSolanaWalletSells(ref.address, sinceIso, 10) : getEvmWalletSells(ref.chain, ref.address, sinceIso, 10),
      ]);
      const toRow = (b: { txHash: string; tokenMint: string; tokenSymbol: string | null; amount: number; valueUsd: number | null; timestamp: string }, action: "buy" | "sell") => ({
        whale_address: ref.address,       // EVM lowercase / Solana base58 — as stored
        chain: ref.chain,
        tx_hash: b.txHash,
        action,
        token_address: b.tokenMint,
        token_symbol: b.tokenSymbol,
        amount: b.amount,
        value_usd: b.valueUsd,
        counterparty: null,
        counterparty_label: null,
        block_number: null,
        timestamp: b.timestamp,
      });
      return [...buys.map((b) => toRow(b, "buy")), ...sells.map((s) => toRow(s, "sell"))];
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
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, polled: refs.length, inserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
