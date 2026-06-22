'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';
import { TokenLogo } from './TokenLogo';
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
 * One component, fed real data, used everywhere a token price card is shown
 * (VTX answers, bubble map, market). Editorial dark theme: near-black panel,
 * subtle border, serif numerals, teal accent. Replaces the older split-brain
 * cards (LLM-streamed stats + a synthetic 3-point chart).
 *
 * Purely presentational — every value is a prop. Optional fields (holders,
 * supply, FDV, % unlocked) are hidden when not provided rather than faked.
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
  /** 24h price series (oldest → newest). Renders the area chart + hour ticks. */
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
  /** Deep link to the token on Orb. Hidden when absent. */
  orbUrl?: string;
}

const CHAIN_LABELS: Record<string, string> = {
  eth: 'Ethereum', ethereum: 'Ethereum',
  sol: 'Solana', solana: 'Solana',
  bsc: 'BNB Chain', bnb: 'BNB Chain',
  base: 'Base', arbitrum: 'Arbitrum', polygon: 'Polygon',
  avalanche: 'Avalanche', optimism: 'Optimism',
};

function chainLabel(chain?: string): string {
  if (!chain) return '';
  const c = chain.toLowerCase();
  return CHAIN_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
}

/** Build ~7 evenly-spaced clock-hour labels spanning the last 24h. */
function hourTicks(count = 7): string[] {
  const now = new Date();
  const ticks: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - (i / (count - 1)) * 24 * 3600 * 1000);
    const h = d.getHours();
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    ticks.push(`${h12} ${period}`);
  }
  return ticks;
}

function AreaChart({ points, positive }: { points: number[]; positive: boolean }) {
  const color = positive ? '#34d399' : '#f87171';
  const W = 100;
  const H = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((v, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * W : 0;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const gradId = `pc-grad-${positive ? 'up' : 'down'}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full" role="img" aria-label="24 hour price chart">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-100 tabular-nums truncate" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {value}
      </div>
      {sub != null && <div className="text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}

export function PriceCard(props: PriceCardProps) {
  const {
    symbol, name, chain, address, logo, trusted,
    price, change24h, points,
    volume24h, volumeChange24h, holders,
    marketCap, liquidity, supply, fdv, pctUnlocked, orbUrl,
  } = props;

  const [copied, setCopied] = useState(false);
  const positive = (change24h ?? 0) >= 0;
  const serif = { fontFamily: 'Georgia, "Times New Roman", serif' } as const;

  const copyAddr = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const ticks = hourTicks();

  return (
    <div className="relative w-full rounded-2xl border border-white/[0.07] bg-[#070A12] p-4 sm:p-5 overflow-hidden">
      {/* faint grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(#9ca3af 1px, transparent 1px), linear-gradient(90deg, #9ca3af 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <TokenLogo src={logo} symbol={symbol} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white truncate" style={serif}>{symbol}</span>
                {name && <span className="text-sm text-gray-400 truncate">{name}</span>}
              </div>
              {address && (
                <button
                  onClick={copyAddr}
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors font-mono"
                  title="Copy address"
                >
                  {shortenAddress(address)}
                  {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              )}
            </div>
          </div>

          {trusted && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-400">
              <ShieldCheck size={13} />
              Trusted
            </span>
          )}
        </div>

        {/* Price + 24h change */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-3xl font-bold text-white tabular-nums leading-none" style={serif}>
              {formatPrice(price)}
            </span>
            <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {formatPercent(change24h)}
            </span>
          </div>
          <span className="rounded-md border border-white/[0.08] px-2 py-0.5 text-[11px] text-gray-400">24h</span>
        </div>

        {/* Chart */}
        <div className="mt-3 h-32 w-full">
          {points && points.length > 1 ? (
            <AreaChart points={points} positive={positive} />
          ) : (
            <div className="h-full w-full flex items-center" aria-hidden>
              <div className="w-full h-16 rounded bg-gradient-to-r from-white/[0.02] via-white/[0.06] to-white/[0.02] animate-pulse" />
            </div>
          )}
        </div>
        {/* Hour ticks */}
        <div className="mt-1 flex justify-between text-[10px] text-gray-600 tabular-nums">
          {ticks.map((t, i) => <span key={i}>{t}</span>)}
        </div>

        {/* Stats row 1 */}
        <div className="mt-4 grid grid-cols-3 gap-3 items-start">
          <Stat
            label="24h Volume"
            value={volume24h != null ? formatLargeNumber(volume24h) : '—'}
            sub={
              volumeChange24h != null ? (
                <span className={volumeChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
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
              className="justify-self-end inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
            >
              See on Orb <ExternalLink size={11} />
            </a>
          ) : <span />}
        </div>

        {/* Stats row 2 */}
        <div className="mt-3 grid grid-cols-4 gap-3 border-t border-white/[0.05] pt-3">
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
