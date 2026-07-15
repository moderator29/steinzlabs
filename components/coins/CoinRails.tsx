'use client';

/**
 * Hero + rails building blocks for the Coins home. FeaturedCoin is the big
 * store-front card for the top trending coin; CoinRail is a horizontal,
 * swipeable shelf of coin tiles under a labelled heading. Both are our own
 * edge-lit glass, real data only, and render nothing when empty.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CoinLogo, PriceDelta } from '@/components/coins/atoms';
import { coinPrice, compactUsd } from '@/lib/coins/format';
import type { Coin } from '@/lib/coins/types';

function coinHref(c: Coin): string {
  return `/dashboard/coins/${c.chain}/${encodeURIComponent(c.tokenAddress)}`;
}

/** The featured coin: a large hero card that leads the Coins home. */
export function FeaturedCoin({ coin }: { coin: Coin }) {
  const up = (coin.change24h ?? 0) >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Link
        href={coinHref(coin)}
        className="group relative block rounded-3xl p-4 sm:p-5 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_20px_50px_-18px_rgba(0,102,255,.6)]"
      >
        {/* corner glow that leans to the trade direction */}
        <span className={`pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl transition-colors ${up ? 'bg-[#0066FF]/25 group-hover:bg-[#0066FF]/40' : 'bg-rose-500/20 group-hover:bg-rose-500/30'}`} />
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-gradient-to-b from-[#1E90FF] to-[#0066FF] opacity-70" />

        <div className="relative flex items-center gap-3">
          <CoinLogo logoUrl={coin.logoUrl} symbol={coin.symbol} chain={coin.chain} size={56} verified={coin.verified} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[19px] font-extrabold text-white truncate">{coin.symbol || coin.name}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#0066FF]/15 text-[#7FB2FF] border border-[#0066FF]/30 shrink-0">Featured</span>
            </div>
            {coin.name && coin.name !== coin.symbol ? <div className="text-[13px] text-white/45 truncate">{coin.name}</div> : null}
          </div>
        </div>

        <div className="relative flex items-end justify-between mt-4">
          <div>
            <div className="text-[30px] leading-none font-extrabold tracking-tight tabular-nums text-white">{coinPrice(coin.priceUsd)}</div>
            <div className="mt-1.5"><PriceDelta value={coin.change24h} className="text-[14px] font-bold" /><span className="text-white/35 text-[12px] ml-1">24h</span></div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-white/40">Market cap</div>
            <div className="text-[17px] font-bold text-white tabular-nums">{compactUsd(coin.marketCapUsd)}</div>
            <div className="text-[11px] text-white/40 mt-0.5">Vol {compactUsd(coin.volume24hUsd)}</div>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[14px] font-bold text-white transition-transform group-hover:scale-[1.01]" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)', boxShadow: '0 8px 24px -8px rgba(0,102,255,.55)' }}>
          Trade {coin.symbol}
        </div>
      </Link>
    </motion.div>
  );
}

/** A labelled horizontal shelf of coin tiles. Renders nothing when empty. */
export function CoinRail({ title, Icon, coins, accent = '#7FB2FF', seeAllHref }: { title: string; Icon: LucideIcon; coins: Coin[]; accent?: string; seeAllHref?: string }) {
  if (!coins || coins.length === 0) return null;
  return (
    <section className="mb-1">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
        <h2 className="text-[15px] font-bold text-white">{title}</h2>
        {seeAllHref ? <Link href={seeAllHref} className="ms-auto text-[12px] font-semibold text-[#7FB2FF] hover:text-white">See all</Link> : null}
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 snap-x">
        {coins.map((c, i) => (
          <motion.div key={`${c.chain}:${c.tokenKey}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.24) }} className="snap-start">
            <CoinTile coin={c} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/** A single coin tile used inside a rail. */
export function CoinTile({ coin }: { coin: Coin }) {
  return (
    <Link
      href={coinHref(coin)}
      className="group relative block w-[168px] shrink-0 rounded-2xl p-3 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_-12px_rgba(0,102,255,.6)]"
    >
      <span className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#0066FF]/18 blur-2xl group-hover:bg-[#0066FF]/32 transition-colors" />
      <div className="relative flex items-center gap-2 mb-2.5">
        <CoinLogo logoUrl={coin.logoUrl} symbol={coin.symbol} chain={coin.chain} size={34} verified={coin.verified} />
        <span className="text-[14px] font-bold text-white truncate">{coin.symbol}</span>
      </div>
      <div className="relative flex items-center justify-between">
        <span className="text-[14px] font-semibold text-white tabular-nums">{coinPrice(coin.priceUsd)}</span>
        <PriceDelta value={coin.change24h} className="text-[12px] font-semibold" />
      </div>
      <div className="relative text-[11px] text-white/40 mt-1">{compactUsd(coin.marketCapUsd)} MC</div>
    </Link>
  );
}
