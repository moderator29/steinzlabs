'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, Star, Plus, Eye, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useRouter } from 'next/navigation';

/**
 * /smart-money — real-data feed of top whales by score (replaces the
 * prior hardcoded TOP_ENTITIES array that violated CLAUDE.md mock-data
 * rule). Data source: `whales` table (`/api/whales`) which the
 * whale-tracker page already consumes. Filters map UI categories to
 * the table's `entity_type` column.
 */

interface SmartMoneyEntity {
  id: string;
  name: string;
  type: 'Market Maker' | 'VC' | 'Whale' | string;
  winRate: number | null;
  description: string;
  address?: string;
}

const FILTERS = [
  { key: 'all',           label: 'All' },
  { key: 'vc',            label: 'VCs' },
  { key: 'market_maker',  label: 'Market Makers' },
  { key: 'whale',         label: 'Whales' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

export default function SmartMoneyPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<SmartMoneyEntity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
  const [totalTracked, setTotalTracked] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/whales?limit=24&sort=whale_score', {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          if (!cancelled) setError('Could not load smart-money feed');
          return;
        }
        const json = (await res.json()) as {
          whales?: Array<{
            id?: string;
            address?: string;
            label?: string | null;
            entity_type?: string | null;
            win_rate?: number | null;
            whale_score?: number | null;
            chain?: string;
          }>;
          total?: number;
        };
        if (cancelled) return;
        const mapped: SmartMoneyEntity[] = (json.whales ?? []).map((w) => ({
          id: w.id ?? w.address ?? '',
          name: w.label ?? `${(w.address ?? '').slice(0, 6)}…${(w.address ?? '').slice(-4)}`,
          type: (w.entity_type ?? 'Whale') as SmartMoneyEntity['type'],
          winRate: typeof w.win_rate === 'number' ? Math.round(w.win_rate) : null,
          description: w.chain ? `${w.chain.toUpperCase()} · score ${w.whale_score ?? '—'}` : `Score ${w.whale_score ?? '—'}`,
          address: w.address ?? undefined,
        }));
        setEntities(mapped);
        setTotalTracked(json.total ?? mapped.length);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Network error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Restore followed entities from server (real persistence — was previously
  // local-only state, lost on refresh).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/moneyRadar/follow', { signal: AbortSignal.timeout(10_000) });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { followed?: Array<{ entity_id?: string }> };
        const ids = new Set((json.followed ?? []).map((r) => r.entity_id ?? '').filter(Boolean));
        if (!cancelled) setFollowed(ids);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = (entities ?? []).filter((e) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'vc') return e.type === 'VC';
    if (activeFilter === 'market_maker') return e.type === 'Market Maker';
    if (activeFilter === 'whale') return e.type === 'Whale';
    return true;
  });

  const followEntity = async (entity: SmartMoneyEntity) => {
    setLoadingFollow(entity.id);
    try {
      const res = await fetch('/api/moneyRadar/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: entity.id,
          entityName: entity.name,
          entityType: entity.type,
          address: entity.address,
        }),
      });
      if (res.ok) {
        setFollowed((prev) => {
          const next = new Set(prev);
          next.add(entity.id);
          return next;
        });
      }
    } catch {
      /* Best-effort; UI stays in not-followed state */
    } finally {
      setLoadingFollow(null);
    }
  };

  const avgWinRate = entities && entities.length
    ? Math.round(
        entities.filter((e) => typeof e.winRate === 'number').reduce((s, e) => s + (e.winRate ?? 0), 0)
          / Math.max(1, entities.filter((e) => typeof e.winRate === 'number').length),
      )
    : null;

  return (
    <div className="min-h-screen bg-[var(--nl-canvas-base)] p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Smart Money"
          description="Follow top whales by composite score. Real-time on-chain activity, copy-trade ready."
        />

        {/* Stats — real numbers from the feed, no fabricated values */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Stat label="Entities Tracked" value={totalTracked.toLocaleString()} hint="From whales table" />
          <Stat label="You Follow" value={String(followed.size)} hint="Active monitors" />
          <Stat label="Avg Win Rate" value={avgWinRate === null ? '—' : `${avgWinRate}%`} hint="Across loaded entities" />
        </div>

        <div className="flex gap-2 mb-6">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === key
                  ? 'bg-[var(--nl-blue,#0066FF)] text-white'
                  : 'bg-[var(--nl-canvas-slightly-elev,#141824)] text-slate-300 hover:text-white border border-[var(--nl-border-dark,#1E2433)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : entities === null ? (
          <div className="flex items-center gap-2 text-sm text-slate-400" aria-busy="true">
            <Loader2 className="w-4 h-4 animate-spin" />Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-400 italic">No entities match this filter yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((entity) => {
              const isFollowed = followed.has(entity.id);
              return (
                <div
                  key={entity.id}
                  className="bg-[var(--nl-canvas-slightly-elev,#141824)] rounded-lg p-5 border border-[var(--nl-border-dark,#1E2433)] hover:border-[var(--nl-blue,#0066FF)]/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-[var(--nl-blue,#0066FF)]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users size={20} className="text-[var(--nl-blue,#0066FF)]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-bold truncate">{entity.name}</h3>
                        <span className="text-xs text-slate-400">{entity.type}</span>
                      </div>
                    </div>
                    {entity.winRate !== null && (
                      <div className="text-end ms-2 flex-shrink-0">
                        <div className="text-emerald-400 font-bold text-lg">{entity.winRate}%</div>
                        <div className="text-slate-500 text-xs">win rate</div>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-300 text-sm mb-4">{entity.description}</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/whale-tracker?address=${entity.address ?? entity.id}`)}
                      className="flex-1 bg-[var(--nl-canvas-base,#0A0E1A)] hover:bg-[var(--nl-border-dark,#1E2433)] text-slate-300 hover:text-white border border-[var(--nl-border-dark,#1E2433)] px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                      aria-label={`View ${entity.name}`}
                    >
                      <Eye size={14} />
                      View
                    </button>
                    <button
                      onClick={() => followEntity(entity)}
                      disabled={loadingFollow === entity.id || isFollowed}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        isFollowed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[var(--nl-blue,#0066FF)] hover:bg-[var(--nl-blue-strong,#0052CC)] text-white'
                      }`}
                      aria-label={isFollowed ? `Following ${entity.name}` : `Follow ${entity.name}`}
                    >
                      {isFollowed ? (
                        <><Star size={14} className="fill-current" /> Following</>
                      ) : (
                        <><Plus size={14} /> Follow</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {followed.size > 0 && (
          <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <TrendingUp size={18} />
              <span className="font-medium">Money Radar Active</span>
            </div>
            <p className="text-slate-300 text-sm mt-1">
              Tracking {followed.size} {followed.size === 1 ? 'entity' : 'entities'}. You&apos;ll receive alerts on significant moves.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-[var(--nl-canvas-slightly-elev,#141824)] rounded-lg p-4 border border-[var(--nl-border-dark,#1E2433)]">
      <div className="text-slate-400 text-sm">{label}</div>
      <div className="text-white text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {hint ? <div className="text-slate-500 text-xs mt-1">{hint}</div> : null}
    </div>
  );
}
