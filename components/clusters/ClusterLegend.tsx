'use client';

/**
 * ClusterLegend — colored swatch legend for the cluster graph. Pairs
 * with the 8 holder archetypes the cluster pipeline assigns. Replaces
 * the inline legend that used the same color for every 'unknown'
 * wallet regardless of provenance.
 *
 * Audit §5.7 B.7 sub-categories: CEX hot / fresh / OG / sniper /
 * dev / whale / dex / scammer.
 */

const ITEMS: Array<{ key: string; label: string; color: string; note?: string }> = [
  { key: 'cex-hot',    label: 'CEX hot wallet',  color: '#F59E0B', note: 'Binance / Coinbase / OKX hot account' },
  { key: 'dex',         label: 'DEX pool',         color: '#06B6D4', note: 'Uniswap / PancakeSwap / 0x router' },
  { key: 'dev',         label: 'Dev / deployer',    color: '#EF4444', note: 'Token creator wallet' },
  { key: 'whale',       label: 'Smart money',       color: '#7C3AED', note: 'Verified profitable wallet' },
  { key: 'sniper',      label: 'Sniper',            color: '#F97316', note: 'Bought within minutes of LP add' },
  { key: 'fresh',       label: 'Fresh wallet',      color: '#FBBF24', note: 'Funded < 7 days ago' },
  { key: 'og',          label: 'OG holder',          color: '#10B981', note: 'Held since launch, no sells' },
  { key: 'scammer',     label: 'Scammer / flagged',  color: '#DC143C', note: 'On a sanctions / rug list' },
  { key: 'unknown',     label: 'Unknown',           color: '#6B7280' },
];

export function ClusterLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="group"
      aria-label="Cluster node legend"
      className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 ${compact ? 'text-[10px]' : 'text-[11px]'}`}
    >
      {ITEMS.map((it) => (
        <span
          key={it.key}
          className="inline-flex items-center gap-1.5 text-slate-300"
          title={it.note ? `${it.label}: ${it.note}` : it.label}
        >
          <span
            aria-hidden
            className="inline-block rounded-full border border-white/20"
            style={{ width: 8, height: 8, backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
