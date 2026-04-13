'use client';

import { useState } from 'react';
import { OrderBook } from './OrderBook';
import { OrderForm } from './OrderForm';
import { RecentTradesFeed } from './RecentTradesFeed';
import { useOrderBook } from '@/lib/hooks/useOrderBook';
import type { OrderBookData, RecentTrade } from '@/lib/market/types';

interface TradeTerminalProps {
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  priceUsd: number;
  userAddress?: string;
  pairAddress?: string;
}

const MOCK_RECENT_TRADES: RecentTrade[] = [];

export function TradeTerminal({
  tokenAddress,
  tokenSymbol,
  chain,
  priceUsd,
  userAddress,
  pairAddress,
}: TradeTerminalProps) {
  const { bids, asks, spread, loading: obLoading } = useOrderBook({
    pairAddress: pairAddress ?? '',
    chain,
  });

  const orderBookData: OrderBookData | null =
    bids.length > 0 || asks.length > 0
      ? {
          buyersPercent: bids.length > 0 ? (bids.length / (bids.length + asks.length)) * 100 : 50,
          sellersPercent: asks.length > 0 ? (asks.length / (bids.length + asks.length)) * 100 : 50,
          buyCount: bids.length,
          sellCount: asks.length,
        }
      : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Main panel: Order Book + Order Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Order Book */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Order Book</h3>
            {spread !== undefined && (
              <span className="text-[10px] text-gray-500">
                Spread: <span className="text-gray-300">${spread.toFixed(4)}</span>
              </span>
            )}
          </div>
          <OrderBook data={orderBookData} loading={obLoading} />
        </div>

        {/* Order Form */}
        <OrderForm
          tokenSymbol={tokenSymbol}
          tokenAddress={tokenAddress}
          chain={chain}
          priceUsd={priceUsd}
          userAddress={userAddress}
        />
      </div>

      {/* Recent Trades */}
      <RecentTradesFeed trades={MOCK_RECENT_TRADES} symbol={tokenSymbol} />
    </div>
  );
}
