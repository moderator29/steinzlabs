"use client";

import { use, useState } from "react";
import { Star, Bell, Share2, Shield, Brain, X, ArrowUpRight, ArrowDownLeft, Repeat, ShoppingCart } from "lucide-react";
import TokenIntelligencePanel from "@/components/market/TokenIntelligencePanel";
import TradingViewChart, { getTradingViewSymbol } from "@/components/TradingViewChart";
import { BackButton } from "@/components/ui/BackButton";
import { BuySellModal } from "@/components/market/BuySellModal";
import { useTokenDetail } from "@/hooks/market/useTokenDetail";
import { useWatchlist } from "@/hooks/market/useWatchlist";
import { useAuth } from "@/lib/hooks/useAuth";
import { TokenLogo } from "@/components/market/TokenLogo";
import { PriceChangeDisplay } from "@/components/market/PriceChangeDisplay";
import { AlertModal } from "@/components/market/AlertModal";
import { formatPrice, formatLargeNumber } from "@/lib/market/formatters";

interface RouteParams {
  chain: string;
  address: string;
}

/**
 * §4.7 / §6.3: Coin Detail Page.
 *
 * REPLACED the old TradingTerminalLayout (OpenOrders / History / Positions
 * / DCA / Stop tabs) per product spec ("DELETE that stupid trading
 * terminal from my Naka wallet"). Keeps: identity bar, live price,
 * TradingView chart with native 1H/1D/1W/1M timeframe buttons,
 * Send / Receive / Swap / Buy / Sell action row, token stats row,
 * Token Intelligence drawer, watchlist + alerts.
 *
 * `address` is either a CoinGecko id ("bitcoin", "ethereum") or a
 * contract address on the given chain. BuySellModal resolves symbols
 * to real contract addresses via lib/market/tokenResolver before hitting
 * 0x (Img 17 fix).
 */
export default function CoinDetailPage({ params }: { params: Promise<RouteParams> }) {
  const { chain, address } = use(params);
  const { user } = useAuth();
  const { detail, loading } = useTokenDetail(address);
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);
  const [showAlert, setShowAlert] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  const [buySellMode, setBuySellMode] = useState<'BUY' | 'SELL' | null>(null);

  const md = detail?.market_data;
  const price = md?.current_price?.usd ?? 0;
  const change24h = md?.price_change_percentage_24h ?? 0;
  const symbol = detail?.symbol?.toUpperCase() ?? address.slice(0, 6).toUpperCase();
  const name = detail?.name ?? address;
  const logo = detail?.image?.small;

  const watched = isWatched(address);

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0E1A] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <BackButton href="/dashboard/market" />
          <TokenLogo src={logo} symbol={symbol} size={32} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate">{name}</span>
              <span className="text-[10px] uppercase text-slate-500">{symbol}</span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 bg-slate-800/60 rounded text-slate-400">
                {chain}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-baseline gap-3 ml-2">
            <span className="text-xl font-mono font-bold tabular-nums">
              {loading ? "—" : formatPrice(price)}
            </span>
            <PriceChangeDisplay value={change24h} size="sm" />
          </div>

          <div className="hidden lg:flex items-center gap-4 ml-4 text-[11px] font-mono text-slate-400">
            <Stat label="Mcap" value={md?.market_cap?.usd ? formatLargeNumber(md.market_cap.usd) : "—"} />
            <Stat label="Vol" value={md?.total_volume?.usd ? formatLargeNumber(md.total_volume.usd) : "—"} />
            <Stat label="FDV" value={md?.fully_diluted_valuation?.usd ? formatLargeNumber(md.fully_diluted_valuation.usd) : "—"} />
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* Phase 10: Intelligence toggle — the feature that makes this beat Binance/MEXC/CheckPrice. */}
            <button
              type="button"
              onClick={() => setShowIntel((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                showIntel
                  ? 'bg-[#0A1EFF]/15 text-[#8FA3FF] border border-[#0A1EFF]/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-transparent'
              }`}
              title="Token intelligence"
            >
              <Brain size={14} />
              <span className="hidden sm:inline">Intel</span>
            </button>
            <IconAction
              title="Security"
              onClick={() => {
                const el = document.getElementById("right-tabs-security");
                el?.click();
              }}
              icon={<Shield size={16} />}
            />
            <IconAction
              title={watched ? "Unwatch" : "Watch"}
              onClick={() => toggleWatchlist(address)}
              icon={
                <Star
                  size={16}
                  className={watched ? "fill-yellow-400 text-yellow-400" : ""}
                />
              }
            />
            <IconAction title="Alerts" onClick={() => setShowAlert(true)} icon={<Bell size={16} />} />
            <IconAction
              title="Share"
              onClick={async () => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  await navigator.share({
                    title: `${name} on Naka Labs`,
                    url: window.location.href,
                  }).catch(() => {});
                } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                  await navigator.clipboard.writeText(window.location.href).catch(() => {});
                }
              }}
              icon={<Share2 size={16} />}
            />
          </div>
        </div>

        {/* Mobile live price strip */}
        <div className="flex md:hidden items-center gap-3 px-4 pb-3">
          <span className="text-xl font-mono font-bold tabular-nums">
            {loading ? "—" : formatPrice(price)}
          </span>
          <PriceChangeDisplay value={change24h} size="sm" />
        </div>
      </div>

      {/* Coin detail body + intelligence rail */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Chart — TradingView widget with built-in 1h/1d/1w/1m timeframe + crosshair */}
          <div className="h-[420px] md:h-[520px] border-b border-slate-800/50">
            <TradingViewChart
              symbol={getTradingViewSymbol(symbol) ?? `${symbol}USD`}
              interval="D"
              height={520}
              showTools
            />
          </div>

          {/* Action row — matches Trust Wallet coin detail layout */}
          <div className="grid grid-cols-4 gap-2 p-4 border-b border-slate-800/50 bg-slate-950/40">
            <ActionButton
              icon={<ArrowUpRight size={18} />}
              label="Send"
              onClick={() => (window.location.href = `/dashboard/wallet-page?action=send&token=${symbol}&chain=${chain}`)}
            />
            <ActionButton
              icon={<ArrowDownLeft size={18} />}
              label="Receive"
              onClick={() => (window.location.href = `/dashboard/wallet-page?action=receive&chain=${chain}`)}
            />
            <ActionButton
              icon={<Repeat size={18} />}
              label="Swap"
              onClick={() => setBuySellMode('SELL')}
            />
            <ActionButton
              icon={<ShoppingCart size={18} />}
              label="Buy"
              primary
              onClick={() => setBuySellMode('BUY')}
            />
          </div>

          {/* Token stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-slate-800/50">
            <StatCell label="Market Cap" value={md?.market_cap?.usd ? `$${formatLargeNumber(md.market_cap.usd)}` : '—'} />
            <StatCell label="24h Volume" value={md?.total_volume?.usd ? `$${formatLargeNumber(md.total_volume.usd)}` : '—'} />
            <StatCell label="FDV" value={md?.fully_diluted_valuation?.usd ? `$${formatLargeNumber(md.fully_diluted_valuation.usd)}` : '—'} />
            <StatCell label="Supply" value={md?.circulating_supply ? formatLargeNumber(md.circulating_supply) : '—'} />
          </div>

          {/* Contract + chain metadata */}
          <div className="p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Contract</span>
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(address).catch(() => {});
                  }
                }}
                className="font-mono text-slate-300 hover:text-white truncate max-w-[280px] text-right"
                title="Copy"
              >
                {address}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Network</span>
              <span className="text-slate-300 uppercase">{chain}</span>
            </div>
          </div>
        </div>

        {/* Desktop: pinned right rail */}
        {showIntel && (
          <aside className="hidden lg:block w-[340px] shrink-0 border-l border-slate-800/50 bg-slate-950/40 overflow-y-auto p-3">
            <TokenIntelligencePanel address={address} chain={chain} symbol={symbol} />
          </aside>
        )}
      </div>

      {/* Mobile: bottom sheet */}
      {showIntel && (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end">
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

      {showAlert && detail && (
        <AlertModal
          tokenId={address}
          symbol={symbol}
          currentPrice={price}
          onAdd={async () => setShowAlert(false)}
          onClose={() => setShowAlert(false)}
        />
      )}

      {buySellMode && detail && (
        <BuySellModal
          symbol={symbol}
          name={name}
          logo={logo}
          priceUSD={price}
          chain={chain}
          tokenAddress={address}
          userId={user?.id}
          initialMode={buySellMode}
          onClose={() => setBuySellMode(null)}
        />
      )}
    </div>
  );
}

function ActionButton({
  icon, label, primary, onClick,
}: { icon: React.ReactNode; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl font-semibold text-[11px] transition-colors ${
        primary
          ? 'bg-[#0A1EFF] hover:bg-[#0A1EFF]/90 text-white shadow-[0_0_12px_rgba(10,30,255,0.35)]'
          : 'bg-slate-900/70 hover:bg-slate-800 text-slate-200 border border-slate-800'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 border-r border-b border-slate-800/50 last:border-r-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-mono font-semibold text-white mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-600 mr-1.5">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function IconAction({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
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
