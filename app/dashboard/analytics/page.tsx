'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, Users, Heart, MessageCircle, Repeat2, Eye, Coins, Wallet, Timer, Percent } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import MiniChart from '@/components/analytics/MiniChart';
import { compactUsd, compactNum, holdTime } from '@/lib/coins/format';

type Range = '7d' | '30d' | 'all';
type Tab = 'trading' | 'account';

const NULL = '—';
const EMERALD = '#10B981';
const ROSE = '#F43F5E';
const BRAND = '#0066FF';

interface ChainStat { realizedUsd: number; unrealizedUsd: number; netValueUsd: number; tradeCount: number; volumeUsd: number }
interface TradingData {
  totalRealizedUsd: number;
  totalUnrealizedUsd: number;
  winRate: number | null;
  tradeCount: number;
  totalVolumeUsd: number;
  avgHoldMs: number | null;
  openPositions: number;
  perChain: Record<'solana' | 'ethereum' | 'bsc', ChainStat>;
  perCoin: Array<{ chain: string; symbol: string; logo: string | null; realized: number; unrealized: number; netValue: number }>;
  pnlSeries: Array<{ day: string; cumulativeRealizedUsd: number }>;
}
interface AccountData {
  followersTotal: number;
  followingTotal: number;
  followersSeries: Array<{ day: string; total: number }>;
  netNewFollowers: number;
  postsCount: number;
  totalLikesReceived: number;
  likesSeries: Array<{ day: string; count: number }>;
  repliesReceived: number;
  reposts: number;
  engagementRate: number | null;
  topPosts: Array<{ id: string; snippet: string; likes: number; replies: number; reposts: number; createdAt: string }>;
  profileViews: number;
  viewsSeries: Array<{ day: string; views: number }>;
}

const RANGES: Array<{ id: Range; label: string }> = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'All' },
];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('trading');
  const [range, setRange] = useState<Range>('30d');
  const [trading, setTrading] = useState<TradingData | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const endpoint = tab === 'trading' ? 'trading' : 'account';
    setLoading(true);
    setError(null);
    fetch(`/api/analytics/${endpoint}?range=${range}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) throw new Error('Sign in to view your analytics.');
        if (!r.ok) throw new Error('Could not load analytics.');
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        if (tab === 'trading') setTrading(j as TradingData);
        else setAccount(j as AccountData);
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load analytics.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, range]);

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 py-5 pb-28">
      <div className="flex items-center gap-2 mb-4">
        <BackButton href="/dashboard" />
        <h1 className="text-lg font-bold inline-flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#7FB2FF]" /> Analytics
        </h1>
      </div>

      {/* Tabs */}
      <div className="relative flex items-center gap-1 nl-glass rounded-2xl p-1 mb-4">
        {(['trading', 'account'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${tab === t ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
          >
            {tab === t && (
              <motion.span
                layoutId="analytics-tab"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10 capitalize">{t}</span>
          </button>
        ))}
      </div>

      {/* Range chips (auto-apply) */}
      <div className="flex items-center gap-2 mb-5">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold border transition-colors ${
              range === r.id
                ? 'text-white border-[#0066FF]/50 bg-[#0066FF]/15'
                : 'text-white/55 border-white/10 hover:text-white/85 hover:border-white/20'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="nl-glass rounded-2xl p-6 text-center text-white/60 text-sm">{error}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'trading'
              ? <TradingView data={trading} loading={loading} />
              : <AccountView data={account} loading={loading} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, trend, trendColor, i = 0 }: {
  icon: React.ElementType; label: string; value: string; trend?: string | null; trendColor?: string; i?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.28), ease: [0.22, 1, 0.36, 1] }}
      className="nl-glass rounded-2xl p-3.5"
      style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.12)' }}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-white/45 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-[#7FB2FF]" /> {label}
      </div>
      <div className="text-[19px] font-bold text-white leading-tight tabular-nums">{value}</div>
      {trend ? <div className="text-[11px] font-semibold mt-0.5" style={{ color: trendColor ?? EMERALD }}>{trend}</div> : null}
    </motion.div>
  );
}

function ChartCard({ title, subtitle, children, i = 0 }: { title: string; subtitle?: string; children: React.ReactNode; i?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.28), ease: [0.22, 1, 0.36, 1] }}
      className="nl-glass rounded-2xl p-4"
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[13px] font-semibold text-white/80">{title}</div>
        {subtitle ? <div className="text-[11px] text-white/40">{subtitle}</div> : null}
      </div>
      {children}
    </motion.div>
  );
}

function TileGridSkeleton({ n }: { n: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="h-[84px] rounded-2xl bg-white/[0.03] animate-pulse" />)}
    </div>
  );
}

function CoinLogo({ logo, symbol }: { logo: string | null; symbol: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#7C3AED)' }}>
      {symbol.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Trading tab ────────────────────────────────────────────────────────────────

function TradingView({ data, loading }: { data: TradingData | null; loading: boolean }) {
  if (loading || !data) {
    return (<><TileGridSkeleton n={6} /><div className="h-[180px] rounded-2xl bg-white/[0.03] animate-pulse" /></>);
  }

  const hasActivity = data.tradeCount > 0 || data.perCoin.length > 0;
  if (!hasActivity) {
    return (
      <div className="nl-glass rounded-2xl p-8 text-center">
        <Coins className="w-8 h-8 text-white/25 mx-auto mb-3" />
        <div className="text-sm text-white/70 font-semibold mb-1">No trades in this range</div>
        <div className="text-[12px] text-white/45">Your realized PnL, volume and holdings will appear here once you trade on Naka.</div>
      </div>
    );
  }

  const realizedColor = data.totalRealizedUsd >= 0 ? EMERALD : ROSE;
  const unrealColor = data.totalUnrealizedUsd >= 0 ? EMERALD : ROSE;
  const chains: Array<{ id: 'solana' | 'ethereum' | 'bsc'; label: string }> = [
    { id: 'solana', label: 'Solana' }, { id: 'ethereum', label: 'Ethereum' }, { id: 'bsc', label: 'BSC' },
  ];
  const activeChains = chains.filter((c) => data.perChain[c.id].tradeCount > 0 || data.perChain[c.id].netValueUsd !== 0);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <StatTile i={0} icon={TrendingUp} label="Realized PnL" value={compactUsd(data.totalRealizedUsd)} trend={data.tradeCount > 0 ? `${data.totalRealizedUsd >= 0 ? 'Profit' : 'Loss'} this range` : null} trendColor={realizedColor} />
        <StatTile i={1} icon={Wallet} label="Unrealized PnL" value={compactUsd(data.totalUnrealizedUsd)} trend={data.openPositions > 0 ? `${data.openPositions} open` : null} trendColor={unrealColor} />
        <StatTile i={2} icon={Percent} label="Win Rate" value={data.winRate == null ? NULL : `${data.winRate.toFixed(0)}%`} />
        <StatTile i={3} icon={Activity} label="Trades" value={data.tradeCount > 0 ? compactNum(data.tradeCount) : NULL} />
        <StatTile i={4} icon={Coins} label="Volume" value={compactUsd(data.totalVolumeUsd)} />
        <StatTile i={5} icon={Timer} label="Avg Hold" value={holdTime(data.avgHoldMs)} />
      </div>

      <div className="mb-5">
        <ChartCard title="Cumulative realized PnL" subtitle={data.pnlSeries.length ? `${data.pnlSeries.length}d` : undefined}>
          <MiniChart
            data={data.pnlSeries.map((p) => p.cumulativeRealizedUsd)}
            color={data.totalRealizedUsd >= 0 ? EMERALD : ROSE}
            height={140}
            ariaLabel="Cumulative realized profit and loss over time"
          />
        </ChartCard>
      </div>

      {activeChains.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {activeChains.map((c, idx) => {
            const s = data.perChain[c.id];
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.2), ease: [0.22, 1, 0.36, 1] }}
                className="nl-glass rounded-2xl p-3.5"
              >
                <div className="text-[12px] font-semibold text-white/70 mb-1.5">{c.label}</div>
                <div className="text-[15px] font-bold tabular-nums" style={{ color: s.realizedUsd >= 0 ? EMERALD : ROSE }}>{compactUsd(s.realizedUsd)}</div>
                <div className="text-[11px] text-white/40 mt-0.5">{compactNum(s.tradeCount)} trades · {compactUsd(s.volumeUsd)} vol</div>
              </motion.div>
            );
          })}
        </div>
      )}

      {data.perCoin.length > 0 && (
        <ChartCard title="By coin" subtitle={`${data.perCoin.length}`}>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-[11px] text-white/40 text-left">
                  <th className="font-medium py-1.5 pl-1">Coin</th>
                  <th className="font-medium py-1.5 text-right">Realized</th>
                  <th className="font-medium py-1.5 text-right">Unrealized</th>
                  <th className="font-medium py-1.5 text-right pr-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.perCoin.map((c) => (
                  <tr key={`${c.chain}:${c.symbol}`} className="border-t border-white/[0.06]">
                    <td className="py-2 pl-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <CoinLogo logo={c.logo} symbol={c.symbol} />
                        <span className="font-semibold text-white truncate">{c.symbol}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium" style={{ color: c.realized >= 0 ? EMERALD : ROSE }}>{compactUsd(c.realized)}</td>
                    <td className="py-2 text-right tabular-nums font-medium" style={{ color: c.unrealized >= 0 ? EMERALD : ROSE }}>{compactUsd(c.unrealized)}</td>
                    <td className="py-2 text-right tabular-nums text-white/85 pr-1">{c.netValue > 0 ? compactUsd(c.netValue) : NULL}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

// ── Account tab ──────────────────────────────────────────────────────────────

function AccountView({ data, loading }: { data: AccountData | null; loading: boolean }) {
  if (loading || !data) {
    return (<><TileGridSkeleton n={6} /><div className="h-[180px] rounded-2xl bg-white/[0.03] animate-pulse" /></>);
  }

  const engagement = data.engagementRate == null ? NULL : `${compactNum(data.engagementRate)}`;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <StatTile i={0} icon={Users} label="Followers" value={compactNum(data.followersTotal)} trend={data.netNewFollowers > 0 ? `+${compactNum(data.netNewFollowers)} this range` : null} trendColor={EMERALD} />
        <StatTile i={1} icon={Users} label="Following" value={compactNum(data.followingTotal)} />
        <StatTile i={2} icon={Eye} label="Profile Views" value={data.profileViews > 0 ? compactNum(data.profileViews) : NULL} />
        <StatTile i={3} icon={Activity} label="Posts" value={data.postsCount > 0 ? compactNum(data.postsCount) : NULL} />
        <StatTile i={4} icon={Heart} label="Likes" value={compactNum(data.totalLikesReceived)} />
        <StatTile i={5} icon={MessageCircle} label="Replies" value={compactNum(data.repliesReceived)} />
        <StatTile i={6} icon={Repeat2} label="Reposts" value={compactNum(data.reposts)} />
        <StatTile i={7} icon={TrendingUp} label="Engagement" value={engagement === NULL ? NULL : `${engagement}`} trend={data.engagementRate == null ? null : 'per post'} trendColor="#7FB2FF" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <ChartCard i={0} title="Follower growth" subtitle={data.followersSeries.length ? `${data.followersSeries.length}d` : undefined}>
          <MiniChart data={data.followersSeries.map((p) => p.total)} color={BRAND} height={120} ariaLabel="Follower growth over time" />
        </ChartCard>
        <ChartCard i={1} title="Likes received" subtitle={data.likesSeries.length ? `${data.likesSeries.length}d` : undefined}>
          <MiniChart data={data.likesSeries.map((p) => p.count)} color={EMERALD} height={120} ariaLabel="Likes received over time" />
        </ChartCard>
      </div>

      <div className="mb-5">
        <ChartCard title="Profile views" subtitle={data.viewsSeries.length ? `${data.viewsSeries.length}d` : undefined}>
          <MiniChart data={data.viewsSeries.map((p) => p.views)} color="#7C3AED" height={120} ariaLabel="Profile views over time" />
        </ChartCard>
      </div>

      <div className="mb-2 text-[13px] font-semibold text-white/70 px-0.5">Top posts</div>
      {data.topPosts.length === 0 ? (
        <div className="nl-glass rounded-2xl p-6 text-center text-white/50 text-sm">No posts yet. Share something on The Wire to start tracking engagement.</div>
      ) : (
        <div className="space-y-2">
          {data.topPosts.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.2), ease: [0.22, 1, 0.36, 1] }}
              className="nl-glass rounded-2xl p-3.5"
            >
              <div className="text-[13px] text-white/85 leading-snug mb-2 line-clamp-2">{p.snippet || 'Media post'}</div>
              <div className="flex items-center gap-4 text-[11px] text-white/45">
                <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {compactNum(p.likes)}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {compactNum(p.replies)}</span>
                <span className="inline-flex items-center gap-1"><Repeat2 className="w-3.5 h-3.5" /> {compactNum(p.reposts)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
