'use client';

/**
 * "Your circle is buying": a horizontal row of coin cards for tokens that
 * people the caller follows bought in the last 24h, each tagged with how many
 * of them bought it. Real logos, live registry price and 24h change. Renders
 * nothing when the circle bought nothing, so it is never an empty shell.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users2 } from 'lucide-react';
import { CoinLogo, PriceDelta } from './atoms';
import { coinPrice, compactUsd } from '@/lib/coins/format';

interface CircleCoin {
  chain: string;
  tokenAddress: string | null;
  tokenKey: string;
  symbol: string | null;
  logoUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24h: number | null;
  buyerCount: number;
}

export function CircleBuying() {
  const [coins, setCoins] = useState<CircleCoin[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/coins/circle', { cache: 'no-store' });
        const j = await r.json();
        setCoins(Array.isArray(j.coins) ? j.coins : []);
      } catch { setCoins([]); }
    })();
  }, []);

  if (coins === null || coins.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <Users2 className="w-4 h-4 text-[#3B9EFF]" />
        <h2 className="text-[14px] font-bold text-white">Your circle is buying</h2>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-1">
        {coins.map((c, i) => {
          const label = c.buyerCount === 1 ? '1 friend' : `${c.buyerCount} friends`;
          const cls = 'group relative block w-[164px] shrink-0 rounded-2xl p-3.5 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-10px_rgba(0,102,255,.55)]';
          const inner = (
            <>
              <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-[#1E90FF] to-[#0066FF] opacity-70 group-hover:opacity-100" />
              <div className="flex items-center gap-2 mb-2 pl-1">
                <CoinLogo logoUrl={c.logoUrl} symbol={c.symbol || ''} chain={c.chain} size={34} />
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-white truncate max-w-[5.5rem]">{c.symbol || '—'}</div>
                  <div className="text-[11px] text-white/45 truncate">{compactUsd(c.marketCapUsd)} MC</div>
                </div>
              </div>
              <div className="flex items-center justify-between pl-1">
                <div className="text-[14px] font-bold text-white tabular-nums">{coinPrice(c.priceUsd)}</div>
                <PriceDelta value={c.change24h} className="text-[11px] font-semibold" />
              </div>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#0066FF]/15 border border-[#0066FF]/40 px-2 py-0.5 text-[11px] font-semibold text-[#8fb4ff] ml-1">
                <Users2 className="w-3 h-3" /> {label}
              </div>
            </>
          );
          return (
            <motion.div key={`${c.chain}:${c.tokenKey}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}>
              {c.tokenAddress ? (
                <Link href={`/dashboard/coins/${c.chain}/${encodeURIComponent(c.tokenAddress)}`} className={cls}>{inner}</Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
