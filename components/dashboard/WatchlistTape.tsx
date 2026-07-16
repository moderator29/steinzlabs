'use client';

/**
 * The user's pinned watchlist as a compact live mini-tape on the dashboard home.
 * Fetches the caller's watchlisted coins, polls every ~20s, and renders a
 * horizontal glass tape (logo, $SYMBOL, price, 24h delta) that links into each
 * coin room. Renders nothing when the watchlist is empty, per real-data-only.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { CoinLogo, PriceDelta } from '@/components/coins/atoms';
import { coinPrice } from '@/lib/coins/format';

interface WatchlistCoin {
  chain: string;
  tokenAddress: string;
  tokenKey: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24h: number | null;
}

const POLL_MS = 20_000;

export function WatchlistTape() {
  const [coins, setCoins] = useState<WatchlistCoin[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/coins/watchlist/coins', {
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { coins?: WatchlistCoin[] };
        if (!cancelled) setCoins(Array.isArray(json.coins) ? json.coins : []);
      } catch {
        if (!cancelled) setCoins((prev) => prev ?? []);
      }
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Render nothing until there is something real to show. No empty titled shell.
  if (coins !== null && coins.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <Star className="w-4 h-4 text-[#7FB2FF]" />
        <h2 className="text-[15px] font-bold text-white">Watchlist</h2>
        <Link
          href="/dashboard/coins?tab=watchlist"
          className="ms-auto text-[12px] font-semibold text-[#7FB2FF] hover:text-white transition-colors"
        >
          See all
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {coins === null
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="w-[150px] h-[76px] shrink-0 rounded-2xl bg-white/[0.03] animate-pulse" />
            ))
          : coins.map((c, i) => (
              <motion.div
                key={`${c.chain}:${c.tokenKey}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
              >
                <Link
                  href={`/dashboard/coins/${c.chain}/${encodeURIComponent(c.tokenAddress)}`}
                  className="group relative block w-[150px] shrink-0 rounded-2xl p-3 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_-12px_rgba(0,102,255,.6)]"
                >
                  <span className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#0066FF]/20 blur-2xl group-hover:bg-[#0066FF]/35 transition-colors" />
                  <div className="relative flex items-center gap-2 mb-2">
                    <CoinLogo logoUrl={c.logoUrl} symbol={c.symbol} chain={c.chain} size={28} />
                    <span className="text-[13px] font-bold text-white truncate">${c.symbol}</span>
                  </div>
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-white tabular-nums truncate">{coinPrice(c.priceUsd)}</span>
                    <PriceDelta value={c.change24h} className="text-[12px] font-semibold shrink-0" />
                  </div>
                </Link>
              </motion.div>
            ))}
      </div>
    </div>
  );
}
