'use client';

import { useMemo, useState } from 'react';
import { useContextFeed, type ContextEvent } from '@/lib/hooks/useContextFeed';
import {
  Activity, Shield, ShieldAlert, TrendingUp, TrendingDown,
  Wallet, Coin, Zap, Eye, ArrowRight, ChevronDown, RefreshCw, Globe,
} from '@/components/icons/brand';
import {
  SolanaIcon, EthereumIcon, BscIcon, PolygonIcon, AvalancheIcon, BaseIcon, AllChainsIcon,
} from '@/components/ChainIcons';

// LiveWire — the platform's own real-time on-chain news wire. It subscribes to
// the same /api/context-feed source as the Context Feed (SSE with a polling
// fallback, owned by useContextFeed) and renders each on-chain event as a clean,
// proof-style news card. No external news API, no fabricated data: when the feed
// is empty we say so honestly.

type IconCmp = (props: { className?: string }) => JSX.Element;

interface WireKind {
  label: string;
  Icon: IconCmp;
  className: string;
}

// Map the server event taxonomy to a clean, readable category label and a brand
// icon. Mirrors lib/contextFeed/filter.ts buckets without re-implementing them.
function classifyEvent(e: ContextEvent): WireKind {
  const type = (e.type || '').toLowerCase();
  if (type.includes('rug') || e.sentiment === 'BEARISH' && type.includes('alert')) {
    return { label: 'Security flag', Icon: ShieldAlert, className: 'text-red-300 bg-red-500/10 border-red-500/20' };
  }
  if (type.includes('smart_money')) {
    return { label: 'Smart money', Icon: Shield, className: 'text-[#6B7FFF] bg-[#0066FF]/10 border-[#0066FF]/20' };
  }
  if (type.includes('whale') || type.includes('transfer')) {
    return { label: 'Whale move', Icon: Wallet, className: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' };
  }
  if (type.includes('network')) {
    return { label: 'Network pulse', Icon: Activity, className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
  }
  if (type.includes('launch') || type.includes('new_listing')) {
    return { label: 'New listing', Icon: Zap, className: 'text-amber-300 bg-amber-500/10 border-amber-500/20' };
  }
  if (type.includes('trend')) {
    return { label: 'Trending', Icon: TrendingUp, className: 'text-purple-300 bg-purple-500/10 border-purple-500/20' };
  }
  return { label: 'Market signal', Icon: Coin, className: 'text-gray-300 bg-white/[0.05] border-white/10' };
}

function chainBadge(chain: string): { Icon: IconCmp; label: string } {
  switch ((chain || '').toLowerCase()) {
    case 'solana': return { Icon: SolanaIcon, label: 'Solana' };
    case 'ethereum': return { Icon: EthereumIcon, label: 'Ethereum' };
    case 'bsc': return { Icon: BscIcon, label: 'BSC' };
    case 'polygon': return { Icon: PolygonIcon, label: 'Polygon' };
    case 'avalanche': return { Icon: AvalancheIcon, label: 'Avalanche' };
    case 'base': return { Icon: BaseIcon, label: 'Base' };
    case 'arbitrum': return { Icon: EthereumIcon, label: 'Arbitrum' };
    case 'optimism': return { Icon: EthereumIcon, label: 'Optimism' };
    default: return { Icon: AllChainsIcon, label: chain ? chain.charAt(0).toUpperCase() + chain.slice(1) : 'On-chain' };
  }
}

function fmtUsd(val: number): string {
  if (!val || val <= 0) return '';
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function timeOf(e: ContextEvent): string {
  const raw = e.displayTimestamp || e.timestamp;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Hand the full event to the proof page the same way the Context Feed does:
// stash it in sessionStorage, then navigate to /dashboard/proof?id=. The proof
// page validates the payload with Zod before rendering, so this is the
// platform's canonical "view proof" path.
function openProof(e: ContextEvent) {
  try {
    sessionStorage.setItem('steinz_proof_event', JSON.stringify(e));
  } catch {
    // sessionStorage can be unavailable in private mode; the proof page falls
    // back to loading by id, so navigation still works.
  }
  window.location.href = `/dashboard/proof?id=${encodeURIComponent(e.id)}`;
}

function WireCard({ event }: { event: ContextEvent }) {
  const [open, setOpen] = useState(false);
  const kind = useMemo(() => classifyEvent(event), [event]);
  const chain = useMemo(() => chainBadge(event.chain), [event.chain]);
  const KindIcon = kind.Icon;
  const ChainIcon = chain.Icon;

  const isBull = event.sentiment === 'BULLISH';
  const isBear = event.sentiment === 'BEARISH';
  const sentimentColor = isBull ? '#10B981' : isBear ? '#EF4444' : '#F59E0B';
  const value = fmtUsd(event.valueUsd);
  const change = event.tokenPriceChange24h;

  return (
    <div className="rounded-2xl nl-glass nl-glass--interactive overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-start p-4"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${kind.className}`}>
            <KindIcon className="w-3 h-3" />
            {kind.label}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-semibold text-gray-300">
            <ChainIcon className="w-3 h-3" />
            {chain.label}
          </span>
          {event.tokenSymbol && (
            <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-semibold text-gray-200 font-mono">
              {event.tokenSymbol}
            </span>
          )}
          <span className="ms-auto text-[10px] text-gray-500 whitespace-nowrap">{timeOf(event)}</span>
        </div>

        <h3 className="text-[13.5px] font-semibold text-white leading-snug mb-1.5 break-words line-clamp-2">
          {event.title}
        </h3>
        <p className="text-[11.5px] text-gray-400 leading-relaxed line-clamp-2 break-words">
          {event.summary}
        </p>

        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {event.tokenPrice && (
            <span className="text-[11px] font-mono font-semibold text-white">{event.tokenPrice}</span>
          )}
          {typeof change === 'number' && change !== 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold"
              style={{ color: change > 0 ? '#10B981' : '#EF4444' }}
            >
              {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
          )}
          {value && <span className="text-[11px] text-gray-500">Value {value}</span>}
          <span className="ms-auto inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500">
            {open ? 'Hide detail' : 'View detail'}
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 -mt-1 nl-fade-up">
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Detail label="Signal confidence" value={`${event.trustScore}/100`} />
              <Detail
                label="Sentiment"
                value={isBull ? 'Bullish' : isBear ? 'Bearish' : 'Neutral'}
                color={sentimentColor}
              />
              {event.platform && <Detail label="Source" value={event.platform} />}
              {value && <Detail label="On-chain value" value={value} />}
              {event.tokenVolume24h ? <Detail label="Volume 24h" value={fmtUsd(event.tokenVolume24h)} /> : null}
              {event.tokenLiquidity ? <Detail label="Liquidity" value={fmtUsd(event.tokenLiquidity)} /> : null}
              {event.tokenMarketCap ? <Detail label="Market cap" value={fmtUsd(event.tokenMarketCap)} /> : null}
            </div>

            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Signal</span>
              <div className="flex-1 max-w-[140px] bg-white/10 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, event.trustScore))}%`,
                    backgroundColor: event.trustScore > 70 ? '#10B981' : event.trustScore > 40 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </div>
              <span className="text-[10px] font-semibold" style={{ color: sentimentColor }}>
                {event.trustScore > 70 ? 'Strong' : event.trustScore > 40 ? 'Medium' : 'Weak'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => openProof(event)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#0066FF]/10 border border-[#0066FF]/25 text-[12px] font-semibold text-[#6B7FFF] hover:bg-[#0066FF]/20 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View full proof
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[12px] font-semibold truncate" style={color ? { color } : undefined}>
        <span className={color ? '' : 'text-gray-200'}>{value}</span>
      </p>
    </div>
  );
}

const WIRE_LIMIT = 12;

export function LiveWire() {
  const { events, loading, refresh } = useContextFeed(200, 'all', 'all');
  const [refreshing, setRefreshing] = useState(false);

  const wire = useMemo(() => events.slice(0, WIRE_LIMIT), [events]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-[#0066FF] flex-shrink-0" />
          <h2 className="text-[15px] font-heading font-bold text-white truncate">Live Wire</h2>
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex-shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
          title="Refresh the wire"
          aria-label="Refresh the wire"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
        Real-time on-chain activity from our own intelligence layer: whale moves, smart-money flows,
        security flags, new listings, and network pulse. Open any item to view its proof.
      </p>

      {loading && wire.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl nl-glass p-4 animate-pulse">
              <div className="h-3 w-24 bg-white/5 rounded mb-3" />
              <div className="h-3.5 w-3/4 bg-white/5 rounded mb-2" />
              <div className="h-3 w-1/2 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : wire.length === 0 ? (
        <div className="rounded-2xl nl-glass p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <Activity className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-sm font-semibold text-gray-300 mb-1">The wire is quiet right now</p>
          <p className="text-xs text-gray-600 mb-4">
            No on-chain activity has cleared our signal threshold yet. New events stream in automatically.
          </p>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0066FF]/10 border border-[#0066FF]/25 text-[12px] font-semibold text-[#6B7FFF] hover:bg-[#0066FF]/20 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Check again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {wire.map((event, i) => (
            <div key={`${event.id}-${i}`} className={`nl-fade-up nl-fade-up-${Math.min((i % 4) + 1, 4)}`}>
              <WireCard event={event} />
            </div>
          ))}
          <p className="text-center text-[10px] text-gray-600 pt-1">
            Showing the {wire.length} most recent signals. Full history lives in the Context Feed.
          </p>
        </div>
      )}
    </section>
  );
}

export default LiveWire;
