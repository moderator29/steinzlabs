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

// Per-coin brand colours for the metallic disc plus the real chain logo that
// already ships in /public/chains. BTC has no repo logo, so it falls back to
// its styled glyph on a gold disc. Logos are drawn on top of the 3D coin body.
const COIN_CONFIG: Record<CoinSymbol, {
  primary: string; secondary: string; glow: string; symbol: string; fontSize: number; logo?: string;
}> = {
  BTC:  { primary: '#f7931a', secondary: '#a85e05', glow: '#f7931a', symbol: '₿', fontSize: 0.46 },
  ETH:  { primary: '#6b8cff', secondary: '#324b9e', glow: '#627eea', symbol: 'ETH', fontSize: 0.26, logo: '/chains/ethereum.png' },
  SOL:  { primary: '#12f0a0', secondary: '#6a30c9', glow: '#14f195', symbol: 'SOL', fontSize: 0.24, logo: '/chains/solana.png' },
  AVAX: { primary: '#f0575a', secondary: '#9c2223', glow: '#e84142', symbol: 'AVAX', fontSize: 0.2, logo: '/chains/avalanche.png' },
  BNB:  { primary: '#f8cf50', secondary: '#b8880c', glow: '#f3ba2f', symbol: 'BNB', fontSize: 0.24, logo: '/chains/bsc.png' },
  MATIC:{ primary: '#9a6bf0', secondary: '#5124a0', glow: '#8247e5', symbol: 'POL', fontSize: 0.24, logo: '/chains/polygon.png' },
  BASE: { primary: '#3a8bff', secondary: '#0038cc', glow: '#4d9fff', symbol: 'BASE', fontSize: 0.2, logo: '/chains/base.png' },
  ARB:  { primary: '#5fb0f5', secondary: '#1f5fb0', glow: '#4d9fec', symbol: 'ARB', fontSize: 0.24, logo: '/chains/arbitrum.png' },
};

// Injected once on the client. Motion is a gentle vertical float paired with a
// subtle breathing scale, on top of a fixed 3D tilt so each coin reads as a
// leaning metallic disc. A slow Y spin is available via spinY.
const CSS = `
@keyframes nl-coin-breathe {
  0%,100% { transform: perspective(460px) rotateX(14deg) rotateY(-10deg) translateY(0) scale(1); }
  50% { transform: perspective(460px) rotateX(14deg) rotateY(-10deg) translateY(var(--coin-amp,-12px)) scale(1.045); }
}
@keyframes nl-coin-spin {
  0% { transform: perspective(460px) rotateX(10deg) rotateY(0deg); }
  100% { transform: perspective(460px) rotateX(10deg) rotateY(360deg); }
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

  // Inject keyframes once, client-side only.
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

  const rim = Math.max(1, size * 0.03);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        // Metallic body: bright top-left face falling to a darker rim, giving a
        // rounded, coin-like read even before the logo lands on top.
        background: `radial-gradient(circle at 36% 28%, #ffffffcc 0%, ${cfg.primary} 26%, ${cfg.secondary} 78%, ${cfg.secondary} 100%)`,
        border: `${rim}px solid ${cfg.primary}66`,
        boxShadow: `0 ${size * 0.09}px ${size * 0.34}px ${cfg.glow}45, inset 0 ${size * 0.05}px ${size * 0.08}px rgba(255,255,255,0.35), inset 0 -${size * 0.06}px ${size * 0.1}px rgba(0,0,0,0.35)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        opacity,
        flexShrink: 0,
        willChange: reduced ? undefined : 'transform',
        ...animStyle,
        ...style,
      }}
    >
      {/* Bevelled inner ring for depth. */}
      <div style={{
        position: 'absolute',
        inset: rim,
        borderRadius: '50%',
        boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.02)}px rgba(255,255,255,0.14)`,
        pointerEvents: 'none',
      }} />

      {/* Top-left specular highlight. */}
      <div style={{
        position: 'absolute',
        top: '9%',
        left: '13%',
        width: '46%',
        height: '30%',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, transparent 100%)',
        filter: 'blur(2px)',
        pointerEvents: 'none',
      }} />

      {cfg.logo ? (
        // Real chain logo, sized to sit inside the coin face.
        <img
          src={cfg.logo}
          alt=""
          aria-hidden
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          draggable={false}
          style={{
            width: '62%',
            height: '62%',
            objectFit: 'contain',
            position: 'relative',
            zIndex: 1,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))',
            userSelect: 'none',
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <span style={{
          color: '#ffffff',
          fontWeight: 800,
          fontSize: size * cfg.fontSize,
          lineHeight: 1,
          position: 'relative',
          zIndex: 1,
          userSelect: 'none',
          textShadow: '0 1px 4px rgba(0,0,0,0.45)',
        }}>
          {cfg.symbol}
        </span>
      )}
    </div>
  );
}
