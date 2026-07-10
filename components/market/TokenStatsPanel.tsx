'use client';

/**
 * Terminal left-rail token-stats panel.
 *
 * Our own aurora/dark take on the mobile DEX token panel — structurally
 * similar (identity, price, liquidity/FDV/mcap, change tiers, TXNS split,
 * volume, traders, actions) but on-brand (nl-glass, #0066FF accent).
 *
 * Every value is REAL, pulled from /api/market/token/[id]/stats which merges
 * DexScreener (pair data) + GeckoTerminal (unique buyers/sellers) + CoinGecko
 * (majors without a DEX pair). Anything a source doesn't provide renders as an
 * honest "—" — never a fabricated number. Refreshes on a ~4s live cadence.
 */

import { useState } from 'react';
import { Star, Globe, Send, ExternalLink, Loader2 } from 'lucide-react';
import { TokenLogo } from '@/components/market/TokenLogo';
import { useTokenStats } from '@/hooks/market/useTokenStats';
import { formatPrice, formatLargeNumber } from '@/lib/market/formatters';
import type { TokenStats, Win } from '@/lib/market/tokenStats';

interface Props {
  chain: string;
  address: string;
  initialName?: string;
  initialSymbol?: string;
  initialLogo?: string;
  watched: boolean;
  onToggleWatch: () => void;
  onBuy: () => void;
  onSell: () => void;
  className?: string;
}

const GLOW = { boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' } as const;

const WINDOWS: { id: Win; label: string }[] = [
  { id: 'm5', label: '5M' },
  { id: 'h1', label: '1H' },
  { id: 'h6', label: '6H' },
  { id: 'h24', label: '24H' },
];

function fmtUsd(n: number | null | undefined): string {
  // formatLargeNumber already prefixes "$".
  return n != null && n > 0 ? formatLargeNumber(n) : '—';
}

function fmtCount(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() : '—';
}

function XIcon({ size = 13 }: { size?: number }) {
  // Twitter/X glyph — lucide has no X-brand mark, so inline a minimal one.
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export default function TokenStatsPanel({
  chain,
  address,
  initialName,
  initialSymbol,
  initialLogo,
  watched,
  onToggleWatch,
  onBuy,
  onSell,
  className = '',
}: Props) {
  const { stats, loading, error, justUpdated } = useTokenStats(address, chain);
  const [win, setWin] = useState<Win>('h24');

  const name = stats?.name ?? initialName ?? address;
  const symbol = stats?.symbol ?? initialSymbol ?? '';
  const logo = stats?.logo ?? initialLogo;
  const displayChain = stats?.chain ?? chain;

  const price = stats?.priceUsd ?? null;
  const change24h = stats?.change.h24 ?? null;

  return (
    <div className={`nl-glass rounded-2xl overflow-hidden flex flex-col ${className}`} style={GLOW}>
      {/* Identity */}
      <div className="p-3.5 border-b border-slate-800/60">
        <div className="flex items-start gap-2.5">
          <TokenLogo src={logo} symbol={symbol || '?'} address={stats?.address ?? undefined} chain={displayChain} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white truncate">{name}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors ${justUpdated ? 'bg-emerald-400' : 'bg-slate-600'}`}
                title="Live, refreshes every ~4s"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-semibold uppercase text-slate-400">{symbol || '—'}</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 bg-slate-800/60 rounded text-slate-500">{displayChain}</span>
              {stats?.dexId && (
                <span className="text-[9px] uppercase px-1.5 py-0.5 bg-slate-800/40 rounded text-slate-500">{stats.dexId}</span>
              )}
            </div>
          </div>
        </div>

        {/* Socials — only real links render */}
        {(stats?.website || stats?.twitter || stats?.telegram) && (
          <div className="flex items-center gap-1.5 mt-2.5">
            {stats.website && (
              <SocialLink href={stats.website} label="Website"><Globe size={13} /></SocialLink>
            )}
            {stats.twitter && (
              <SocialLink href={stats.twitter} label="Twitter / X"><XIcon size={12} /></SocialLink>
            )}
            {stats.telegram && (
              <SocialLink href={stats.telegram} label="Telegram"><Send size={13} /></SocialLink>
            )}
          </div>
        )}
      </div>

      {/* Price */}
      <div className="p-3.5 border-b border-slate-800/60">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Price USD</div>
            <div className="text-2xl font-mono font-bold text-white tabular-nums truncate">
              {loading && !stats ? <Loader2 className="animate-spin text-slate-500" size={20} /> : price != null && price > 0 ? formatPrice(price) : '—'}
            </div>
          </div>
          {change24h != null && (
            <div className={`text-sm font-mono font-bold tabular-nums ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
            </div>
          )}
        </div>
        {stats?.priceNative && stats.nativeSymbol && (
          <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
            {stats.priceNative} {stats.nativeSymbol}
          </div>
        )}
      </div>

      {/* Change tiers */}
      <div className="grid grid-cols-4 border-b border-slate-800/60">
        {WINDOWS.map((w, i) => {
          const v = stats?.change[w.id] ?? null;
          const tone = v == null ? 'text-slate-600' : v >= 0 ? 'text-emerald-400' : 'text-red-400';
          return (
            <div key={w.id} className={`py-2 text-center ${i < 3 ? 'border-r border-slate-800/60' : ''}`}>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{w.label}</div>
              <div className={`text-[11px] font-mono font-semibold tabular-nums ${tone}`}>
                {v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Liquidity / FDV / Market cap */}
      <div className="grid grid-cols-3 border-b border-slate-800/60">
        <MetricCell label="Liquidity" value={fmtUsd(stats?.liquidityUsd)} border />
        <MetricCell label="FDV" value={fmtUsd(stats?.fdv)} border />
        <MetricCell label="Mkt Cap" value={fmtUsd(stats?.marketCap)} />
      </div>

      {/* Window selector for the flow metrics */}
      <div className="flex items-center gap-1 px-3.5 pt-3">
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setWin(w.id)}
            className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-colors ${
              win === w.id ? 'bg-[#0066FF]/20 text-[#8FA3FF] border border-[#0066FF]/40' : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            aria-pressed={win === w.id}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* TXNS split */}
      <SplitBlock
        label="Txns"
        leftLabel="Buys"
        rightLabel="Sells"
        left={stats?.txns[win]?.buys ?? null}
        right={stats?.txns[win]?.sells ?? null}
      />

      {/* Volume */}
      <div className="px-3.5 py-2.5 border-b border-slate-800/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Volume</span>
          <span className="text-xs font-mono font-semibold text-white tabular-nums">{fmtUsd(stats?.volume[win])}</span>
        </div>
        {(stats?.buyVol24h != null || stats?.sellVol24h != null) && (
          <div className="flex items-center justify-between mt-1 text-[10px] font-mono tabular-nums">
            <span className="text-emerald-400">Buy {fmtUsd(stats?.buyVol24h)}</span>
            <span className="text-red-400">Sell {fmtUsd(stats?.sellVol24h)}</span>
          </div>
        )}
      </div>

      {/* Traders (GeckoTerminal, 24h) */}
      <SplitBlock
        label="Traders · 24h"
        leftLabel="Buyers"
        rightLabel="Sellers"
        left={stats?.buyers24h ?? null}
        right={stats?.sellers24h ?? null}
        emptyHint="Trader-level data unavailable for this pool"
      />

      {/* Actions */}
      <div className="p-3 mt-auto space-y-2">
        <button
          type="button"
          onClick={onToggleWatch}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-colors border ${
            watched ? 'bg-yellow-400/10 text-yellow-300 border-yellow-400/40' : 'bg-slate-900/60 text-slate-300 border-slate-800/60 hover:text-white'
          }`}
        >
          <Star size={13} className={watched ? 'fill-yellow-400 text-yellow-400' : ''} />
          {watched ? 'Watching' : 'Watchlist'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onBuy}
            className="py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-colors"
          >
            Buy
          </button>
          <button
            type="button"
            onClick={onSell}
            className="py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors"
          >
            Sell
          </button>
        </div>
        {error && !stats && (
          <p className="text-[10px] text-slate-500 text-center pt-1">{error}</p>
        )}
      </div>
    </div>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/60 border border-slate-800/60 text-slate-400 hover:text-white hover:border-[#0066FF]/40 transition-colors"
    >
      {children}
      <ExternalLink size={9} className="opacity-60" />
    </a>
  );
}

function MetricCell({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <div className={`py-2.5 px-2 text-center ${border ? 'border-r border-slate-800/60' : ''}`}>
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-[12px] font-mono font-semibold text-white tabular-nums truncate">{value}</div>
    </div>
  );
}

function SplitBlock({
  label,
  leftLabel,
  rightLabel,
  left,
  right,
  emptyHint,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  left: number | null;
  right: number | null;
  emptyHint?: string;
}) {
  const hasData = left != null && right != null && (left + right) > 0;
  const total = hasData ? left! + right! : 0;
  const pctLeft = hasData ? Math.round((left! / total) * 100) : 0;
  const pctRight = 100 - pctLeft;

  return (
    <div className="px-3.5 py-2.5 border-b border-slate-800/60">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-[11px] font-mono font-semibold text-white tabular-nums">
          {hasData ? total.toLocaleString() : '—'}
        </span>
      </div>
      {hasData ? (
        <>
          <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${pctLeft}%` }} />
            <div className="bg-red-500 h-full" style={{ width: `${pctRight}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] font-mono tabular-nums">
            <span className="text-emerald-400">{leftLabel} {left!.toLocaleString()}</span>
            <span className="text-red-400">{rightLabel} {right!.toLocaleString()}</span>
          </div>
        </>
      ) : (
        <div className="text-[10px] text-slate-600">{emptyHint ?? 'No activity in this window'}</div>
      )}
    </div>
  );
}
