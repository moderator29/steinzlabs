'use client';

// Trust Wallet-style vertical token row. Each row renders:
//   [logo]  SYMBOL [chain-badge]           qty
//           price  24h-change              usd value
// Inline sparkline removed from the primary row to keep it dense and mobile-first.
// Data: sparkline endpoint gives us changePct; price is derived from
// valueUsd / balance (authoritative for stable pairs) with a fallback.

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface Props {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string | null;
  contractAddress?: string | null;
  logoUrl?: string;
  chainLabel?: string;
  coinGeckoId?: string;
  hideBalance?: boolean;
  onClick?: () => void;
}

interface SparkData {
  points: number[];
  changePct: number;
}

const sparkCache = new Map<string, SparkData>();

function formatPrice(p: number): string {
  if (!p || !isFinite(p)) return '—';
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1)    return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toExponential(2)}`;
}

function formatQty(q: number): string {
  if (!q) return '0';
  if (q < 0.0001) return q.toExponential(2);
  if (q < 1)     return q.toFixed(6).replace(/\.?0+$/, '');
  return q.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatValue(v: number): string {
  if (!v || !isFinite(v)) return '$0.00';
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WalletTokenRow({
  symbol, name, balance, valueUsd, contractAddress, logoUrl, chainLabel, coinGeckoId, hideBalance, onClick,
}: Props) {
  const [changePct, setChangePct] = useState<number | null>(null);

  useEffect(() => {
    // Prefer contract-backed DexScreener sparkline when we have a contract
    // address — CoinGecko doesn't index small-caps like Naka Go / Pleasure
    // Coin, so the id path would 404 and the row would render a blank line.
    const url = contractAddress && /^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(contractAddress)
      ? `/api/wallet/sparkline?contract=${encodeURIComponent(contractAddress)}&chain=${encodeURIComponent((chainLabel || '').toLowerCase())}`
      : coinGeckoId
        ? `/api/wallet/sparkline?id=${encodeURIComponent(coinGeckoId)}`
        : null;
    if (!url) return;
    const cacheKey = url;
    if (sparkCache.has(cacheKey)) {
      setChangePct(sparkCache.get(cacheKey)?.changePct ?? null);
      return;
    }
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SparkData | null) => {
        if (cancelled || !d || !Array.isArray(d.points)) return;
        sparkCache.set(cacheKey, d);
        setChangePct(d.changePct);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [contractAddress, coinGeckoId, chainLabel]);

  const qty = parseFloat(balance) || 0;
  const val = parseFloat(valueUsd || '0') || 0;
  const price = qty > 0 && val > 0 ? val / qty : 0;
  const changeColor = changePct == null ? 'text-slate-500' : changePct >= 0 ? 'text-emerald-400' : 'text-red-400';
  const changeSign = changePct == null ? '' : changePct >= 0 ? '+' : '';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-slate-900/60 active:bg-slate-900/80 transition-colors group text-left"
    >
      {/* Logo */}
      <div className="relative w-10 h-10 shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt={symbol} className="w-10 h-10 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
            {symbol.slice(0, 2)}
          </div>
        )}
      </div>

      {/* Left — symbol + chain badge / price + change */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold text-white">{symbol}</span>
          {chainLabel && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-800/80 text-slate-400 leading-none border border-slate-700/50">
              {chainLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[12px] text-slate-400 font-mono">{formatPrice(price)}</span>
          {changePct != null && (
            <span className={`text-[12px] font-semibold ${changeColor}`}>
              {changeSign}{changePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Right — qty + USD value */}
      <div className="text-right shrink-0">
        <div className="text-[15px] font-semibold text-white tabular-nums leading-tight">
          {hideBalance ? '••••' : formatQty(qty)}
        </div>
        <div className="text-[12px] text-slate-400 tabular-nums leading-tight mt-0.5">
          {hideBalance ? '••••' : formatValue(val)}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
