'use client';

/**
 * Coins leaderboard. Two ranked boards from real platform trades: Traders (each
 * account's total realized-plus-unrealized PnL) and Trades (the best single
 * positions). A Global / Friends scope (Traders only, Friends needs sign-in) and
 * a 7d / 30d / All range. Ranked glass cards, gold ring for #1, big emerald PnL.
 * Honest empty state when nothing qualifies. Real data only, no fabrication.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Users2, Globe2 } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { CoinLogo } from '@/components/coins/atoms';
import CopyTraderButton from '@/components/coins/CopyTraderButton';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { compactUsd, signedPct } from '@/lib/coins/format';

interface Profile { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
interface Trader { user: Profile; pnlUsd: number; tradeCount: number }
interface Trade { user: Profile; chain: string; tokenAddress: string; tokenKey: string; symbol: string | null; logoUrl: string | null; pnlUsd: number; pnlPct: number | null }

type Tab = 'traders' | 'trades';
type Scope = 'global' | 'friends';
type Range = '7d' | '30d' | 'all';

const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, all: 3650 };
const RANGES: { id: Range; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
];

const ACTIVE_CHIP = 'bg-[#0066FF]/18 border-[#0066FF]/60 text-white shadow-[0_0_18px_-4px_rgba(0,102,255,.8)]';
const IDLE_CHIP = 'bg-white/[0.03] border-white/10 text-white/55 hover:text-white hover:border-white/20';

function Avatar({ user, size = 40 }: { user: Profile; size?: number }) {
  const nm = user.display_name || user.username || 'Trader';
  if (user.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar_url} alt="" className="rounded-full object-cover ring-1 ring-white/10 shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="rounded-full flex items-center justify-center font-semibold text-white ring-1 ring-white/10 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: 'linear-gradient(135deg,#0066FF,#7C3AED)' }}
    >
      {nm.charAt(0).toUpperCase()}
    </span>
  );
}

/** Rank badge: gold ring + gold text for #1, brand-muted for the rest. */
function Rank({ n }: { n: number }) {
  const first = n === 1;
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold tabular-nums shrink-0 ${
        first ? 'text-[#F0B90B] ring-2 ring-[#F0B90B]/70 bg-[#F0B90B]/10' : 'text-white/45 ring-1 ring-white/10 bg-white/[0.03]'
      }`}
    >
      {n}
    </span>
  );
}

const CARD = 'nl-glass rounded-2xl p-3 flex items-center gap-3 transition-all hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-10px_rgba(0,102,255,.55)]';

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('traders');
  const [scope, setScope] = useState<Scope>('global');
  const [range, setRange] = useState<Range>('7d');
  const [traders, setTraders] = useState<Trader[] | null>(null);
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [authError, setAuthError] = useState(false);

  const load = useCallback(async () => {
    setAuthError(false);
    const effScope: Scope = tab === 'trades' ? 'global' : scope;
    const params = new URLSearchParams({ tab, scope: effScope, days: String(RANGE_DAYS[range]) });
    if (tab === 'traders') setTraders(null); else setTrades(null);
    try {
      const r = await fetch(`/api/coins/leaderboard?${params.toString()}`, { cache: 'no-store' });
      if (r.status === 401) { setAuthError(true); if (tab === 'traders') setTraders([]); else setTrades([]); return; }
      const j = await r.json();
      if (tab === 'traders') setTraders(Array.isArray(j.traders) ? j.traders : []);
      else setTrades(Array.isArray(j.trades) ? j.trades : []);
    } catch {
      if (tab === 'traders') setTraders([]); else setTrades([]);
    }
  }, [tab, scope, range]);

  useEffect(() => { void load(); }, [load]);

  const loading = tab === 'traders' ? traders === null : trades === null;
  const list = tab === 'traders' ? traders ?? [] : trades ?? [];
  const isEmpty = !loading && list.length === 0;

  return (
    <AuroraBackground fullHeight>
      <div className="min-h-screen text-white max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-28">
        <div className="flex items-center gap-2 mb-4">
          <BackButton href="/dashboard/coins" />
          <div className="flex items-center gap-1.5">
            <Trophy className="w-5 h-5 text-[#F0B90B]" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-[#8fb4ff] bg-clip-text text-transparent">Leaderboard</h1>
          </div>
        </div>

        {/* Traders / Trades segmented tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl nl-glass mb-3">
          {(['traders', 'trades'] as Tab[]).map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-xl py-2 text-[13px] font-semibold border transition-all duration-200 ${active ? ACTIVE_CHIP : 'border-transparent text-white/55 hover:text-white'}`}
              >
                {id === 'traders' ? 'Traders' : 'Trades'}
              </button>
            );
          })}
        </div>

        {/* Scope (Traders only) + range chips */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          {tab === 'traders' ? (
            <div className="flex items-center gap-1.5">
              {(['global', 'friends'] as Scope[]).map((id) => {
                const active = scope === id;
                const Icon = id === 'global' ? Globe2 : Users2;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setScope(id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold border transition-all duration-200 ${active ? ACTIVE_CHIP : IDLE_CHIP}`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {id === 'global' ? 'Global' : 'Friends'}
                  </button>
                );
              })}
            </div>
          ) : <span />}
          <div className="flex items-center gap-1.5">
            {RANGES.map(({ id, label }) => {
              const active = range === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRange(id)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-all duration-200 ${active ? ACTIVE_CHIP : IDLE_CHIP}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={`${tab}:${scope}:${range}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-2">
            {loading ? (
              [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[64px] rounded-2xl bg-white/[0.03] animate-pulse" />)
            ) : isEmpty ? (
              <div className="nl-glass rounded-2xl p-8 text-center">
                <Trophy className="w-7 h-7 text-white/25 mx-auto mb-3" />
                <p className="text-white/55 text-sm">
                  {authError
                    ? 'Sign in to see how the people you follow are trading.'
                    : tab === 'traders' && scope === 'friends'
                      ? 'No profitable trades yet from people you follow. Follow more traders to fill this out.'
                      : 'No profitable trades in this window yet. Check back once the tape gets going.'}
                </p>
              </div>
            ) : tab === 'traders' ? (
              (traders ?? []).map((t, i) => {
                const nm = t.user.display_name || t.user.username || 'Trader';
                const inner = (
                  <>
                    <Rank n={i + 1} />
                    <Avatar user={t.user} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-white truncate">{nm}</div>
                      <div className="text-[12px] text-white/45 truncate">{t.tradeCount} {t.tradeCount === 1 ? 'trade' : 'trades'}{t.user.username ? ` · @${t.user.username}` : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[17px] font-bold text-emerald-400 tabular-nums leading-tight">+{compactUsd(t.pnlUsd)}</div>
                    </div>
                  </>
                );
                return (
                  <motion.div key={t.user.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.25) }} className={CARD}>
                    {t.user.username
                      ? <Link href={`/u/${t.user.username}`} className="flex items-center gap-3 min-w-0 flex-1">{inner}</Link>
                      : <div className="flex items-center gap-3 min-w-0 flex-1">{inner}</div>}
                    <CopyTraderButton leaderUserId={t.user.id} leaderName={nm} />
                  </motion.div>
                );
              })
            ) : (
              (trades ?? []).map((t, i) => {
                const nm = t.user.display_name || t.user.username || 'Trader';
                return (
                  <motion.div key={`${t.user.id}:${t.tokenKey}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.25) }}>
                    <Link href={`/dashboard/coins/${t.chain}/${encodeURIComponent(t.tokenAddress)}`} className={CARD}>
                      <Rank n={i + 1} />
                      <Avatar user={t.user} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-white truncate">{nm}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CoinLogo logoUrl={t.logoUrl} symbol={t.symbol || ''} chain={t.chain} size={16} />
                          <span className="text-[12px] text-white/45 truncate">{t.symbol || 'Coin'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[17px] font-bold text-emerald-400 tabular-nums leading-tight">+{compactUsd(t.pnlUsd)}</div>
                        {t.pnlPct != null ? <div className="text-[12px] font-semibold text-emerald-400/80">{signedPct(t.pnlPct)}</div> : null}
                      </div>
                    </Link>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AuroraBackground>
  );
}
