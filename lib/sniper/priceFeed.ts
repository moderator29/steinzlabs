/**
 * Sniper price feed — current USD price for a token on a sniper chain.
 *
 * Solana: Jupiter Price API (free, ~200ms, sub-cent accuracy on tradable mints).
 * EVM:    0x v2 quote — sells 1 token → USDC, derives spot from buyAmount.
 * TON:    not yet wired. Returns null so the auto-sell cron can skip TON
 *         positions until Ston.fi or DeDust price endpoint is added.
 *
 * Returns USD per single token (not per 1e18 / 1e9 / 1e6 unit).
 */

import { getTokenPrice as jupiterGetTokenPrice } from "@/lib/services/jupiter";
import type { SniperChain } from "./chains";
import { timed } from "./engine/apiCost";

// Common stable / reference tokens for 0x price queries.
const USDC_BY_CHAIN: Record<string, string> = {
  ethereum: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  bsc: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
  avalanche: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
};

const NATIVE_PSEUDO = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  bsc: 56,
  avalanche: 43114,
};

async function priceUsdSolana(mint: string): Promise<number | null> {
  try {
    const p = await jupiterGetTokenPrice(mint);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function priceUsdEvm(chain: SniperChain, tokenAddress: string): Promise<number | null> {
  const apiKey = process.env.ZX_API_KEY ?? process.env.NEXT_PUBLIC_ZX_API_KEY;
  if (!apiKey) return null;
  const usdc = USDC_BY_CHAIN[chain];
  const chainId = CHAIN_IDS[chain];
  if (!usdc || !chainId) return null;

  // Sell 1 whole token (assume 18 decimals — caller corrects if it knows).
  // For non-18-dec tokens this still works for spot price as long as the same
  // amount->USDC ratio holds; we only need price-per-token, not absolute size.
  const sellAmount = "1000000000000000000"; // 1e18 (assume 18 decimals)
  const search = new URLSearchParams({
    chainId: String(chainId),
    sellToken: tokenAddress === "native" ? NATIVE_PSEUDO : tokenAddress,
    buyToken: usdc,
    sellAmount,
  });

  try {
    const json = await timed(
      { provider: "0x", chain, endpoint: "swap/price/usd-quote" },
      async () => {
        const res = await fetch(`https://api.0x.org/swap/allowance-holder/price?${search.toString()}`, {
          headers: { "0x-api-key": apiKey, "0x-version": "v2" },
        });
        if (!res.ok) throw new Error(`0x price ${res.status}`);
        return { result: await res.json(), status: res.status };
      },
    );
    const buyAmount = BigInt(json.buyAmount ?? "0");
    if (buyAmount === BigInt(0)) return null;
    // USDC has 6 decimals on every supported EVM chain.
    return Number(buyAmount) / 1e6;
  } catch {
    return null;
  }
}

export async function getCurrentTokenPriceUsd(
  chain: SniperChain,
  tokenAddress: string,
): Promise<number | null> {
  if (chain === "solana") return priceUsdSolana(tokenAddress);
  if (chain === "ethereum" || chain === "bsc" || chain === "avalanche") {
    return priceUsdEvm(chain, tokenAddress);
  }
  // TON: skipped — no fast USD price feed wired yet.
  return null;
}
