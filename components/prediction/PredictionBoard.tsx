'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Search,
  TrendingUp,
  Clock,
  ExternalLink,
  Droplets,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

// Mirrors the server shape in app/api/prediction/route.ts. Kept local so the
// component stays decoupled from the route module (client bundle stays clean).
interface Outcome {
  label: string;
  price: number; // 0..1
  pct: number; // 0..100
}
interface Market {
  id: string;
  question: string;
  category: string | null;
  outcomes: Outcome[];
  volume: number | null;
  liquidity: number | null;
  endDate: string | null;
  url: string;
}
interface ApiResponse {
  markets: Market[];
  count: number;
  updatedAt: string;
  stale: boolean;
  error: string | null;
}

type Status = 'loading' | 'ready' | 'error';

const ALL = 'All';

// ── formatting helpers ───────────────────────────────────────────────────────
function formatUsd(n: number | null): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function formatClose(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diff = t - Date.now();
  if (diff <= 0) return 'Closed';
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return days === 1 ? '1 day' : `${days} days`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return hours === 1 ? '1 hour' : `${hours} hours`;
  return '<1 hour';
}

// ── odds bar: leader emerald, runner-up red, rest neutral-blue ────────────────
function outcomeColor(rank: number): { bar: string; text: string } {
  if (rank === 0) return { bar: 'bg-emerald-400', text: 'text-emerald-400' };
  if (rank === 1) return { bar: 'bg-red-400/80', text: 'text-red-400' };
  return { bar: 'bg-[#0066FF]/60', text: 'text-[#9FD0FF]' };
}

function OddsRow({ outcome, rank }: { outcome: Outcome; rank: number }) {
  const c = outcomeColor(rank);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
        <span className="text-gray-300 truncate">{outcome.label}</span>
        <span className={`font-semibold tabular-nums shrink-0 ${c.text}`}>{outcome.pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full ${c.bar}`}
          style={{ width: `${Math.max(2, Math.min(100, outcome.pct))}%` }}
        />
      </div>
    </div>
  );
}

function MarketCard({ market }: { market: Market }) {
  const top = market.outcomes.slice(0, 3);
  const volume = formatUsd(market.volume);
  const liquidity = formatUsd(market.liquidity);
  const close = formatClose(market.endDate);
  return (
    <a
      href={market.url}
      target="_blank"
      rel="noopener noreferrer"
      className="nl-glass nl-glass--interactive group rounded-2xl p-4 flex flex-col justify-between min-h-[188px] no-underline"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          {market.category ? (
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[#9FD0FF] bg-[#0066FF]/[0.14] border border-[#0066FF]/25 rounded-full px-2 py-0.5">
              {market.category}
            </span>
          ) : (
            <span />
          )}
          <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#9FD0FF] transition-colors shrink-0" />
        </div>
        <p className="mt-2 text-sm font-semibold text-white leading-snug line-clamp-3">
          {market.question}
        </p>
      </div>

      <div className="mt-4 space-y-2.5">
        {top.map((o, i) => (
          <OddsRow key={`${market.id}-${o.label}-${i}`} outcome={o} rank={i} />
        ))}
      </div>

      {(volume || liquidity || close) && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-gray-500">
          {volume && (
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {volume} Vol
            </span>
          )}
          {liquidity && (
            <span className="inline-flex items-center gap-1">
              <Droplets className="w-3 h-3" /> {liquidity}
            </span>
          )}
          {close && (
            <span className="inline-flex items-center gap-1 ms-auto">
              <Clock className="w-3 h-3" /> {close}
            </span>
          )}
        </div>
      )}
    </a>
  );
}

function CardSkeleton() {
  return (
    <div className="nl-glass rounded-2xl p-4 min-h-[188px] flex flex-col justify-between animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-16 rounded-full bg-white/[0.06]" />
        <div className="h-3.5 w-full rounded bg-white/[0.06]" />
        <div className="h-3.5 w-3/4 rounded bg-white/[0.06]" />
      </div>
      <div className="space-y-3 mt-4">
        <div className="h-1.5 w-full rounded-full bg-white/[0.06]" />
        <div className="h-1.5 w-full rounded-full bg-white/[0.06]" />
      </div>
      <div className="h-3 w-2/3 rounded bg-white/[0.06] mt-4" />
    </div>
  );
}

export default function PredictionBoard() {
  const [status, setStatus] = useState<Status>('loading');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [stale, setStale] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/prediction', { cache: 'no-store' });
      const data: ApiResponse = await res.json();
      if (!res.ok && (!data.markets || data.markets.length === 0)) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setMarkets(Array.isArray(data.markets) ? data.markets : []);
      setStale(Boolean(data.stale));
      setStatus('ready');
    } catch {
      setMarkets([]);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of markets) if (m.category) set.add(m.category);
    return [ALL, ...Array.from(set).sort()];
  }, [markets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter((m) => {
      if (category !== ALL && m.category !== category) return false;
      if (q && !m.question.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [markets, query, category]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prediction markets"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#0066FF]/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Leading
          </span>
          <span className="inline-flex items-center gap-1 ms-1">
            <span className="w-2 h-2 rounded-full bg-red-400/80" /> Trailing
          </span>
        </div>
      </div>

      {/* Category chips — built ONLY from categories the API really returns. */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                category === c
                  ? 'bg-[#0066FF]/[0.16] border-[#0066FF]/40 text-[#9FD0FF]'
                  : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:text-gray-200 hover:border-white/[0.14]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {stale && status === 'ready' && (
        <div className="flex items-center gap-2 text-[11px] text-amber-400/90">
          <AlertTriangle className="w-3.5 h-3.5" />
          Showing the last available snapshot — live data is temporarily unreachable.
        </div>
      )}

      {/* States */}
      {status === 'loading' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="nl-glass rounded-2xl px-5 py-10 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-amber-500/10 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Markets unavailable</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            We couldn&apos;t reach Polymarket right now. No data is shown rather than stale guesses.
          </p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0066FF] hover:bg-[#0066FF]/90 text-white text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {status === 'ready' && filtered.length === 0 && (
        <div className="nl-glass rounded-2xl px-5 py-10 text-center">
          <h3 className="text-base font-semibold text-white">No markets match</h3>
          <p className="text-sm text-gray-400 mt-1">
            {markets.length === 0
              ? 'No active prediction markets are available right now.'
              : 'Try a different search or category.'}
          </p>
        </div>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <p className="text-[11px] text-gray-600 text-center pt-1">
          Live odds from Polymarket. Prices are implied probabilities, not guarantees.
        </p>
      )}
    </div>
  );
}
