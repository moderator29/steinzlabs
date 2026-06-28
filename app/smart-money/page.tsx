'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, TrendingUp, Star, Plus, Eye, Loader2, Activity, Flame } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChainLogo } from '@/components/common/ChainLogo';

/**
 * /smart-money — live roster of ACTIVE, day-to-day whale TRADERS ranked by DEX
 * trading VOLUME (not holdings), sourced from the `whales` table (Bitquery
 * discovery feeds it). Filter by chain; follow to track + get alerts + copy.
 */

interface Trader {
  id: string;
  address: string;
  chain: string;
  name: string;
  volumeUsd: number | null;
  activeDays: number | null;
  winRate: number | null;
  score: number | null;
  type: string;
}

const CHAIN_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ethereum', label: 'Ethereum' },
  { key: 'base', label: 'Base' },
  { key: 'bsc', label: 'BSC' },
  { key: 'arbitrum', label: 'Arbitrum' },
  { key: 'solana', label: 'Solana' },
] as const;
type ChainKey = (typeof CHAIN_FILTERS)[number]['key'];

function fmtUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

export default function SmartMoneyPage() {
  const router = useRouter();
  const [traders, setTraders] = useState<Trader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [chain, setChain] = useState<ChainKey>('all');
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setTraders(null);
    setError(null);
    try {
      // Active daily traders, ranked by 7d DEX volume.
      const params = new URLSearchParams({ limit: '30', sort: 'volume', min_active_days: '3' });
      if (chain !== 'all') params.set('chain', chain);
      const res = await fetch(`/api/whales?${params}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { setError('Could not load the smart-money feed'); return; }
      const json = (await res.json()) as {
        whales?: Array<{
          id?: string; address?: string; label?: string | null; entity_type?: string | null;
          win_rate?: number | null; whale_score?: number | null; chain?: string;
          volume_7d_usd?: number | null; active_days_7d?: number | null;
        }>;
        total?: number;
      };
      const mapped: Trader[] = (json.whales ?? []).map((w) => ({
        id: w.id ?? w.address ?? '',
        address: w.address ?? '',
        chain: w.chain ?? 'ethereum',
        name: w.label ?? `${(w.address ?? '').slice(0, 6)}…${(w.address ?? '').slice(-4)}`,
        volumeUsd: w.volume_7d_usd ?? null,
        activeDays: w.active_days_7d ?? null,
        winRate: typeof w.win_rate === 'number' ? Math.round(w.win_rate) : null,
        score: w.whale_score ?? null,
        type: w.entity_type ?? 'trader',
      }));
      setTraders(mapped);
      setTotal(json.total ?? mapped.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  }, [chain]);

  useEffect(() => { void load(); }, [load]);

  // Restore followed wallets (keyed by address).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/moneyRadar/follow', { signal: AbortSignal.timeout(10_000) });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { followed?: Array<{ address?: string }> };
        const addrs = new Set((json.followed ?? []).map((r) => r.address ?? '').filter(Boolean));
        if (!cancelled) setFollowed(addrs);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const follow = async (t: Trader) => {
    if (!t.address || !t.chain) return;
    setLoadingFollow(t.id);
    try {
      const res = await fetch('/api/moneyRadar/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: t.id, entityName: t.name, entityType: t.type, address: t.address, chain: t.chain }),
      });
      if (res.ok) setFollowed((prev) => new Set(prev).add(t.address));
    } catch { /* best-effort */ } finally {
      setLoadingFollow(null);
    }
  };

  const list = traders ?? [];

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="nl-glass rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[#8FA3FF]" />
          <h1 className="text-xl sm:text-2xl font-bold text-white">Smart Money</h1>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Active day-to-day traders ranked by <span className="text-[#8FA3FF] font-semibold">DEX volume</span> — not holdings. Follow to track, get alerts, and copy.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        <Stat icon={<Users className="w-4 h-4" />} label="Traders" value={total.toLocaleString()} />
        <Stat icon={<Star className="w-4 h-4" />} label="You Follow" value={String(followed.size)} />
        <Stat icon={<TrendingUp className="w-4 h-4" />} label="Top Volume" value={fmtUsd(list[0]?.volumeUsd ?? null)} hint="7d" />
      </div>

      {/* Chain filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CHAIN_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setChain(key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              chain === key
                ? 'bg-[#0066FF]/15 text-[#8FA3FF] border-[#0066FF]/40'
                : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="nl-glass rounded-xl p-4 text-sm text-red-300">{error}</div>
      ) : traders === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 p-4" aria-busy="true">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading active traders…
        </div>
      ) : list.length === 0 ? (
        <div className="nl-glass rounded-xl p-6 text-sm text-slate-400 text-center">
          No active traders for this chain yet. The Bitquery discovery cron fills this within a few hours.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {list.map((t) => {
            const isFollowed = !!t.address && followed.has(t.address);
            return (
              <div key={t.id} className="nl-glass nl-glass--interactive rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#0066FF]/15 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-[#8FA3FF]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-bold truncate">{t.name}</h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <ChainLogo chain={t.chain} size={12} />
                        <span className="capitalize">{t.chain}</span>
                      </div>
                    </div>
                  </div>
                  {t.activeDays != null && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-500/12 text-emerald-300 border border-emerald-500/25">
                      <Activity className="w-3 h-3" /> {t.activeDays}/7d
                    </span>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <Metric label="Vol 7d" value={fmtUsd(t.volumeUsd)} tone="blue" />
                  <Metric label="Win rate" value={t.winRate != null ? `${t.winRate}%` : '—'} tone={t.winRate != null && t.winRate >= 50 ? 'green' : 'neutral'} />
                  <Metric label="Score" value={t.score != null ? String(t.score) : '—'} tone="neutral" />
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => router.push(`/dashboard/whale-tracker/${t.address}?chain=${t.chain}`)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button
                    onClick={() => follow(t)}
                    disabled={loadingFollow === t.id || isFollowed || !t.address}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${
                      isFollowed
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-[#0066FF]/15 text-[#8FA3FF] border border-[#0066FF]/35 hover:bg-[#0066FF]/25'
                    }`}
                  >
                    {loadingFollow === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : isFollowed ? <><Star className="w-3.5 h-3.5 fill-current" /> Following</>
                      : <><Plus className="w-3.5 h-3.5" /> Follow</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="nl-glass rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] uppercase tracking-wide">{icon}{label}</div>
      <div className="text-white text-xl sm:text-2xl font-bold mt-1 tabular-nums">{value}{hint ? <span className="text-xs text-slate-500 ms-1">{hint}</span> : null}</div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'neutral' }) {
  const color = tone === 'blue' ? 'text-[#8FA3FF]' : tone === 'green' ? 'text-emerald-400' : 'text-white';
  return (
    <div className="rounded-lg bg-black/20 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-[12px] font-bold font-mono mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
