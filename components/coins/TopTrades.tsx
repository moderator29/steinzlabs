'use client';

/**
 * Our weekly Top Trades: the best-performing positions across Naka this week,
 * from real platform trades. Horizontal glass cards in our own style. Renders
 * nothing until there are real winners, so it is never an empty shell.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { CoinLogo } from './atoms';
import { compactUsd, signedPct } from '@/lib/coins/format';

interface Profile { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
interface TopTrade { user: Profile; chain: string; tokenAddress: string; tokenKey: string; symbol: string | null; logoUrl: string | null; pnlUsd: number; pnlPct: number | null }

export function TopTrades() {
  const [trades, setTrades] = useState<TopTrade[] | null>(null);
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/coins/top-trades', { cache: 'no-store' }); const j = await r.json(); setTrades(Array.isArray(j.trades) ? j.trades : []); }
      catch { setTrades([]); }
    })();
  }, []);

  if (trades === null || trades.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <Trophy className="w-4 h-4 text-amber-300" />
        <h2 className="text-[14px] font-bold text-white">Top Trades this week</h2>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-1">
        {trades.map((t, i) => {
          const nm = t.user.display_name || t.user.username || 'Trader';
          return (
            <motion.div key={`${t.user.id}:${t.tokenKey}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}>
              <Link
                href={`/dashboard/coins/${t.chain}/${encodeURIComponent(t.tokenAddress)}`}
                className="group relative block w-[176px] shrink-0 rounded-2xl p-3.5 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_14px_36px_-12px_rgba(0,102,255,.6)]"
              >
                <span className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#0066FF]/25 blur-2xl group-hover:bg-[#0066FF]/40 transition-colors" />
                <span className="absolute top-2.5 right-3 text-[11px] font-bold text-white/30">#{i + 1}</span>
                <div className="flex items-center gap-2 mb-2 relative">
                  {t.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ring-1 ring-white/10" style={{ background: 'linear-gradient(135deg,#0066FF,#7C3AED)' }}>{nm.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="text-[13px] font-semibold text-white truncate">{nm}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CoinLogo logoUrl={t.logoUrl} symbol={t.symbol || ''} chain={t.chain} size={22} />
                  <span className="text-[12px] text-white/60 truncate">{t.symbol}</span>
                </div>
                <div className="text-[18px] font-bold text-emerald-400 tabular-nums leading-tight">+{compactUsd(t.pnlUsd)}</div>
                {t.pnlPct != null ? <div className="text-[12px] font-semibold text-emerald-400/80">{signedPct(t.pnlPct)}</div> : null}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
