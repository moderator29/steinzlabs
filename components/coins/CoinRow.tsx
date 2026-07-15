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
        className="flex items-center gap-3 rounded-2xl px-3 py-2.5 nl-glass hover:bg-white/[0.05] transition-colors"
        style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.12)' }}
      >
        <CoinLogo logoUrl={coin.logoUrl} symbol={coin.symbol} chain={coin.chain} size={42} verified={coin.verified} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-semibold text-white truncate max-w-[9rem]">{coin.symbol || coin.name}</span>
          </div>
          <div className="text-[12px] text-white/45 truncate">{compactUsd(coin.marketCapUsd)} MC</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-semibold text-white tabular-nums">{coinPrice(coin.priceUsd)}</div>
          <PriceDelta value={coin.change24h} className="text-[12px] font-medium" />
        </div>
      </Link>
    </motion.div>
  );
}
