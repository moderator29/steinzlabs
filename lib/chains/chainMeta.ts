// Shared chain metadata — real logos (DefiLlama chain icon CDN) + brand
// colors, used by the swap chain selector and the whale directory chain
// filter so both render the same real chain marks instead of bare dots.
// The <ChainLogo> component degrades to the color dot if a logo fails to
// load, so a missing/blocked asset never breaks the UI.

export interface ChainMeta {
  /** canonical chain id used across the app + APIs */
  id: string;
  /** full display name, e.g. "Ethereum" */
  label: string;
  /** short ticker-style label, e.g. "ETH" */
  short: string;
  /** brand color for the fallback dot / accents */
  color: string;
  /** real logo URL (DefiLlama chain icons) */
  logo: string;
}

const ll = (slug: string) => `https://icons.llamao.fi/icons/chains/rsz_${slug}.jpg`;

export const CHAIN_META: Record<string, ChainMeta> = {
  ethereum: { id: 'ethereum', label: 'Ethereum', short: 'ETH', color: '#627EEA', logo: ll('ethereum') },
  solana: { id: 'solana', label: 'Solana', short: 'SOL', color: '#9945FF', logo: ll('solana') },
  base: { id: 'base', label: 'Base', short: 'Base', color: '#0052FF', logo: ll('base') },
  arbitrum: { id: 'arbitrum', label: 'Arbitrum', short: 'ARB', color: '#28A0F0', logo: ll('arbitrum') },
  optimism: { id: 'optimism', label: 'Optimism', short: 'OP', color: '#FF0420', logo: ll('optimism') },
  bsc: { id: 'bsc', label: 'BNB Chain', short: 'BSC', color: '#F0B90B', logo: ll('binance') },
  polygon: { id: 'polygon', label: 'Polygon', short: 'POLY', color: '#8247E5', logo: ll('polygon') },
  avalanche: { id: 'avalanche', label: 'Avalanche', short: 'AVAX', color: '#E84142', logo: ll('avalanche') },
};

export function getChainMeta(id: string): ChainMeta | null {
  return CHAIN_META[id] ?? null;
}
