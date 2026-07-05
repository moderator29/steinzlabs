'use client';

import { useState } from 'react';
import { tokenLogoCandidates } from '@/lib/wallet/tokenLogoCandidates';

interface TokenLogoProps {
  src?: string;
  symbol: string;
  /** Real CA + chain enable a Trust Wallet asset-registry backstop before the
   *  lettered monogram, so a valid token still shows real art when the indexer
   *  image is missing or 404s. */
  address?: string;
  chain?: string;
  size?: number;
  className?: string;
}

export function TokenLogo({ src, symbol, address, chain, size = 36, className = '' }: TokenLogoProps) {
  const [idx, setIdx] = useState(0);
  const letter = (symbol ?? '?')[0].toUpperCase();

  const colors = [
    '#0066FF', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#10b981',
  ];
  const colorIndex = letter.charCodeAt(0) % colors.length;
  const bg = colors[colorIndex];

  const candidates = tokenLogoCandidates({ primary: src, address, chain });
  const current = candidates[idx];

  if (!current) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
        style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
      >
        {letter}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full flex-shrink-0 object-cover ${className}`}
      onError={() => setIdx((i) => i + 1)}
      loading="lazy"
    />
  );
}
