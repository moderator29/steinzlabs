'use client';

/**
 * ContextEventCard — presentational card for a single Context Feed event,
 * matching the live feed's visual language (sentiment / chain / platform /
 * INTEL / VERIFIED badges, title, summary, price row, stats grid, signal bar
 * + View Proof). Used by the Archive page so archived events read exactly
 * like the live feed, just historical.
 *
 * Kept self-contained (no bookmark / engagement / convergence state) so it can
 * render anywhere without the live feed's stateful wiring.
 */

import type { ContextEvent } from '@/lib/hooks/useContextFeed';

const CHAIN_BADGE: Record<string, { color: string; label: string }> = {
  solana: { color: '#14F195', label: 'SOL' },
  ethereum: { color: '#627EEA', label: 'ETH' },
  bsc: { color: '#F0B90B', label: 'BSC' },
  polygon: { color: '#8247E5', label: 'POLY' },
  avalanche: { color: '#E84142', label: 'AVAX' },
  base: { color: '#0052FF', label: 'BASE' },
  arbitrum: { color: '#28A0F0', label: 'ARB' },
  optimism: { color: '#FF0420', label: 'OP' },
};

function chainBadge(chain: string) {
  return CHAIN_BADGE[chain?.toLowerCase()] ?? { color: '#0066FF', label: (chain || '?').toUpperCase().slice(0, 4) };
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function ContextEventCard({ event }: { event: ContextEvent }) {
  const isPositive = event.sentiment === 'BULLISH';
  const isNegative = event.sentiment === 'BEARISH';
  const sentimentColor = isPositive ? '#10B981' : isNegative ? '#EF4444' : '#F59E0B';
  const badge = chainBadge(event.chain);
  const hasStats = !!(event.tokenVolume24h || event.tokenLiquidity || event.tokenMarketCap);

  return (
    <div className="nl-glass rounded-2xl p-5 hover:border-[#0066FF]/40 transition-all overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
      {/* Badge row + time */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: `${sentimentColor}20`, color: sentimentColor }}
          >
            {event.sentiment}
          </span>
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: `${badge.color}22`, color: badge.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badge.color }} />
            {badge.label}
          </span>
          {event.platform && (
            <span className="px-2 py-0.5 rounded text-xs text-gray-300 bg-white/5 flex-shrink-0">{event.platform}</span>
          )}
          {event.valueUsd >= 50000 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#0066FF]/10 text-[#0066FF] border border-[#0066FF]/20 flex-shrink-0">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              INTEL
            </span>
          )}
          {event.trustScore >= 75 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 flex-shrink-0">
              VERIFIED
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs flex-shrink-0 ms-2">
          {new Date(event.displayTimestamp || event.timestamp).toLocaleString()}
        </span>
      </div>

      <h3 className="text-base font-bold mb-2 break-words line-clamp-2">{event.title}</h3>
      <p className="text-gray-300 text-sm mb-4 leading-relaxed break-words line-clamp-3">{event.summary}</p>

      {/* Price row */}
      <div className="flex items-center gap-3 mb-2 text-xs text-gray-400 overflow-hidden flex-wrap">
        {event.tokenPrice && <span className="flex-shrink-0 font-mono font-semibold text-white">{event.tokenPrice}</span>}
        {event.tokenPriceChange24h !== undefined && event.tokenPriceChange24h !== 0 && (
          <span className="flex-shrink-0 font-semibold" style={{ color: event.tokenPriceChange24h > 0 ? '#10B981' : '#EF4444' }}>
            {event.tokenPriceChange24h > 0 ? '+' : ''}{event.tokenPriceChange24h.toFixed(1)}%
          </span>
        )}
        {event.valueUsd > 0 && <span className="flex-shrink-0">TX: ${event.valueUsd.toLocaleString()}</span>}
      </div>

      {/* Stats grid */}
      {hasStats && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {!!event.tokenVolume24h && event.tokenVolume24h > 0 && (
            <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
              <div className="text-[9px] text-gray-500 uppercase">Vol 24h</div>
              <div className="text-[11px] font-semibold text-gray-300 font-mono">${fmtCompact(event.tokenVolume24h)}</div>
            </div>
          )}
          {!!event.tokenLiquidity && event.tokenLiquidity > 0 && (
            <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
              <div className="text-[9px] text-gray-500 uppercase">Liquidity</div>
              <div className="text-[11px] font-semibold text-gray-300 font-mono">${fmtCompact(event.tokenLiquidity)}</div>
            </div>
          )}
          {!!event.tokenMarketCap && event.tokenMarketCap > 0 && (
            <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
              <div className="text-[9px] text-gray-500 uppercase">MCap</div>
              <div className="text-[11px] font-semibold text-gray-300 font-mono">${fmtCompact(event.tokenMarketCap)}</div>
            </div>
          )}
        </div>
      )}

      {/* Signal bar + View Proof */}
      <div className="flex flex-wrap items-center gap-y-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap" title="Signal confidence: how reliable this event's source is.">
          <span className="text-[9px] font-semibold text-slate-500 uppercase flex-shrink-0">Signal</span>
          <div className="w-20 bg-white/20 rounded-full h-1.5 flex-shrink-0">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${event.trustScore}%`, backgroundColor: event.trustScore > 70 ? '#10B981' : event.trustScore > 40 ? '#F59E0B' : '#EF4444' }}
            />
          </div>
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: sentimentColor }}>{event.trustScore}</span>
          <span className="px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0" style={{ backgroundColor: `${sentimentColor}20`, color: sentimentColor }}>
            {event.trustScore > 70 ? 'STRONG' : event.trustScore > 40 ? 'MEDIUM' : 'WEAK'}
          </span>
        </div>
        <button
          onClick={() => {
            sessionStorage.setItem('steinz_proof_event', JSON.stringify(event));
            window.location.href = `/dashboard/proof?id=${event.id}`;
          }}
          className="naka-button-primary flex-shrink-0 ms-auto"
          aria-label="View proof for this event"
        >
          View Proof
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
