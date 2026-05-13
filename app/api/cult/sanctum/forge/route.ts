import { NextRequest, NextResponse } from 'next/server';
import { Alchemy, Network } from 'alchemy-sdk';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Chains the Forge auto-discovers. EVM only in v1 — Solana / TON / etc are
// follow-ups (Helius for Solana, TonAPI for TON). Each network used here is
// covered by the existing Alchemy SDK + ALCHEMY_API_KEY plumbing.
const CHAIN_NETWORKS: Array<{ name: string; net: Network }> = [
  { name: 'ethereum', net: Network.ETH_MAINNET },
  { name: 'base', net: Network.BASE_MAINNET },
  { name: 'polygon', net: Network.MATIC_MAINNET },
  { name: 'arbitrum', net: Network.ARB_MAINNET },
  { name: 'optimism', net: Network.OPT_MAINNET },
];

interface UserWalletEntry {
  address?: string;
  chain?: string;
}

interface ForgePiece {
  chain: string;
  contract: string;
  tokenId: string;
  name: string;
  collection: string;
  image: string | null;
  description: string | null;
}

function evmAddress(addr: string | null | undefined): string | null {
  if (!addr || typeof addr !== 'string') return null;
  return /^0x[a-fA-F0-9]{40}$/.test(addr) ? addr.toLowerCase() : null;
}

/**
 * GET /api/cult/sanctum/forge — the cult member's NFT gallery.
 *
 * Pulls the caller's owned EVM wallets out of user_wallets_v2, fans the
 * Alchemy NFT API across the supported chains, dedupes by (chain, contract,
 * tokenId), and returns up to 60 pieces. Real-API rule: when ALCHEMY_API_KEY
 * is unset, the route returns an empty list rather than fabricating sample
 * NFTs. Cold cache is fine — the chamber renders an "empty forge" state.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!process.env.ALCHEMY_API_KEY) {
    return NextResponse.json({
      pieces: [],
      addresses: [],
      offline: true,
      offlineReason: 'alchemy_not_configured',
    });
  }

  const admin = getSupabaseAdmin();
  const { data: walletRow } = await admin
    .from('user_wallets_v2')
    .select('wallets,default_address')
    .eq('user_id', access.userId)
    .maybeSingle<{ wallets: unknown; default_address: string | null }>();

  const addresses = new Set<string>();
  const def = evmAddress(walletRow?.default_address);
  if (def) addresses.add(def);
  if (Array.isArray(walletRow?.wallets)) {
    for (const w of walletRow.wallets as UserWalletEntry[]) {
      const a = evmAddress(w?.address ?? null);
      if (a) addresses.add(a);
    }
  }

  if (addresses.size === 0) {
    return NextResponse.json({ pieces: [], addresses: [] });
  }

  const addrList = Array.from(addresses);
  const pieces: ForgePiece[] = [];
  const seen = new Set<string>();

  // Fan out per (chain, address). Each Alchemy call is independent; if one
  // flakes the others still populate. Cap per call at 40 NFTs since we just
  // need a representative gallery, not a full inventory.
  await Promise.all(
    CHAIN_NETWORKS.flatMap(({ name, net }) =>
      addrList.map(async (addr) => {
        try {
          const client = new Alchemy({ apiKey: process.env.ALCHEMY_API_KEY, network: net });
          const owned = await client.nft.getNftsForOwner(addr, {
            pageSize: 40,
            omitMetadata: false,
          });
          for (const nft of owned.ownedNfts ?? []) {
            const contract = nft.contract?.address?.toLowerCase() ?? '';
            const tokenId = nft.tokenId ?? '';
            if (!contract || !tokenId) continue;
            const key = `${name}:${contract}:${tokenId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            pieces.push({
              chain: name,
              contract,
              tokenId,
              name: (nft.name ?? nft.contract?.name ?? `Token #${tokenId}`).slice(0, 120),
              collection: (nft.contract?.name ?? nft.contract?.openSeaMetadata?.collectionName ?? '').slice(
                0,
                120,
              ),
              image: nft.image?.cachedUrl ?? nft.image?.originalUrl ?? null,
              description: (nft.description ?? '').slice(0, 280) || null,
            });
          }
        } catch {
          // One chain / address failure does not poison the rest.
        }
      }),
    ),
  );

  pieces.sort((a, b) => a.chain.localeCompare(b.chain) || a.collection.localeCompare(b.collection));
  return NextResponse.json({
    pieces: pieces.slice(0, 60),
    addresses: addrList,
  });
}
