'use client';

import { useState } from 'react';
import { getChainMeta, normalizeChainId } from '@/lib/chains/chainMeta';

interface ChainLogoProps {
  /** canonical chain id (ethereum, solana, base, …) */
  chain: string;
  size?: number;
  className?: string;
}

/**
 * ChainLogo — renders the real chain logo (DefiLlama CDN). If the asset
 * fails to load or the chain is unknown, it degrades to a brand-colored
 * dot so the UI never shows a broken image.
 */
export function ChainLogo({ chain, size = 18, className = '' }: ChainLogoProps) {
  const [errored, setErrored] = useState(false);
  const meta = getChainMeta(normalizeChainId(chain));

  if (!meta || errored) {
    return (
      <span
        className={`inline-block rounded-full shrink-0 ${className}`}
        style={{ width: size, height: size, backgroundColor: meta?.color ?? '#6B7280' }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={meta.logo}
      alt={meta.label}
      width={size}
      height={size}
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setErrored(true)}
    />
  );
}
