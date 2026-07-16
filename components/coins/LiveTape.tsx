'use client';

/**
 * The living floor: a vertically scrolling live feed of recent platform trades
 * in our glass style. A small All / Following segmented toggle (Following only
 * when signed in) filters the feed. Polls every 8s. Renders nothing until there
 * is at least one real trade, so it is never an empty titled shell.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { CoinLogo } from './atoms';
import { useAuth } from '@/lib/hooks/useAuth';
import { compactUsd, shortAgo } from '@/lib/coins/format';

interface Profile { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
interface TapeTrade {
  user: Profile;
  side: 'buy' | 'sell';
  usdAmount: number;
  marketCapUsd: number | null;
  symbol: string | null;
  logoUrl: string | null;
  chain: string;
  tokenAddress: string | null;
  timestamp: number;
}

type Scope = 'all' | 'following';

export function LiveTape() {
  const { user } = useAuth();
  const signedIn = !!user;
  const [scope, setScope] = useState<Scope>('all');
  const [trades, setTrades] = useState<TapeTrade[]>([]);
  const [loaded, setLoaded] = useState(false);

  const effectiveScope: Scope = scope === 'following' && signedIn ? 'following' : 'all';

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/coins/tape?scope=${effectiveScope}`, { cache: 'no-store' });
      const j = await r.json();
      setTrades(Array.isArray(j.trades) ? j.trades : []);
    } catch { /* keep the last good feed on a transient error */ }
    finally { setLoaded(true); }
  }, [effectiveScope]);

  useEffect(() => {
    setLoaded(false);
    void load();
    const id = setInterval(() => { void load(); }, 8000);
    return () => clearInterval(id);
  }, [load]);

  // If the caller can't see the feed yet (first load) or there is nothing real,
  // render nothing. Never show an empty titled shell.
  if (!loaded && trades.length === 0) return null;
  if (loaded && trades.length === 0 && effectiveScope === 'all') return null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-[#3B9EFF]" />
          <h2 className="text-[14px] font-bold text-white">Live floor</h2>
        </div>
        {signedIn ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/10 p-0.5">
            {(['all', 'following'] as Scope[]).map((s) => {
              const active = scope === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-all duration-200 ${
                    active ? 'bg-[#0066FF]/18 border border-[#0066FF]/60 text-white shadow-[0_0_18px_-4px_rgba(0,102,255,.8)]' : 'text-white/55 hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'All' : 'Following'}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {trades.length === 0 && effectiveScope === 'following' ? (
        <div className="nl-glass rounded-2xl p-5 text-center text-white/50 text-[13px]">
          No trades from people you follow yet.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto no-scrollbar space-y-2 pr-0.5">
          <AnimatePresence initial={false}>
            {trades.map((t) => (
              <TapeRow key={`${t.user.id}:${t.chain}:${t.tokenAddress}:${t.timestamp}`} trade={t} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TapeRow({ trade: t }: { trade: TapeTrade }) {
  const nm = t.user.display_name || t.user.username || 'Trader';
  const buy = t.side === 'buy';
  const inner = (
    <>
      {/* blue accent stride */}
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-[#1E90FF] to-[#0066FF] opacity-70 group-hover:opacity-100" />
      {t.user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10 shrink-0" />
      ) : (
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white ring-1 ring-white/10 shrink-0" style={{ background: 'linear-gradient(135deg,#0066FF,#7C3AED)' }}>{nm.charAt(0).toUpperCase()}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-white truncate max-w-[7.5rem]">{nm}</span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              buy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
            }`}
          >
            {buy ? 'Buy' : 'Sell'}
          </span>
        </div>
        <div className="text-[12px] text-white/50 truncate tabular-nums">
          {compactUsd(t.usdAmount)}
          {t.marketCapUsd != null ? <> at {compactUsd(t.marketCapUsd)} MC</> : null}
        </div>
      </div>
      <CoinLogo logoUrl={t.logoUrl} symbol={t.symbol || ''} chain={t.chain} size={30} />
      <span className="text-[11px] text-white/35 tabular-nums w-8 text-right shrink-0">{shortAgo(t.timestamp)}</span>
    </>
  );

  const cls = 'group relative flex items-center gap-2.5 rounded-2xl pl-4 pr-3 py-2.5 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-10px_rgba(0,102,255,.55)]';
  const wrapped = (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
      {t.tokenAddress ? (
        <Link href={`/dashboard/coins/${t.chain}/${encodeURIComponent(t.tokenAddress)}`} className={cls}>{inner}</Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </motion.div>
  );
  return wrapped;
}
