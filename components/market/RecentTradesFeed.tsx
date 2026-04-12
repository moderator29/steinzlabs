'use client';

import { RecentTrade } from '@/lib/market/types';
import { formatTimestamp, shortenAddress } from '@/lib/market/formatters';

interface RecentTradesFeedProps {
  trades: RecentTrade[];
  symbol?: string;
}

export function RecentTradesFeed({ trades, symbol = '' }: RecentTradesFeedProps) {
  return (
    <div className="bg-[#0D1117] border border-[#1E2433] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2433]">
        <span className="text-white text-sm font-medium">Recent Trades</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
        {!trades.length ? (
          <div className="py-8 text-center text-gray-500 text-sm">No trades yet</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-[#1E2433]">
                <th className="px-3 py-2 text-left font-medium">Time</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 20).map((trade, i) => (
                <tr key={`${trade.timestamp}-${i}`} className="border-b border-[#1E2433]/50 hover:bg-[#141824] transition-colors">
                  <td className="px-3 py-2 text-gray-500">{formatTimestamp(trade.timestamp)}</td>
                  <td className={`px-3 py-2 font-medium ${trade.type === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.type === 'buy' ? 'Buy' : 'Sell'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">${trade.price.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">{trade.amount.toFixed(2)} {symbol}</td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">${trade.valueUSD.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
