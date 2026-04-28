/**
 * EVM sniper execution adapter (Ethereum, BNB Chain, Avalanche).
 *
 * build():   0x v2 swap allowance-holder/quote → returns calldata + to + value
 *            + gas params. Caller (browser) signs an EIP-1559 tx with these
 *            fields.
 * submit():  if mevProtect=true:
 *              - Ethereum  → Flashbots Protect RPC (https://rpc.flashbots.net)
 *              - BSC       → BloxRoute Cloud-API tx-relay
 *              - Avalanche → no MEV concerns; uses public RPC.
 *            else → public RPC for the chain.
 *
 * Why split: Naka Labs never holds keys server-side (see lib/trading/builtinSigner.ts).
 * The signed raw tx hex comes back from the browser; we only relay it.
 */

import { JsonRpcProvider, Transaction } from "ethers";
import type { SniperChain } from "../chains";
import type { BuildParams, BuildResult, EngineAdapter, SubmitParams, SubmitResult } from "./types";
import { timed } from "./apiCost";

const QUOTE_VALIDITY_MS = 30_000;

const CHAIN_IDS: Record<Extract<SniperChain, "ethereum" | "bsc" | "avalanche">, number> = {
  ethereum: 1,
  bsc: 56,
  avalanche: 43114,
};

const NATIVE_PSEUDO = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"; // 0x convention

function alchemyRpcUrl(chain: SniperChain): string {
  const key = process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY not set");
  switch (chain) {
    case "ethereum":
      return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
    case "bsc":
      return `https://bnb-mainnet.g.alchemy.com/v2/${key}`;
    case "avalanche":
      return `https://avax-mainnet.g.alchemy.com/v2/${key}`;
    default:
      throw new Error(`Not an EVM chain: ${chain}`);
  }
}

function flashbotsRpcUrl(): string {
  return process.env.FLASHBOTS_PROTECT_RPC ?? "https://rpc.flashbots.net";
}

function bloxrouteEndpoint(): { url: string; auth: string | null } {
  return {
    url: process.env.BLOXROUTE_BSC_URL ?? "https://api.blxrbdn.com",
    auth: process.env.BLOXROUTE_AUTH ?? null,
  };
}

async function zeroXQuote(params: {
  chain: SniperChain;
  sellToken: string;
  buyToken: string;
  sellAmountWei: bigint;
  taker: string;
  slippageBps: number;
  userId?: string;
  criteriaId?: string;
}) {
  const apiKey = process.env.ZX_API_KEY ?? process.env.NEXT_PUBLIC_ZX_API_KEY;
  if (!apiKey) throw new Error("ZX_API_KEY not set");

  const chainId = CHAIN_IDS[params.chain as keyof typeof CHAIN_IDS];
  if (!chainId) throw new Error(`Unsupported EVM chain for 0x: ${params.chain}`);

  const search = new URLSearchParams({
    chainId: String(chainId),
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmountWei.toString(),
    taker: params.taker,
    slippageBps: String(params.slippageBps),
  });

  return timed(
    {
      provider: "0x",
      chain: params.chain,
      endpoint: "swap/allowance-holder/quote",
      userId: params.userId,
      criteriaId: params.criteriaId,
    },
    async () => {
      const res = await fetch(
        `https://api.0x.org/swap/allowance-holder/quote?${search.toString()}`,
        { headers: { "0x-api-key": apiKey, "0x-version": "v2" } },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText);
        throw new Error(`0x quote failed (${res.status}): ${body}`);
      }
      const json = await res.json();
      return { result: json, status: res.status };
    },
  );
}

export function makeEvmAdapter(chain: Extract<SniperChain, "ethereum" | "bsc" | "avalanche">): EngineAdapter {
  return {
    chain,

    async build(p: BuildParams): Promise<BuildResult> {
      const sellToken = p.fromToken === "native" ? NATIVE_PSEUDO : p.fromToken;
      const buyToken = p.toToken;
      const sellAmountWei = BigInt(Math.floor(p.amountIn * 1e18));

      const quote = await zeroXQuote({
        chain,
        sellToken,
        buyToken,
        sellAmountWei,
        taker: p.walletAddress,
        slippageBps: p.slippageBps,
        userId: p.userId,
        criteriaId: p.criteriaId,
      });

      const tx = quote.transaction ?? {};
      const buyAmountWei = BigInt(quote.buyAmount ?? "0");
      // Output decimals are token-specific. 0x doesn't include them in v2 quote;
      // expectedOut is reported in raw wei here and converted by the caller when
      // it knows the token's decimals. UI/relayer already does this lookup.
      const expectedOutRaw = Number(buyAmountWei);

      const unsignedTx = JSON.stringify({
        chainId: CHAIN_IDS[chain],
        to: tx.to,
        data: tx.data,
        value: tx.value ?? "0",
        gas: tx.gas ?? null,
        gasPrice: tx.gasPrice ?? null,
        // EIP-1559: client supplies maxFeePerGas / maxPriorityFeePerGas based on
        // current network conditions + p.priorityFeeNative override (gwei).
        maxPriorityFeePerGasGwei: p.priorityFeeNative ?? null,
      });

      return {
        unsignedTx,
        encoding: "evm-eip1559-json",
        expectedOut: expectedOutRaw,
        priceImpactPct: parseFloat(quote.estimatedPriceImpact ?? "0"),
        routeLabel: (quote.route?.fills ?? [])
          .map((f: any) => f?.source)
          .filter(Boolean)
          .join(" → ") || "0x Aggregator",
        validUntilMs: Date.now() + QUOTE_VALIDITY_MS,
        provider: "0x",
        meta: { allowanceTarget: quote.allowanceTarget ?? tx.to, sellToken, buyToken },
      };
    },

    async submit(p: SubmitParams): Promise<SubmitResult> {
      const t0 = Date.now();

      let rpcUrl: string;
      let routeUsed: SubmitResult["routeUsed"];

      if (p.mevProtect && chain === "ethereum") {
        rpcUrl = flashbotsRpcUrl();
        routeUsed = "flashbots";
      } else if (p.mevProtect && chain === "bsc") {
        const blx = bloxrouteEndpoint();
        rpcUrl = blx.url;
        routeUsed = "bloxroute";
      } else {
        rpcUrl = alchemyRpcUrl(chain);
        routeUsed = "public-rpc";
      }

      const tx = Transaction.from(p.signedTx);
      const txHash = tx.hash;
      if (!txHash) throw new Error("Could not derive tx hash from signed transaction");

      const sendResult = await timed(
        {
          provider: routeUsed === "flashbots" ? "flashbots" : routeUsed === "bloxroute" ? "bloxroute" : "alchemy",
          chain,
          endpoint: "eth_sendRawTransaction",
          userId: p.userId,
          criteriaId: p.criteriaId,
        },
        async () => {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (routeUsed === "bloxroute") {
            const blx = bloxrouteEndpoint();
            if (blx.auth) headers["Authorization"] = blx.auth;
          }
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_sendRawTransaction",
              params: [p.signedTx],
            }),
          });
          if (!res.ok) {
            const body = await res.text().catch(() => res.statusText);
            throw new Error(`sendRawTransaction failed (${res.status}): ${body}`);
          }
          const json = await res.json();
          if (json.error) throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
          return { result: json.result as string, status: res.status };
        },
      );

      const provider = new JsonRpcProvider(alchemyRpcUrl(chain));
      const receipt = await provider.waitForTransaction(sendResult, 1, 60_000);

      return {
        txHash: sendResult,
        executionTimeMs: Date.now() - t0,
        gasUsed: receipt?.gasUsed != null ? Number(receipt.gasUsed) : null,
        gasPriceNative: receipt?.gasPrice != null ? Number(receipt.gasPrice) / 1e9 : null,
        routeUsed,
        error: receipt?.status === 0 ? "Transaction reverted on-chain" : undefined,
      };
    },
  };
}

export const ethereumAdapter = makeEvmAdapter("ethereum");
export const bscAdapter = makeEvmAdapter("bsc");
export const avalancheAdapter = makeEvmAdapter("avalanche");
