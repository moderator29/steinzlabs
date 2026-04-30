/**
 * Solana sniper execution adapter.
 *
 * build():  Jupiter v6 quote + swap-instruction → unsigned VersionedTransaction.
 * submit(): if mevProtect=true, bundle the signed tx through Jito's block engine
 *           (front-running protected, atomic landing). Otherwise broadcast via
 *           Helius RPC for low-latency public-mempool propagation.
 *
 * Helius is preferred over the public mainnet RPC because it has
 * staked-connection priority and per-region routing; Jito is preferred for
 * MEV protection because Solana's leader schedule means a normal RPC submit
 * can be sandwiched by validator-aligned bots.
 */

import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { BuildParams, BuildResult, EngineAdapter, SubmitParams, SubmitResult } from "./types";
import { timed } from "./apiCost";

const JUPITER_BASE = "https://lite-api.jup.ag/swap/v1";
const SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112";
const QUOTE_VALIDITY_MS = 30_000;

function heliusRpcUrl(): string {
  const key = process.env.HELIUS_API_KEY_1 ?? process.env.HELIUS_API_KEY_2;
  if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  const fallback = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC ?? process.env.SOLANA_RPC_URL;
  if (fallback) return fallback;
  throw new Error("No Solana RPC configured (set HELIUS_API_KEY_1 or SOLANA_RPC_URL)");
}

function jitoBlockEngineUrl(): string {
  return process.env.JITO_BLOCK_ENGINE_URL ?? "https://mainnet.block-engine.jito.wtf";
}

async function jupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: bigint;
  slippageBps: number;
  userId?: string;
  criteriaId?: string;
}) {
  const search = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amountLamports.toString(),
    slippageBps: String(params.slippageBps),
    onlyDirectRoutes: "false",
    asLegacyTransaction: "false",
  });
  return timed(
    {
      provider: "jupiter",
      chain: "solana",
      endpoint: "quote",
      userId: params.userId,
      criteriaId: params.criteriaId,
    },
    async () => {
      const res = await fetch(`${JUPITER_BASE}/quote?${search.toString()}`);
      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText);
        throw new Error(`Jupiter quote failed (${res.status}): ${body}`);
      }
      const json = await res.json();
      return { result: json, status: res.status };
    },
  );
}

async function jupiterSwap(params: {
  quoteResponse: unknown;
  userPublicKey: string;
  priorityFeeMicrolamports?: number;
  userId?: string;
  criteriaId?: string;
}) {
  return timed(
    {
      provider: "jupiter",
      chain: "solana",
      endpoint: "swap",
      userId: params.userId,
      criteriaId: params.criteriaId,
    },
    async () => {
      const res = await fetch(`${JUPITER_BASE}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: params.quoteResponse,
          userPublicKey: params.userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports:
            params.priorityFeeMicrolamports != null
              ? { priorityLevelWithMaxLamports: { maxLamports: params.priorityFeeMicrolamports * 1000 } }
              : "auto",
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText);
        throw new Error(`Jupiter swap failed (${res.status}): ${body}`);
      }
      const json = await res.json();
      return { result: json as { swapTransaction: string }, status: res.status };
    },
  );
}

async function submitJitoBundle(params: {
  signedTxBase64: string;
  userId?: string;
  criteriaId?: string;
}): Promise<string> {
  return timed(
    {
      provider: "jito",
      chain: "solana",
      endpoint: "sendBundle",
      userId: params.userId,
      criteriaId: params.criteriaId,
    },
    async () => {
      const res = await fetch(`${jitoBlockEngineUrl()}/api/v1/bundles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendBundle",
          params: [[params.signedTxBase64], { encoding: "base64" }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText);
        throw new Error(`Jito sendBundle failed (${res.status}): ${body}`);
      }
      const json = await res.json();
      if (json.error) throw new Error(`Jito sendBundle error: ${JSON.stringify(json.error)}`);
      return { result: json.result as string, status: res.status };
    },
  );
}

export const solanaAdapter: EngineAdapter = {
  chain: "solana",

  async build(p: BuildParams): Promise<BuildResult> {
    const inputMint = p.fromToken === "native" ? SOL_NATIVE_MINT : p.fromToken;
    const outputMint = p.toToken;
    const amountLamports = BigInt(Math.floor(p.amountIn * 1e9));

    const quote = await jupiterQuote({
      inputMint,
      outputMint,
      amountLamports,
      slippageBps: p.slippageBps,
      userId: p.userId,
      criteriaId: p.criteriaId,
    });

    const { swapTransaction } = await jupiterSwap({
      quoteResponse: quote,
      userPublicKey: p.walletAddress,
      priorityFeeMicrolamports: p.priorityFeeNative,
      userId: p.userId,
      criteriaId: p.criteriaId,
    });

    // Jupiter v6 returns outAmount as a string in the destination mint's
    // smallest unit. Decimals are NOT included on the quote payload — caller
    // resolves them via token metadata; we surface null here rather than
    // guessing 9 (which would be wrong for USDC-style 6-dec mints).
    const expectedOutRaw = String(quote.outAmount ?? "0");
    const priceImpactPct = Math.abs(parseFloat(quote.priceImpactPct ?? "0")) * 100;
    const labels: string[] = (quote.routePlan ?? [])
      .map((s: any) => s?.swapInfo?.label)
      .filter((l: unknown): l is string => typeof l === "string");
    const routeLabel = labels.length ? labels.join(" → ") : "Jupiter";

    return {
      unsignedTx: swapTransaction,
      encoding: "solana-versioned-tx-base64",
      expectedOutRaw,
      expectedOutDecimals: null,
      priceImpactPct,
      routeLabel,
      validUntilMs: Date.now() + QUOTE_VALIDITY_MS,
      provider: "jupiter",
      meta: { inputMint, outputMint, slippageBps: p.slippageBps },
    };
  },

  async submit(p: SubmitParams): Promise<SubmitResult> {
    const t0 = Date.now();
    const conn = new Connection(heliusRpcUrl(), "confirmed");

    if (p.mevProtect) {
      const txHash = await submitJitoBundle({
        signedTxBase64: p.signedTx,
        userId: p.userId,
        criteriaId: p.criteriaId,
      });
      const conf = await conn.confirmTransaction(txHash, "confirmed");
      if (conf.value.err) {
        return {
          txHash,
          executionTimeMs: Date.now() - t0,
          gasUsed: null,
          gasPriceNative: null,
          routeUsed: "jito-bundle",
          error: `Confirmed with err: ${JSON.stringify(conf.value.err)}`,
        };
      }
      return {
        txHash,
        executionTimeMs: Date.now() - t0,
        gasUsed: null,
        gasPriceNative: null,
        routeUsed: "jito-bundle",
      };
    }

    const buf = Buffer.from(p.signedTx, "base64");
    const tx = VersionedTransaction.deserialize(buf);
    const txHash = await conn.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });
    const conf = await conn.confirmTransaction(txHash, "confirmed");
    const status = await conn.getSignatureStatus(txHash, { searchTransactionHistory: true });
    const cuConsumed =
      (await conn.getTransaction(txHash, { maxSupportedTransactionVersion: 0 }))?.meta
        ?.computeUnitsConsumed ?? null;

    return {
      txHash,
      executionTimeMs: Date.now() - t0,
      gasUsed: typeof cuConsumed === "number" ? cuConsumed : null,
      gasPriceNative: null,
      routeUsed: "public-rpc",
      error: conf.value.err
        ? `Confirmed with err: ${JSON.stringify(conf.value.err)}`
        : status.value?.err
          ? `Status err: ${JSON.stringify(status.value.err)}`
          : undefined,
    };
  },
};
