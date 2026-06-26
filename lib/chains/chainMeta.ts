// Shared chain metadata — real logos (self-hosted from the TrustWallet
// assets repo under /public/chains) + brand colors, used everywhere the
// platform shows a chain so they all render the same real chain marks
// instead of bare dots. Vendored locally (no third-party CDN at runtime)
// so they always resolve; <ChainLogo> still degrades to the color dot if
// an asset is ever missing.

export interface ChainMeta {
  /** canonical chain id used across the app + APIs */
  id: string;
  /** full display name, e.g. "Ethereum" */
  label: string;
  /** short ticker-style label, e.g. "ETH" */
  short: string;
  /** brand color for the fallback dot / accents */
  color: string;
  /** local logo path (TrustWallet asset, vendored into /public/chains) */
  logo: string;
}

const tw = (id: string) => `/chains/${id}.png`;

export const CHAIN_META: Record<string, ChainMeta> = {
  ethereum: { id: 'ethereum', label: 'Ethereum', short: 'ETH', color: '#627EEA', logo: tw('ethereum') },
  solana: { id: 'solana', label: 'Solana', short: 'SOL', color: '#9945FF', logo: tw('solana') },
  base: { id: 'base', label: 'Base', short: 'Base', color: '#0052FF', logo: tw('base') },
  arbitrum: { id: 'arbitrum', label: 'Arbitrum', short: 'ARB', color: '#28A0F0', logo: tw('arbitrum') },
  optimism: { id: 'optimism', label: 'Optimism', short: 'OP', color: '#FF0420', logo: tw('optimism') },
  bsc: { id: 'bsc', label: 'BNB Chain', short: 'BSC', color: '#F0B90B', logo: tw('bsc') },
  polygon: { id: 'polygon', label: 'Polygon', short: 'POLY', color: '#8247E5', logo: tw('polygon') },
  avalanche: { id: 'avalanche', label: 'Avalanche', short: 'AVAX', color: '#E84142', logo: tw('avalanche') },
};

/** Normalize common chain aliases to our canonical ids. */
export function normalizeChainId(raw: string | null | undefined): string {
  const c = (raw ?? '').toLowerCase().trim();
  switch (c) {
    case 'eth':
    case 'mainnet':
    case 'ethereum': return 'ethereum';
    case 'sol':
    case 'solana': return 'solana';
    case 'base': return 'base';
    case 'arb':
    case 'arbitrum':
    case 'arbitrum-one': return 'arbitrum';
    case 'op':
    case 'optimism': return 'optimism';
    case 'bsc':
    case 'bnb':
    case 'binance':
    case 'smartchain':
    case 'bnb-chain': return 'bsc';
    case 'poly':
    case 'matic':
    case 'polygon': return 'polygon';
    case 'avax':
    case 'avalanche':
    case 'avalanchec': return 'avalanche';
    default: return c;
  }
}

export function getChainMeta(id: string): ChainMeta | null {
  return CHAIN_META[id] ?? null;
}
