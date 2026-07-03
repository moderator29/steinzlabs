import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";
import { priceActivityUsdBatch } from "@/lib/whales/priceActivity";
import { addressesEqual } from "@/lib/utils/addressNormalize";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "whale-activity-poll";

// EVM chains reachable on a single Alchemy key. Solana whales are covered by
// the Helius webhook (app/api/webhooks/helius-whale), not this poll.
const ALCHEMY_HOSTS: Record<string, string> = {
  ethereum: "eth-mainnet",
  base: "base-mainnet",
  arbitrum: "arb-mainnet",
  optimism: "opt-mainnet",
  polygon: "polygon-mainnet",
};

// Per tick we rotate through the stalest active whales so coverage scales
// with the whole directory, not just the handful a user happens to follow.
// Bitquery's bitquery-activity-poll is now the PRIMARY buy-ingest path on both
// chains; this Alchemy poll is the idempotent backup (and the only source of
// transfer_in/out + sell legs), so the per-tick count is modest. A wall-clock
// budget caps the run well under the dispatcher's 60s abort — the timeouts that
// were paging Sentry came from this loop occasionally overrunning.
// Freshness: at 14/tick in the half-hourly group a 500+ whale directory took
// ~18h to fully re-poll. Raised the per-tick ceiling + concurrency + budget so
// the cycle is roughly ~3× faster while the wall-clock budget still caps the
// run under the dispatcher's 60s abort. (A further win — moving this handler
// to a faster dispatch cadence — is the owner's call; noted in the audit TODO.)
const WHALES_PER_TICK = 40;
const POOL = 8;
const TIME_BUDGET_MS = 52_000;

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
 * Pull the most recent transfers for a whale in one direction (out = the whale
 * is the sender, in = the whale is the receiver) from the chain's Alchemy RPC.
 */
async function pollTransfers(
  chain: string,
  address: string,
  direction: "out" | "in",
): Promise<AlchemyAssetTransfer[]> {
  const key = process.env.ALCHEMY_API_KEY;
  const host = ALCHEMY_HOSTS[chain];
  if (!key || !host) return [];
  const params: Record<string, unknown> = {
    category: ["external", "erc20"],
    // 0x32 = 50 (was 0xa = 10). A DEX swap's two legs only pair into a
    // buy/sell row when BOTH land in their direction's slice and share a
    // tx_hash; a 10-row cap starved the pairing, so ~96% of rows degraded
    // to transfer noise. 50/direction captures far more real trades.
    maxCount: "0x32",
    order: "desc",
    withMetadata: true,
    excludeZeroValue: true,
  };
  if (direction === "out") params.fromAddress = address;
  else params.toAddress = address;
  try {
    const res = await fetchWithRetry(`https://${host}.g.alchemy.com/v2/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "alchemy_getAssetTransfers", params: [params] }),
      source: `alchemy-transfers-${chain}`,
      timeoutMs: 8000,
      retries: 1,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { result?: { transfers?: AlchemyAssetTransfer[] } };
    return json.result?.transfers ?? [];
  } catch {
    return [];
  }
}

type WhaleRow = { address: string; chain: string };

// Base/quote assets — when a whale swaps one of these for something else, the
// "something else" is the traded token and the base side tells us buy vs sell.
const BASE_ASSETS = new Set([
  "USDC", "USDT", "DAI", "BUSD", "FRAX", "USDC.E", "TUSD", "USDE",
  "ETH", "WETH", "BNB", "WBNB", "SOL", "WSOL", "MATIC", "WMATIC", "AVAX", "WAVAX",
]);
function isBaseAsset(sym: string | null): boolean {
  return !!sym && BASE_ASSETS.has(sym.toUpperCase());
}

interface ActivityInsert {
  whale_address: string;
  chain: string;
  tx_hash: string;
  action: string;
  token_address: string | null;
  token_symbol: string | null;
  amount: number | null;
  value_usd: number | null;
  counterparty: string | null;
  counterparty_label: null;
  block_number: number;
  timestamp: string;
}

/**
 * Turn a whale's raw out/in transfer legs into priced whale_activity rows.
 * A DEX swap surfaces as opposite-direction legs sharing one tx_hash; we pair
 * them into a single buy/sell/swap row (token = the non-base side) so the feed
 * shows real trades and copy-trade-monitor — which only acts on buy/sell/swap —
 * has something to mirror. Lone legs stay transfer_in/transfer_out.
 */
async function buildRows(whale: WhaleRow, legs: AlchemyAssetTransfer[]): Promise<ActivityInsert[]> {
  const byTx = new Map<string, AlchemyAssetTransfer[]>();
  for (const t of legs) {
    const arr = byTx.get(t.hash) ?? [];
    arr.push(t);
    byTx.set(t.hash, arr);
  }

  // Batch-price every leg up front via the dedupe + GeckoTerminal-multi path,
  // so a whale with 50 legs costs ~1-2 price requests instead of 50.
  const legUsd = new Map<AlchemyAssetTransfer, number | null>();
  const pricedValues = await priceActivityUsdBatch(
    legs.map((t) => ({
      chain: whale.chain,
      token_address: t.rawContract?.address ?? null,
      token_symbol: t.asset,
      amount: typeof t.value === "number" ? t.value : null,
    })),
  );
  legs.forEach((t, i) => legUsd.set(t, pricedValues[i]));
  const price = (t: AlchemyAssetTransfer) => legUsd.get(t) ?? null;
  const largest = (arr: AlchemyAssetTransfer[]) =>
    arr.reduce((m, t) => ((t.value ?? 0) > (m.value ?? 0) ? t : m), arr[0]);

  const rows: ActivityInsert[] = [];
  for (const [hash, group] of byTx) {
    const outLegs = group.filter((t) => addressesEqual(t.from, whale.address, whale.chain));
    const inLegs = group.filter((t) => !addressesEqual(t.from, whale.address, whale.chain));
    const ts = group[0].metadata?.blockTimestamp ?? new Date().toISOString();
    const block = parseInt(group[0].blockNum, 16);

    if (outLegs.length > 0 && inLegs.length > 0) {
      // Swap: classify by which side is a base asset.
      const out = largest(outLegs);
      const inc = largest(inLegs);
      const outBase = isBaseAsset(out.asset);
      const incBase = isBaseAsset(inc.asset);
      let action: "buy" | "sell" | "swap";
      let traded: AlchemyAssetTransfer;
      if (outBase && !incBase) { action = "buy"; traded = inc; }
      else if (!outBase && incBase) { action = "sell"; traded = out; }
      else { action = "swap"; traded = inc; }
      const outUsd = price(out);
      const incUsd = price(inc);
      rows.push({
        whale_address: whale.address,
        chain: whale.chain,
        tx_hash: hash,
        action,
        token_address: traded.rawContract?.address ?? null,
        token_symbol: traded.asset,
        amount: typeof traded.value === "number" ? traded.value : null,
        value_usd: Math.max(outUsd ?? 0, incUsd ?? 0) || null,
        counterparty: out.to,
        counterparty_label: null,
        block_number: block,
        timestamp: ts,
      });
    } else {
      // Plain transfer(s) — emit the largest leg for this tx (the upsert key is
      // tx+whale+chain, so one row per tx is all that survives anyway).
      const t = largest(group);
      const isOut = addressesEqual(t.from, whale.address, whale.chain);
      rows.push({
        whale_address: whale.address,
        chain: whale.chain,
        tx_hash: hash,
        action: isOut ? "transfer_out" : "transfer_in",
        token_address: t.rawContract?.address ?? null,
        token_symbol: t.asset,
        amount: typeof t.value === "number" ? t.value : null,
        value_usd: price(t),
        counterparty: isOut ? t.to : t.from,
        counterparty_label: null,
        block_number: block,
        timestamp: ts,
      });
    }
  }
  return rows;
}

async function ingestWhale(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  whale: WhaleRow,
): Promise<number> {
  const [outbound, inbound] = await Promise.all([
    pollTransfers(whale.chain, whale.address, "out"),
    pollTransfers(whale.chain, whale.address, "in"),
  ]);
  const rows = await buildRows(whale, [...outbound, ...inbound]);
  let inserted = 0;
  for (const row of rows) {
    const { error } = await supabase
      .from("whale_activity")
      .upsert(row, { onConflict: "tx_hash,whale_address,chain" });
    if (!error) inserted++;
  }
  await supabase
    .from("whales")
    .update({ last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("address", whale.address)
    .eq("chain", whale.chain);
  return inserted;
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let inserted = 0;
  try {
    const supabase = getSupabaseAdmin();

    // Rotate through the stalest active whales on Alchemy-reachable EVM chains.
    // NOTE: this used to be demand-gated to followed whales only — but the
    // live feed shows the WHOLE directory to every user, so gating to the
    // handful of followed whales left the feed empty. We poll the directory
    // broadly and let the per-token price cache keep cost bounded.
    const { data: whales } = await supabase
      .from("whales")
      .select("address, chain")
      .eq("is_active", true)
      .in("chain", Object.keys(ALCHEMY_HOSTS))
      .order("last_active_at", { ascending: true, nullsFirst: true })
      .limit(WHALES_PER_TICK);

    const queue = (whales ?? []) as WhaleRow[];
    // Bounded pool so a tick never opens dozens of sockets or blows maxDuration.
    // A wall-clock budget stops launching new batches once we approach the
    // dispatcher's 60s abort, so the handler always returns cleanly with a
    // partial result instead of being killed mid-flight (the TimeoutError that
    // was paging Sentry). The stale-first ordering means the unprocessed tail
    // is simply picked up on the next tick.
    let polled = 0;
    for (let i = 0; i < queue.length; i += POOL) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const batch = queue.slice(i, i + POOL);
      const counts = await Promise.all(batch.map((w) => ingestWhale(supabase, w).catch(() => 0)));
      inserted += counts.reduce((a, b) => a + b, 0);
      polled += batch.length;
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, polled, inserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
