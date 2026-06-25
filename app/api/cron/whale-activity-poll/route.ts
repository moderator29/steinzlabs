import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution, getFollowedWhaleAddresses, ilikeAnyFilter } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "whale-activity-poll";

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

async function pollEthereumWhale(address: string): Promise<AlchemyAssetTransfer[]> {
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
    return json.result?.transfers ?? [];
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
    // is seeded with hundreds of addresses; polling them all via Alchemy every
    // tick spends RPC budget on whales nobody tracks. Scoping to followed
    // whales makes cost scale with real demand (zero when no follows).
    const followed = await getFollowedWhaleAddresses();
    if (followed.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, skipped: "no-followed-whales", polled: 0 });
    }

    const { data: whales } = await supabase
      .from("whales")
      .select("address, chain")
      .eq("is_active", true)
      .eq("chain", "ethereum")
      .or(ilikeAnyFilter("address", followed))
      .order("last_active_at", { ascending: true, nullsFirst: true })
      .limit(25);

    for (const whale of (whales ?? []) as Array<{ address: string; chain: string }>) {
      const transfers = await pollEthereumWhale(whale.address);
      polled++;
      for (const t of transfers) {
        const value = typeof t.value === "number" ? t.value : null;
        const ts = t.metadata?.blockTimestamp ?? new Date().toISOString();
        const action = t.from.toLowerCase() === whale.address.toLowerCase() ? "transfer_out" : "transfer_in";
        const { error } = await supabase.from("whale_activity").upsert(
          {
            whale_address: whale.address,
            chain: whale.chain,
            tx_hash: t.hash,
            action,
            token_address: t.rawContract?.address ?? null,
            token_symbol: t.asset,
            amount: value,
            value_usd: null,
            counterparty: t.from.toLowerCase() === whale.address.toLowerCase() ? t.to : t.from,
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
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, polled, inserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
