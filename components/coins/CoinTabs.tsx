'use client';

/**
 * Coin detail tabs: Holders, Wire and Info. Real data only, from the coins API.
 * Holders carry badges earned from real hold-time and PnL (no whale list), with
 * an Activity view of live transactions. Wire is our real Wire filtered to posts
 * that carry this coin's ticker. Info shows the real buy/sell split and market
 * data. UI is our own: soft glass rows, brand accents, no arrows.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Gem, Zap, TrendingUp, Send, Globe } from 'lucide-react';
import type { Coin } from '@/lib/coins/types';
import { compactUsd, compactNum, holdTime, shortAgo, signedPct } from '@/lib/coins/format';
import { PriceDelta } from './atoms';
import { CoinWireFeed } from './CoinWireFeed';

interface Profile { id: string; username: string | null; display_name: string | null; avatar_url: string | null; tier?: string | null; is_verified?: boolean }
interface Holder { user: Profile; usdValue: number; pnlPct: number | null; avgHoldMs: number | null }
interface Trade { timestamp: number; side: 'buy' | 'sell'; usdAmount: number; marketCapUsd: number | null; user?: Profile | null; source: string }
interface Stats { buys: number | null; sells: number | null; buyers: number | null; sellers: number | null }

function Avatar({ p, size = 34 }: { p: Profile | null | undefined; size?: number }) {
  const nm = p?.display_name || p?.username || '?';
  if (p?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.avatar_url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return <span className="rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ width: size, height: size, background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{nm.charAt(0).toUpperCase()}</span>;
}

/** Badge earned from real behavior, not a curated list. */
function traderBadge(h: Holder): { label: string; Icon: typeof Gem; cls: string } | null {
  const DAY = 86400000;
  if (h.pnlPct != null && h.pnlPct >= 100) return { label: 'Proven', Icon: TrendingUp, cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' };
  if (h.avgHoldMs != null && h.avgHoldMs >= 7 * DAY) return { label: 'Diamond', Icon: Gem, cls: 'text-[#7FB2FF] bg-[#0066FF]/12 border-[#0066FF]/30' };
  if (h.avgHoldMs != null && h.avgHoldMs > 0 && h.avgHoldMs < 3600000) return { label: 'Flipper', Icon: Zap, cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25' };
  return null;
}

export function HoldersTab({ coin }: { coin: Coin }) {
  const [view, setView] = useState<'holders' | 'activity'>('holders');
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [trades, setTrades] = useState<Trade[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}/holders`, { cache: 'no-store' });
        const j = await r.json();
        setHolders(Array.isArray(j.holders) ? j.holders : []);
      } catch { setHolders([]); }
    })();
  }, [coin.chain, coin.tokenAddress]);

  useEffect(() => {
    if (view !== 'activity' || trades !== null) return;
    (async () => {
      try {
        const r = await fetch(`/api/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}/feed`, { cache: 'no-store' });
        const j = await r.json();
        const plat = Array.isArray(j.platformTrades) ? j.platformTrades : [];
        const dex = Array.isArray(j.dexTrades) ? j.dexTrades.map((d: Trade) => ({ ...d, source: 'dex' })) : [];
        setTrades([...plat, ...dex].sort((a, b) => b.timestamp - a.timestamp).slice(0, 60));
      } catch { setTrades([]); }
    })();
  }, [view, trades, coin.chain, coin.tokenAddress]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 mb-3 w-fit">
        {(['holders', 'activity'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition-colors ${view === v ? 'bg-[#0066FF]/20 text-white' : 'text-white/50 hover:text-white'}`}>{v}</button>
        ))}
      </div>

      {view === 'holders' ? (
        holders === null ? <ListSkeleton /> : holders.length === 0 ? <Empty text="No Naka holders yet. Be the first to buy and you show up here." /> : (
          <div className="space-y-1">
            {holders.map((h, i) => {
              const badge = traderBadge(h);
              return (
                <motion.div key={h.user.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }} className="flex items-center gap-2.5 py-2">
                  <Avatar p={h.user} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-white truncate">{h.user.display_name || h.user.username || 'Holder'}</span>
                      {badge ? <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.cls}`}><badge.Icon className="w-3 h-3" />{badge.label}</span> : null}
                    </div>
                    <div className="text-[11px] text-white/40 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {holdTime(h.avgHoldMs)} avg hold</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[14px] font-semibold text-white tabular-nums">{compactUsd(h.usdValue)}</div>
                    <PriceDelta value={h.pnlPct} className="text-[12px]" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : trades === null ? <ListSkeleton /> : trades.length === 0 ? <Empty text="No transactions yet. The first trade shows up here live." /> : (
        <div className="space-y-1">
          {trades.map((t, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2">
              <Avatar p={t.user} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-white truncate">{t.user?.display_name || t.user?.username || 'Anon'}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.side === 'buy' ? 'text-emerald-300 bg-emerald-500/12' : 'text-rose-300 bg-rose-500/12'}`}>{t.side === 'buy' ? 'Buy' : 'Sell'}</span>
                  <span className="text-[11px] text-white/35">{shortAgo(t.timestamp)}</span>
                </div>
                <div className="text-[13px] text-white/60">{compactUsd(t.usdAmount)}{t.marketCapUsd != null ? <span className="text-white/35"> at {compactUsd(t.marketCapUsd)} MC</span> : null}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The coin's slice of The Wire. Renders the platform's real WirePostCard (signal
 * rail, tier badge, rich text, inline coin cards, action bar, gift, threads)
 * scoped to this coin, so it is the same Wire view, not a look-alike.
 */
export function WireTab({ coin, canPost }: { coin: Coin; canPost: boolean }) {
  return <CoinWireFeed coin={coin} canPost={canPost} />;
}

export function InfoTab({ coin, stats }: { coin: Coin; stats: Stats | null }) {
  const totalTx = (stats?.buys ?? 0) + (stats?.sells ?? 0);
  const buyPct = totalTx > 0 ? ((stats?.buys ?? 0) / totalTx) * 100 : 50;
  return (
    <div className="space-y-5">
      {stats && totalTx > 0 ? (
        <div>
          <div className="text-[13px] font-semibold text-white/80 mb-2">Transactions (24h)</div>
          <div className="flex items-center justify-between text-[13px] mb-1"><span className="text-emerald-300 font-semibold">{compactNum(stats.buys)} buys</span><span className="text-rose-300 font-semibold">{compactNum(stats.sells)} sells</span></div>
          <div className="h-1.5 rounded-full overflow-hidden bg-rose-500/40"><div className="h-full bg-emerald-500" style={{ width: `${buyPct}%` }} /></div>
          {stats.buyers != null || stats.sellers != null ? (
            <div className="flex items-center justify-between text-[12px] text-white/55 mt-2"><span>{compactNum(stats.buyers)} buyers</span><span>{compactNum(stats.sellers)} sellers</span></div>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="text-[13px] font-semibold text-white/80 mb-2">Market</div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Market cap" value={compactUsd(coin.marketCapUsd)} />
          <Stat label="Liquidity" value={compactUsd(coin.liquidityUsd)} />
          <Stat label="Volume 24h" value={compactUsd(coin.volume24hUsd)} />
          <Stat label="Holders" value={coin.holdersCount != null ? compactNum(coin.holdersCount) : '—'} />
          {coin.fdvUsd != null && coin.fdvUsd !== coin.marketCapUsd ? <Stat label="FDV" value={compactUsd(coin.fdvUsd)} /> : null}
          <Stat label="24h" value={coin.change24h != null ? signedPct(coin.change24h) : '—'} valueClass={coin.change24h != null && coin.change24h < 0 ? 'text-rose-400' : 'text-emerald-400'} />
        </div>
      </div>

      {(coin.socials.website || coin.socials.twitter || coin.socials.telegram) ? (
        <div className="flex flex-wrap gap-2">
          {coin.socials.website ? <SocialChip href={coin.socials.website} label="Website" Icon={Globe} /> : null}
          {coin.socials.twitter ? <SocialChip href={coin.socials.twitter} label="Twitter" Icon={Globe} /> : null}
          {coin.socials.telegram ? <SocialChip href={coin.socials.telegram} label="Telegram" Icon={Send} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
      <div className="text-[11px] text-white/45">{label}</div>
      <div className={`text-[15px] font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
function SocialChip({ href, label, Icon }: { href: string; label: string; Icon: typeof Globe }) {
  return <Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white/75 bg-white/[0.04] border border-white/10 hover:text-white"><Icon className="w-3.5 h-3.5" /> {label}</Link>;
}
function ListSkeleton() { return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />)}</div>; }
function Empty({ text }: { text: string }) { return <div className="nl-glass rounded-2xl p-6 text-center text-white/50 text-sm">{text}</div>; }
