'use client';

/**
 * Coin detail. Order follows the house rule: identity, price, chart first, then
 * the tabs, then the in-flow trade card. Live price ticks in near real time.
 * Contract address and market cap are copyable. Real data only.
 */

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Share2, Check, Loader2, CandlestickChart as CandleIcon, Activity, ShieldAlert, ShieldCheck } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { CoinLogo, Copyable, PriceDelta } from '@/components/coins/atoms';
import { CoinChart, type ChartMode, type TradeMarker } from '@/components/coins/CoinChart';
import { TradeCard } from '@/components/coins/TradeCard';
import { HoldersTab, WireTab, InfoTab } from '@/components/coins/CoinTabs';
import { useLivePrice } from '@/components/coins/useLivePrice';
import type { Coin, CoinCandle, CoinTimeframe } from '@/lib/coins/types';
import { coinPrice, compactUsd, formatAddress } from '@/lib/coins/format';

const TIMEFRAMES: CoinTimeframe[] = ['1H', '4H', '1D', '7D', '3M', 'ALL'];
type Tab = 'holders' | 'wire' | 'info';

export default function CoinDetailPage({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address: raw } = use(params);
  const address = decodeURIComponent(raw);

  const [coin, setCoin] = useState<Coin | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [tf, setTf] = useState<CoinTimeframe>('1H');
  const [chartMode, setChartMode] = useState<ChartMode>('line');
  const [candles, setCandles] = useState<CoinCandle[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('wire');
  const [stats, setStats] = useState<{ buys: number | null; sells: number | null; buyers: number | null; sellers: number | null } | null>(null);
  const [markers, setMarkers] = useState<TradeMarker[]>([]);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}`, { cache: 'no-store' });
        if (!r.ok) { setNotFound(true); return; }
        const j = await r.json();
        setCoin(j.coin); setWatchlisted(!!j.watchlisted);
      } catch { setNotFound(true); }
    })();
    // Do we have a session (controls thesis composer + watchlist writes)?
    fetch('/api/coins/watchlist', { cache: 'no-store' }).then((r) => r.json()).then((j) => setSignedIn(Array.isArray(j.keys))).catch(() => {});
    // The caller's own buys/sells on this coin, plotted as chart markers.
    fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/mytrades`, { cache: 'no-store' })
      .then((r) => r.json()).then((j) => setMarkers(Array.isArray(j.trades) ? j.trades : [])).catch(() => {});
  }, [chain, address]);

  const loadChart = useCallback(async (timeframe: CoinTimeframe, pair?: string | null) => {
    setChartLoading(true);
    try {
      const p = new URLSearchParams({ tf: timeframe });
      if (pair) p.set('pair', pair);
      const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/chart?${p.toString()}`, { cache: 'no-store' });
      const j = await r.json();
      setCandles(Array.isArray(j.candles) ? j.candles : []);
    } catch { setCandles([]); } finally { setChartLoading(false); }
  }, [chain, address]);

  useEffect(() => { if (coin) void loadChart(tf, coin.pairAddress); }, [coin, tf, loadChart]);
  useEffect(() => {
    if (!coin) return;
    (async () => {
      try {
        const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/feed`, { cache: 'no-store' });
        const j = await r.json();
        setStats(j.stats ?? null);
      } catch { /* ignore */ }
    })();
  }, [coin, chain, address]);

  const live = useLivePrice(chain, address, {
    priceUsd: coin?.priceUsd ?? null,
    marketCapUsd: coin?.marketCapUsd ?? null,
    change24h: coin?.change24h ?? null,
  });

  const toggleWatch = async () => {
    if (!coin) return;
    const next = !watchlisted;
    setWatchlisted(next);
    try { await fetch('/api/coins/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chain, address, on: next }) }); }
    catch { setWatchlisted(!next); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : ''); setShared(true); setTimeout(() => setShared(false), 1500); } catch { /* ignore */ }
  };

  const up = useMemo(() => (live.change24h ?? coin?.change24h ?? 0) >= 0, [live.change24h, coin]);

  if (notFound) return <div className="min-h-screen flex items-center justify-center text-white/50 text-sm px-6 text-center">This coin is not available. Only coins graduated on a DEX can be traded here.</div>;
  if (!coin) return <div className="min-h-screen flex items-center justify-center text-white/40"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <AuroraBackground fullHeight>
    <div className="min-h-screen text-white max-w-2xl mx-auto pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-2.5 px-3 sm:px-4 py-3 bg-[#070a12]/70 backdrop-blur-xl border-b border-[#0066FF]/25">
        <BackButton href="/dashboard/coins" />
        <CoinLogo logoUrl={coin.logoUrl} symbol={coin.symbol} chain={coin.chain} size={36} verified={coin.verified} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-white truncate leading-tight">{coin.symbol || coin.name}</div>
          <Copyable text={coin.tokenAddress} label={formatAddress(coin.tokenAddress)} className="text-[11px]" />
        </div>
        <button type="button" onClick={toggleWatch} aria-label="Watchlist" className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06]">
          <Star className={`w-[18px] h-[18px] ${watchlisted ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
        <button type="button" onClick={share} aria-label="Share" className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06]">
          {shared ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
        </button>
      </div>

      <div className="px-3 sm:px-4">
        {/* Price hero with a soft brand glow */}
        <div className="relative flex items-end justify-between pt-5 pb-3">
          <span className="pointer-events-none absolute -top-2 -left-6 w-52 h-24 rounded-full bg-[#0066FF]/20 blur-3xl" />
          <div className="relative">
            <div className={`text-[34px] leading-none font-extrabold tracking-tight tabular-nums transition-colors ${live.flash === 'up' ? 'text-emerald-400' : live.flash === 'down' ? 'text-rose-400' : 'text-white'}`}>
              {coinPrice(live.price)}
            </div>
            <div className="mt-1.5"><PriceDelta value={live.change24h} className="text-[14px] font-bold" /><span className="text-white/35 text-[13px] ml-1">24h</span></div>
          </div>
          <div className="relative text-right rounded-2xl nl-glass px-3.5 py-2">
            <div className="text-white/45 text-[10px] uppercase tracking-wide">Market cap</div>
            <Copyable text={String(Math.round(live.marketCap ?? coin.marketCapUsd ?? 0))} label={compactUsd(live.marketCap ?? coin.marketCapUsd)} className="text-[17px] font-bold text-white" />
          </div>
        </div>

        {/* Chart first */}
        <div className="rounded-2xl overflow-hidden">
          {chartLoading && candles.length === 0 ? (
            <div className="h-[260px] rounded-2xl bg-white/[0.03] animate-pulse" />
          ) : candles.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-white/40 text-sm">No chart data yet.</div>
          ) : (
            <CoinChart candles={candles} mode={chartMode} up={up} markers={markers} />
          )}
        </div>

        {/* Timeframe + chart type */}
        <div className="flex items-center justify-between mt-1 mb-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {TIMEFRAMES.map((t) => (
              <button key={t} type="button" onClick={() => setTf(t)} className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold ${tf === t ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white'}`}>{t}</button>
            ))}
          </div>
          <button type="button" onClick={() => setChartMode((m) => m === 'line' ? 'candle' : 'line')} aria-label="Chart type" className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#7FB2FF] hover:bg-white/[0.06]">
            {chartMode === 'line' ? <CandleIcon className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          </button>
        </div>

        {/* Tabs (house rule: chart first, then the tabs, then the trade area) */}
        <div className="flex items-center border-b border-white/10 mb-3">
          {(['holders', 'wire', 'info'] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 py-2.5 text-[14px] font-semibold capitalize relative ${tab === t ? 'text-white' : 'text-white/45'}`}>
              {t === 'wire' ? 'Wire' : t}
              {tab === t ? <motion.span layoutId="coin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066FF]" /> : null}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {tab === 'holders' ? <HoldersTab coin={coin} /> : tab === 'wire' ? <WireTab coin={coin} canPost={signedIn} /> : <InfoTab coin={coin} stats={stats} />}
          </motion.div>
        </AnimatePresence>

        {/* Honest verification state, then the in-flow trade action last. */}
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mt-4 mb-2.5 text-[12px] ${coin.verified ? 'bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300' : 'bg-amber-500/[0.08] border border-amber-500/20 text-amber-200/90'}`}>
          {coin.verified ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
          <span>{coin.verified ? 'Verified by Naka. Still a volatile asset, trade with care.' : 'Unverified coin. Anyone can launch a coin, so trade with heightened caution.'}</span>
        </div>
        <div className="mb-4">
          <TradeCard coin={coin} livePrice={live.price} liveMcap={live.marketCap} />
        </div>
      </div>
    </div>
    </AuroraBackground>
  );
}
