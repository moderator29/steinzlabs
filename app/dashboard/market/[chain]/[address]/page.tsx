"use client";

/**
 * §5.5 — Coin Detail Page, redesigned to match checkprice.com layout.
 *
 * Desktop (md+):
 *   [ Header with back, name/symbol, badges, watchlist/alert/share ]
 *   [ Stats strip: price, 1h, 24h, 5m VOL, 24h VOL, 24h BUY, 24h SELL ]
 *   ┌─────────────────────────────────┬──────────────────────┐
 *   │   TradingView chart + timeframe │  Inline Buy/Sell     │
 *   │   (volume bars built into TV)   │  Recent Trades LIVE  │
 *   └─────────────────────────────────┴──────────────────────┘
 *   [ Contract + network metadata footer ]
 *
 * Mobile:
 *   [ Price + 24h % ] — large, top of page
 *   [ TradingView chart full width ]
 *   [ Stats compact grid ]
 *   [ Inline Buy/Sell form ]
 *   [ Recent Trades collapsible ]
 *
 * The old terminal TradingTerminalLayout (OpenOrders / Positions /
 * DCA / Stop) is gone — that lives at /market/orders now (batch 6).
 */

import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Star, Bell, Share2, Brain, X, Maximize2, Minimize2, CandlestickChart as CandleIcon, LineChart as LineIcon, AreaChart as AreaIcon, BarChart3, Settings2 } from "lucide-react";
import SocialVelocityPill from "@/components/market/SocialVelocityPill";
import DuneIntelligenceStrip from "@/components/market/DuneIntelligenceStrip";
import TokenIntelligencePanel from "@/components/market/TokenIntelligencePanel";
import TradingViewChart, { getTradingViewSymbol, isKnownTradingViewSymbol } from "@/components/TradingViewChart";
import { AdvancedChart, type ChartType, type IndicatorConfig } from "@/components/trading/AdvancedChart";
import SecurityPanel from "@/components/market/SecurityPanel";
import { useTheme } from "@/lib/theme/ThemeProvider";
import InlineBuySellForm from "@/components/market/InlineBuySellForm";
import RecentTradesRail from "@/components/market/RecentTradesRail";
import BuySellRatioBar from "@/components/market/BuySellRatioBar";
import PortfolioHistoryPanel from "@/components/market/PortfolioHistoryPanel";
import { BackButton } from "@/components/ui/BackButton";
import { useTokenDetail } from "@/hooks/market/useTokenDetail";
import { useWatchlist } from "@/hooks/market/useWatchlist";
import { useAuth } from "@/lib/hooks/useAuth";
import { TokenLogo } from "@/components/market/TokenLogo";
import { PriceChangeDisplay } from "@/components/market/PriceChangeDisplay";
import { AlertModal } from "@/components/market/AlertModal";
import { formatPrice, formatLargeNumber } from "@/lib/market/formatters";
import { resolveWrappedAsset, explorerUrlFor } from "@/lib/market/wrappedAssets";
import { ExternalLink } from "lucide-react";

interface RouteParams {
  chain: string;
  address: string;
}

// Audit M3 — chart timeframe was hardcoded to "15" with no UI. Industry
// standard set: 1m / 5m / 15m / 1h / 4h / 1d / 1w (DexScreener / Birdeye
// / TradingView). Persisted per token in localStorage so a returning
// trader lands back on the timeframe they were studying.
const CHART_INTERVALS: { id: string; label: string }[] = [
  { id: '1',   label: '1m'  },
  { id: '5',   label: '5m'  },
  { id: '15',  label: '15m' },
  { id: '60',  label: '1h'  },
  { id: '240', label: '4h'  },
  { id: 'D',   label: '1d'  },
  { id: 'W',   label: '1w'  },
];

function readChartInterval(tokenKey: string): string {
  if (typeof window === 'undefined') return '15';
  try {
    const v = localStorage.getItem(`steinz_chart_tf_${tokenKey}`);
    return v && CHART_INTERVALS.some((i) => i.id === v) ? v : '15';
  } catch {
    return '15';
  }
}

// Map TradingView interval IDs to lib/services/ohlcv Timeframe shape so
// the off-CEX AdvancedChart honors the same toolbar as TradingView.
type AdvancedTf = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
function tfForAdvanced(tvInterval: string): AdvancedTf {
  switch (tvInterval) {
    case '1':   return '1m';
    case '5':   return '5m';
    case '15':  return '15m';
    case '60':  return '1h';
    case '240': return '4h';
    case 'D':   return '1d';
    case 'W':   return '1w';
    default:    return '15m';
  }
}

function writeChartInterval(tokenKey: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`steinz_chart_tf_${tokenKey}`, value);
  } catch {
    /* storage disabled (Safari private) — non-fatal */
  }
}

// Bug #1 (pro-chart coverage) — the off-CEX AdvancedChart branch used to
// be hardcoded to candlesticks + ema21/volume with no user controls, so
// every long-tail coin (i.e. everything not in the ~65-symbol TradingView
// map) rendered as a stripped-down "lesser" chart. It now ships the same
// pro controls the CEX widget has: chart type (candles / line / area /
// bars) + a full indicator menu (EMA / SMA / Bollinger / VWAP / RSI /
// MACD / volume), all persisted per token so a returning trader keeps
// their study setup. Data stays 100% real (DEX/CG OHLCV via
// /api/market/ohlcv) — no fabricated candles are ever synthesized.
const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'candlestick', label: 'Candles' },
  { id: 'line',        label: 'Line'    },
  { id: 'area',        label: 'Area'    },
  { id: 'bars',        label: 'Bars'    },
];

const INDICATOR_OPTIONS: { key: keyof IndicatorConfig; label: string }[] = [
  { key: 'ema9',      label: 'EMA 9'     },
  { key: 'ema21',     label: 'EMA 21'    },
  { key: 'ema50',     label: 'EMA 50'    },
  { key: 'ema200',    label: 'EMA 200'   },
  { key: 'sma20',     label: 'SMA 20'    },
  { key: 'sma50',     label: 'SMA 50'    },
  { key: 'sma200',    label: 'SMA 200'   },
  { key: 'bollinger', label: 'Bollinger' },
  { key: 'vwap',      label: 'VWAP'      },
  { key: 'rsi',       label: 'RSI'       },
  { key: 'macd',      label: 'MACD'      },
  { key: 'volume',    label: 'Volume'    },
];

const DEFAULT_INDICATORS: IndicatorConfig = { ema21: true, ema50: true, volume: true };
const VALID_CHART_TYPES: ChartType[] = ['candlestick', 'line', 'area', 'bars'];

function readChartType(tokenKey: string): ChartType {
  if (typeof window === 'undefined') return 'candlestick';
  try {
    const v = localStorage.getItem(`steinz_chart_type_${tokenKey}`);
    return v && VALID_CHART_TYPES.includes(v as ChartType) ? (v as ChartType) : 'candlestick';
  } catch {
    return 'candlestick';
  }
}

function writeChartType(tokenKey: string, value: ChartType): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`steinz_chart_type_${tokenKey}`, value); } catch { /* non-fatal */ }
}

function readIndicators(tokenKey: string): IndicatorConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_INDICATORS };
  try {
    const raw = localStorage.getItem(`steinz_chart_ind_${tokenKey}`);
    if (!raw) return { ...DEFAULT_INDICATORS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: IndicatorConfig = {};
    for (const { key } of INDICATOR_OPTIONS) {
      if (typeof parsed[key] === 'boolean') out[key] = parsed[key] as boolean;
    }
    return Object.keys(out).length > 0 ? out : { ...DEFAULT_INDICATORS };
  } catch {
    return { ...DEFAULT_INDICATORS };
  }
}

function writeIndicators(tokenKey: string, value: IndicatorConfig): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`steinz_chart_ind_${tokenKey}`, JSON.stringify(value)); } catch { /* non-fatal */ }
}

export default function CoinDetailPage({ params }: { params: Promise<RouteParams> }) {
  const { chain, address } = use(params);
  const { user } = useAuth();
  const { theme } = useTheme();
  const { detail, loading } = useTokenDetail(address);
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);
  const [showAlert, setShowAlert] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  // Per-token timeframe persistence — keyed on chain:address so BTC at
  // 4h doesn't bleed into ETH on the same browser.
  const tokenKey = `${chain}:${address}`;
  const [chartInterval, setChartInterval] = useState<string>(() => readChartInterval(tokenKey));
  const [chartFullscreen, setChartFullscreen] = useState(false);
  // Bug #1 — pro-chart controls for the off-CEX AdvancedChart branch.
  const [chartType, setChartType] = useState<ChartType>(() => readChartType(tokenKey));
  const [indicators, setIndicators] = useState<IndicatorConfig>(() => readIndicators(tokenKey));
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);

  // Audit M8 #9 — preload the TradingView script so by the time the
  // dynamic chart import resolves, the widget code is already in the
  // browser cache. Costs us nothing on cold start (DNS + TCP only).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('tv-preload-link')) return;
    const link = document.createElement('link');
    link.id = 'tv-preload-link';
    link.rel = 'preload';
    link.as = 'script';
    link.href = 'https://s3.tradingview.com/tv.js';
    document.head.appendChild(link);
  }, []);

  const handleIntervalChange = (id: string) => {
    setChartInterval(id);
    writeChartInterval(tokenKey, id);
  };

  const handleChartTypeChange = (t: ChartType) => {
    setChartType(t);
    writeChartType(tokenKey, t);
  };

  const handleIndicatorToggle = (key: keyof IndicatorConfig) => {
    setIndicators((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeIndicators(tokenKey, next);
      return next;
    });
  };

  const md = detail?.market_data;
  const price = md?.current_price?.usd ?? 0;
  const change1h = (md as any)?.price_change_percentage_1h_in_currency?.usd ?? 0;
  const change24h = md?.price_change_percentage_24h ?? 0;
  const volume24h = md?.total_volume?.usd ?? 0;
  const marketCap = md?.market_cap?.usd ?? 0;
  const fdv = md?.fully_diluted_valuation?.usd ?? 0;
  const dex = (detail as any)?._dex as {
    volume_m5?: number;
    volume_h1?: number;
    volume_h6?: number;
    volume_h24?: number;
    buys_h24?: number;
    sells_h24?: number;
    // Audit P1 #17 — full DexScreener tier strip
    change_m5?: number | null;
    change_h1?: number | null;
    change_h6?: number | null;
    change_h24?: number | null;
    // Audit P1 #20 — used by AdvancedChart fallback below
    pair_address?: string;
    liquidity_usd?: number | null;
  } | undefined;
  const vol5m = dex?.volume_m5;
  const buys24h = dex?.buys_h24;
  const sells24h = dex?.sells_h24;
  // Prefer DexScreener pair-level tiers when available; fall back to
  // CoinGecko's coarser percentages so the strip never goes blank for
  // major tokens that aren't in DexScreener.
  const change5m = dex?.change_m5 ?? null;
  const change6h = dex?.change_h6 ?? null;
  const change1hUnified = dex?.change_h1 ?? change1h;
  const change24hUnified = dex?.change_h24 ?? change24h;
  const symbol = detail?.symbol?.toUpperCase() ?? address.slice(0, 6).toUpperCase();
  const name = detail?.name ?? address;
  const logo = detail?.image?.small;
  const watched = isWatched(address);
  // Bug #1 — only route to the real TradingView (Binance/Bybit) widget when
  // we have a VERIFIED CEX symbol. Guessing BINANCE:{SYM}USDT for an
  // unlisted coin would render "Invalid symbol" or, worse, a same-ticker
  // DIFFERENT coin's chart (fake data). Everything else uses AdvancedChart,
  // which now ships the full pro toolbar and renders REAL DEX/CG candles.
  // Wait for detail to load so we branch on the real ticker, not the
  // address slice — avoids a first-paint flip from Advanced → widget.
  const useWidget = !!detail && isKnownTradingViewSymbol(symbol);

  return (
    <div className="flex flex-col min-h-screen text-white pb-20 md:pb-0">
      {/* Top bar */}
      <div className="sticky top-0 z-20 nl-glass rounded-none" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
        {/* Bug §6.6 — breadcrumb above the back button gives users an
            explicit two-level escape (Dashboard / Market / {Token}) so
            they're never stuck on a coin detail page without a way back
            to the dashboard root. Each level routes via next/link so the
            browser back button continues to work normally. */}
        <nav aria-label="Breadcrumb" className="px-4 pt-2 text-[11px] text-slate-500 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <a href="/dashboard" className="hover:text-slate-200 transition-colors">Dashboard</a>
          <span className="text-slate-700">/</span>
          <a href="/dashboard/market" className="hover:text-slate-200 transition-colors">Market</a>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 truncate max-w-[40vw]">{name || symbol || 'Token'}</span>
        </nav>
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Trading-terminal back button — owner reported it as
              'stuck' because the hardcoded href always shoved the
              user to /dashboard/market regardless of where they came
              from. Without the href the component uses router.back()
              and falls back to /dashboard if history is empty, so the
              user lands on the page they were actually on (portfolio,
              dashboard, search, whales). The breadcrumb above still
              shows the semantic location for orientation. */}
          <BackButton />
          <TokenLogo src={logo} symbol={symbol} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate">{name}</span>
              <span className="text-[10px] uppercase text-slate-500">{symbol}</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 bg-slate-800/60 rounded text-slate-400">{chain}</span>
              <SocialVelocityPill symbol={symbol} />
            </div>
            {/* §5.6 Trading Terminal — Dune-derived intelligence strip
                (holder concentration, wash-trade score, smart-money 24h
                net flow). Auto-hides when Dune is unprovisioned. */}
            <DuneIntelligenceStrip chain={chain} address={address} className="mt-2" />
            {/* Audit B4 / P0 — wrapped-asset honesty label. When the
                canonical asset (BTC, ETH on L2, etc) is not native to
                the page chain, surface the actual contract being
                traded + the issuer + verify link. Replaces the
                misleading "Network: ETHEREUM · Contract: bitcoin"
                three-line lie. */}
            {(() => {
              const wrap = resolveWrappedAsset(symbol, chain);
              if (!wrap) return null;
              const explorer = explorerUrlFor(wrap);
              return (
                <div className="text-[10px] text-amber-300/90 mt-0.5 truncate">
                  Trading <span className="font-semibold">{wrap.wrappedSymbol}</span> on {wrap.chain}
                  <span className="text-slate-500"> · wraps {wrap.canonicalSymbol} {wrap.backingRatio}:1 by {wrap.issuer}</span>
                  {explorer && (
                    <a
                      href={explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ms-1.5 text-amber-300 hover:text-amber-200"
                      title={`Verify ${wrap.wrappedSymbol} contract on the explorer`}
                    >
                      verify <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowIntel((v) => !v)}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                showIntel ? 'bg-[#0066FF]/15 text-[#8FA3FF] border border-[#0066FF]/40' : 'bg-slate-900/60 text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Brain size={13} /> Intel
            </button>
            <IconBtn title={watched ? "Unwatch" : "Watch"} onClick={() => toggleWatchlist(address)} icon={<Star size={16} className={watched ? 'fill-yellow-400 text-yellow-400' : ''} />} />
            <IconBtn title="Alerts" onClick={() => setShowAlert(true)} icon={<Bell size={16} />} />
            <IconBtn
              title="Share"
              onClick={async () => {
                if (typeof navigator !== 'undefined' && navigator.share) {
                  await navigator.share({ title: `${name} on Naka Labs`, url: window.location.href }).catch(() => {});
                } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText(window.location.href).catch(() => {});
                }
              }}
              icon={<Share2 size={16} />}
            />
          </div>
        </div>

        {/* Checkprice-style stats strip */}
        <div className="flex items-center gap-4 px-4 pb-3 overflow-x-auto text-xs whitespace-nowrap">
          <span className="text-lg md:text-xl font-mono font-bold tabular-nums">
            {/* Honest price: show — while loading AND when the source has no
                real price (price <= 0), never a fabricated $0.00. */}
            {loading ? '—' : price > 0 ? formatPrice(price) : '—'}
          </span>
          <PriceChangeDisplay value={change24hUnified} size="sm" />
          <div className="h-4 w-px bg-slate-800/60 hidden md:block" />
          {/*
            Audit P1 #17 — DexScreener parity: 5m / 1h / 6h / 24h tier
            strip. Each tier hides when its source is missing rather
            than rendering "—" so we don't pad the row with empty cells
            on tokens CoinGecko serves without DexScreener pair data.
          */}
          {change5m != null && (
            <StatInline label="5m" value={`${change5m >= 0 ? '+' : ''}${change5m.toFixed(2)}%`} tone={change5m >= 0 ? 'up' : 'down'} />
          )}
          <StatInline label="1h" value={change1hUnified != null ? `${change1hUnified >= 0 ? '+' : ''}${change1hUnified.toFixed(2)}%` : '—'} tone={change1hUnified >= 0 ? 'up' : 'down'} />
          {change6h != null && (
            <StatInline label="6h" value={`${change6h >= 0 ? '+' : ''}${change6h.toFixed(2)}%`} tone={change6h >= 0 ? 'up' : 'down'} />
          )}
          <StatInline label="24h" value={`${change24hUnified >= 0 ? '+' : ''}${change24hUnified.toFixed(2)}%`} tone={change24hUnified >= 0 ? 'up' : 'down'} />
          <StatInline label="5m Vol" value={vol5m != null && vol5m > 0 ? `$${formatLargeNumber(vol5m)}` : '—'} />
          <StatInline label="24h Vol" value={volume24h ? `$${formatLargeNumber(volume24h)}` : '—'} />
          <StatInline label="24h Buy" value={buys24h != null && buys24h > 0 ? formatLargeNumber(buys24h) : '—'} tone={buys24h && buys24h > 0 ? 'up' : undefined} />
          <StatInline label="24h Sell" value={sells24h != null && sells24h > 0 ? formatLargeNumber(sells24h) : '—'} tone={sells24h && sells24h > 0 ? 'down' : undefined} />
          <StatInline label="Mcap" value={marketCap ? `$${formatLargeNumber(marketCap)}` : '—'} />
          <StatInline label="FDV" value={fdv ? `$${formatLargeNumber(fdv)}` : '—'} />
        </div>
      </div>

      {/* Body — checkprice-style 2-column on desktop, stacked on mobile */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div className="flex-1 min-w-0 flex flex-col">
          {/*
            Audit M3 — interval selector + fullscreen toggle. Restored
            from main after the rebase dropped the toolbar; selection
            persists per token via localStorage.

            Audit P1 #20 — chart routing. TradingViewChart silently 404s
            for off-CEX tokens (Naka Go, Pleasure Coin, every long-tail
            asset). For those we render AdvancedChart, which fetches
            OHLCV directly from the actual DEX pair via the contract
            address. tfForAdvanced maps TradingView's interval IDs to
            the lib/services/ohlcv Timeframe shape so the same toolbar
            controls both renderers.
          */}
          <div className={
            chartFullscreen
              ? 'fixed inset-0 z-[80] bg-slate-950 flex flex-col'
              : 'flex flex-col border-b border-slate-800/50'
          }>
            <div className="flex items-center justify-between px-3 py-2 nl-glass rounded-none gap-2" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {CHART_INTERVALS.map((tf) => {
                  const active = tf.id === chartInterval;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => handleIntervalChange(tf.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex-shrink-0 ${
                        active
                          ? 'bg-[#0066FF]/20 text-[#8FA3FF] border border-[#0066FF]/40'
                          : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                      aria-pressed={active}
                    >
                      {tf.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Bug #1 — chart-type + indicator controls. The real
                    TradingView widget carries its own native top/side
                    toolbar, so these only render for the AdvancedChart
                    (off-CEX) branch, giving every long-tail coin the same
                    pro study tools as the BTC widget. */}
                {!useWidget && (
                  <>
                    <div className="flex items-center gap-0.5">
                      {CHART_TYPES.map((ct) => {
                        const active = ct.id === chartType;
                        const Icon = ct.id === 'candlestick' ? CandleIcon : ct.id === 'line' ? LineIcon : ct.id === 'area' ? AreaIcon : BarChart3;
                        return (
                          <button
                            key={ct.id}
                            type="button"
                            onClick={() => handleChartTypeChange(ct.id)}
                            title={ct.label}
                            aria-label={ct.label}
                            aria-pressed={active}
                            className={`p-1.5 rounded-md transition-colors ${
                              active ? 'bg-[#0066FF]/20 text-[#8FA3FF]' : 'text-slate-300 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <Icon size={14} />
                          </button>
                        );
                      })}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIndicatorsOpen((v) => !v)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/5"
                        aria-expanded={indicatorsOpen}
                      >
                        <Settings2 size={13} />
                        <span className="hidden sm:inline">Indicators</span>
                        <span className="text-[9px] font-mono text-[#8FA3FF]">
                          {INDICATOR_OPTIONS.filter((o) => indicators[o.key]).length}
                        </span>
                      </button>
                      {indicatorsOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setIndicatorsOpen(false)} aria-hidden />
                          <div className="absolute top-full right-0 mt-1 w-44 nl-glass rounded-lg shadow-2xl z-40 p-1 max-h-[60vh] overflow-y-auto" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
                            {INDICATOR_OPTIONS.map(({ key, label }) => {
                              const active = !!indicators[key];
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => handleIndicatorToggle(key)}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] rounded hover:bg-white/5 text-start transition-colors"
                                >
                                  <span className={active ? 'text-white' : 'text-slate-500'}>{label}</span>
                                  <span className={`w-3 h-3 rounded border ${active ? 'bg-[#0066FF]/80 border-[#4D6BFF]' : 'border-slate-700'}`} />
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setChartFullscreen((v) => !v)}
                  className="flex-shrink-0 p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/5"
                  title={chartFullscreen ? 'Exit fullscreen' : 'Fullscreen chart'}
                  aria-label={chartFullscreen ? 'Exit fullscreen' : 'Fullscreen chart'}
                >
                  {chartFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>
            <div className={chartFullscreen ? 'flex-1 min-h-0' : 'h-[380px] md:h-[560px]'}>
              {useWidget ? (
                <TradingViewChart
                  symbol={getTradingViewSymbol(symbol) ?? `${symbol}USD`}
                  interval={chartInterval}
                  height={chartFullscreen ? 0 : 560}
                  showTools
                  theme={theme}
                />
              ) : (
                <AdvancedChart
                  chain={chain}
                  token={address}
                  tf={tfForAdvanced(chartInterval)}
                  chartType={chartType}
                  indicators={indicators}
                  height={chartFullscreen ? 0 : 560}
                />
              )}
            </div>
          </div>

          {/* Mobile: inline Buy/Sell under the chart */}
          <div id="mobile-trade-form" className="md:hidden p-3 border-b border-slate-800/50 scroll-mt-4">
            <InlineBuySellForm
              symbol={symbol}
              chain={chain}
              tokenAddress={address}
              priceUSD={price}
              userId={user?.id}
            />
          </div>

          {/* Mobile: buy/sell ratio + recent trades */}
          {buys24h != null && sells24h != null && (buys24h + sells24h) > 0 && (
            <div className="md:hidden px-3 pt-3">
              <BuySellRatioBar buys={buys24h} sells={sells24h} />
            </div>
          )}
          <div className="md:hidden p-3">
            <RecentTradesRail pairAddress={address} chain={chain} />
          </div>
          {/* Audit P0 #5 — security panel surfaced on mobile under recent
              trades so a buyer can scan rug indicators without leaving
              the page. */}
          <div className="md:hidden px-3 pb-3">
            <SecurityPanel chain={chain} address={address} liquidityUsd={dex?.liquidity_usd ?? null} />
          </div>

          {/* Contract + network metadata. Audit B4 — when the page
              represents a wrapped asset (BTC on Ethereum → WBTC), the
              Contract row was rendering the raw URL slug ("bitcoin")
              while the Network row screamed "ETHEREUM" — both lying
              about what the user actually trades. We now render the
              wrapped asset's real contract address (the thing 0x will
              fill against) when applicable, and show a separate
              "Underlying" row pointing at the canonical asset. */}
          {(() => {
            const wrap = resolveWrappedAsset(symbol, chain);
            const traded = wrap?.contract ?? address;
            const tradedLabel = wrap?.wrappedSymbol ?? symbol;
            return (
              <div className="p-4 space-y-2 text-xs border-t border-slate-800/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Contract ({tradedLabel})</span>
                  <button
                    type="button"
                    onClick={() => { if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(traded).catch(() => {}); }}
                    className="font-mono text-slate-300 hover:text-white truncate max-w-[280px] text-end"
                    title="Copy"
                  >
                    {traded}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Network</span>
                  <span className="text-slate-300 uppercase">{chain}</span>
                </div>
                {wrap && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Underlying</span>
                    <span className="text-slate-300">
                      {wrap.canonicalSymbol} <span className="text-slate-500">({wrap.backingRatio}:1 by {wrap.issuer})</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Desktop right rail — buy/sell + recent trades */}
        <aside className="hidden md:block w-[320px] shrink-0 nl-glass rounded-none overflow-y-auto p-3 space-y-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
          <InlineBuySellForm
            symbol={symbol}
            chain={chain}
            tokenAddress={address}
            priceUSD={price}
            userId={user?.id}
          />
          {buys24h != null && sells24h != null && (buys24h + sells24h) > 0 && (
            <BuySellRatioBar buys={buys24h} sells={sells24h} />
          )}
          <SecurityPanel chain={chain} address={address} liquidityUsd={dex?.liquidity_usd ?? null} />
          <RecentTradesRail pairAddress={address} chain={chain} />
          {showIntel && (
            <div className="pt-2 border-t border-slate-800/50">
              <TokenIntelligencePanel address={address} chain={chain} symbol={symbol} />
            </div>
          )}
        </aside>

        {/* Mobile: Intel bottom sheet */}
        {showIntel && (
          <div className="md:hidden fixed inset-0 z-40 flex items-end">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowIntel(false)} />
            <div className="relative w-full max-h-[85vh] nl-glass rounded-t-2xl overflow-y-auto p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#8FA3FF]" />
                  <span className="font-bold">Token Intelligence</span>
                </div>
                <button onClick={() => setShowIntel(false)} className="p-1.5 rounded-lg hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <TokenIntelligencePanel address={address} chain={chain} symbol={symbol} />
            </div>
          </div>
        )}
      </div>

      {/* Batch 9 — Portfolio / Trade History bottom table (checkprice-style) */}
      {/* Audit M4 #7 — scope Portfolio + Trade History to THIS token by
          default. The component still ships a "Filter · All assets"
          toggle for users who want the cross-token view. */}
      <PortfolioHistoryPanel scopeSymbol={symbol} scopeAddress={address} />

      {showAlert && detail && (
        <AlertModal
          tokenId={address}
          symbol={symbol}
          currentPrice={price}
          onAdd={async (input) => {
            // Actually persist the alert (this was a no-op that just closed).
            await fetch('/api/market/alerts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token_id: input.token_id,
                token_symbol: input.token_symbol,
                target_price: input.target_price,
                direction: input.direction,
                chain,
              }),
            }).catch(() => {});
            setShowAlert(false);
          }}
          onClose={() => setShowAlert(false)}
        />
      )}

      {/* Mobile fixed Buy/Sell bottom bar — anchored to the viewport,
          keeps the primary trade actions always-reachable without
          scrolling. Hidden on md+ where the right rail has the full
          inline form. Links to the same BUY/SELL scroll target. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/95 backdrop-blur-xl px-3 py-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            document.getElementById('mobile-trade-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm"
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => {
            document.getElementById('mobile-trade-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-sm"
        >
          Sell
        </button>
      </div>
    </div>
  );
}

function StatInline({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  const color = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-red-400' : 'text-slate-200';
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`font-mono tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900/60 transition-colors"
    >
      {icon}
    </button>
  );
}
