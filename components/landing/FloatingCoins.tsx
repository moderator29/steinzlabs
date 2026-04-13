'use client';

import { CoinIcon } from './CoinIcon';

interface FloatingCoinsProps {
  section: 'hero' | 'features' | 'cta';
}

// All coins are absolute-positioned inside a parent with position:relative overflow:hidden (or visible)
// Mobile: hidden via className

const CONFIGS = {
  hero: [
    { coin: 'BTC' as const, size: 48, top: '15%', right: '8%',  opacity: 0.35, dur: '6s',   delay: '0s',   spin: false },
    { coin: 'ETH' as const, size: 36, top: '40%', left: '5%',   opacity: 0.28, dur: '7.5s', delay: '1.2s', spin: false },
    { coin: 'SOL' as const, size: 28, top: '22%', right: '18%', opacity: 0.3,  dur: '5.5s', delay: '2.4s', spin: true  },
    { coin: 'AVAX'as const, size: 32, top: '62%', left: '9%',   opacity: 0.25, dur: '8s',   delay: '0.6s', spin: false },
  ],
  features: [
    { coin: 'BNB'  as const, size: 36, top: '20%', right: '3%', opacity: 0.22, dur: '6.5s', delay: '0.4s', spin: false },
    { coin: 'MATIC'as const, size: 28, top: '60%', left: '2%',  opacity: 0.2,  dur: '5s',   delay: '1.8s', spin: true  },
    { coin: 'ARB'  as const, size: 40, top: '40%', right: '2%', opacity: 0.2,  dur: '7s',   delay: '2s',   spin: false },
  ],
  cta: [
    { coin: 'BTC' as const, size: 44, bottom: '20%', left: '5%',  opacity: 0.3,  dur: '6s', delay: '0s',  spin: false },
    { coin: 'ETH' as const, size: 32, bottom: '15%', right: '8%', opacity: 0.25, dur: '7s', delay: '1s',  spin: false },
  ],
};

export function FloatingCoins({ section }: FloatingCoinsProps) {
  const coins = CONFIGS[section] || [];

  return (
    <>
      {coins.map((c, i) => {
        const posStyle: React.CSSProperties = {
          position: 'absolute',
          zIndex: 0,
          pointerEvents: 'none',
          ...(c.top    ? { top: c.top }       : {}),
          ...(c.bottom ? { bottom: (c as any).bottom } : {}),
          ...(c.left   ? { left: c.left }      : {}),
          ...(c.right  ? { right: c.right }    : {}),
        };

        return (
          <div key={i} className="hidden md:block" style={posStyle}>
            <CoinIcon
              coin={c.coin}
              size={c.size}
              opacity={c.opacity}
              floatDuration={c.dur}
              floatDelay={c.delay}
              floatAmplitude={c.size * 0.28}
              spinY={c.spin}
            />
          </div>
        );
      })}
    </>
  );
}
