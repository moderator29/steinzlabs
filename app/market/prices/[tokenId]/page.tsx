'use client';

import { useState, use } from 'react';
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

export default function TokenDetailPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const router = useRouter();
  const { tokenId } = use(params);
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

  const athPct = md?.ath_change_percentage?.usd ?? 0;
  const athProgress = Math.max(0, Math.min(100, 100 + athPct)); // 0% = AT ATH, going down
  const volChange = md?.price_change_percentage_24h ?? 0; // proxy for volume direction

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Always return to dashboard market tab — never context feed
              try { localStorage.setItem('steinz_last_tab', 'markets'); } catch { /* localStorage unavailable — silently ignore */ }
              router.push('/dashboard');
            }}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
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
      <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-3xl font-bold text-white font-mono">{formatPrice(price)}</span>
          <PriceChangeDisplay value={change24h} size="lg" />
        </div>
        <p className="text-gray-500 text-sm">24H Range: {formatPrice(md?.low_24h?.usd ?? 0)} — {formatPrice(md?.high_24h?.usd ?? 0)}</p>
      </div>

      {/* Chart */}
      <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>
        <CandlestickChart data={candles} volumeData={volume} height={380} loading={chartLoading} enableFullscreen />
      </div>

      {/* KEY STATS */}
      <div>
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">Key Stats</p>
        <div className="grid grid-cols-2 gap-2">
          {/* Rank */}
          <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">RANK</p>
            <p className="text-white font-bold text-base">#{detail.market_cap_rank ?? '—'}</p>
          </div>
          {/* Market Cap */}
          <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">MARKET CAP</p>
            <p className="text-white font-bold text-base font-mono">{formatLargeNumber(md?.market_cap?.usd ?? 0)}</p>
          </div>
          {/* FDV */}
          <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">FDV</p>
            <p className="text-white font-bold text-base font-mono">
              {md?.fully_diluted_valuation?.usd ? formatLargeNumber(md.fully_diluted_valuation.usd) : '= Market Cap'}
            </p>
          </div>
          {/* Volume 24H with direction */}
          <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">VOLUME 24H</p>
            <p className="text-white font-bold text-base font-mono">{formatLargeNumber(md?.total_volume?.usd ?? 0)}</p>
            <p className={`text-xs font-semibold mt-0.5 ${volChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {volChange >= 0 ? '+' : ''}{volChange.toFixed(1)}%
            </p>
          </div>
          {/* ATH with progress bar */}
          <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-3 col-span-2">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">ATH</p>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-white font-bold text-base font-mono">{formatPrice(md?.ath?.usd ?? 0)}</p>
              <p className={`text-xs font-semibold ${athPct >= -5 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPercent(athPct)} from ATH
              </p>
            </div>
            <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${athPct >= -5 ? 'bg-emerald-400' : 'bg-red-400'}`}
                style={{ width: `${athProgress}%` }}
              />
            </div>
          </div>
          {/* 24H High / Low */}
          <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">24H HIGH</p>
            <p className="text-emerald-400 font-bold text-sm font-mono">{formatPrice(md?.high_24h?.usd ?? 0)}</p>
          </div>
          <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">24H LOW</p>
            <p className="text-red-400 font-bold text-sm font-mono">{formatPrice(md?.low_24h?.usd ?? 0)}</p>
          </div>
          {/* Circulating */}
          <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-3 col-span-2">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">CIRCULATING SUPPLY</p>
            <p className="text-white font-bold text-sm font-mono">
              {md?.circulating_supply
                ? `${md.circulating_supply.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${detail.symbol.toUpperCase()}`
                : 'No max supply'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={() => setShowBuy(true)}
          className="flex-1 min-w-[120px] py-3 bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-bold rounded-lg transition-colors shadow-[0_0_20px_rgba(10,30,255,0.3)]">
          Buy {detail.symbol.toUpperCase()}
        </button>
        <button onClick={() => setShowAlert(true)}
          className="flex items-center gap-2 px-4 py-3 bg-[#111827] border border-white/[0.06] text-gray-300 hover:text-white rounded-lg transition-colors">
          <Bell size={14} /> Alert
        </button>
        <button onClick={() => router.push(`/dashboard/vtx-ai?q=Analyze+token+${tokenId}`)}
          className="flex items-center gap-2 px-4 py-3 bg-[#111827] border border-white/[0.06] text-gray-300 hover:text-white rounded-lg transition-colors">
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
