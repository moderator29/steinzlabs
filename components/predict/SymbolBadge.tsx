'use client';

import { symbolColor } from './utils';

// Lettered token glyph. We never claim a logo we don't have — a deterministic
// brand-tinted disc with the symbol's initials is honest and always renders.
export function SymbolBadge({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const color = symbolColor(symbol);
  const letters = symbol.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
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
