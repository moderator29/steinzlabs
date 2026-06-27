import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";
import { normalizeAddress, addressesEqual } from "@/lib/utils/addressNormalize";
import { priceActivityUsdBatch } from "@/lib/whales/priceActivity";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "whale-activity-poll";

// Whales polled per tick. The whales table holds hundreds of active addresses;
// polling them ALL every tick would burn Alchemy budget, so we rotate: each
// tick takes the N least-recently-polled active whales (ordered by
// last_active_at asc), stamps them, and the next tick picks up where this one
// left off. With ~360 active whales and a 30-min cadence the whole set is
// covered roughly every 7 hours. Tune via WHALE_POLL_BATCH.
const POLL_BATCH = Math.max(1, Math.min(Number(process.env.WHALE_POLL_BATCH ?? 30) || 30, 100));

interface AlchemyAssetTransfer {
  hash: string;
  from: string;
  to: string;
  asset: string | null;
  value: number | null;
  blockNum: string;
  metadata?: { blockTimestamp?: string };
  rawContract?: { address?: string };
  category: string;
}

/**
 * Pull the most recent asset transfers for a whale in one direction.
 * `direction: 'out'` queries transfers FROM the whale (sells / sends);
 * `direction: 'in'` queries transfers TO the whale (buys / receives). We poll
 * both so the feed and its Buy/Sell/Transfer filter see real two-sided flow
 * instead of the old 100%-transfer_out single-direction data.
 */
async function pollEthereumWhale(
  address: string,
  direction: "in" | "out",
): Promise<AlchemyAssetTransfer[]> {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return [];
  const addrParam = direction === "out" ? { fromAddress: address } : { toAddress: address };
  try {
    const res = await fetchWithRetry(`https://eth-mainnet.g.alchemy.com/v2/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [
          {
            ...addrParam,
            category: ["external", "erc20"],
            maxCount: "0xa",
            order: "desc",
            withMetadata: true,
            excludeZeroValue: true,
          },
        ],
      }),
      source: "alchemy-transfers",
      timeoutMs: 8000,
      retries: 2,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { result?: { transfers?: AlchemyAssetTransfer[] } };
    return json.result?.transfers ?? [];
  } catch {
    return [];
  }
}

interface CandidateRow {
  whale_address: string;
  chain: string;
  tx_hash: string;
  action: "transfer_in" | "transfer_out";
  token_address: string | null;
  token_symbol: string | null;
  amount: number | null;
  counterparty: string | null;
  block_number: number | null;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let polled = 0;
  let inserted = 0;
  let priced = 0;
  try {
    const supabase = getSupabaseAdmin();

    // Rotate through the GLOBAL active whale set (no follow gate). The whale
    // feed, Top Today, chart and net-flow are platform-wide intelligence — they
    // must reflect every tracked whale's moves, not only the handful a user
    // personally follows. (The follow gate shipped in the cost sweep is exactly
    // what silently killed ingestion: with near-zero follows the cron polled
    // nothing.) Cost is bounded by POLL_BATCH rotation instead.
    const { data: whales } = await supabase
      .from("whales")
      .select("address, chain")
      .eq("is_active", true)
      .eq("chain", "ethereum")
      .order("last_active_at", { ascending: true, nullsFirst: true })
      .limit(POLL_BATCH);

    const whaleList = (whales ?? []) as Array<{ address: string; chain: string }>;
    if (whaleList.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, polled: 0, inserted: 0, note: "no-active-whales" });
    }

    // 1. Collect candidate transfers (both directions) across the batch.
    const candidates: CandidateRow[] = [];
    for (const whale of whaleList) {
      const [out, incoming] = await Promise.all([
        pollEthereumWhale(whale.address, "out"),
        pollEthereumWhale(whale.address, "in"),
      ]);
      polled++;
      for (const t of [...out, ...incoming]) {
        if (!t.hash) continue;
        const value = typeof t.value === "number" ? t.value : null;
        const isOut = addressesEqual(t.from, whale.address, whale.chain);
        candidates.push({
          whale_address: whale.address,
          chain: whale.chain,
          tx_hash: t.hash,
          action: isOut ? "transfer_out" : "transfer_in",
          token_address: t.rawContract?.address ?? null,
          token_symbol: t.asset,
          amount: value,
          counterparty: isOut ? t.to : t.from,
          block_number: t.blockNum ? parseInt(t.blockNum, 16) : null,
          timestamp: t.metadata?.blockTimestamp ?? new Date().toISOString(),
        });
      }
      // Advance the rotation cursor regardless of whether new rows landed.
      await supabase
        .from("whales")
        .update({ last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("address", whale.address)
        .eq("chain", whale.chain);
    }

    if (candidates.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, polled, inserted: 0, priced: 0 });
    }

    // 2. Dedupe candidates and skip any (tx_hash, whale, chain) already stored,
    //    so we only PRICE genuinely new rows (pricing hits CoinGecko/Birdeye).
    const byKey = new Map<string, CandidateRow>();
    for (const c of candidates) byKey.set(`${c.chain}:${normalizeAddress(c.whale_address, c.chain)}:${c.tx_hash}`, c);
    const unique = Array.from(byKey.values());

    const hashes = Array.from(new Set(unique.map((c) => c.tx_hash)));
    const { data: existing } = await supabase
      .from("whale_activity")
      .select("tx_hash, whale_address, chain")
      .in("tx_hash", hashes);
    const existingKeys = new Set(
      ((existing ?? []) as Array<{ tx_hash: string; whale_address: string; chain: string }>).map(
        (e) => `${e.chain}:${normalizeAddress(e.whale_address, e.chain)}:${e.tx_hash}`,
      ),
    );
    const fresh = unique.filter(
      (c) => !existingKeys.has(`${c.chain}:${normalizeAddress(c.whale_address, c.chain)}:${c.tx_hash}`),
    );

    // 3. Price at ingest. priceActivityUsdBatch looks up each DISTINCT token's
    //    unit price once (no per-row herd), then multiplies per row. Rows that
    //    can't be priced go in as null and the backfill cron retries them.
    const values = await priceActivityUsdBatch(
      fresh.map((c) => ({
        chain: c.chain,
        token_address: c.token_address,
        token_symbol: c.token_symbol,
        amount: c.amount,
      })),
    );
    const rows = fresh.map((c, i) => {
      const value_usd = values[i];
      if (value_usd != null) priced++;
      return {
        whale_address: c.whale_address,
        chain: c.chain,
        tx_hash: c.tx_hash,
        action: c.action,
        token_address: c.token_address,
        token_symbol: c.token_symbol,
        amount: c.amount,
        value_usd,
        counterparty: c.counterparty,
        counterparty_label: null,
        block_number: c.block_number,
        timestamp: c.timestamp,
      };
    });

    if (rows.length > 0) {
      // ignoreDuplicates guards against a concurrent webhook inserting the same
      // tx between our existence check and this write.
      const { error, count } = await supabase
        .from("whale_activity")
        .upsert(rows, { onConflict: "tx_hash,whale_address,chain", ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      inserted = count ?? rows.length;
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, polled, inserted, priced });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
