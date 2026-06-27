import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution, getFollowedWhaleAddresses, ilikeAnyFilter } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";
import { priceActivityUsd } from "@/lib/whales/priceActivity";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "whale-activity-poll";

// Normalized transfer shape both chain pollers emit, so the upsert loop is
// chain-agnostic.
interface NormalizedTransfer {
  tx_hash: string;
  action: "transfer_in" | "transfer_out";
  token_address: string | null;
  token_symbol: string | null;
  amount: number | null;
  counterparty: string | null;
  block_number: number | null;
  timestamp: string;
}

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

async function pollEthereumWhale(address: string): Promise<NormalizedTransfer[]> {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return [];
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
            fromAddress: address,
            category: ["external", "erc20"],
            maxCount: "0xa",
            order: "desc",
            withMetadata: true,
          },
        ],
      }),
      source: "alchemy-transfers",
      timeoutMs: 8000,
      retries: 2,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { result?: { transfers?: AlchemyAssetTransfer[] } };
    const transfers = json.result?.transfers ?? [];
    const lower = address.toLowerCase();
    return transfers.map((t) => {
      const out = t.from.toLowerCase() === lower;
      return {
        tx_hash: t.hash,
        action: out ? "transfer_out" : "transfer_in",
        token_address: t.rawContract?.address ?? null,
        token_symbol: t.asset,
        amount: typeof t.value === "number" ? t.value : null,
        counterparty: out ? t.to : t.from,
        block_number: t.blockNum ? parseInt(t.blockNum, 16) : null,
        timestamp: t.metadata?.blockTimestamp ?? new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

interface HeliusTx {
  signature?: string;
  timestamp?: number;
  slot?: number;
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    mint?: string;
    tokenAmount?: number;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    amount?: number;
  }>;
}

async function pollSolanaWhale(address: string): Promise<NormalizedTransfer[]> {
  const key = process.env.HELIUS_API_KEY || process.env.HELIUS_API_KEY_1 || process.env.HELIUS_API_KEY_2;
  if (!key) return [];
  try {
    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${key}&limit=10`;
    const res = await fetchWithRetry(url, { method: "GET", source: "helius-transfers", timeoutMs: 8000, retries: 2 });
    if (!res.ok) return [];
    const txs = (await res.json()) as HeliusTx[];
    if (!Array.isArray(txs)) return [];
    const out: NormalizedTransfer[] = [];
    for (const t of txs) {
      const sig = t.signature;
      if (!sig) continue;
      const ts = t.timestamp ? new Date(t.timestamp * 1000).toISOString() : new Date().toISOString();
      const block = typeof t.slot === "number" ? t.slot : null;
      // Pick the single most significant transfer leg involving the whale so
      // one tx → one row (the upsert key is tx_hash+whale+chain). Prefer the
      // largest token transfer; fall back to the largest native (SOL) move.
      const tokenLegs = (t.tokenTransfers ?? []).filter(
        (x) => x.fromUserAccount === address || x.toUserAccount === address,
      );
      const nativeLegs = (t.nativeTransfers ?? []).filter(
        (x) => x.fromUserAccount === address || x.toUserAccount === address,
      );
      let leg: NormalizedTransfer | null = null;
      if (tokenLegs.length) {
        const top = tokenLegs.reduce((a, b) => ((b.tokenAmount ?? 0) > (a.tokenAmount ?? 0) ? b : a));
        const isOut = top.fromUserAccount === address;
        leg = {
          tx_hash: sig,
          action: isOut ? "transfer_out" : "transfer_in",
          token_address: top.mint ?? null,
          token_symbol: null, // resolved via Birdeye-by-mint when pricing
          amount: typeof top.tokenAmount === "number" ? top.tokenAmount : null,
          counterparty: (isOut ? top.toUserAccount : top.fromUserAccount) ?? null,
          block_number: block,
          timestamp: ts,
        };
      } else if (nativeLegs.length) {
        const top = nativeLegs.reduce((a, b) => ((b.amount ?? 0) > (a.amount ?? 0) ? b : a));
        const isOut = top.fromUserAccount === address;
        leg = {
          tx_hash: sig,
          action: isOut ? "transfer_out" : "transfer_in",
          token_address: null,
          token_symbol: "SOL",
          amount: typeof top.amount === "number" ? top.amount / 1e9 : null, // lamports → SOL
          counterparty: (isOut ? top.toUserAccount : top.fromUserAccount) ?? null,
          block_number: block,
          timestamp: ts,
        };
      }
      if (leg) out.push(leg);
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let polled = 0;
  let inserted = 0;
  try {
    const supabase = getSupabaseAdmin();

    // Demand gate: poll only whales a user actually follows. The whales table
    // is seeded with hundreds of addresses; polling them all every tick spends
    // RPC budget on whales nobody tracks. Scoping to followed whales makes cost
    // scale with real demand (zero when no follows).
    const followed = await getFollowedWhaleAddresses();
    if (followed.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, skipped: "no-followed-whales", polled: 0 });
    }

    const { data: whales } = await supabase
      .from("whales")
      .select("address, chain")
      .eq("is_active", true)
      .in("chain", ["ethereum", "solana"])
      .or(ilikeAnyFilter("address", followed))
      .order("last_active_at", { ascending: true, nullsFirst: true })
      .limit(25);

    for (const whale of (whales ?? []) as Array<{ address: string; chain: string }>) {
      const transfers =
        whale.chain === "solana"
          ? await pollSolanaWhale(whale.address)
          : await pollEthereumWhale(whale.address);
      polled++;
      for (const t of transfers) {
        // Price at insert time so the feed (which filters value_usd >= minUsd)
        // sees the row immediately instead of waiting on the backfill cron.
        // priceActivityUsd caches per-token for 60s, so a poll run makes ~one
        // network call per distinct token, not per transfer. Unpriceable tokens
        // stay null and get retried by whale-activity-price. Never fabricated.
        let valueUsd: number | null = null;
        try {
          valueUsd = await priceActivityUsd({
            chain: whale.chain,
            token_address: t.token_address,
            token_symbol: t.token_symbol,
            amount: t.amount,
          });
        } catch { /* leave null — price cron retries */ }
        const { error } = await supabase.from("whale_activity").upsert(
          {
            whale_address: whale.address,
            chain: whale.chain,
            tx_hash: t.tx_hash,
            action: t.action,
            token_address: t.token_address,
            token_symbol: t.token_symbol,
            amount: t.amount,
            value_usd: valueUsd,
            counterparty: t.counterparty,
            counterparty_label: null,
            block_number: t.block_number,
            timestamp: t.timestamp,
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
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, polled, inserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
