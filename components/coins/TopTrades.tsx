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
                className="block w-[172px] shrink-0 rounded-2xl p-3 nl-glass hover:bg-white/[0.05] transition-colors"
                style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.16)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {t.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{nm.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="text-[13px] font-semibold text-white truncate">{nm}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CoinLogo logoUrl={t.logoUrl} symbol={t.symbol || ''} chain={t.chain} size={22} />
                  <span className="text-[12px] text-white/60 truncate">{t.symbol}</span>
                </div>
                <div className="text-[18px] font-bold text-emerald-400 tabular-nums leading-tight">+{compactUsd(t.pnlUsd).replace('$', '$')}</div>
                {t.pnlPct != null ? <div className="text-[12px] font-semibold text-emerald-400/80">{signedPct(t.pnlPct)}</div> : null}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
