import "server-only";
import { searchTokens } from "@/lib/services/coingecko";

/**
 * Resolve a user-typed token symbol or name to a canonical CoinGecko coin ID.
 *
 * The CoinGecko search endpoint returns matches ordered by market cap rank,
 * which gives us "the obvious one" for ambiguous symbols (e.g. "USDC" → the
 * real Circle USDC, not some random scam token). Symbol-exact match wins
 * over name match so /price USDC doesn't return a coin merely *named*
 * USDC-something.
 */

const HARDCODED: Record<string, string> = {
  // Top tickers people will type most often. Hardcoding them avoids a
  // CoinGecko search round-trip on every /price BTC and avoids the (small)
  // chance that the search ranks a memecoin above the canonical asset.
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOGE: "dogecoin",
  TRX: "tron",
  LINK: "chainlink",
  MATIC: "matic-network",
  DOT: "polkadot",
  TON: "the-open-network",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  UNI: "uniswap",
  XLM: "stellar",
  HBAR: "hedera-hashgraph",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  FIL: "filecoin",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  PEPE: "pepe",
  WIF: "dogwifcoin",
  BONK: "bonk",
  AAVE: "aave",
  MKR: "maker",
  CRV: "curve-dao-token",
  LDO: "lido-dao",
  RNDR: "render-token",
  INJ: "injective-protocol",
  TIA: "celestia",
  SEI: "sei-network",
  SUI: "sui",
};

export async function resolveCoinId(input: string): Promise<{ id: string; symbol: string; name: string } | null> {
  if (!input) return null;
  const upper = input.toUpperCase().trim();

  // Hardcoded fast path
  if (HARDCODED[upper]) {
    return { id: HARDCODED[upper], symbol: upper, name: upper };
  }

  try {
    const res = await searchTokens(input.trim());
    if (!res.coins || res.coins.length === 0) return null;

    // Prefer symbol-exact match over name match.
    const exact = res.coins.find(c => c.symbol?.toUpperCase() === upper);
    const pick = exact ?? res.coins[0];
    return { id: pick.id, symbol: pick.symbol.toUpperCase(), name: pick.name };
  } catch (err) {
    console.error("[telegram.resolveCoinId] search failed:", err);
    return null;
  }
}
