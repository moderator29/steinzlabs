'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import TraderCard, { type TraderCardData } from '@/components/whales/TraderCard';
import FollowWhaleModal from '@/components/whales/FollowWhaleModal';

/**
 * LiveTradersGrid — the "Traders" view of the live feed: the most active
 * day-to-day traders ranked by 7d DEX volume (NOT a transaction tape), each as
 * the shared TraderCard so you can star, copy-trade, or open the profile. Reads
 * the whale directory (custodial exchanges already excluded server-side).
 * Refreshes on demand + hourly.
 */

const REFRESH_MS = 60 * 60 * 1000; // hourly auto-refresh

export default function LiveTradersGrid({ chain }: { chain?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<TraderCardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [copyTarget, setCopyTarget] = useState<TraderCardData | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setRows(null);
    setError(null);
    try {
      const p = new URLSearchParams({ limit: '30', sort: 'volume' });
      if (chain && chain !== 'all') p.set('chain', chain);
      const res = await fetch(`/api/whales/directory?${p}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { setError('Could not load traders'); setRows([]); return; }
      const d = (await res.json()) as { whales?: TraderCardData[] };
      setRows(d.whales ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setRows([]);
    } finally {
      setRefreshing(false);
    }
  }, [chain]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/whale-tracker/watchlist', { signal: AbortSignal.timeout(10_000) });
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as { watchlist?: Array<{ whale_address?: string; chain?: string }> };
        const keys = new Set((d.watchlist ?? []).map((w) => `${(w.chain ?? '').toLowerCase()}:${w.whale_address ?? ''}`).filter(Boolean));
        if (!cancelled) setWatched(keys);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleWatch = useCallback(async (t: TraderCardData) => {
    const key = `${t.chain.toLowerCase()}:${t.address}`;
    const isW = watched.has(key);
    setWatched((prev) => { const n = new Set(prev); if (isW) n.delete(key); else n.add(key); return n; });
    try {
      if (isW) await fetch(`/api/whale-tracker/watchlist?whale_address=${encodeURIComponent(t.address)}&chain=${encodeURIComponent(t.chain)}`, { method: 'DELETE' });
      else await fetch('/api/whale-tracker/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whale_address: t.address, chain: t.chain, label: t.label ?? null }) });
    } catch { setWatched((prev) => { const n = new Set(prev); if (isW) n.add(key); else n.delete(key); return n; }); }
  }, [watched]);

  const list = rows ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">
          Active traders · ranked by 7d DEX volume
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/[0.04] text-slate-300 border border-white/10 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
          aria-label="Refresh traders"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-300">{error}</div>
      ) : rows === null ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-5 h-5 animate-spin me-2" /> Loading active traders…</div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          No active traders yet.
          <br />
          <span className="text-xs text-slate-600">The Bitquery discovery cron ranks traders by volume as it populates.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {list.map((t) => (
            <TraderCard
              key={`${t.chain}:${t.address}`}
              trader={t}
              watched={watched.has(`${t.chain.toLowerCase()}:${t.address}`)}
              onOpen={() => router.push(`/dashboard/whale-tracker/${encodeURIComponent(t.address)}?chain=${encodeURIComponent(t.chain)}`)}
              onFollow={() => setCopyTarget(t)}
              onToggleWatch={() => toggleWatch(t)}
              onCopy={() => setCopyTarget(t)}
            />
          ))}
        </div>
      )}

      {copyTarget && (
        <FollowWhaleModal
          whale={copyTarget as never}
          onClose={() => setCopyTarget(null)}
          onDone={() => setCopyTarget(null)}
        />
      )}
    </div>
  );
}
