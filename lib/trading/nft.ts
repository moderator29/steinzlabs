import 'server-only';

/**
 * §3 P2-D.6 — NFT helpers. Lists a wallet's NFTs via Alchemy NFT API
 * and builds ERC721/ERC1155 transferFrom calldata for the send flow.
 */

const ALCHEMY_NFT_BASE_BY_CHAIN: Record<string, string | undefined> = {
  ethereum: process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}` : undefined,
  base:     process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}` : undefined,
  arbitrum: process.env.ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}` : undefined,
  polygon:  process.env.ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}` : undefined,
  optimism: process.env.ALCHEMY_API_KEY ? `https://opt-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}` : undefined,
};

export interface OwnedNft {
  contract_address: string;
  token_id: string;
  token_type: 'ERC721' | 'ERC1155' | string;
  name?: string;
  image?: string;
  collection_name?: string;
  balance?: string;
}

export async function getOwnedNfts(chain: string, owner: string): Promise<OwnedNft[]> {
  const base = ALCHEMY_NFT_BASE_BY_CHAIN[chain.toLowerCase()];
  if (!base) return [];
  try {
    const res = await fetch(`${base}/getNFTsForOwner?owner=${owner}&pageSize=100`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { ownedNfts?: Array<Record<string, unknown>> };
    return (json.ownedNfts ?? []).map((n) => ({
      contract_address: String((n.contract as { address?: string })?.address ?? ''),
      token_id: String(n.tokenId ?? ''),
      token_type: String(n.tokenType ?? 'ERC721') as OwnedNft['token_type'],
      name: (n.name as string | undefined) ?? undefined,
      image: ((n.image as { cachedUrl?: string; originalUrl?: string })?.cachedUrl
            ?? (n.image as { cachedUrl?: string; originalUrl?: string })?.originalUrl) as string | undefined,
      collection_name: ((n.contract as { name?: string })?.name) as string | undefined,
      balance: (n.balance as string | undefined) ?? undefined,
    }));
  } catch {
    return [];
  }
}

// ─── transferFrom calldata builders ──────────────────────────────────────

// keccak("transferFrom(address,address,uint256)")[0..4]
const ERC721_TRANSFER_FROM = '0x23b872dd';
// keccak("safeTransferFrom(address,address,uint256,uint256,bytes)")[0..4]
const ERC1155_SAFE_TRANSFER_FROM = '0xf242432a';

function padAddress(addr: string): string {
  return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}
function padUint(v: string | number | bigint): string {
  return BigInt(v).toString(16).padStart(64, '0');
}

export interface NftTransferTx {
  to: string;     // NFT contract
  data: string;
  value: string;  // 0x0
}

export function buildErc721TransferFrom(contract: string, from: string, to: string, tokenId: string): NftTransferTx {
  const data = ERC721_TRANSFER_FROM + padAddress(from) + padAddress(to) + padUint(tokenId);
  return { to: contract, data, value: '0x0' };
}

export function buildErc1155SafeTransferFrom(
  contract: string, from: string, to: string, tokenId: string, amount: string,
): NftTransferTx {
  // safeTransferFrom(from, to, id, amount, data="")
  // data bytes need offset (0xa0 = 160) + length 0
  const offsetForBytes = padUint(160);
  const bytesLen = padUint(0);
  const data = ERC1155_SAFE_TRANSFER_FROM
    + padAddress(from)
    + padAddress(to)
    + padUint(tokenId)
    + padUint(amount)
    + offsetForBytes
    + bytesLen;
  return { to: contract, data, value: '0x0' };
}
