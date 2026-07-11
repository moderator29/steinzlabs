'use client';

import React from 'react';
import { CoinIcon, type CoinSymbol } from '@/components/landing/CoinIcon';

// Decorative 3D coin field for the landing hero. Each coin is a metallic disc
// carrying its real chain logo from /public/chains (BTC uses its styled glyph).
// Motion, breathing, and reduced-motion handling all live in CoinIcon, so this
// file only places and clamps the coins.
type Placement = {
  coin: CoinSymbol;
  size: number;
  opacity: number;
  dur: string;
  delay: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
};

const COINS: Placement[] = [
  { coin: 'BTC',   size: 54, top: '12%',    left: '6%',   opacity: 0.5,  dur: '6s',   delay: '0s'   },
  { coin: 'ETH',   size: 44, top: '68%',    right: '7%',  opacity: 0.48, dur: '7.5s', delay: '1.4s' },
  { coin: 'SOL',   size: 40, top: '44%',    left: '4%',   opacity: 0.46, dur: '5.5s', delay: '2.2s' },
  { coin: 'BNB',   size: 46, top: '26%',    right: '6%',  opacity: 0.5,  dur: '6.5s', delay: '1s'   },
  { coin: 'AVAX',  size: 46, top: '60%',    right: '13%', opacity: 0.48, dur: '5.8s', delay: '0.4s' },
  { coin: 'MATIC', size: 38, bottom: '16%', left: '14%',  opacity: 0.44, dur: '8s',   delay: '1.8s' },
  { coin: 'BASE',  size: 40, top: '18%',    right: '22%', opacity: 0.45, dur: '6.8s', delay: '2.6s' },
  { coin: 'ARB',   size: 42, top: '78%',    left: '22%',  opacity: 0.47, dur: '6.3s', delay: '0.6s' },
];

interface FloatingCoinsProps {
  section?: 'hero' | 'features' | 'cta';
}

export function FloatingCoins({ section = 'hero' }: FloatingCoinsProps) {
  const subset = section === 'features' ? COINS.slice(3, 6)
    : section === 'cta' ? COINS.slice(0, 3)
    : COINS;

  return (
    // Self-contained, clamped layer: spans the hero viewport, never adds layout
    // or horizontal overflow, and stays behind and untouchable to real content.
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 top-0 overflow-hidden"
      style={{ height: '100vh', zIndex: 0 }}
    >
      {subset.map((c, i) => (
        <div
          key={`${c.coin}-${i}`}
          className="hidden md:block absolute"
          style={{
            top: c.top,
            bottom: c.bottom,
            left: c.left,
            right: c.right,
          }}
        >
          <CoinIcon
            coin={c.coin}
            size={c.size}
            opacity={c.opacity}
            floatDuration={c.dur}
            floatDelay={c.delay}
            floatAmplitude={Math.round(c.size * 0.24)}
          />
        </div>
      ))}
    </div>
  );
}
