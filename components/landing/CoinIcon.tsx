'use client';

import React from 'react';

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

const COIN_CONFIG: Record<CoinSymbol, {
  primary: string; secondary: string; glow: string; symbol: string; fontSize: number;
}> = {
  BTC:  { primary: '#f7931a', secondary: '#c96a00', glow: '#f7931a', symbol: '₿',  fontSize: 0.45 },
  ETH:  { primary: '#627eea', secondary: '#3a5acd', glow: '#627eea', symbol: 'Ξ',  fontSize: 0.4  },
  SOL:  { primary: '#9945ff', secondary: '#7b2fd4', glow: '#14f195', symbol: '◎',  fontSize: 0.38 },
  AVAX: { primary: '#e84142', secondary: '#b52f30', glow: '#e84142', symbol: 'A',  fontSize: 0.42 },
  BNB:  { primary: '#f3ba2f', secondary: '#c9940a', glow: '#f3ba2f', symbol: 'B',  fontSize: 0.42 },
  MATIC:{ primary: '#8247e5', secondary: '#5c2fb0', glow: '#8247e5', symbol: 'M',  fontSize: 0.38 },
  BASE: { primary: '#0052ff', secondary: '#0038cc', glow: '#4d9fff', symbol: 'B',  fontSize: 0.42 },
  ARB:  { primary: '#4d9fec', secondary: '#2a7acc', glow: '#4d9fec', symbol: 'A',  fontSize: 0.42 },
};

const CSS = `
@keyframes coin-float {
  0%,100%{transform:perspective(400px) rotateX(20deg) rotateY(-15deg) translateY(0)}
  50%{transform:perspective(400px) rotateX(20deg) rotateY(-15deg) translateY(var(--coin-amp,−12px))}
}
@keyframes coin-spin {
  0%{transform:perspective(400px) rotateX(10deg) rotateY(0deg)}
  100%{transform:perspective(400px) rotateX(10deg) rotateY(360deg)}
}
`;

let cssInjected = false;

export function CoinIcon({
  coin, size, opacity = 1, floatDuration = '6s', floatDelay = '0s',
  floatAmplitude = 14, spinY = false, style, className,
}: CoinIconProps) {
  const cfg = COIN_CONFIG[coin];
  const amp = -floatAmplitude;

  // Inject CSS once (client-side only)
  if (typeof document !== 'undefined' && !cssInjected) {
    const tag = document.createElement('style');
    tag.textContent = CSS;
    document.head.appendChild(tag);
    cssInjected = true;
  }

  const animStyle: React.CSSProperties = spinY
    ? { animation: `coin-spin ${floatDuration} linear infinite`, animationDelay: floatDelay }
    : {
        '--coin-amp': `${amp}px`,
        animation: `coin-float ${floatDuration} ease-in-out infinite`,
        animationDelay: floatDelay,
      } as React.CSSProperties;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, ${cfg.primary}, ${cfg.secondary})`,
        border: `${Math.max(1, size * 0.025)}px solid ${cfg.primary}55`,
        boxShadow: `0 ${size * 0.08}px ${size * 0.3}px ${cfg.glow}40, inset 0 ${size * 0.02}px 0 rgba(255,255,255,0.18)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        opacity,
        flexShrink: 0,
        ...animStyle,
        ...style,
      }}
    >
      {/* Top-left light catch */}
      <div style={{
        position: 'absolute',
        top: '8%',
        left: '12%',
        width: '45%',
        height: '28%',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(255,255,255,0.28) 0%, transparent 100%)',
        filter: 'blur(3px)',
        pointerEvents: 'none',
      }} />
      <span style={{
        color: '#ffffff',
        fontWeight: 800,
        fontSize: size * cfg.fontSize,
        lineHeight: 1,
        position: 'relative',
        zIndex: 1,
        userSelect: 'none',
        textShadow: `0 1px 4px rgba(0,0,0,0.4)`,
      }}>
        {cfg.symbol}
      </span>
    </div>
  );
}
