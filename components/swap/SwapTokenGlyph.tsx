'use client';

/**
 * SwapTokenGlyph — round token logo with a graceful initials fallback, shared
 * by the swap surfaces (SwapBatchCard, the swap page). Logos come from the
 * CoinGecko CDN for the common set; anything unknown renders its first two
 * letters on a Naka-panel chip so the layout never collapses.
 */

import { useState } from 'react';

const LOGO: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  OP: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  BONK: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
  WIF: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg',
  JUP: 'https://assets.coingecko.com/coins/images/34188/small/jup.png',
  RAY: 'https://assets.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  NAKA: 'https://assets.coingecko.com/coins/images/18041/small/naka.png',
};

interface Props {
  symbol: string;
  /** Optional explicit logo URL (overrides the built-in map). */
  logo?: string;
  size?: number;
}

export default function SwapTokenGlyph({ symbol, logo, size = 32 }: Props) {
  const [errored, setErrored] = useState(false);
  const src = logo || LOGO[symbol.toUpperCase()];

  if (!src || errored) {
    return (
      <div
        className="rounded-full bg-[#141824] border border-[#1E2433] flex items-center justify-center font-bold text-white shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.34 }}
        aria-hidden="true"
      >
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      onError={() => setErrored(true)}
      className="rounded-full bg-[#141824] shrink-0 object-cover"
      style={{ width: size, height: size, minWidth: size }}
    />
  );
}
