/**
 * Shared token-id → on-chain / CoinGecko-slug maps.
 *
 * Extracted so the coin-detail route AND the live token-stats route resolve a
 * URL segment (a contract, a CoinGecko slug, a bare symbol, or a community
 * slug) the SAME way — no drift between "what the page shows" and "what the 4s
 * live poll shows".
 */

// Community tokens CoinGecko doesn't index → route their slug to the on-chain
// contract so the DexScreener path serves real pair data instead of a 404.
export const COMMUNITY_TOKEN_CONTRACTS: Record<string, string> = {
  // $NAKA — ETH-only, Uniswap-traded community token.
  naka: '0x6967b9a8c0b14849CFE8f9E5732B401433fD2898',
  'naka-go': '0x6967b9a8c0b14849CFE8f9E5732B401433fD2898',
  // Pleasure Coin — Polygon-traded.
  pleasure: '0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19',
  'pleasure-coin': '0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19',
  nsfw: '0x8f006d1e1d9dc6c98996f50a4c810f17a47fbf19',
};

// Wallet-side symbols the user might URL-ify (eth/btc/sol/…) don't match
// CoinGecko slugs directly. Map the obvious ones so native assets stop showing
// $0.00 when a wallet links to /coin/<chain>/eth instead of /…/ethereum.
export const SYMBOL_TO_SLUG: Record<string, string> = {
  eth: 'ethereum',
  weth: 'weth',
  btc: 'bitcoin',
  wbtc: 'wrapped-bitcoin',
  sol: 'solana',
  bnb: 'binancecoin',
  wbnb: 'wbnb',
  matic: 'matic-network',
  pol: 'polygon-ecosystem-token',
  avax: 'avalanche-2',
  arb: 'arbitrum',
  op: 'optimism',
  usdc: 'usd-coin',
  usdt: 'tether',
  dai: 'dai',
  link: 'chainlink',
  uni: 'uniswap',
  ltc: 'litecoin',
  trx: 'tron',
  doge: 'dogecoin',
  shib: 'shiba-inu',
};

/** True for a 0x…40-hex EVM contract address. */
export function isEvmContract(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

/** True for a base58 Solana mint (32–44 chars, not 0x-prefixed). */
export function isSolanaAddress(v: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v) && !v.startsWith('0x');
}

/**
 * Resolve a raw URL segment to the identifier our data sources understand.
 * Returns the resolved id plus whether it looks like an on-chain contract.
 */
export function resolveTokenId(rawId: string): { id: string; isContract: boolean } {
  const lower = rawId.toLowerCase();
  const id = COMMUNITY_TOKEN_CONTRACTS[lower] ?? SYMBOL_TO_SLUG[lower] ?? rawId;
  return { id, isContract: isEvmContract(id) || isSolanaAddress(id) };
}
