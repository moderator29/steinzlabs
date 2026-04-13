'use client';

import { CoinGeckoDetail } from '@/lib/market/types';
import { formatLargeNumber, formatPercent, formatSupply } from '@/lib/market/formatters';

interface KeyStatsGridProps {
  token: CoinGeckoDetail;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}

function StatCard({ label, value, sub, subColor }: StatCardProps) {
  return (
    <div className="bg-[#0A0E1A] border border-[#1E2433] rounded-xl p-4">
      <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1.5">{label}</div>
      <div className="text-white font-semibold text-sm leading-snug truncate">{value}</div>
      {sub && (
        <div className={`text-xs mt-1 font-medium ${subColor ?? 'text-gray-500'}`}>{sub}</div>
      )}
    </div>
  );
}

export function KeyStatsGrid({ token }: KeyStatsGridProps) {
  const d = token.market_data;
  const sym = token.symbol.toUpperCase();

  const athChangeColor = (d.ath_change_percentage?.usd ?? 0) >= 0 ? 'text-green-400' : 'text-red-400';
  const volToMcap =
    d.market_cap?.usd && d.total_volume?.usd
      ? ((d.total_volume.usd / d.market_cap.usd) * 100).toFixed(2) + '%'
      : 'N/A';

  const athDate = d.ath_date?.usd
    ? new Date(d.ath_date.usd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* ATH */}
      <StatCard
        label="All-Time High"
        value={formatLargeNumber(d.ath?.usd ?? 0)}
        sub={`${formatPercent(d.ath_change_percentage?.usd)} from ATH · ${athDate}`}
        subColor={athChangeColor}
      />

      {/* Market Cap Rank */}
      <StatCard
        label="Market Cap Rank"
        value={token.market_cap_rank ? `#${token.market_cap_rank}` : 'N/A'}
        sub={`Market Cap: ${formatLargeNumber(d.market_cap?.usd ?? 0)}`}
      />

      {/* FDV */}
      <StatCard
        label="Fully Diluted Val."
        value={
          d.fully_diluted_valuation?.usd
            ? formatLargeNumber(d.fully_diluted_valuation.usd)
            : 'N/A'
        }
      />

      {/* Volume / Market Cap */}
      <StatCard
        label="Vol / Market Cap"
        value={volToMcap}
        sub={`24h Volume: ${formatLargeNumber(d.total_volume?.usd ?? 0)}`}
      />

      {/* Circulating Supply */}
      <StatCard
        label="Circulating Supply"
        value={formatSupply(d.circulating_supply, sym)}
      />

      {/* Total Supply */}
      <StatCard
        label="Total Supply"
        value={formatSupply(d.total_supply, sym)}
      />

      {/* Max Supply */}
      <StatCard
        label="Max Supply"
        value={d.max_supply ? formatSupply(d.max_supply, sym) : 'Unlimited'}
      />

      {/* 24h Range */}
      <StatCard
        label="24h Range"
        value={`${formatLargeNumber(d.low_24h?.usd ?? 0)} – ${formatLargeNumber(d.high_24h?.usd ?? 0)}`}
      />
    </div>
  );
}
