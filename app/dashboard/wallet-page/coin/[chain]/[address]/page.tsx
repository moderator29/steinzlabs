"use client";

/**
 * Batch 8 — Naka Wallet coin-detail page. Opens when user clicks any
 * token in the wallet home list. Matches the Trust-Wallet-style layout
 * from the reference screenshot (§4.5 refinement):
 *
 *   [← back]       ETH / COIN | Ethereum         [★ watch]
 *   ⛽ $0.01       [Over 45K stakers]
 *                     $2,286.61
 *                     ↓ -$27.00 (-1.16%)
 *   [          line chart (stride / simple)          ]
 *   [ 1H  1D  1W  1M  1Y  All ]
 *
 *   Buy now
 *   [ 40,275 NGN ] [ Buy ]
 *   [ 20K 30K 60K 100K ]       Yellowcard · P2P Bank
 *
 *   [ Holdings · History · About ]
 *
 *   [Send] [Receive] [Swap] [BUY] [Sell]      ← fixed bottom
 *
 * Buy / Sell / Swap currently show a "Coming Soon" toast per product
 * direction — rail is built, wiring to the real swap pipeline queued.
 * Send + Receive deep-link to the existing wallet flows (work today).
 */

import { use, useState, useEffect } from "react";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Repeat, ShoppingCart, Landmark, Star, Fuel } from "lucide-react";
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

type Tab = 'holdings' | 'history' | 'about';
type Timeframe = '1H' | '1D' | '1W' | '1M' | '1Y' | 'All';
const TIMEFRAMES: Timeframe[] = ['1H', '1D', '1W', '1M', '1Y', 'All'];

export default function WalletCoinPage({ params }: { params: Promise<RouteParams> }) {
  const { chain, address } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { balance } = useWallet();
  const { detail, loading } = useTokenDetail(address);
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);

  const [tab, setTab] = useState<Tab>('holdings');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [comingSoonOpen, setComingSoonOpen] = useState<string | null>(null);

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

  // Sparkline from CoinGecko
  const sparklineData: number[] = (md as any)?.sparkline_7d?.price
    ?? (detail as any)?.sparkline_in_7d?.price
    ?? [];

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

      {/* Gas + stakers row */}
      <div className="flex items-center justify-between gap-2 px-4 mb-2">
        <div className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <Fuel size={12} /> <span className="font-mono">$0.01</span>
        </div>
        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] bg-[#A78BFA]/15 px-2.5 py-1 rounded-full">
          <span>👥</span> Over 45K stakers
        </div>
        <div className="w-[60px]" />
      </div>

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

      {/* Line chart — simple SVG stride using 7d sparkline */}
      <div className="px-4 pb-4">
        <Sparkline data={sparklineData} negative={isNegative} />
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

      {/* Buy now fiat card */}
      <div className="px-4 mb-6">
        <div className="text-sm font-semibold text-slate-300 mb-2">Buy now</div>
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-2xl font-bold tabular-nums">40,275</div>
              <div className="text-[10px] uppercase text-slate-500 font-semibold">NGN</div>
            </div>
            <button
              type="button"
              onClick={() => setComingSoonOpen('Buy')}
              className="px-6 py-2 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-sm transition-colors"
            >
              Buy
            </button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {['20K', '30K', '60K', '100K'].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setComingSoonOpen('Buy')}
                className="flex-1 py-1 rounded-full bg-emerald-900/40 text-emerald-300 text-xs font-semibold"
              >
                {amt}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-slate-500">
            Buying {(price > 0 ? 40275 / 1600 / price : 0).toFixed(8)} {symbol} · <span className="text-emerald-400">Instant P2P Bank</span> · <span className="text-emerald-400">Yellowcard</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 px-4 border-b border-slate-800 mb-4 text-sm font-semibold">
        {(['holdings', 'history', 'about'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 -mb-px border-b-2 capitalize transition-colors ${
              tab === t ? 'border-emerald-400 text-white' : 'border-transparent text-slate-500 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 min-h-[140px]">
        {tab === 'holdings' && (
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
        {tab === 'history' && (
          <p className="text-sm text-slate-500">Transaction history for {symbol} will appear here once you trade.</p>
        )}
        {tab === 'about' && (
          <p className="text-sm text-slate-400 leading-relaxed">
            {detail?.description?.en ? detail.description.en.split('.')[0] + '.' : `${name} is a digital asset on ${chainLabel}.`}
          </p>
        )}
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-[#0A0E1A]/95 backdrop-blur-xl px-3 py-3 grid grid-cols-5 gap-2 z-40">
        <WalletAction icon={<ArrowUpRight size={16} />} label="Send" onClick={() => router.push(`/dashboard/wallet-page?action=send&token=${symbol}&chain=${chain}`)} />
        <WalletAction icon={<ArrowDownLeft size={16} />} label="Receive" onClick={() => router.push(`/dashboard/wallet-page?action=receive&chain=${chain}`)} />
        <WalletAction icon={<Repeat size={16} />} label="Swap" onClick={() => setComingSoonOpen('Swap')} />
        <WalletAction icon={<ShoppingCart size={16} />} label="Buy" primary onClick={() => setComingSoonOpen('Buy')} />
        <WalletAction icon={<Landmark size={16} />} label="Sell" onClick={() => setComingSoonOpen('Sell')} />
      </div>

      {/* Coming Soon modal */}
      {comingSoonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0D1117] border border-slate-800 rounded-2xl p-6 w-full max-w-xs text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#0A1EFF]/15 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[#0A1EFF]" />
            </div>
            <h3 className="text-base font-bold mb-1">{comingSoonOpen} — Coming Soon</h3>
            <p className="text-xs text-slate-400 mb-4">
              In-wallet fiat {comingSoonOpen.toLowerCase()} flow is launching shortly. For now you can still trade via the <span className="text-white">Market</span>.
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
      className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors ${
        primary
          ? 'bg-emerald-400 text-black shadow-[0_0_12px_rgba(74,222,128,0.25)]'
          : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800'
      }`}
    >
      <div className={primary ? 'text-black' : ''}>{icon}</div>
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
function Sparkline({ data, negative }: { data: number[]; negative: boolean }) {
  const [measured, setMeasured] = useState(false);
  useEffect(() => { setMeasured(true); }, []);

  if (!data || data.length < 2) {
    return (
      <div className="h-48 rounded-lg bg-slate-900/40 flex items-center justify-center text-xs text-slate-500">
        {measured ? 'Chart data unavailable' : 'Loading chart…'}
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
