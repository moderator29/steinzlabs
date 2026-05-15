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

import { use, useState } from "react";
import { Star, Bell, Share2, Brain, X } from "lucide-react";
import TokenIntelligencePanel from "@/components/market/TokenIntelligencePanel";
import TradingViewChart, { getTradingViewSymbol } from "@/components/TradingViewChart";
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

export default function CoinDetailPage({ params }: { params: Promise<RouteParams> }) {
  const { chain, address } = use(params);
  const { user } = useAuth();
  const { theme } = useTheme();
  const { detail, loading } = useTokenDetail(address);
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);
  const [showAlert, setShowAlert] = useState(false);
  const [showIntel, setShowIntel] = useState(false);

  const md = detail?.market_data;
  const price = md?.current_price?.usd ?? 0;
  const change1h = (md as any)?.price_change_percentage_1h_in_currency?.usd ?? 0;
  const change24h = md?.price_change_percentage_24h ?? 0;
  const volume24h = md?.total_volume?.usd ?? 0;
  const marketCap = md?.market_cap?.usd ?? 0;
  const fdv = md?.fully_diluted_valuation?.usd ?? 0;
  const dex = (detail as any)?._dex as { volume_m5?: number; buys_h24?: number; sells_h24?: number } | undefined;
  const vol5m = dex?.volume_m5;
  const buys24h = dex?.buys_h24;
  const sells24h = dex?.sells_h24;
  const symbol = detail?.symbol?.toUpperCase() ?? address.slice(0, 6).toUpperCase();
  const name = detail?.name ?? address;
  const logo = detail?.image?.small;
  const watched = isWatched(address);

  return (
    <div className="flex flex-col min-h-screen text-white pb-20 md:pb-0">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <BackButton href="/dashboard/market" />
          <TokenLogo src={logo} symbol={symbol} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate">{name}</span>
              <span className="text-[10px] uppercase text-slate-500">{symbol}</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 bg-slate-800/60 rounded text-slate-400">{chain}</span>
            </div>
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
                      className="inline-flex items-center gap-0.5 ml-1.5 text-amber-300 hover:text-amber-200"
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
                showIntel ? 'bg-[#0A1EFF]/15 text-[#8FA3FF] border border-[#0A1EFF]/40' : 'bg-slate-900/60 text-slate-400 hover:text-white border border-transparent'
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
            {loading ? '—' : formatPrice(price)}
          </span>
          <PriceChangeDisplay value={change24h} size="sm" />
          <div className="h-4 w-px bg-slate-800/60 hidden md:block" />
          <StatInline label="1h" value={change1h != null ? `${change1h >= 0 ? '+' : ''}${change1h.toFixed(2)}%` : '—'} tone={change1h >= 0 ? 'up' : 'down'} />
          <StatInline label="24h" value={`${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`} tone={change24h >= 0 ? 'up' : 'down'} />
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
          {/* Chart */}
          <div className="h-[380px] md:h-[560px] border-b border-slate-800/50">
            <TradingViewChart
              symbol={getTradingViewSymbol(symbol) ?? `${symbol}USD`}
              interval="15"
              height={560}
              showTools
              theme={theme}
            />
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
                    className="font-mono text-slate-300 hover:text-white truncate max-w-[280px] text-right"
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
        <aside className="hidden md:block w-[320px] shrink-0 border-l border-slate-800/50 bg-slate-950/40 overflow-y-auto p-3 space-y-3">
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
            <div className="relative w-full max-h-[85vh] bg-[#05081E] border-t border-white/10 rounded-t-2xl overflow-y-auto p-4 shadow-2xl">
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
      <PortfolioHistoryPanel />

      {showAlert && detail && (
        <AlertModal
          tokenId={address}
          symbol={symbol}
          currentPrice={price}
          onAdd={async () => setShowAlert(false)}
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
