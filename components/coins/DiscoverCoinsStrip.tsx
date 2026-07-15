'use client';

/**
 * A compact "Trending coins" strip for the Find/Discover page. Ties the coins
 * world into people-discovery, in our own edge-lit glass style. Real data from
 * the coins discovery API; renders nothing until there are coins to show.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { CoinLogo, PriceDelta } from '@/components/coins/atoms';
import { coinPrice, compactUsd } from '@/lib/coins/format';
import type { Coin } from '@/lib/coins/types';

export function DiscoverCoinsStrip() {
  const [coins, setCoins] = useState<Coin[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/coins?tab=trending', { cache: 'no-store' });
        const j = await r.json();
        setCoins(Array.isArray(j.coins) ? j.coins.slice(0, 6) : []);
      } catch { setCoins([]); }
    })();
  }, []);

  if (coins !== null && coins.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <Flame className="w-4 h-4 text-[#7FB2FF]" />
        <h2 className="text-[15px] font-bold text-white">Trending coins</h2>
        <Link href="/dashboard/coins" className="ms-auto text-[12px] font-semibold text-[#7FB2FF] hover:text-white">See all</Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {coins === null
          ? [0, 1, 2, 3].map((i) => <div key={i} className="w-[160px] h-[92px] shrink-0 rounded-2xl bg-white/[0.03] animate-pulse" />)
          : coins.map((c, i) => (
              <motion.div key={`${c.chain}:${c.tokenKey}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}>
                <Link
                  href={`/dashboard/coins/${c.chain}/${encodeURIComponent(c.tokenAddress)}`}
                  className="group relative block w-[160px] shrink-0 rounded-2xl p-3 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_-12px_rgba(0,102,255,.6)]"
                >
                  <span className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#0066FF]/20 blur-2xl group-hover:bg-[#0066FF]/35 transition-colors" />
                  <div className="relative flex items-center gap-2 mb-2">
                    <CoinLogo logoUrl={c.logoUrl} symbol={c.symbol} chain={c.chain} size={30} verified={c.verified} />
                    <span className="text-[14px] font-bold text-white truncate">{c.symbol}</span>
                  </div>
                  <div className="relative flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-white tabular-nums">{coinPrice(c.priceUsd)}</span>
                    <PriceDelta value={c.change24h} className="text-[12px] font-semibold" />
                  </div>
                  <div className="relative text-[11px] text-white/40 mt-0.5">{compactUsd(c.marketCapUsd)} MC</div>
                </Link>
              </motion.div>
            ))}
      </div>
    </div>
  );
}
