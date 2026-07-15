'use client';

/**
 * Coin detail. Order follows the house rule: identity, price, chart first, then
 * the tabs, then the in-flow trade card. Live price ticks in near real time.
 * Contract address and market cap are copyable. Real data only.
 */

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Share2, Check, Loader2, CandlestickChart as CandleIcon, Activity, ShieldAlert, ShieldCheck, Shield, Sparkles, Bell, X, Trash2 } from 'lucide-react';
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

type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
interface RiskRead { level: RiskLevel; reasons: string[] }
interface VtxFlag { kind: 'strength' | 'risk'; text: string }
interface VtxRead { available: boolean; summary?: string; flags?: VtxFlag[]; reason?: string }
type AlertKind = 'price_above' | 'price_below' | 'mcap_above' | 'mcap_below';
interface CoinAlert { id: string; kind: AlertKind; threshold: number; active: boolean; triggered_at: string | null }

const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  price_above: 'Price rises above',
  price_below: 'Price falls below',
  mcap_above: 'Market cap rises above',
  mcap_below: 'Market cap falls below',
};

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
  const [risk, setRisk] = useState<RiskRead | null>(null);
  const [vtxOpen, setVtxOpen] = useState(false);
  const [vtx, setVtx] = useState<VtxRead | null>(null);
  const [vtxLoading, setVtxLoading] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [alerts, setAlerts] = useState<CoinAlert[]>([]);
  const [alertKind, setAlertKind] = useState<AlertKind>('price_above');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertBusy, setAlertBusy] = useState(false);

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

  // Rug-risk read (real token-security signal, honest 'unknown' when no data).
  useEffect(() => {
    if (!coin) return;
    let alive = true;
    fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/risk`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive && j?.level) setRisk({ level: j.level, reasons: Array.isArray(j.reasons) ? j.reasons : [] }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [coin, chain, address]);

  // VTX take: loaded on demand so it never blocks the page.
  const openVtx = useCallback(async () => {
    setVtxOpen((o) => !o);
    if (vtx || vtxLoading) return;
    setVtxLoading(true);
    try {
      const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/vtx`, { cache: 'no-store' });
      const j = await r.json();
      setVtx(j && typeof j.available === 'boolean' ? j : { available: false, reason: 'AI read unavailable' });
    } catch {
      setVtx({ available: false, reason: 'AI read unavailable' });
    } finally { setVtxLoading(false); }
  }, [vtx, vtxLoading, chain, address]);

  const loadAlerts = useCallback(async () => {
    try {
      const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/alerts`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setAlerts(Array.isArray(j.alerts) ? j.alerts : []);
    } catch { /* ignore */ }
  }, [chain, address]);

  const toggleBell = () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) void loadAlerts();
  };

  const createAlert = async () => {
    const threshold = Number(alertThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    setAlertBusy(true);
    try {
      const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/alerts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: alertKind, threshold }),
      });
      if (r.ok) { const j = await r.json(); if (j.alert) setAlerts((a) => [j.alert, ...a]); setAlertThreshold(''); }
    } catch { /* ignore */ } finally { setAlertBusy(false); }
  };

  const removeAlert = async (id: string) => {
    setAlerts((a) => a.filter((x) => x.id !== id));
    try { await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/alerts?id=${id}`, { method: 'DELETE' }); }
    catch { void loadAlerts(); }
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
        <div className="relative">
          <button type="button" onClick={toggleBell} aria-label="Price alerts" className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06]">
            <Bell className={`w-[18px] h-[18px] ${alerts.some((a) => a.active) ? 'fill-[#0066FF]/30 text-[#3B9EFF]' : ''}`} />
          </button>
          <AnimatePresence>
            {bellOpen ? (
              <>
                <button type="button" aria-label="Close alerts" onClick={() => setBellOpen(false)} className="fixed inset-0 z-30 cursor-default" />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-11 z-40 w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-2xl nl-glass p-3.5 shadow-[0_20px_50px_-20px_rgba(0,102,255,.6)]"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="text-[13px] font-semibold text-white inline-flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-[#3B9EFF]" /> Alert me when</div>
                    <button type="button" onClick={() => setBellOpen(false)} aria-label="Close" className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  {!signedIn ? (
                    <div className="text-[12px] text-white/50 py-1.5">Sign in to set price and market-cap alerts.</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {(Object.keys(ALERT_KIND_LABEL) as AlertKind[]).map((k) => (
                          <button key={k} type="button" onClick={() => setAlertKind(k)}
                            className={`text-left text-[11px] leading-tight rounded-lg px-2 py-1.5 border ${alertKind === k ? 'border-[#0066FF]/60 bg-[#0066FF]/10 text-white' : 'border-white/10 text-white/55 hover:text-white/80'}`}>
                            {ALERT_KIND_LABEL[k]}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center rounded-lg bg-white/[0.05] border border-white/10 px-2.5 py-1.5">
                          <span className="text-white/40 text-[13px] mr-1">$</span>
                          <input
                            inputMode="decimal" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder={alertKind.startsWith('price') ? 'price' : 'market cap'}
                            className="w-full bg-transparent outline-none text-[13px] text-white placeholder:text-white/30 tabular-nums"
                          />
                        </div>
                        <button type="button" onClick={createAlert} disabled={alertBusy || !alertThreshold}
                          className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-[#0066FF] text-white disabled:opacity-40 hover:bg-[#0a72ff]">
                          {alertBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set'}
                        </button>
                      </div>
                      {alerts.length > 0 ? (
                        <div className="mt-2.5 space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                          {alerts.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] text-white/80 truncate">{ALERT_KIND_LABEL[a.kind]} <span className="text-white tabular-nums">{compactUsd(Number(a.threshold))}</span></div>
                                <div className="text-[10px] text-white/40">{a.active ? 'Armed' : a.triggered_at ? 'Triggered' : 'Off'}</div>
                              </div>
                              <button type="button" onClick={() => removeAlert(a.id)} aria-label="Remove alert" className="text-white/40 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-white/40">No alerts set yet.</div>
                      )}
                    </>
                  )}
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
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
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mt-4 mb-2 text-[12px] ${coin.verified ? 'bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300' : 'bg-amber-500/[0.08] border border-amber-500/20 text-amber-200/90'}`}>
          {coin.verified ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
          <span>{coin.verified ? 'Verified by Naka. Still a volatile asset, trade with care.' : 'Unverified coin. Anyone can launch a coin, so trade with heightened caution.'}</span>
        </div>

        {/* Rug-risk chip: real token-security read, honest 'unknown' when no data. */}
        {risk ? (
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-2 text-[12px] ${
            risk.level === 'high' ? 'bg-rose-500/[0.08] border border-rose-500/20 text-rose-300'
              : risk.level === 'medium' ? 'bg-amber-500/[0.08] border border-amber-500/20 text-amber-200/90'
              : risk.level === 'low' ? 'bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300'
              : 'bg-white/[0.04] border border-white/10 text-white/55'}`}>
            {risk.level === 'high' ? <ShieldAlert className="w-4 h-4 shrink-0" /> : risk.level === 'low' ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <Shield className="w-4 h-4 shrink-0" />}
            <span className="min-w-0">
              {risk.level === 'unknown'
                ? 'Rug-risk read unavailable right now.'
                : (<><span className="font-semibold">Rug risk: {risk.level === 'high' ? 'High' : risk.level === 'medium' ? 'Elevated' : 'Low'}.</span>{risk.reasons[0] ? <span className="text-white/60"> {risk.reasons.slice(0, 2).join('. ')}.</span> : null}</>)}
            </span>
          </div>
        ) : null}

        {/* VTX take: an on-demand AI read that never blocks page load. */}
        <button
          type="button" onClick={openVtx} aria-expanded={vtxOpen}
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 mb-2 text-[12px] font-semibold nl-glass text-[#7FB2FF] hover:text-white transition-colors"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>VTX take</span>
          <span className="ml-auto text-[11px] font-normal text-white/40">{vtxOpen ? 'Hide' : 'Read'}</span>
        </button>
        <AnimatePresence initial={false}>
          {vtxOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }} className="overflow-hidden"
            >
              <div className="rounded-2xl nl-glass p-3.5 mb-2">
                {vtxLoading ? (
                  <div className="flex items-center gap-2 text-white/50 text-[12px] py-1"><Loader2 className="w-4 h-4 animate-spin" /> Reading the on-chain data.</div>
                ) : vtx?.available ? (
                  <>
                    <p className="text-[13px] leading-relaxed text-white/85">{vtx.summary}</p>
                    {vtx.flags && vtx.flags.length > 0 ? (
                      <div className="mt-2.5 space-y-1.5">
                        {vtx.flags.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 text-[12px]">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${f.kind === 'strength' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span className="text-white/75">{f.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2.5 text-[10px] text-white/35">VTX synthesizes live data. Not financial advice.</p>
                  </>
                ) : (
                  <div className="text-[12px] text-white/50 py-1">{vtx?.reason || 'AI read unavailable'}.</div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mb-4">
          <TradeCard coin={coin} livePrice={live.price} liveMcap={live.marketCap} />
        </div>
      </div>
    </div>
    </AuroraBackground>
  );
}
