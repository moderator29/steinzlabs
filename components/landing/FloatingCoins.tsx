'use client';

import Image from 'next/image';

const CRYPTO_LOGOS = [
  { name: 'Bitcoin',   src: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=041',    size: 40, top: '12%',  left: '7%',   opacity: 0.18, dur: '6s',   delay: '0s'   },
  { name: 'Ethereum',  src: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=041',   size: 32, top: '72%',  right: '8%',  opacity: 0.15, dur: '7.5s', delay: '1.4s' },
  { name: 'Solana',    src: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=041',     size: 28, top: '45%',  left: '4%',   opacity: 0.12, dur: '5.5s', delay: '2.2s' },
  { name: 'XRP',       src: 'https://cryptologos.cc/logos/xrp-xrp-logo.png?v=041',       size: 30, bottom: '30%', left: '12%', opacity: 0.14, dur: '8s',   delay: '0.8s' },
  { name: 'BNB',       src: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=041',       size: 34, top: '30%',  right: '6%',  opacity: 0.13, dur: '6.5s', delay: '1.0s' },
  { name: 'Tron',      src: 'https://cryptologos.cc/logos/tron-trx-logo.png?v=041',      size: 26, bottom: '15%', left: '18%', opacity: 0.11, dur: '7s',   delay: '1.8s' },
  { name: 'Avalanche', src: 'https://cryptologos.cc/logos/avalanche-avax-logo.png?v=041', size: 36, top: '60%',  right: '12%', opacity: 0.15, dur: '5.8s', delay: '0.4s' },
  { name: 'USDC',      src: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=041', size: 28, top: '20%',  right: '22%', opacity: 0.10, dur: '6.8s', delay: '2.6s' },
  { name: 'Toncoin',   src: 'https://cryptologos.cc/logos/toncoin-ton-logo.png?v=041',   size: 30, bottom: '40%', right: '4%', opacity: 0.12, dur: '7.2s', delay: '1.2s' },
  { name: 'Arbitrum',  src: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=041',  size: 32, top: '80%',  left: '25%',  opacity: 0.13, dur: '6.3s', delay: '0.6s' },
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
