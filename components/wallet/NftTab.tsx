'use client';

import { useEffect, useState } from 'react';
import { ImageOff, ExternalLink, Loader2 } from 'lucide-react';

/**
 * NftTab — wallet NFT gallery. Renders real NFTs from /api/wallet/nfts
 * (Alchemy NFT API v3 for EVM, Helius DAS for Solana). Closes the
 * critical wallet feature gap identified by audit Agent 4 (NFT support
 * was completely absent vs Trust Wallet / Phantom / Rabby).
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
  address: string;
  chain: string;
}

export function NftTab({ address, chain }: Props) {
  const [nfts, setNfts] = useState<NftRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wallet/nfts?address=${encodeURIComponent(address)}&chain=${chain}&limit=50`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json.error ?? 'Failed'); return; }
        setNfts(json.nfts ?? []);
      } catch {
        if (!cancelled) setError('Network error');
      }
    })();
    return () => { cancelled = true; };
  }, [address, chain]);

  if (error) return <div className="text-sm text-red-400 p-4">{error}</div>;
  if (nfts === null) return (
    <div className="flex items-center gap-2 text-sm text-slate-400 p-4" aria-busy="true">
      <Loader2 className="w-4 h-4 animate-spin" />Loading NFTs…
    </div>
  );
  if (nfts.length === 0) return (
    <div className="text-sm text-slate-400 italic p-6 text-center rounded-xl nl-glass">
      No NFTs found in this wallet on {chain}.
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
      {nfts.map((n) => (
        <a
          key={`${n.contract_address}-${n.token_id}`}
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
              <span className="text-[10px] text-slate-400 truncate">{n.collection ?? '—'}</span>
              {n.marketplace_url ? <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white flex-shrink-0" /> : null}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
