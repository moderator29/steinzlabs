'use client';

import Image from 'next/image';

// Using CoinGecko asset CDN (reliable, no-cors, stable SVGs/PNGs) instead of cryptologos.cc
// which hot-links with referer checks and frequently returns 403 in browsers.
const CRYPTO_LOGOS = [
  { name: 'Bitcoin',   src: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',          size: 52, top: '12%',   left: '7%',   opacity: 0.55, dur: '6s',   delay: '0s'   },
  { name: 'Ethereum',  src: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',       size: 44, top: '72%',   right: '8%',  opacity: 0.50, dur: '7.5s', delay: '1.4s' },
  { name: 'Solana',    src: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',        size: 40, top: '45%',   left: '4%',   opacity: 0.48, dur: '5.5s', delay: '2.2s' },
  { name: 'XRP',       src: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png', size: 42, bottom: '30%', left: '12%', opacity: 0.50, dur: '8s',   delay: '0.8s' },
  { name: 'BNB',       src: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',   size: 46, top: '30%',   right: '6%',  opacity: 0.52, dur: '6.5s', delay: '1.0s' },
  { name: 'Tron',      src: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',     size: 38, bottom: '15%', left: '18%', opacity: 0.45, dur: '7s',   delay: '1.8s' },
  { name: 'Avalanche', src: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png', size: 48, top: '60%', right: '12%', opacity: 0.52, dur: '5.8s', delay: '0.4s' },
  { name: 'USDC',      src: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',          size: 40, top: '20%',   right: '22%', opacity: 0.45, dur: '6.8s', delay: '2.6s' },
  { name: 'Toncoin',   src: 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',   size: 42, bottom: '40%', right: '4%', opacity: 0.48, dur: '7.2s', delay: '1.2s' },
  { name: 'Arbitrum',  src: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg', size: 44, top: '80%', left: '25%', opacity: 0.50, dur: '6.3s', delay: '0.6s' },
];

interface FloatingCoinsProps {
  section?: 'hero' | 'features' | 'cta';
}

export function FloatingCoins({ section }: FloatingCoinsProps) {
  const subset = section === 'features' ? CRYPTO_LOGOS.slice(3, 6)
    : section === 'cta' ? CRYPTO_LOGOS.slice(0, 2)
    : CRYPTO_LOGOS;

  return (
    <>
      {subset.map((coin, i) => {
        const posStyle: React.CSSProperties = {
          position: 'absolute',
          zIndex: 0,
          pointerEvents: 'none',
          animationName: 'coinFloat',
          animationDuration: coin.dur,
          animationDelay: coin.delay,
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          ...(coin.top ? { top: coin.top } : {}),
          ...((coin as { bottom?: string }).bottom ? { bottom: (coin as { bottom: string }).bottom } : {}),
          ...((coin as { left?: string }).left ? { left: (coin as { left: string }).left } : {}),
          ...((coin as { right?: string }).right ? { right: (coin as { right: string }).right } : {}),
        };

        return (
          <div key={i} className="hidden md:block" style={posStyle}>
            <img
              src={coin.src}
              alt={coin.name}
              width={coin.size}
              height={coin.size}
              style={{ opacity: coin.opacity, borderRadius: '50%' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        );
      })}
      <style>{`
        @keyframes coinFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </>
  );
}
