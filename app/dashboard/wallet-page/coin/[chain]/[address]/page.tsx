"use client";

/**
 * Naka Wallet coin-detail page. Inspired by Trust Wallet's layout but
 * fully Naka-branded (brand blue primary, no green accents, no
 * Yellowcard/P2P fiat card):
 *
 *   [← back]       ETH / COIN · Ethereum              [★ watch]
 *                     $2,286.61
 *                     ↓ -$27.00 (-1.16%)
 *   [          line chart — real price history         ]
 *   [ 1H  1D  1W  1M  1Y  All ]
 *
 *   [ My Position · Activity ]
 *
 *   [  Send  ] [ Receive ] [  Swap  ]     ← fixed bottom
 *
 * Send + Receive deep-link to the existing wallet flows. Swap shows
 * a Coming Soon modal — the in-wallet swap pipeline is queued.
 * Buy + Sell removed (fiat on/off-ramp ships with Yellowcard later).
 */

import { use, useState, useEffect } from "react";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Repeat, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTokenDetail } from "@/hooks/market/useTokenDetail";
import { useWatchlist } from "@/hooks/market/useWatchlist";
import { useAuth } from "@/lib/hooks/useAuth";
import { useWallet } from "@/lib/hooks/useWallet";
import { formatPrice } from "@/lib/market/formatters";

interface RouteParams {
  chain: string;
  address: string;
}

type Tab = 'position' | 'activity';
type Timeframe = '1H' | '1D' | '1W' | '1M' | '1Y' | 'All';
const TIMEFRAMES: Timeframe[] = ['1H', '1D', '1W', '1M', '1Y', 'All'];
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'position', label: 'My Position' },
  { id: 'activity', label: 'Activity' },
];

export default function WalletCoinPage({ params }: { params: Promise<RouteParams> }) {
  const { chain, address } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { balance } = useWallet();
  const { detail, loading } = useTokenDetail(address);
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);

  const [tab, setTab] = useState<Tab>('position');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [comingSoonOpen, setComingSoonOpen] = useState<string | null>(null);
  const [chartPoints, setChartPoints] = useState<number[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const md = detail?.market_data;
  const price = md?.current_price?.usd ?? 0;
  const change24hPct = md?.price_change_percentage_24h ?? 0;
  const change24hAbs = (md as any)?.price_change_24h ?? 0;
  const symbol = detail?.symbol?.toUpperCase() ?? address.slice(0, 6).toUpperCase();
  const name = detail?.name ?? address;
  const isNegative = change24hPct < 0;
  const chainLabel = chain.charAt(0).toUpperCase() + chain.slice(1);
  const watched = isWatched(address);
  const balanceAmount = balance.tokens[symbol] ?? 0;
  const balanceUsd = balanceAmount * price;

  // Chart points — fetched from /api/market/token/[id]/chart with a days
  // window matched to the active timeframe button. Falls back to the 7d
  // sparkline baked into the token detail response so something renders
  // immediately while the chart call resolves.
  const sparklineData: number[] = (md as any)?.sparkline_7d?.price
    ?? (detail as any)?.sparkline_in_7d?.price
    ?? [];

  useEffect(() => {
    const days = timeframe === '1H' ? '1'
      : timeframe === '1D' ? '1'
      : timeframe === '1W' ? '7'
      : timeframe === '1M' ? '30'
      : timeframe === '1Y' ? '365'
      : 'max';
    let cancelled = false;
    setChartLoading(true);
    fetch(`/api/market/token/${address}/chart?days=${days}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { candles?: Array<{ close: number }> } | null) => {
        if (cancelled) return;
        if (data?.candles?.length) {
          setChartPoints(data.candles.map((c) => c.close));
        } else {
          setChartPoints([]);
        }
      })
      .catch(() => { if (!cancelled) setChartPoints([]); })
      .finally(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; };
  }, [address, timeframe]);

  const chartData = chartPoints.length > 1 ? chartPoints : sparklineData;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center flex-1">
          <div className="text-xl font-bold">{symbol}</div>
          <div className="text-[11px] text-slate-500">COIN · {chainLabel}</div>
        </div>
        <button onClick={() => toggleWatchlist(address)} className="p-2 -mr-2 rounded-lg hover:bg-white/5">
          <Star size={20} className={watched ? 'fill-emerald-400 text-emerald-400' : 'text-slate-500'} />
        </button>
      </div>

      {/* Gas + stakers row — stakers pill only for ETH (real stakers count
          is public: ETH2 has ~1M validators but the "45K stakers" line
          from the Trust Wallet reference is their own DEX integration
          and doesn't apply to generic tokens). Hide on non-ETH. */}
      {symbol.toUpperCase() === 'ETH' && (
        <div className="flex items-center justify-center gap-2 px-4 mb-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] bg-[#A78BFA]/15 px-2.5 py-1 rounded-full">
            <span>👥</span> ETH staking active
          </div>
        </div>
      )}

      {/* Price */}
      <div className="text-center py-6">
        <div className="text-3xl font-bold tabular-nums">{loading ? '—' : formatPrice(price)}</div>
        <div className={`inline-flex items-center gap-1 text-sm font-semibold mt-1 ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
          {isNegative ? '↓' : '↑'}
          <span className="font-mono">
            ${Math.abs(change24hAbs).toFixed(change24hAbs < 1 ? 5 : 2)} ({change24hPct >= 0 ? '+' : ''}{change24hPct.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Line chart — timeframe-driven. Uses /api/market/token/[id]/chart
          closes; falls back to 7d sparkline while loading. */}
      <div className="px-4 pb-4">
        <Sparkline data={chartData} negative={isNegative} loading={chartLoading && chartData.length === 0} />
      </div>

      {/* Timeframe tabs */}
      <div className="flex items-center justify-around px-4 mb-6 text-sm">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              timeframe === tf ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Tabs — kept lean: My Position (what the user holds) +
          Activity (their tx history for this token). About was
          removed per spec: users don't need a marketing blurb inside
          the wallet. */}
      <div className="flex items-center gap-6 px-4 border-b border-slate-800 mb-4 text-sm font-semibold">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 -mb-px border-b-2 transition-colors ${
              tab === t.id ? 'border-[#0A1EFF] text-white' : 'border-transparent text-slate-500 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 min-h-[140px]">
        {tab === 'position' && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">My Balance</p>
            {balanceAmount > 0 ? (
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-lg font-bold">{balanceAmount.toFixed(6)} {symbol}</div>
                  <div className="text-xs text-slate-400">{formatPrice(balanceUsd)}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">You don&apos;t hold any {symbol} yet.</p>
            )}
          </div>
        )}
        {tab === 'activity' && (
          <p className="text-sm text-slate-500">Your {symbol} activity on {chainLabel} will appear here once you transact.</p>
        )}
      </div>

      {/* Fixed bottom action bar — Send / Receive / Swap only.
          Buy + Sell removed per spec (they were Coming Soon stubs;
          fiat on/off-ramp ships with the Yellowcard integration).
          Send + Receive deep-link into the working wallet flows. */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-[#0A0E1A]/95 backdrop-blur-xl px-3 py-3 grid grid-cols-3 gap-2 z-40">
        <WalletAction icon={<ArrowUpRight size={16} />} label="Send" primary onClick={() => router.push(`/dashboard/wallet-page?action=send&token=${symbol}&chain=${chain}`)} />
        <WalletAction icon={<ArrowDownLeft size={16} />} label="Receive" onClick={() => router.push(`/dashboard/wallet-page?action=receive&chain=${chain}`)} />
        <WalletAction icon={<Repeat size={16} />} label="Swap" onClick={() => setComingSoonOpen('Swap')} />
      </div>

      {/* Coming Soon modal — only Swap uses this now. */}
      {comingSoonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0D1117] border border-slate-800 rounded-2xl p-6 w-full max-w-xs text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#0A1EFF]/15 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-[#0A1EFF]" />
            </div>
            <h3 className="text-base font-bold mb-1">{comingSoonOpen} — Coming Soon</h3>
            <p className="text-xs text-slate-400 mb-4">
              In-wallet {comingSoonOpen.toLowerCase()} is launching shortly. For now you can trade via the <span className="text-white">Market</span>.
            </p>
            <button
              type="button"
              onClick={() => setComingSoonOpen(null)}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WalletAction({
  icon, label, primary, onClick,
}: { icon: React.ReactNode; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-colors ${
        primary
          ? 'bg-[#0A1EFF] text-white shadow-[0_0_16px_rgba(10,30,255,0.35)] hover:bg-[#0818CC]'
          : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800'
      }`}
    >
      <div>{icon}</div>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

/**
 * Simple SVG stride line chart. Takes an array of prices (sparkline_7d
 * from CoinGecko token detail) and renders a single-color line that
 * bends up/down. Matches the reference screenshot style — no candles,
 * no axes, just the price arc.
 */
function Sparkline({ data, negative, loading }: { data: number[]; negative: boolean; loading?: boolean }) {
  const [measured, setMeasured] = useState(false);
  useEffect(() => { setMeasured(true); }, []);

  if (!data || data.length < 2) {
    return (
      <div className="h-48 rounded-lg bg-slate-900/40 flex items-center justify-center text-xs text-slate-500">
        {loading || !measured ? 'Loading chart…' : 'Chart data unavailable'}
      </div>
    );
  }
  const W = 360;
  const H = 180;
  const pad = 4;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (W - pad * 2) + pad;
    const y = H - ((v - min) / range) * (H - pad * 2) - pad;
    return `${x},${y}`;
  }).join(' ');
  const color = negative ? '#f87171' : '#34d399';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
