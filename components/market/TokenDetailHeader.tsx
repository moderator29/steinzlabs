'use client';

import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { CoinGeckoDetail } from '@/lib/market/types';
import { formatPrice, formatLargeNumber, formatPercent } from '@/lib/market/formatters';
import { TokenLogo } from './TokenLogo';

interface TokenDetailHeaderProps {
  token: CoinGeckoDetail;
  price: number;
  change24h: number;
  volume24h: number;
  onBack?: () => void;
}

export function TokenDetailHeader({
  token,
  price,
  change24h,
  volume24h,
  onBack,
}: TokenDetailHeaderProps) {
  const isPositive = change24h >= 0;
  const coingeckoUrl = `https://www.coingecko.com/en/coins/${token.id}`;

  return (
    <div className="bg-[#111827] border border-[#1E2433] rounded-xl px-5 py-5">
      {/* Top row: back + coingecko link */}
      <div className="flex items-center justify-between mb-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </button>
        ) : (
          <div />
        )}
        <a
          href={coingeckoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-[#0A1EFF] text-xs font-medium transition-colors"
        >
          CoinGecko
          <ExternalLink size={11} />
        </a>
      </div>

      {/* Main content */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: logo + name */}
        <div className="flex items-center gap-3">
          <TokenLogo src={token.image?.large} symbol={token.symbol} size={52} />
          <div>
            <div className="text-white font-bold text-lg leading-tight">{token.name}</div>
            <div className="text-gray-500 text-sm uppercase font-medium">{token.symbol}</div>
            {token.market_cap_rank && (
              <div className="text-gray-600 text-xs mt-0.5">Rank #{token.market_cap_rank}</div>
            )}
          </div>
        </div>

        {/* Right: price + change */}
        <div className="sm:text-right">
          <div className="text-white font-bold text-3xl font-mono leading-none">
            {formatPrice(price)}
          </div>

          <div className="mt-2 flex sm:justify-end items-center gap-2 flex-wrap">
            {/* 24h change badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold ${
                isPositive
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {formatPercent(change24h)} 24h
            </span>

            {/* Volume */}
            <span className="text-gray-500 text-xs">
              Vol:&nbsp;
              <span className="text-gray-300 font-medium font-mono">
                {formatLargeNumber(volume24h)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
