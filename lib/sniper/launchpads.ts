/**
 * Launchpad / source registry for the sniper feed (#62).
 *
 * The old feed only knew DEX ids (uniswap_v3, aerodrome) — so there was no way
 * to show or filter by the launchpads users actually care about (Pump.fun,
 * LetsBonk, Believe, Moonshot, …). This maps a provider's dex/source string +
 * chain + token address to a canonical launchpad, a human label, a real icon,
 * and a chart/launchpad deep-link.
 *
 * Icons resolve from DexScreener's public dex-icon CDN
 * (https://dd.dexscreener.com/ds-data/dexes/<slug>.png) — real brand logos the
 * browser loads at runtime; the UI falls back to a monogram badge on 404 so a
 * missing icon never reads as broken.
 */

export interface Launchpad {
  /** canonical id stored in sniper_feed_tokens.launchpad and used by filters */
  id: string;
  /** display label on the source chip / card badge */
  label: string;
  /** DexScreener dex-icon slug (real logo CDN); null → monogram fallback only */
  iconSlug: string | null;
  /** chains this launchpad operates on */
  chains: string[];
}

/** Ordered for the "Exchanges/Sources" filter row (most-used first). */
export const LAUNCHPADS: Launchpad[] = [
  { id: 'pumpfun',   label: 'Pump.fun',   iconSlug: 'pumpfun',   chains: ['solana'] },
  { id: 'letsbonk',  label: "Let's Bonk", iconSlug: 'launchlab',  chains: ['solana'] },
  { id: 'believe',   label: 'Believe',    iconSlug: 'believe',    chains: ['solana'] },
  { id: 'bags',      label: 'Bags',       iconSlug: 'bags',       chains: ['solana'] },
  { id: 'moonshot',  label: 'Moonshot',   iconSlug: 'moonshot',   chains: ['solana'] },
  { id: 'heaven',    label: 'Heaven',     iconSlug: 'heaven',     chains: ['solana'] },
  { id: 'jupstudio', label: 'Jup Studio', iconSlug: 'jupiter',    chains: ['solana'] },
  { id: 'raydium',   label: 'Raydium',    iconSlug: 'raydium',    chains: ['solana'] },
  { id: 'pumpswap',  label: 'Pump.swap',  iconSlug: 'pumpswap',   chains: ['solana'] },
  { id: 'meteora',   label: 'Meteora',    iconSlug: 'meteora',    chains: ['solana'] },
  { id: 'orca',      label: 'Orca',       iconSlug: 'orca',       chains: ['solana'] },
  { id: 'dbc',       label: 'DBC',        iconSlug: 'meteora',    chains: ['solana'] },
  { id: 'uniswap',   label: 'Uniswap',    iconSlug: 'uniswap',    chains: ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon'] },
  { id: 'aerodrome', label: 'Aerodrome',  iconSlug: 'aerodrome',  chains: ['base'] },
  { id: 'pancakeswap', label: 'PancakeSwap', iconSlug: 'pancakeswap', chains: ['bsc'] },
  { id: 'traderjoe', label: 'LFJ',        iconSlug: 'traderjoe',  chains: ['avalanche'] },
  { id: 'fourmeme',  label: 'Four.meme',  iconSlug: null,         chains: ['bsc'] },
  { id: 'bankr',     label: 'Bankr',      iconSlug: null,         chains: ['base'] },
  { id: 'dex',       label: 'DEX',        iconSlug: null,         chains: ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche', 'solana'] },
];

const BY_ID = new Map(LAUNCHPADS.map((l) => [l.id, l]));

export function getLaunchpad(id: string | null | undefined): Launchpad | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function launchpadIconUrl(id: string | null | undefined): string | null {
  const lp = getLaunchpad(id);
  if (!lp?.iconSlug) return null;
  return `https://dd.dexscreener.com/ds-data/dexes/${lp.iconSlug}.png`;
}

export function launchpadLabel(id: string | null | undefined): string {
  return getLaunchpad(id)?.label ?? 'DEX';
}

/**
 * Detect the canonical launchpad from a provider's dex/source string (+ chain +
 * token address). Solana launchpad coins carry strong signals: pump.fun mints
 * end in "pump", LetsBonk mints end in "bonk", and the dex name names the venue.
 */
export function detectLaunchpad(params: {
  dex?: string | null;
  chain: string;
  tokenAddress?: string | null;
}): string {
  const dex = (params.dex ?? '').toLowerCase().replace(/[\s_-]/g, '');
  const addr = (params.tokenAddress ?? '').toLowerCase();

  // Address-suffix signals (Solana vanity mints from the launchpad's curve).
  if (params.chain === 'solana') {
    if (addr.endsWith('pump')) return 'pumpfun';
    if (addr.endsWith('bonk')) return 'letsbonk';
    if (addr.endsWith('moon')) return 'moonshot';
  }

  // Dex/source-name signals.
  if (dex.includes('pumpswap')) return 'pumpswap';
  if (dex.includes('pump')) return 'pumpfun';
  if (dex.includes('bonk') || dex.includes('launchlab')) return 'letsbonk';
  if (dex.includes('believe')) return 'believe';
  if (dex.includes('bags')) return 'bags';
  if (dex.includes('moonshot') || dex.includes('moonit')) return 'moonshot';
  if (dex.includes('heaven')) return 'heaven';
  if (dex.includes('jup') || dex.includes('studio')) return 'jupstudio';
  if (dex.includes('meteora') || dex.includes('dbc')) return 'meteora';
  if (dex.includes('raydium')) return 'raydium';
  if (dex.includes('orca')) return 'orca';
  if (dex.includes('aerodrome')) return 'aerodrome';
  if (dex.includes('pancake')) return 'pancakeswap';
  // Trader Joe rebranded to "LFJ" (dex names "LFJ" / "LFJ V2.2") — the old
  // 'joe'/'traderjoe' match never caught the new name, so these fell to 'dex'.
  if (dex.includes('traderjoe') || dex.includes('joe') || dex.includes('lfj')) return 'traderjoe';
  if (dex.includes('four.meme') || dex.includes('fourmeme')) return 'fourmeme';
  if (dex.includes('bankr')) return 'bankr';
  if (dex.includes('uniswap') || dex.includes('uni')) return 'uniswap';

  return 'dex';
}

/** Deep-link to the token's chart / launchpad page for the card link. */
export function tokenExternalUrl(chain: string, tokenAddress: string, launchpad?: string | null): string {
  if (launchpad === 'pumpfun' && chain === 'solana') return `https://pump.fun/coin/${tokenAddress}`;
  const gtNet = chain === 'solana' ? 'solana' : chain === 'ethereum' ? 'eth' : chain === 'avalanche' ? 'avax' : chain === 'polygon' ? 'polygon_pos' : chain;
  return `https://www.geckoterminal.com/${gtNet}/tokens/${tokenAddress}`;
}
