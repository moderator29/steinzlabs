/**
 * TON sniper execution adapter.
 *
 * build():  Ston.fi router quote → returns the swap message body as a
 *           base64-encoded BOC the user's wallet will sign and send.
 * submit(): TON Center sendBoc — TON has no mempool, so MEV-protect is a no-op
 *           (every external message is broadcast directly to validators).
 *
 * Pre-launch sniping is not supported on TON in this adapter (chain config
 * already advertises preLaunchSnipe=false). New-jetton detection runs on the
 * webhook side, which then enqueues a normal swap through this adapter.
 */

import type { BuildParams, BuildResult, EngineAdapter, SubmitParams, SubmitResult } from "./types";
import { timed } from "./apiCost";

const TON_CENTER_BASE = process.env.TON_CENTER_URL ?? "https://toncenter.com/api/v2";
const STONFI_BASE = process.env.STONFI_API_URL ?? "https://api.ston.fi";
const TON_NATIVE = "ton"; // Ston.fi convention for native TON
const QUOTE_VALIDITY_MS = 60_000;

function tonCenterHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const k = process.env.TON_CENTER_API_KEY;
  if (k) h["X-API-Key"] = k;
  return h;
}

async function stonfiSwapSimulate(params: {
  offerAddress: string;
  askAddress: string;
  units: bigint;
  slippageTolerance: number; // 0..1
  walletAddress: string;
  userId?: string;
  criteriaId?: string;
}) {
  return timed(
    {
      provider: "stonfi",
      chain: "ton",
      endpoint: "swap/simulate",
      userId: params.userId,
      criteriaId: params.criteriaId,
    },
    async () => {
      const search = new URLSearchParams({
        offer_address: params.offerAddress,
        ask_address: params.askAddress,
        units: params.units.toString(),
        slippage_tolerance: params.slippageTolerance.toString(),
        wallet_address: params.walletAddress,
      });
      const res = await fetch(`${STONFI_BASE}/v1/swap/simulate?${search.toString()}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText);
        throw new Error(`Ston.fi simulate failed (${res.status}): ${body}`);
      }
      return { result: await res.json(), status: res.status };
    },
  );
}

export const tonAdapter: EngineAdapter = {
  chain: "ton",

  async build(p: BuildParams): Promise<BuildResult> {
    const offer = p.fromToken === "native" ? TON_NATIVE : p.fromToken;
    const ask = p.toToken;
    const units = BigInt(Math.floor(p.amountIn * 1e9)); // TON has 9 decimals

    const sim = await stonfiSwapSimulate({
      offerAddress: offer,
      askAddress: ask,
      units,
      slippageTolerance: p.slippageBps / 10_000,
      walletAddress: p.walletAddress,
      userId: p.userId,
      criteriaId: p.criteriaId,
    });

    // Ston.fi returns the unsigned message payload + destination + amount the
    // wallet must send. The browser builds a TonConnect transaction from these,
    // signs, and either submits directly via TonConnect or hands the resulting
    // BOC back to submit() below for a server-side broadcast.
    const messagePayload = sim?.message_payload ?? sim?.payload ?? null;
    if (!messagePayload) throw new Error("Ston.fi returned no message payload");

    const expectedOut = Number(sim?.ask_units ?? 0) / 1e9;
    const priceImpactPct = parseFloat(sim?.price_impact ?? "0") * 100;

    const unsignedTx = Buffer.from(
      JSON.stringify({
        to: sim?.router_address ?? sim?.to,
        amount: sim?.offer_units ?? units.toString(),
        payload: messagePayload,
      }),
      "utf-8",
    ).toString("base64");

    return {
      unsignedTx,
      encoding: "ton-boc-base64",
      expectedOut,
      priceImpactPct,
      routeLabel: "Ston.fi",
      validUntilMs: Date.now() + QUOTE_VALIDITY_MS,
      provider: "stonfi",
      meta: { offer, ask, slippageBps: p.slippageBps },
    };
  },

  async submit(p: SubmitParams): Promise<SubmitResult> {
    const t0 = Date.now();

    const result = await timed(
      {
        provider: "ton-center",
        chain: "ton",
        endpoint: "sendBoc",
        userId: p.userId,
        criteriaId: p.criteriaId,
      },
      async () => {
        const res = await fetch(`${TON_CENTER_BASE}/sendBoc`, {
          method: "POST",
          headers: tonCenterHeaders(),
          body: JSON.stringify({ boc: p.signedTx }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => res.statusText);
          throw new Error(`TON sendBoc failed (${res.status}): ${body}`);
        }
        const json = await res.json();
        if (!json.ok) throw new Error(`TON sendBoc not ok: ${JSON.stringify(json)}`);
        return { result: json, status: res.status };
      },
    );

    // TON Center returns a transaction hash in result.hash on most deployments;
    // some return only `ok:true`. When unavailable, we return the BOC hash as a
    // best-effort identifier that the caller can use to poll TON API later.
    const txHash: string =
      result?.result?.hash ?? result?.hash ?? result?.result?.['@type'] ?? "ton-pending";

    return {
      txHash,
      executionTimeMs: Date.now() - t0,
      gasUsed: null,
      gasPriceNative: null,
      routeUsed: "ton-api",
    };
  },
};
