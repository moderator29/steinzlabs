'use client';

import React from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type CoinSymbol = 'BTC' | 'ETH' | 'SOL' | 'AVAX' | 'BNB' | 'MATIC' | 'BASE' | 'ARB';

interface CoinIconProps {
  coin: CoinSymbol;
  size: number;
  opacity?: number;
  floatDuration?: string;
  floatDelay?: string;
  floatAmplitude?: number;
  spinY?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

// FLAT coins (owner preference — the earlier non-3D mark reads cleaner than the
// metallic 3D disc). Each coin is its real, flat chain logo from /public/chains
// with a soft brand-coloured glow. BTC has no repo logo, so it falls back to a
// clean ₿ glyph on a flat gold disc. No perspective tilt, no metallic bevel.
const COIN_CONFIG: Record<CoinSymbol, { glow: string; bg: string; symbol: string; fontSize: number; logo?: string }> = {
  BTC:  { glow: '#f7931a', bg: '#f7931a', symbol: '₿',   fontSize: 0.5 },
  ETH:  { glow: '#627eea', bg: 'transparent', symbol: 'ETH',  fontSize: 0.26, logo: '/chains/ethereum.png' },
  SOL:  { glow: '#14f195', bg: 'transparent', symbol: 'SOL',  fontSize: 0.24, logo: '/chains/solana.png' },
  AVAX: { glow: '#e84142', bg: 'transparent', symbol: 'AVAX', fontSize: 0.2,  logo: '/chains/avalanche.png' },
  BNB:  { glow: '#f3ba2f', bg: 'transparent', symbol: 'BNB',  fontSize: 0.24, logo: '/chains/bsc.png' },
  MATIC:{ glow: '#8247e5', bg: 'transparent', symbol: 'POL',  fontSize: 0.24, logo: '/chains/polygon.png' },
  BASE: { glow: '#4d9fff', bg: 'transparent', symbol: 'BASE', fontSize: 0.2,  logo: '/chains/base.png' },
  ARB:  { glow: '#4d9fec', bg: 'transparent', symbol: 'ARB',  fontSize: 0.24, logo: '/chains/arbitrum.png' },
};

// Gentle vertical float + subtle breathing scale — flat, no 3D rotation.
const CSS = `
@keyframes nl-coin-breathe {
  0%,100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(var(--coin-amp,-12px)) scale(1.05); }
}
@keyframes nl-coin-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

let cssInjected = false;

export function CoinIcon({
  coin, size, opacity = 1, floatDuration = '6s', floatDelay = '0s',
  floatAmplitude = 14, spinY = false, style, className,
}: CoinIconProps) {
  const cfg = COIN_CONFIG[coin];
  const reduced = useReducedMotion();
  const amp = -floatAmplitude;

  if (typeof document !== 'undefined' && !cssInjected) {
    const tag = document.createElement('style');
    tag.textContent = CSS;
    document.head.appendChild(tag);
    cssInjected = true;
  }

  const animStyle: React.CSSProperties = reduced
    ? {}
    : spinY
      ? { animation: `nl-coin-spin ${floatDuration} linear infinite`, animationDelay: floatDelay }
      : ({
          '--coin-amp': `${amp}px`,
          animation: `nl-coin-breathe ${floatDuration} ease-in-out infinite`,
          animationDelay: floatDelay,
        } as React.CSSProperties);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        opacity,
        flexShrink: 0,
        // Soft brand glow behind the flat logo so it still pops on the hero.
        filter: `drop-shadow(0 ${size * 0.06}px ${size * 0.22}px ${cfg.glow}55)`,
        willChange: reduced ? undefined : 'transform',
        ...animStyle,
        ...style,
      }}
    >
      {cfg.logo ? (
        // The real, flat chain logo (already a circular coin mark).
        <img
          src={cfg.logo}
          alt=""
          aria-hidden
          width={size}
          height={size}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        // BTC — flat gold disc + glyph (no logo asset in the repo).
        <div
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: cfg.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ color: '#fff', fontWeight: 800, fontSize: size * cfg.fontSize, lineHeight: 1, userSelect: 'none' }}>
            {cfg.symbol}
          </span>
        </div>
      )}
    </div>
  );
}
