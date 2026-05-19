import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * GET /api/wallet/nfts?address=<addr>&chain=<chain>&limit=
 *
 * Real NFT enumeration for the wallet's NFT tab. EVM via Alchemy NFT
 * API v3; Solana via Helius DAS getAssetsByOwner. Output shape
 * normalized so the UI doesn't branch on chain.
 */

const Q = z.object({
  address: z.string().min(8).max(128),
  chain: z.string().min(2).max(32).default('ethereum'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

interface NftRow {
  contract_address: string | null;
  token_id: string;
  name: string | null;
  collection: string | null;
  image_url: string | null;
  chain: string;
  marketplace_url?: string | null;
}

const ALCHEMY_BASE: Record<string, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com',
  polygon:  'https://polygon-mainnet.g.alchemy.com',
  base:     'https://base-mainnet.g.alchemy.com',
  arbitrum: 'https://arb-mainnet.g.alchemy.com',
  optimism: 'https://opt-mainnet.g.alchemy.com',
};

export const revalidate = 120;

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse({
    address: req.nextUrl.searchParams.get('address'),
    chain: req.nextUrl.searchParams.get('chain') ?? 'ethereum',
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { address, chain, limit } = parsed.data;

  try {
    if (chain === 'solana') {
      const heliusKey = process.env.HELIUS_API_KEY ?? '';
      if (!heliusKey) return NextResponse.json({ chain, address, nfts: [] });
      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 'nfts', method: 'searchAssets',
          params: { ownerAddress: address, tokenType: 'nonFungible', page: 1, limit },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return NextResponse.json({ chain, address, nfts: [] });
      const json = await res.json() as { result?: { items?: Array<{ id: string; content?: { metadata?: { name?: string }; links?: { image?: string } }; grouping?: Array<{ group_key?: string; group_value?: string }> }> } };
      const items = json.result?.items ?? [];
      const nfts: NftRow[] = items.map((it) => {
        const coll = (it.grouping ?? []).find((g) => g.group_key === 'collection')?.group_value ?? null;
        return {
          contract_address: coll,
          token_id: it.id,
          name: it.content?.metadata?.name ?? null,
          collection: coll,
          image_url: it.content?.links?.image ?? null,
          chain: 'solana',
          marketplace_url: `https://magiceden.io/item-details/${it.id}`,
        };
      });
      return NextResponse.json({ chain, address, nfts });
    }

    const alchemyKey = process.env.ALCHEMY_API_KEY ?? '';
    const base = ALCHEMY_BASE[chain];
    if (!alchemyKey || !base) return NextResponse.json({ chain, address, nfts: [] });
    const url = `${base}/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${address}&pageSize=${limit}&withMetadata=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return NextResponse.json({ chain, address, nfts: [] });
    const json = await res.json() as { ownedNfts?: Array<{ contract?: { address?: string; name?: string }; tokenId?: string; name?: string; image?: { cachedUrl?: string; thumbnailUrl?: string; pngUrl?: string }; tokenUri?: string }> };
    const nfts: NftRow[] = (json.ownedNfts ?? []).map((n) => ({
      contract_address: n.contract?.address ?? null,
      token_id: n.tokenId ?? '',
      name: n.name ?? n.contract?.name ?? null,
      collection: n.contract?.name ?? null,
      image_url: n.image?.cachedUrl ?? n.image?.thumbnailUrl ?? n.image?.pngUrl ?? null,
      chain,
      marketplace_url: n.contract?.address && n.tokenId ? `https://opensea.io/assets/${chain}/${n.contract.address}/${n.tokenId}` : null,
    }));
    return NextResponse.json({ chain, address, nfts });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'NFT fetch failed' }, { status: 500 });
  }
}
