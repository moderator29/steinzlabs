/**
 * NFT positions aggregator — normalizes the per-provider response
 * shape (Alchemy / Helius) into a single PortfolioNft[] the UI
 * renders. Caller is responsible for fetching the raw data; this
 * lib is pure transform + valuation logic.
 *
 * Audit §B.1 portfolio NFT tab.
 */

export type NftChain = 'ethereum' | 'base' | 'polygon' | 'arbitrum' | 'optimism' | 'solana';

export interface AlchemyNft {
  contract: { address: string; name?: string | null; openSeaMetadata?: { floorPrice?: number | null } | null };
  tokenId: string;
  name?: string | null;
  image?: { thumbnailUrl?: string | null; cachedUrl?: string | null } | null;
  acquiredAt?: { blockTimestamp?: string | null } | null;
}

export interface HeliusNft {
  id: string;
  content?: {
    metadata?: { name?: string | null } | null;
    files?: Array<{ uri?: string | null; cdn_uri?: string | null }> | null;
  } | null;
  grouping?: Array<{ group_key?: string; group_value?: string }> | null;
  /** Native SOL price floor from Tensor / Magic Eden when provided. */
  floorSol?: number | null;
}

export interface PortfolioNft {
  chain: NftChain;
  collection: string;
  collectionAddress: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  floorValueUsd: number;
  acquiredAt: number | null;
}

/**
 * Normalize Alchemy NFT response into PortfolioNft rows. floorPrice
 * is reported in ETH; caller supplies the ETH/USD rate so we can
 * present USD without a network call inside the lib.
 */
export function fromAlchemy(chain: NftChain, nfts: AlchemyNft[], ethUsd: number): PortfolioNft[] {
  return nfts.map((n) => {
    const floorEth = n.contract.openSeaMetadata?.floorPrice ?? 0;
    return {
      chain,
      collection: n.contract.name ?? 'Unknown',
      collectionAddress: n.contract.address,
      tokenId: n.tokenId,
      name: n.name ?? null,
      imageUrl: n.image?.cachedUrl ?? n.image?.thumbnailUrl ?? null,
      floorValueUsd: Math.max(0, floorEth) * Math.max(0, ethUsd),
      acquiredAt: n.acquiredAt?.blockTimestamp ? Math.floor(new Date(n.acquiredAt.blockTimestamp).getTime() / 1000) : null,
    };
  });
}

/**
 * Normalize Helius (Solana) NFT response. floorSol → USD via caller-
 * supplied solUsd.
 */
export function fromHelius(nfts: HeliusNft[], solUsd: number): PortfolioNft[] {
  return nfts.map((n) => {
    const collectionAddress = n.grouping?.find((g) => g.group_key === 'collection')?.group_value ?? '';
    return {
      chain: 'solana' as const,
      collection: n.content?.metadata?.name ?? 'Unknown',
      collectionAddress,
      tokenId: n.id,
      name: n.content?.metadata?.name ?? null,
      imageUrl: n.content?.files?.[0]?.cdn_uri ?? n.content?.files?.[0]?.uri ?? null,
      floorValueUsd: Math.max(0, n.floorSol ?? 0) * Math.max(0, solUsd),
      acquiredAt: null,
    };
  });
}

/**
 * Roll up a heterogeneous NFT list into per-collection rows so the
 * portfolio's NFT tab renders one row per project rather than one
 * row per individual NFT (which on a real wallet would be hundreds).
 */
export interface CollectionRollup {
  chain: NftChain;
  collection: string;
  collectionAddress: string;
  count: number;
  floorValueUsd: number;
  thumbnailUrl: string | null;
}

export function rollupByCollection(nfts: PortfolioNft[]): CollectionRollup[] {
  const map = new Map<string, CollectionRollup>();
  for (const n of nfts) {
    const key = `${n.chain}:${n.collectionAddress || n.collection}`;
    const prior = map.get(key);
    if (prior) {
      prior.count += 1;
      prior.floorValueUsd += n.floorValueUsd;
      if (!prior.thumbnailUrl && n.imageUrl) prior.thumbnailUrl = n.imageUrl;
    } else {
      map.set(key, {
        chain: n.chain,
        collection: n.collection,
        collectionAddress: n.collectionAddress,
        count: 1,
        floorValueUsd: n.floorValueUsd,
        thumbnailUrl: n.imageUrl,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.floorValueUsd - a.floorValueUsd);
}
