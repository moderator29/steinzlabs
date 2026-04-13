'use client';

import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { PortfolioPosition } from '@/lib/market/types';
import { formatPrice, formatLargeNumber, formatPercent } from '@/lib/market/formatters';
import { TokenLogo } from './TokenLogo';

interface PortfolioTableProps {
  positions: PortfolioPosition[];
  loading?: boolean;
}

type SortKey = 'value' | 'pnl' | 'pnlPct' | 'balance' | 'price';
type SortDir = 'asc' | 'desc';

const shimmer = 'animate-pulse bg-[#1E2433] rounded';

function SkeletonRow() {
  return (
    <tr className="border-b border-[#1E2433]/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full ${shimmer}`} />
          <div className="space-y-1">
            <div className={`h-3 w-16 ${shimmer}`} />
            <div className={`h-2.5 w-10 ${shimmer}`} />
          </div>
        </div>
      </td>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-3 w-16 ${shimmer} ml-auto`} />
        </td>
      ))}
    </tr>
  );
}

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <ChevronDown size={12} className="text-gray-600 ml-0.5" />;
  return dir === 'desc'
    ? <ChevronDown size={12} className="text-[#0A1EFF] ml-0.5" />
    : <ChevronUp size={12} className="text-[#0A1EFF] ml-0.5" />;
}

export function PortfolioTable({ positions, loading = false }: PortfolioTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const getValue = (p: PortfolioPosition) => {
      switch (sortKey) {
        case 'value': return p.balance * p.currentPriceUSD;
        case 'pnl': return p.upnlUSD;
        case 'pnlPct': return p.upnlPercent;
        case 'balance': return p.balance;
        case 'price': return p.currentPriceUSD;
        default: return 0;
      }
    };
    return [...positions].sort((a, b) => {
      const diff = getValue(a) - getValue(b);
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [positions, sortKey, sortDir]);

  const colHeader = (label: string, key: SortKey) => (
    <th
      className="px-4 py-3 text-right font-medium cursor-pointer select-none hover:text-white transition-colors"
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center justify-end gap-0.5">
        {label}
        <SortIcon col={key} sortKey={sortKey} dir={sortDir} />
      </span>
    </th>
  );

  if (!loading && positions.length === 0) {
    return (
      <div className="bg-[#111827] border border-[#1E2433] rounded-xl py-16 flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#1E2433] flex items-center justify-center">
          <TrendingUp size={20} className="text-gray-600" />
        </div>
        <p className="text-gray-400 text-sm font-medium">No positions yet</p>
        <p className="text-gray-600 text-xs">Start trading to see your portfolio here.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[#1E2433] bg-[#111827]">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-[#1E2433] text-gray-500 text-xs">
            <th className="px-4 py-3 text-left font-medium">Token</th>
            {colHeader('Balance', 'balance')}
            {colHeader('Price', 'price')}
            {colHeader('Value', 'value')}
            <th className="px-4 py-3 text-right font-medium">Avg Entry</th>
            {colHeader('P&L ($)', 'pnl')}
            {colHeader('P&L (%)', 'pnlPct')}
            <th className="px-4 py-3 text-right font-medium">24h Change</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : sorted.map((pos) => {
                const value = pos.balance * pos.currentPriceUSD;
                const isProfit = pos.upnlUSD >= 0;
                // 24h change approximation
                const priceChange24h = pos.currentPriceUSD - pos.avgEntryUSD;
                const change24hPct = pos.avgEntryUSD > 0 ? (priceChange24h / pos.avgEntryUSD) * 100 : 0;

                return (
                  <tr
                    key={`${pos.symbol}-${pos.tokenAddress ?? ''}`}
                    className={`border-b border-[#1E2433]/60 transition-colors hover:bg-[#1A2030] ${
                      isProfit ? 'hover:bg-green-900/10' : 'hover:bg-red-900/10'
                    }`}
                  >
                    {/* Token */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <TokenLogo src={pos.logo} symbol={pos.symbol} size={32} />
                        <div>
                          <div className="text-white font-medium text-sm">{pos.name}</div>
                          <div className="text-gray-500 text-xs uppercase">{pos.symbol}</div>
                        </div>
                      </div>
                    </td>

                    {/* Balance */}
                    <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                      {pos.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right text-white font-mono text-xs">
                      {formatPrice(pos.currentPriceUSD)}
                    </td>

                    {/* Value */}
                    <td className="px-4 py-3 text-right text-white font-mono text-sm font-semibold">
                      {formatLargeNumber(value)}
                    </td>

                    {/* Avg Entry */}
                    <td className="px-4 py-3 text-right text-gray-400 font-mono text-xs">
                      {formatPrice(pos.avgEntryUSD)}
                    </td>

                    {/* P&L $ */}
                    <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      {isProfit ? '+' : ''}{formatLargeNumber(pos.upnlUSD)}
                    </td>

                    {/* P&L % */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          isProfit ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {isProfit ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {formatPercent(pos.upnlPercent)}
                      </span>
                    </td>

                    {/* 24h Change */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-xs font-mono ${
                          change24hPct >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatPercent(change24hPct)}
                      </span>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
