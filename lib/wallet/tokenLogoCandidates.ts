// Client-safe ordered token-logo candidate builder. Given a contract address +
// chain (and optionally an indexer-provided logo), returns real logo URLs to
// try in order via an <img onError> cascade before falling back to a lettered
// avatar. Every URL is a real registry/CDN path that either 200s or 404s — we
// never fabricate token art. Mirrors the server-side trustWalletAssetLogoUrl()
// registry path but runs in the browser (no 'server-only').

import { getAddress } from 'ethers';

// Canonical chain id → trustwallet/assets blockchain directory.
const ASSET_CHAIN_DIRS: Record<string, string> = {
  ethereum: 'ethereum',
  eth: 'ethereum',
  bsc: 'smartchain',
  bnb: 'smartchain',
  binance: 'smartchain',
  smartchain: 'smartchain',
  polygon: 'polygon',
  matic: 'polygon',
  arbitrum: 'arbitrum',
  base: 'base',
  optimism: 'optimism',
  avalanche: 'avalanchec',
  avalanchec: 'avalanchec',
  avax: 'avalanchec',
  solana: 'solana',
  sol: 'solana',
  fantom: 'fantom',
  cronos: 'cronos',
  tron: 'tron',
};

/** Trust Wallet assets-registry logo URL (public, keyless). EVM needs EIP-55. */
export function trustWalletCdnLogo(chain: string, address: string): string | null {
  const dir = ASSET_CHAIN_DIRS[chain.toLowerCase()];
  if (!dir || !address) return null;
  let pathAddress = address;
  if (address.startsWith('0x')) {
    try {
      pathAddress = getAddress(address.toLowerCase());
    } catch {
      return null; // not a valid EVM address — no registry path exists
    }
  }
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${dir}/assets/${pathAddress}/logo.png`;
}

/**
 * Ordered, de-duplicated candidate logo URLs. Pass whatever the indexer already
 * gave you (DexScreener/GeckoTerminal imageUrl) as `primary` — it goes first,
 * then the Trust Wallet registry as a real backstop. Caller renders a lettered
 * avatar only after all candidates 404.
 */
export function tokenLogoCandidates(opts: {
  primary?: string | null;
  address?: string | null;
  chain?: string | null;
}): string[] {
  const out: string[] = [];
  if (opts.primary) out.push(opts.primary);
  if (opts.address && opts.chain) {
    const tw = trustWalletCdnLogo(opts.chain, opts.address);
    if (tw) out.push(tw);
  }
  return Array.from(new Set(out));
}
