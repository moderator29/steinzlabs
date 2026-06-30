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

const RPC_BY_CHAIN: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  bsc: "https://bsc-dataseed.binance.org",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  polygon: "https://polygon-rpc.com",
};

const decimalsCache = new Map<string, number>();

/**
 * On-chain ERC-20 decimals() via a raw eth_call. Cached. Returns null when the
 * RPC is unreachable, returns a malformed reply, or the token doesn't implement
 * decimals — so MONEY-PATH callers (auto-sell sizing, market-maker pricing) can
 * SKIP the position instead of silently assuming 18. Assuming 18 for a 6- or
 * 8-decimal token mis-scales the sell amount by 1e10–1e12x, which either sells
 * dust (and falsely marks the position realized) or over-reports price and
 * fires a false take-profit. A skipped tick simply retries next cron pass.
 */
export async function getEvmTokenDecimalsStrict(chain: string, tokenAddress: string): Promise<number | null> {
  const key = `${chain}:${tokenAddress.toLowerCase()}`;
  const cached = decimalsCache.get(key);
  if (cached != null) return cached;
  const rpc = RPC_BY_CHAIN[chain];
  if (!rpc) return null;
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to: tokenAddress, data: "0x313ce567" }, "latest"], // decimals()
      }),
      signal: AbortSignal.timeout(6000),
    });
    const json = await res.json();
    const hex = json?.result;
    if (typeof hex === "string" && hex.length >= 3) {
      const d = parseInt(hex, 16);
      if (Number.isFinite(d) && d >= 0 && d <= 36) { decimalsCache.set(key, d); return d; }
    }
  } catch { /* fall through to null */ }
  return null;
}

/**
 * Lenient decimals read for DISPLAY / non-money paths: defaults to 18 when the
 * strict read can't resolve. Never use this to size a swap or compute PnL — use
 * getEvmTokenDecimalsStrict and skip on null there.
 */
export async function getEvmTokenDecimals(chain: string, tokenAddress: string): Promise<number> {
  return (await getEvmTokenDecimalsStrict(chain, tokenAddress)) ?? 18;
}

// Solana decimals are cached under a CASE-SENSITIVE key — Solana mint addresses
// are case-sensitive (CLAUDE.md: never lowercase a Solana address), unlike the
// EVM cache which lowercases.
const solDecimalsCache = new Map<string, number>();

/**
 * SPL mint decimals via the Jupiter token list. Returns null on failure (RPC/
 * list miss) so MONEY-PATH callers SKIP the position instead of assuming a wrong
 * default — SPL tokens are typically 6 or 9 decimals, so assuming 18 over-scales
 * a sell amount by 1e9–1e12x (the swap then reverts on insufficient balance and
 * the protective sell silently never fires). Never default this for sizing.
 */
export async function getSolanaTokenDecimals(mint: string): Promise<number | null> {
  const cached = solDecimalsCache.get(mint);
  if (cached != null) return cached;
  try {
    const res = await fetch(`https://tokens.jup.ag/token/${mint}`, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const t = await res.json();
    if (t && typeof t.decimals === 'number' && t.decimals >= 0 && t.decimals <= 18) {
      solDecimalsCache.set(mint, t.decimals);
      return t.decimals;
    }
  } catch { /* fall through to null */ }
  return null;
}

async function priceUsdSolana(mint: string): Promise<number | null> {
  try {
    const p = await jupiterGetTokenPrice(mint);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function priceUsdEvm(chain: SniperChain, tokenAddress: string, decimals?: number): Promise<number | null> {
  const apiKey = process.env.ZX_API_KEY ?? process.env.NEXT_PUBLIC_ZX_API_KEY;
  if (!apiKey) return null;
  const usdc = USDC_BY_CHAIN[chain];
  const chainId = CHAIN_IDS[chain];
  if (!usdc || !chainId) return null;

  // Sell exactly ONE whole token (10**decimals base units) so buyAmount is the
  // real USD price per token. The old code hardcoded 1e18, which over-reported
  // price by 1e(18-decimals)x for non-18-decimal tokens and poisoned TP/SL/PnL.
  const dec = decimals ?? (tokenAddress === "native" ? 18 : await getEvmTokenDecimals(chain, tokenAddress));
  const sellAmount = (BigInt(10) ** BigInt(dec)).toString();
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
    // USDC is 6 decimals on most chains but 18 on BSC (Binance-Peg USDC) —
    // the old hardcoded /1e6 over-reported BSC prices by ~1e12 and poisoned
    // autosell TP/SL on BSC.
    const usdcDecimals = chain === "bsc" ? 18 : 6;
    return Number(buyAmount) / 10 ** usdcDecimals;
  } catch {
    return null;
  }
}

export async function getCurrentTokenPriceUsd(
  chain: SniperChain,
  tokenAddress: string,
  decimals?: number,
): Promise<number | null> {
  if (chain === "solana") return priceUsdSolana(tokenAddress);
  if (chain === "ethereum" || chain === "bsc" || chain === "avalanche") {
    return priceUsdEvm(chain, tokenAddress, decimals);
  }
  // TON: skipped — no fast USD price feed wired yet.
  return null;
}
