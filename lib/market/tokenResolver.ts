/**
 * Symbol → EVM contract address resolver for common tokens.
 *
 * Why: 0x Protocol swap endpoints reject anything that isn't a 0x-prefixed
 * 40-char hex address with INPUT_INVALID / "Invalid ethereum address".
 * The Market page used to pass symbols ("BTC", "USDC", "ETH") straight
 * through, producing the Trade-Failed modal users saw in production.
 *
 * This module converts symbols to their canonical wrapped/bridged address
 * per chain. BTC on EVM chains maps to WBTC (no native bitcoin support).
 * Native ETH / BNB / MATIC / etc. resolve to the 0xEEE…EEE sentinel that
 * 0x uses for native currency.
 *
 * If the input already looks like an address (0x + 40 hex), returns it
 * unchanged — so the caller can pre-resolve or pass an address directly.
 */

const NATIVE_TOKEN_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Canonical addresses. Only include tokens we actually see users trading
// — extend carefully and cross-reference Etherscan before adding anything.
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    ETH: NATIVE_TOKEN_SENTINEL,
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    // BTC on EVM is always wrapped — route through WBTC. Users asking
    // to "buy BTC" on Ethereum get WBTC; no native BTC on EVM exists.
    BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
  },
  base: {
    ETH: NATIVE_TOKEN_SENTINEL,
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    // Native USDbC was Base's first USDC before Circle-native launched; keep
    // it mapped in case older deposits reference it.
    USDBC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    CBBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    BTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  },
  arbitrum: {
    ETH: NATIVE_TOKEN_SENTINEL,
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    BTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  },
  polygon: {
    MATIC: NATIVE_TOKEN_SENTINEL,
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    BTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  },
  optimism: {
    ETH: NATIVE_TOKEN_SENTINEL,
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    WBTC: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
    BTC: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
    OP: '0x4200000000000000000000000000000000000042',
  },
  bsc: {
    BNB: NATIVE_TOKEN_SENTINEL,
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    // BTCB — Binance-pegged BTC, the standard on BSC
    BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    BTC: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  },
};

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Returns the canonical contract address for `symbolOrAddress` on `chain`.
 *
 * Rules:
 *   1. If input already matches EVM-address shape, return it lowercased.
 *      (0x pass-through — caller already knows the address.)
 *   2. Uppercase the input, look it up in the per-chain map. Hit → return.
 *   3. Miss → return null so the caller can decide between "reject the
 *      trade" or "try another source (CoinGecko platform lookup)".
 *
 * Never throws — null is the miss signal.
 */
export function resolveTokenAddress(symbolOrAddress: string, chain: string): string | null {
  if (!symbolOrAddress) return null;
  const trimmed = symbolOrAddress.trim();
  if (EVM_ADDRESS_RE.test(trimmed)) return trimmed.toLowerCase();

  const chainKey = chain.toLowerCase();
  const aliases: Record<string, string> = { eth: 'ethereum', matic: 'polygon', bnb: 'bsc', arb: 'arbitrum', op: 'optimism' };
  const resolved = aliases[chainKey] ?? chainKey;
  const map = TOKEN_ADDRESSES[resolved];
  if (!map) return null;

  const upper = trimmed.toUpperCase();
  return map[upper] ?? null;
}

/**
 * Same as resolveTokenAddress but throws a helpful Error on miss. Use in
 * API routes where you want to short-circuit with a meaningful 400 instead
 * of letting 0x return its generic INPUT_INVALID.
 */
export function requireTokenAddress(symbolOrAddress: string, chain: string): string {
  const addr = resolveTokenAddress(symbolOrAddress, chain);
  if (!addr) {
    throw new Error(
      `Cannot resolve token "${symbolOrAddress}" on ${chain}. ` +
      `Pass a contract address (0x…) or one of the known symbols.`,
    );
  }
  return addr;
}

export { NATIVE_TOKEN_SENTINEL };
