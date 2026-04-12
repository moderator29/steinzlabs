'use client';

import { useState } from 'react';
import { ArrowLeft, Star, Bell, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTokenDetail } from '@/hooks/market/useTokenDetail';
import { useChartData } from '@/hooks/market/useChartData';
import { CandlestickChart } from '@/components/market/CandlestickChart';
import { TimeframeSelector } from '@/components/market/TimeframeSelector';
import { TokenLogo } from '@/components/market/TokenLogo';
import { PriceChangeDisplay } from '@/components/market/PriceChangeDisplay';
import { BuySellModal } from '@/components/market/BuySellModal';
import { AlertModal } from '@/components/market/AlertModal';
import { LoadingSkeleton } from '@/components/market/LoadingSkeleton';
import { ErrorState } from '@/components/market/ErrorState';
import { formatPrice, formatLargeNumber, formatPercent } from '@/lib/market/formatters';
import { Timeframe } from '@/lib/market/types';

export default function TokenDetailPage({ params }: { params: { tokenId: string } }) {
  const router = useRouter();
  const { tokenId } = params;
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [showBuy, setShowBuy] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  const { detail, loading, error } = useTokenDetail(tokenId);
  const days = { '1H': '1', '6H': '1', '1D': '1', '1W': '7', '1M': '30', '1Y': '365', 'ALL': 'max' }[timeframe] ?? '1';
  const { candles, volume, loading: chartLoading } = useChartData(tokenId, timeframe);

  const md = detail?.market_data;
  const price = md?.current_price?.usd ?? 0;
  const change24h = md?.price_change_percentage_24h ?? 0;

  if (loading) return <LoadingSkeleton variant="header" />;
  if (error || !detail) return <ErrorState message={error ?? 'Token not found'} onRetry={() => router.back()} />;

  const stats = [
    { label: 'Rank', value: `#${detail.market_cap_rank}` },
    { label: 'Market Cap', value: formatLargeNumber(md?.market_cap?.usd ?? 0) },
    { label: 'FDV', value: md?.fully_diluted_valuation?.usd ? formatLargeNumber(md.fully_diluted_valuation.usd) : 'N/A' },
    { label: '24H Volume', value: formatLargeNumber(md?.total_volume?.usd ?? 0) },
    { label: '24H High', value: formatPrice(md?.high_24h?.usd ?? 0) },
    { label: '24H Low', value: formatPrice(md?.low_24h?.usd ?? 0) },
    { label: 'Circulating', value: md?.circulating_supply ? `${(md.circulating_supply / 1e6).toFixed(1)}M` : 'N/A' },
    { label: 'ATH', value: `${formatPrice(md?.ath?.usd ?? 0)} (${formatPercent(md?.ath_change_percentage?.usd)})` },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <TokenLogo src={detail.image?.small} symbol={detail.symbol} size={40} />
          <div>
            <h2 className="text-xl font-bold text-white">{detail.name}</h2>
            <span className="text-gray-400 text-sm uppercase">{detail.symbol}</span>
          </div>
        </div>
        <button className="p-1.5 text-gray-500 hover:text-[#0A1EFF] transition-colors">
          <Star size={18} />
        </button>
      </div>

      {/* Price */}
      <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-4">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-3xl font-bold text-white font-mono">{formatPrice(price)}</span>
          <PriceChangeDisplay value={change24h} size="lg" />
        </div>
        <p className="text-gray-500 text-sm">24H Range: {formatPrice(md?.low_24h?.usd ?? 0)} — {formatPrice(md?.high_24h?.usd ?? 0)}</p>
      </div>

      {/* Chart */}
      <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>
        <CandlestickChart data={candles} volumeData={volume} height={380} loading={chartLoading} enableFullscreen />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-1">{s.label}</p>
            <p className="text-white font-mono text-sm font-medium">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={() => setShowBuy(true)}
          className="flex-1 min-w-[120px] py-3 bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-bold rounded-lg transition-colors shadow-[0_0_20px_rgba(10,30,255,0.3)]">
          Buy {detail.symbol.toUpperCase()}
        </button>
        <button onClick={() => setShowAlert(true)}
          className="flex items-center gap-2 px-4 py-3 bg-[#141824] border border-[#1E2433] text-gray-300 hover:text-white rounded-lg transition-colors">
          <Bell size={14} /> Alert
        </button>
        <button onClick={() => router.push(`/dashboard/vtx-ai?q=Analyze+token+${tokenId}`)}
          className="flex items-center gap-2 px-4 py-3 bg-[#141824] border border-[#1E2433] text-gray-300 hover:text-white rounded-lg transition-colors">
          <ExternalLink size={14} /> VTX Analysis
        </button>
      </div>

      {showBuy && (
        <BuySellModal
          tokenId={tokenId}
          symbol={detail.symbol.toUpperCase()}
          name={detail.name}
          logo={detail.image?.small}
          priceUSD={price}
          chain="ethereum"
          onClose={() => setShowBuy(false)}
        />
      )}

      {showAlert && (
        <AlertModal
          tokenId={tokenId}
          symbol={detail.symbol.toUpperCase()}
          currentPrice={price}
          onAdd={async () => { setShowAlert(false); }}
          onClose={() => setShowAlert(false)}
        />
      )}
    </div>
  );
}
