'use client';

/**
 * Hero + rails building blocks for the Coins home. FeaturedCoin is the big
 * store-front card for the top trending coin; CoinRail is a horizontal,
 * swipeable shelf of coin tiles under a labelled heading. Both are our own
 * edge-lit glass, real data only, and render nothing when empty.
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CoinLogo, PriceDelta } from '@/components/coins/atoms';
import { CoinRow } from '@/components/coins/CoinRow';
import { useLivePrice } from '@/components/coins/useLivePrice';
import { coinPrice, compactUsd } from '@/lib/coins/format';
import type { Coin } from '@/lib/coins/types';

function coinHref(c: Coin): string {
  return `/dashboard/coins/${c.chain}/${encodeURIComponent(c.tokenAddress)}`;
}

/**
 * The featured coin: a large hero card that leads the active house. The price
 * ticks live (with a green/rose flash on each real move), the badge + accent
 * take the house colour, and the "hot" house gets a slow flame shimmer.
 */
export function FeaturedCoin({ coin, accent = '#0066FF', label = 'Featured', hot = false }: { coin: Coin; accent?: string; label?: string; hot?: boolean }) {
  const live = useLivePrice(coin.chain, coin.tokenAddress, { priceUsd: coin.priceUsd, marketCapUsd: coin.marketCapUsd, change24h: coin.change24h });
  const price = live.price ?? coin.priceUsd;
  const change = live.change24h ?? coin.change24h;
  const mcap = live.marketCap ?? coin.marketCapUsd;
  const up = (change ?? 0) >= 0;
  const flashColor = live.flash === 'up' ? '#10B981' : live.flash === 'down' ? '#F43F5E' : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Link
        href={coinHref(coin)}
        className="group relative block rounded-3xl p-4 sm:p-5 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_20px_50px_-18px_rgba(0,102,255,.6)]"
        style={flashColor ? { boxShadow: `0 0 0 1px ${flashColor}, 0 0 34px -6px ${flashColor}aa`, transition: 'box-shadow .25s ease' } : { transition: 'box-shadow .5s ease' }}
      >
        {/* hot house: a slow flame shimmer sweeping the card */}
        {hot ? <span className="pointer-events-none absolute inset-0 opacity-60 coin-flame" style={{ background: `linear-gradient(115deg, transparent 35%, ${accent}26 50%, transparent 65%)`, backgroundSize: '220% 100%' }} /> : null}
        {/* corner glow in the house accent */}
        <span className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl transition-colors" style={{ background: `${accent}33` }} />
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full" style={{ background: `linear-gradient(to bottom, ${accent}, ${accent}88)`, opacity: 0.8 }} />

        <div className="relative flex items-center gap-3">
          <CoinLogo logoUrl={coin.logoUrl} symbol={coin.symbol} chain={coin.chain} size={56} verified={coin.verified} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[19px] font-extrabold text-white truncate">{coin.symbol || coin.name}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${accent}26`, color: '#eaf2ff', border: `1px solid ${accent}55` }}>{label}</span>
            </div>
            {coin.name && coin.name !== coin.symbol ? <div className="text-[13px] text-white/45 truncate">{coin.name}</div> : null}
          </div>
        </div>

        <div className="relative flex items-end justify-between mt-4">
          <div>
            <div className="text-[30px] leading-none font-extrabold tracking-tight tabular-nums text-white transition-colors" style={flashColor ? { color: flashColor } : undefined}>{coinPrice(price)}</div>
            <div className="mt-1.5"><PriceDelta value={change} className="text-[14px] font-bold" /><span className="text-white/35 text-[12px] ml-1">24h</span></div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-white/40">Market cap</div>
            <div className="text-[17px] font-bold text-white tabular-nums">{compactUsd(mcap)}</div>
            <div className="text-[11px] text-white/40 mt-0.5">Vol {compactUsd(coin.volume24hUsd)}</div>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[14px] font-bold text-white transition-transform group-hover:scale-[1.01]" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 8px 24px -8px ${accent}8c` }}>
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

/**
 * A labelled VERTICAL list of coin rows. Replaces the horizontal shelf so the
 * feed reads top-to-bottom, one clean row per coin. Shows an initial window and
 * expands on tap so a long trending list stays tidy. Renders nothing when empty.
 */
export function CoinList({ title, Icon, coins, accent = '#7FB2FF', initial = 8, seeAllHref }: { title: string; Icon: LucideIcon; coins: Coin[]; accent?: string; initial?: number; seeAllHref?: string }) {
  if (!coins || coins.length === 0) return null;
  return <CoinListInner title={title} Icon={Icon} coins={coins} accent={accent} initial={initial} seeAllHref={seeAllHref} />;
}

function CoinListInner({ title, Icon, coins, accent, initial, seeAllHref }: { title: string; Icon: LucideIcon; coins: Coin[]; accent: string; initial: number; seeAllHref?: string }) {
  return (
    <section className="mb-1">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
        <h2 className="text-[15px] font-bold text-white">{title}</h2>
        <span className="text-[12px] text-white/35 font-semibold">{coins.length}</span>
        {seeAllHref ? <Link href={seeAllHref} className="ms-auto text-[12px] font-semibold text-[#7FB2FF] hover:text-white">See all</Link> : null}
      </div>
      <CoinListRows coins={coins} initial={initial} />
    </section>
  );
}

/** The expandable vertical stack of rows. */
function CoinListRows({ coins, initial }: { coins: Coin[]; initial: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? coins : coins.slice(0, initial);
  const remaining = coins.length - shown.length;
  return (
    <div className="space-y-2">
      {shown.map((c, i) => (
        <CoinRow key={`${c.chain}:${c.tokenKey}`} coin={c} index={i} />
      ))}
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-2xl py-2.5 text-[13px] font-semibold text-[#7FB2FF] nl-glass hover:text-white transition-colors"
        >
          Show {remaining} more
        </button>
      ) : null}
    </div>
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
