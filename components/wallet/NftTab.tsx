'use client';

import { useEffect, useState } from 'react';
import { ImageOff, ExternalLink, Loader2 } from 'lucide-react';

/**
 * NftTab — wallet NFT gallery. Renders real NFTs from /api/wallet/nfts
 * (Alchemy NFT API v3 for EVM, Helius DAS for Solana).
 *
 * #57 — aggregates across ALL major chains in one view (not just the active
 * one), so an imported wallet's NFTs show up wherever they live — Ethereum,
 * Polygon, Base, Arbitrum, Optimism, and Solana.
 */

interface NftRow {
  contract_address: string | null;
  token_id: string;
  name: string | null;
  collection: string | null;
  image_url: string | null;
  chain: string;
  marketplace_url?: string | null;
}

interface Props {
  /** EVM address (0x…) — queried across all EVM chains below. */
  evmAddress: string;
  /** Solana base58 address — queried on Solana when present. */
  solanaAddress?: string | null;
}

const EVM_NFT_CHAINS = ['ethereum', 'polygon', 'base', 'arbitrum', 'optimism'];

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'Ethereum', polygon: 'Polygon', base: 'Base',
  arbitrum: 'Arbitrum', optimism: 'Optimism', solana: 'Solana',
};

export function NftTab({ evmAddress, solanaAddress }: Props) {
  const [nfts, setNfts] = useState<NftRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!evmAddress && !solanaAddress) { setNfts([]); return; }
    let cancelled = false;
    setNfts(null);
    setError(null);
    (async () => {
      // One request per chain; merge whatever resolves. A single chain
      // failing never blanks the gallery.
      const jobs: Promise<NftRow[]>[] = [];
      if (evmAddress) {
        for (const c of EVM_NFT_CHAINS) {
          jobs.push(
            fetch(`/api/wallet/nfts?address=${encodeURIComponent(evmAddress)}&chain=${c}&limit=50`)
              .then((r) => (r.ok ? r.json() : { nfts: [] }))
              .then((j) => (j.nfts ?? []) as NftRow[])
              .catch(() => []),
          );
        }
      }
      if (solanaAddress) {
        jobs.push(
          fetch(`/api/wallet/nfts?address=${encodeURIComponent(solanaAddress)}&chain=solana&limit=50`)
            .then((r) => (r.ok ? r.json() : { nfts: [] }))
            .then((j) => (j.nfts ?? []) as NftRow[])
            .catch(() => []),
        );
      }
      try {
        const results = await Promise.all(jobs);
        if (cancelled) return;
        const merged = results.flat();
        // De-dupe by chain+contract+tokenId.
        const seen = new Set<string>();
        const deduped = merged.filter((n) => {
          const k = `${n.chain}:${n.contract_address}:${n.token_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setNfts(deduped);
      } catch {
        if (!cancelled) setError('Could not load NFTs — try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [evmAddress, solanaAddress]);

  if (error) return <div className="text-sm text-red-400 p-4">{error}</div>;
  if (nfts === null) return (
    <div className="flex items-center gap-2 text-sm text-slate-400 p-4" aria-busy="true">
      <Loader2 className="w-4 h-4 animate-spin" />Loading NFTs…
    </div>
  );
  if (nfts.length === 0) return (
    <div className="text-sm text-slate-400 italic p-6 text-center rounded-xl nl-glass">
      No NFTs found in this wallet.
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
      {nfts.map((n) => (
        <a
          key={`${n.chain}-${n.contract_address}-${n.token_id}`}
          href={n.marketplace_url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-xl overflow-hidden bg-white/[0.04] border border-white/10 hover:border-[var(--nl-blue,#0066FF)]/40 transition-colors"
          aria-label={`Open ${n.name ?? 'NFT'} on marketplace`}
        >
          <div className="aspect-square bg-[var(--nl-canvas-base,#0A0E1A)] flex items-center justify-center overflow-hidden">
            {n.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.image_url} alt={n.name ?? 'NFT'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            ) : (
              <ImageOff className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <div className="p-2.5">
            <div className="text-[12px] font-semibold text-white truncate">{n.name ?? `#${n.token_id}`}</div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-[10px] text-slate-400 truncate">{n.collection ?? CHAIN_LABEL[n.chain] ?? n.chain}</span>
              {n.marketplace_url ? <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white flex-shrink-0" /> : null}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
