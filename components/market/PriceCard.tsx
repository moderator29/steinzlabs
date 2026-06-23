'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { TokenLogo } from './TokenLogo';
import { PriceChangeDisplay } from './PriceChangeDisplay';
import { SparklineChart } from './SparklineChart';
import {
  formatPrice,
  formatLargeNumber,
  formatSupply,
  formatPercent,
  shortenAddress,
} from '@/lib/market/formatters';

/**
 * PriceCard — the canonical token price surface for Naka Labs.
 *
 * Naka aurora branding: #0D1117 panel + #1E2433 border, with a soft aurora glow
 * (electric-blue #0A1EFF → violet #8B5CF6 → emerald #10B981, the same palette as
 * AuroraBackground) and a gradient top accent. Monospace/tabular numerals and
 * the shared lightweight SparklineChart (current price view, instant,
 * non-interactive). Up = green, down = red — the platform chart convention.
 *
 * Presentational — every value is a prop. Optional fields (holders, Trusted,
 * supply, FDV, % unlocked, Orb link) are hidden when absent rather than faked.
 */

export interface PriceCardProps {
  symbol: string;
  name?: string;
  chain?: string;
  address?: string;
  logo?: string;
  /** Trusted badge — pass true when the token passed security checks. */
  trusted?: boolean;
  price: number;
  change24h: number;
  /** Price series (oldest → newest) for the sparkline. */
  points?: number[];
  volume24h?: number | null;
  volumeChange24h?: number | null;
  holders?: number | null;
  marketCap?: number | null;
  liquidity?: number | null;
  supply?: number | null;
  fdv?: number | null;
  /** 0–100; shown under FDV as "N% unlocked" when present. */
  pctUnlocked?: number | null;
  /** Deep link to the token's full intelligence view ("Orb"). Hidden when absent. */
  orbUrl?: string;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-100 font-mono tabular-nums truncate">{value}</div>
      {sub != null && <div className="text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}

export function PriceCard(props: PriceCardProps) {
  const {
    symbol, name, address, logo, trusted,
    price, change24h, points,
    volume24h, volumeChange24h, holders,
    marketCap, liquidity, supply, fdv, pctUnlocked, orbUrl,
  } = props;

  const [copied, setCopied] = useState(false);
  const positive = (change24h ?? 0) >= 0;

  const copyAddr = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#1E2433] bg-[#0D1117] p-4 sm:p-5">
      {/* Aurora glow — soft blue/violet/emerald orbs (Naka brand palette) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-[#0A1EFF]/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-[#8B5CF6]/15 blur-3xl" />
        <div className="absolute -bottom-12 right-1/3 h-32 w-32 rounded-full bg-[#10B981]/10 blur-3xl" />
      </div>
      {/* Aurora top accent line */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#0A1EFF] via-[#8B5CF6] to-[#10B981] opacity-70" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <TokenLogo src={logo} symbol={symbol} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white truncate">{symbol}</span>
                {name && <span className="text-sm text-gray-400 truncate">{name}</span>}
              </div>
              {address && (
                <button
                  onClick={copyAddr}
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#0A1EFF] transition-colors font-mono"
                  title="Copy address"
                >
                  {shortenAddress(address)}
                  {copied ? <Check size={11} className="text-[#0A1EFF]" /> : <Copy size={11} />}
                </button>
              )}
            </div>
          </div>

          {trusted && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-2 py-1 text-[11px] font-semibold text-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <ShieldCheck size={13} />
              Trusted
            </span>
          )}
        </div>

        {/* Price + 24h change */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-3xl font-bold text-white font-mono tabular-nums leading-none">
              {formatPrice(price)}
            </span>
            <PriceChangeDisplay value={change24h} size="md" />
          </div>
          <span className="rounded-md border border-[#1E2433] bg-[#0A1EFF]/[0.06] px-2 py-0.5 text-[11px] text-gray-400">24h</span>
        </div>

        {/* Chart — same lightweight sparkline the watchlist uses (instant, non-interactive) */}
        <div className="mt-3 h-28 w-full">
          {points && points.length > 1 ? (
            <SparklineChart data={points} isPositive={positive} height={112} />
          ) : (
            <div className="h-full w-full flex items-center" aria-hidden>
              <div className="w-full h-16 rounded bg-gradient-to-r from-white/[0.02] via-white/[0.06] to-white/[0.02] animate-pulse" />
            </div>
          )}
        </div>

        {/* Stats row 1 */}
        <div className="mt-4 grid grid-cols-3 gap-3 items-start">
          <Stat
            label="24h Volume"
            value={volume24h != null ? formatLargeNumber(volume24h) : '—'}
            sub={
              volumeChange24h != null ? (
                <span className={volumeChange24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                  {volumeChange24h >= 0 ? '↗' : '↘'} {formatPercent(volumeChange24h)}
                </span>
              ) : undefined
            }
          />
          <Stat label="Holders" value={holders != null ? holders.toLocaleString() : '—'} />
          {orbUrl ? (
            <a
              href={orbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="justify-self-end inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#0A1EFF] transition-colors"
            >
              See on Orb <ExternalLink size={11} />
            </a>
          ) : <span />}
        </div>

        {/* Stats row 2 */}
        <div className="mt-3 grid grid-cols-4 gap-3 border-t border-[#1E2433] pt-3">
          <Stat label="Market Cap" value={marketCap != null ? formatLargeNumber(marketCap) : '—'} />
          <Stat label="Liquidity" value={liquidity != null ? formatLargeNumber(liquidity) : '—'} />
          <Stat label="Supply" value={supply != null ? formatSupply(supply, '').trim() : '—'} />
          <Stat
            label="FDV"
            value={fdv != null ? formatLargeNumber(fdv) : '—'}
            sub={pctUnlocked != null ? <span className="text-gray-500">{pctUnlocked.toFixed(0)}% unlocked</span> : undefined}
          />
        </div>
      </div>
    </div>
  );
}
