import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";
import { priceActivityUsd } from "@/lib/whales/priceActivity";
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
const WHALES_PER_TICK = 25;
const POOL = 5;

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
    maxCount: "0xa",
    order: "desc",
    withMetadata: true,
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

async function ingestWhale(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  whale: WhaleRow,
): Promise<number> {
  const [outbound, inbound] = await Promise.all([
    pollTransfers(whale.chain, whale.address, "out"),
    pollTransfers(whale.chain, whale.address, "in"),
  ]);
  let inserted = 0;
  for (const t of [...outbound, ...inbound]) {
    const amount = typeof t.value === "number" ? t.value : null;
    const ts = t.metadata?.blockTimestamp ?? new Date().toISOString();
    const isOut = addressesEqual(t.from, whale.address, whale.chain);
    const action = isOut ? "transfer_out" : "transfer_in";
    // Price at ingest so the feed (which filters value_usd >= minUsd) is
    // populated the moment a row lands — no waiting for the price backfill
    // cron. priceActivityUsd caches per-token, so native ETH rows in the same
    // tick share one price lookup.
    const value_usd = await priceActivityUsd({
      chain: whale.chain,
      token_address: t.rawContract?.address ?? null,
      token_symbol: t.asset,
      amount,
    });
    const { error } = await supabase.from("whale_activity").upsert(
      {
        whale_address: whale.address,
        chain: whale.chain,
        tx_hash: t.hash,
        action,
        token_address: t.rawContract?.address ?? null,
        token_symbol: t.asset,
        amount,
        value_usd,
        counterparty: isOut ? t.to : t.from,
        counterparty_label: null,
        block_number: parseInt(t.blockNum, 16),
        timestamp: ts,
      },
      { onConflict: "tx_hash,whale_address,chain" },
    );
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
    for (let i = 0; i < queue.length; i += POOL) {
      const batch = queue.slice(i, i + POOL);
      const counts = await Promise.all(batch.map((w) => ingestWhale(supabase, w).catch(() => 0)));
      inserted += counts.reduce((a, b) => a + b, 0);
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, polled: queue.length, inserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
