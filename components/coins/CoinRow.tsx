'use client';

/**
 * A single coin row in the discovery list. Real logo, our verified tick, market
 * cap, live price and 24h change. Tap opens the coin detail page.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Coin } from '@/lib/coins/types';
import { CoinLogo, PriceDelta } from './atoms';
import { coinPrice, compactUsd } from '@/lib/coins/format';

export function CoinRow({ coin, index = 0 }: { coin: Coin; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.025, 0.25), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/dashboard/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}`}
        className="group relative flex items-center gap-3 rounded-2xl pl-4 pr-3.5 py-3 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-10px_rgba(0,102,255,.55)]"
      >
        {/* blue accent stride */}
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-[#1E90FF] to-[#0066FF] opacity-70 group-hover:opacity-100" />
        <CoinLogo logoUrl={coin.logoUrl} symbol={coin.symbol} chain={coin.chain} size={44} verified={coin.verified} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-white truncate max-w-[10rem] tracking-tight">{coin.symbol || coin.name}</div>
          <div className="text-[12px] text-white/45 truncate">{compactUsd(coin.marketCapUsd)} MC</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-bold text-white tabular-nums">{coinPrice(coin.priceUsd)}</div>
          <PriceDelta value={coin.change24h} className="text-[12px] font-semibold" />
        </div>
      </Link>
    </motion.div>
  );
}
