'use client';

import { useEffect, useState } from 'react';
import { symbolColor } from './utils';
import { nativeCoinLogo } from '@/lib/wallet/tokenLogoCandidates';

// Token glyph. Renders the real coin logo for known tickers (BTC/ETH/SOL/BNB and
// other majors) from the Trust Wallet registry, falling back to a deterministic
// brand-tinted disc with the symbol's initials the moment the logo 404s or the
// ticker is unknown. We never claim a logo we do not have.
export function SymbolBadge({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const color = symbolColor(symbol);
  const letters = symbol.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const logo = nativeCoinLogo(symbol);
  const [broken, setBroken] = useState(false);

  // Reset the error state when the symbol changes so a switcher re-tries the new
  // coin's real logo instead of staying on the previous fallback.
  useEffect(() => { setBroken(false); }, [symbol]);

  if (logo && !broken) {
    return (
      <img
        src={logo}
        alt={symbol}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className="rounded-full object-cover shrink-0 shadow-lg"
        style={{ width: size, height: size, boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset' }}
      />
    );
  }

  return (
    <div
      className="relative rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-lg"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(size * 0.34, 10),
        background: `radial-gradient(120% 120% at 30% 25%, ${color}ee 0%, ${color}99 55%, ${color}55 100%)`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.08) inset, 0 6px 18px ${color}44`,
      }}
      aria-hidden
    >
      {letters || '?'}
    </div>
  );
}
