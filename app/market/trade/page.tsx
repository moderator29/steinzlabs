'use client';

import { useState } from 'react';
import { useMarketData } from '@/hooks/market/useMarketData';
import { useChartData } from '@/hooks/market/useChartData';
import { useRecentTrades } from '@/hooks/market/useRecentTrades';
import { CandlestickChart } from '@/components/market/CandlestickChart';
import { TimeframeSelector } from '@/components/market/TimeframeSelector';
import { TokenLogo } from '@/components/market/TokenLogo';
import { PriceChangeDisplay } from '@/components/market/PriceChangeDisplay';
import { RecentTradesFeed } from '@/components/market/RecentTradesFeed';
import { OrderBook } from '@/components/market/OrderBook';
import { BuySellModal } from '@/components/market/BuySellModal';
import { LoadingSkeleton } from '@/components/market/LoadingSkeleton';
import { formatPrice } from '@/lib/market/formatters';
import { CoinGeckoMarket, Timeframe } from '@/lib/market/types';

export default function TradePage() {
  const { tokens, loading } = useMarketData({ page: 1 });
  const [selected, setSelected] = useState<CoinGeckoMarket | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [mode, setMode] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [showModal, setShowModal] = useState(false);

  const token = selected ?? tokens[0] ?? null;
  const { candles, volume, loading: chartLoading } = useChartData(token?.id ?? null, timeframe);
  const { trades } = useRecentTrades(null); // no pair address available from CoinGecko IDs

  const md = token ? { price: token.current_price, change: token.price_change_percentage_24h } : null;
  const amountNum = parseFloat(amount) || 0;
  const tokenAmount = md && md.price > 0 ? amountNum / md.price : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4">
      {/* Left: Token list */}
      <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl overflow-hidden hidden lg:block">
        <div className="px-3 py-3 border-b border-[#1E2433] text-xs text-gray-500 uppercase tracking-wide">Tokens</div>
        <div className="overflow-y-auto" style={{ maxHeight: 600 }}>
          {loading ? <LoadingSkeleton rows={8} /> : tokens.slice(0, 50).map((t) => (
            <button key={t.id} onClick={() => setSelected(t)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#141824] transition-colors ${token?.id === t.id ? 'bg-[#0A1EFF]/10 border-l-2 border-[#0A1EFF]' : ''}`}>
              <TokenLogo src={t.image} symbol={t.symbol} size={24} />
              <div className="flex-1 text-left min-w-0">
                <div className="text-white text-xs font-medium truncate">{t.name}</div>
                <div className="text-gray-500 text-xs uppercase">{t.symbol}</div>
              </div>
              <PriceChangeDisplay value={t.price_change_percentage_24h} size="sm" showArrow={false} />
            </button>
          ))}
        </div>
      </div>

      {/* Center: Chart */}
      <div className="space-y-3">
        {token && (
          <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <TokenLogo src={token.image} symbol={token.symbol} size={32} />
              <div>
                <div className="text-white font-bold">{token.name}</div>
                <div className="text-gray-500 text-xs uppercase">{token.symbol}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-white font-mono font-bold">{formatPrice(token.current_price)}</div>
                <PriceChangeDisplay value={token.price_change_percentage_24h} size="sm" />
              </div>
            </div>
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          </div>
        )}
        <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-4" style={{ minHeight: 440 }}>
          <CandlestickChart data={candles} volumeData={volume} height={400} loading={chartLoading} enableFullscreen />
        </div>
        <RecentTradesFeed trades={trades} symbol={token?.symbol} />
      </div>

      {/* Right: Order form */}
      <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-4 space-y-4 h-fit">
        <div className="flex gap-2">
          {(['BUY', 'SELL'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${
                m === mode
                  ? (m === 'BUY' ? 'bg-[#0A1EFF] text-white' : 'bg-red-600 text-white')
                  : 'bg-[#141824] text-gray-400 border border-[#1E2433]'
              }`}>{m}</button>
          ))}
        </div>

        <OrderBook data={{ buyersPercent: 58, sellersPercent: 42, buyCount: 1240, sellCount: 890 }} />

        <div>
          <label className="text-xs text-gray-500 block mb-1.5">Amount (USD)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
            className="w-full bg-[#141824] border border-[#1E2433] rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#0A1EFF]" />
          <div className="flex gap-1.5 mt-2">
            {['25', '50', '100', 'MAX'].map((v) => (
              <button key={v} onClick={() => setAmount(v === 'MAX' ? '9999' : v)}
                className="flex-1 text-xs py-1 bg-[#141824] border border-[#1E2433] rounded text-gray-400 hover:text-white transition-colors">
                {v === 'MAX' ? 'MAX' : `$${v}`}
              </button>
            ))}
          </div>
        </div>

        {amountNum > 0 && token && (
          <div className="bg-[#141824] rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-400">You&apos;ll receive</span><span className="text-white font-mono">{tokenAmount.toFixed(4)} {token.symbol.toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Fee (0.2%)</span><span className="text-white font-mono">${(amountNum * 0.002).toFixed(4)}</span></div>
          </div>
        )}

        <button onClick={() => setShowModal(true)} disabled={!token}
          className={`w-full py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-40 ${
            mode === 'BUY' ? 'bg-[#0A1EFF] hover:bg-[#0916CC] text-white' : 'bg-red-600 hover:bg-red-700 text-white'
          }`}>
          {mode} {token?.symbol.toUpperCase() ?? '...'}
        </button>
      </div>

      {showModal && token && (
        <BuySellModal
          tokenId={token.id}
          symbol={token.symbol.toUpperCase()}
          name={token.name}
          logo={token.image}
          priceUSD={token.current_price}
          chain="ethereum"
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
