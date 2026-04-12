'use client';

import { useState } from 'react';

interface TokenLogoProps {
  src?: string;
  symbol: string;
  size?: number;
  className?: string;
}

export function TokenLogo({ src, symbol, size = 36, className = '' }: TokenLogoProps) {
  const [failed, setFailed] = useState(false);
  const letter = (symbol ?? '?')[0].toUpperCase();

  const colors = [
    '#0A1EFF', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#10b981',
  ];
  const colorIndex = letter.charCodeAt(0) % colors.length;
  const bg = colors[colorIndex];

  if (!src || failed) {
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
      src={src}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full flex-shrink-0 object-cover ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
