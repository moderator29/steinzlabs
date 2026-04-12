'use client';

import { OrderBookData } from '@/lib/market/types';

interface OrderBookProps {
  data: OrderBookData | null;
  loading?: boolean;
}

export function OrderBook({ data, loading }: OrderBookProps) {
  if (loading || !data) {
    return (
      <div className="h-8 bg-[#141824] rounded animate-pulse" />
    );
  }

  return (
    <div className="space-y-1">
      <div className="w-full h-6 flex rounded overflow-hidden">
        <div
          className="bg-green-500/30 flex items-center justify-start pl-2"
          style={{ width: `${data.buyersPercent}%` }}
        >
          <span className="text-green-500 text-xs font-medium whitespace-nowrap">
            {data.buyersPercent}% Buyers
          </span>
        </div>
        <div
          className="bg-red-500/30 flex items-center justify-end pr-2"
          style={{ width: `${data.sellersPercent}%` }}
        >
          <span className="text-red-500 text-xs font-medium whitespace-nowrap">
            Sellers {data.sellersPercent}%
          </span>
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{data.buyCount.toLocaleString()} buys</span>
        <span>{data.sellCount.toLocaleString()} sells</span>
      </div>
    </div>
  );
}
