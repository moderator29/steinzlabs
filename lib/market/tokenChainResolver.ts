/**
 * Token → chain router.
 *
 * Audit B4 / P0 #4 + M6 #1 — every list click that didn't carry an
 * explicit chain (Top Gainers card, Heating Up, Market list ticker
 * results, GlobalSearch token hits) was hardcoded to route through
 * /dashboard/market/ethereum/{slug}. The result: clicking BTC, SOL,
 * BNB, AVAX, BONK, JUP, WIF, etc. landed users on the wrong chain
 * page (often $0 prices, broken charts, broken trades).
 *
 * This resolver picks the chain a token's detail page should open on
 * based on the canonical CoinGecko slug or symbol. The decision rule:
 *
 *   1. If the token is native to a non-EVM chain we trade (Solana
 *      tokens), route to that chain.
 *   2. If the token has a known canonical chain (BTC → bitcoin,
 *      SOL → solana, MATIC → polygon, etc), route to its native chain.
 *   3. Default to ethereum (the dominant DeFi chain — sensible
 *      fallback for unindexed long-tail tokens).
 *
 * Combined with lib/market/wrappedAssets.ts, the detail page can
 * decide whether to render an "underlying / wrapped" honesty label.
 *
 * Industry parity: CoinGecko routes to the canonical asset page
 * (one Bitcoin, one Solana). DexScreener routes to the chain with
 * highest-liquidity DEX pair.
 */

const SLUG_TO_NATIVE_CHAIN: Record<string, string> = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  solana: 'solana',
  binancecoin: 'bsc',
  ripple: 'xrp',
  cardano: 'cardano',
  'avalanche-2': 'avalanche',
  polkadot: 'polkadot',
  dogecoin: 'dogecoin',
  litecoin: 'litecoin',
  'matic-network': 'polygon',
  'polygon-ecosystem-token': 'polygon',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  base: 'base',
  fantom: 'fantom',
  'crypto-com-chain': 'cronos',
  sui: 'sui',
  near: 'near',
  cosmos: 'cosmos',
  // Solana ecosystem tokens — highest-liquidity venue is Solana.
  bonk: 'solana',
  dogwifcoin: 'solana',
  dogwifhat: 'solana',
  'jupiter-exchange-solana': 'solana',
  jito: 'solana',
  'jito-governance-token': 'solana',
  pyth: 'solana',
  'pyth-network': 'solana',
  popcat: 'solana',
  'book-of-meme': 'solana',
  fartcoin: 'solana',
  moodeng: 'solana',
  pnut: 'solana',
  'peanut-the-squirrel': 'solana',
  'goatseus-maximus': 'solana',
};

const SYMBOL_TO_NATIVE_CHAIN: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'bsc',
  WBNB: 'bsc',
  CAKE: 'bsc',
  AVAX: 'avalanche',
  MATIC: 'polygon',
  POL: 'polygon',
  ARB: 'arbitrum',
  OP: 'optimism',
  XRP: 'xrp',
  ADA: 'cardano',
  DOT: 'polkadot',
  DOGE: 'dogecoin',
  LTC: 'litecoin',
  FTM: 'fantom',
  CRO: 'cronos',
  SUI: 'sui',
  NEAR: 'near',
  ATOM: 'cosmos',
  // Solana ecosystem
  BONK: 'solana',
  WIF: 'solana',
  JUP: 'solana',
  JTO: 'solana',
  PYTH: 'solana',
  POPCAT: 'solana',
  BOME: 'solana',
  FARTCOIN: 'solana',
  MOODENG: 'solana',
  PNUT: 'solana',
};

export interface ResolvedRoute {
  chain: string;
  /** True when we picked from a known map; false when defaulting to ethereum. */
  confident: boolean;
}

/**
 * Resolve a chain by CoinGecko slug FIRST (slugs are canonical), then
 * fall back to symbol, then default to ethereum. Always returns a
 * route — never null — so callers can blindly push the URL.
 */
export function resolveTokenChain(input: { id?: string | null; symbol?: string | null }): ResolvedRoute {
  if (input.id) {
    const fromSlug = SLUG_TO_NATIVE_CHAIN[input.id.toLowerCase()];
    if (fromSlug) return { chain: fromSlug, confident: true };
  }
  if (input.symbol) {
    const fromSymbol = SYMBOL_TO_NATIVE_CHAIN[input.symbol.toUpperCase()];
    if (fromSymbol) return { chain: fromSymbol, confident: true };
  }
  return { chain: 'ethereum', confident: false };
}

/**
 * Convenience builder for the canonical detail-page href. Centralizes
 * URL construction so all callers stay in lockstep if the route shape
 * changes.
 */
export function buildDetailHref(input: { id?: string | null; symbol?: string | null; address?: string | null }): string {
  const { chain } = resolveTokenChain({ id: input.id, symbol: input.symbol });
  const target = input.id || input.address || (input.symbol ? input.symbol.toLowerCase() : '');
  return `/dashboard/market/${chain}/${target}`;
}
