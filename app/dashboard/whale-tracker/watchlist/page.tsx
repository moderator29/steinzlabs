'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Star } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import TraderCard, { type TraderCardData } from '@/components/whales/TraderCard';
import FollowWhaleModal from '@/components/whales/FollowWhaleModal';

/**
 * /dashboard/whale-tracker/watchlist — the user's watched whales, rendered with
 * the SAME trader card as the directory and live feed. Backed by
 * user_whale_follows (enriched with directory stats server-side).
 */

interface WatchRow {
  whale_address: string;
  chain: string;
  label: string | null;
  copy_mode?: string | null;
  whale: Partial<TraderCardData> | null;
}

function toCardData(r: WatchRow): TraderCardData {
  const w = r.whale ?? {};
  return {
    address: r.whale_address,
    chain: r.chain,
    label: (w.label as string) ?? r.label ?? null,
    entity_type: (w.entity_type as string) ?? null,
    archetype: (w.archetype as string) ?? null,
    whale_score: (w.whale_score as number) ?? null,
    portfolio_value_usd: (w.portfolio_value_usd as number) ?? null,
    pnl_30d_usd: (w.pnl_30d_usd as number) ?? null,
    win_rate: (w.win_rate as number) ?? null,
    volume_7d_usd: (w.volume_7d_usd as number) ?? null,
    active_days_7d: (w.active_days_7d as number) ?? null,
    follower_count: (w.follower_count as number) ?? null,
    verified: (w.verified as boolean) ?? false,
    naka_number: (w.naka_number as number) ?? null,
    logo_url: (w.logo_url as string) ?? null,
    logo_source: (w.logo_source as string) ?? null,
  };
}

export default function WatchlistPage() {
  const router = useRouter();
  const [rows, setRows] = useState<WatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followTarget, setFollowTarget] = useState<TraderCardData | null>(null);

  const load = useCallback(async () => {
    setRows(null); setError(null);
    try {
      const res = await fetch('/api/whale-tracker/watchlist', { signal: AbortSignal.timeout(15_000) });
      if (res.status === 401 || res.status === 403) { setError('Sign in with a Pro plan to use your watchlist.'); setRows([]); return; }
      if (!res.ok) { setError('Could not load your watchlist'); setRows([]); return; }
      const d = (await res.json()) as { watchlist?: WatchRow[] };
      setRows(d.watchlist ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setRows([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unwatch = useCallback(async (t: TraderCardData) => {
    setRows((prev) => (prev ?? []).filter((r) => !(r.whale_address === t.address && r.chain === t.chain)));
    try {
      await fetch(`/api/whale-tracker/watchlist?whale_address=${encodeURIComponent(t.address)}&chain=${encodeURIComponent(t.chain)}`, { method: 'DELETE' });
    } catch { void load(); }
  }, [load]);

  const openProfile = (t: TraderCardData) => router.push(`/dashboard/whale-tracker/${encodeURIComponent(t.address)}?chain=${encodeURIComponent(t.chain)}`);
  const startCopy = (t: TraderCardData) => router.push(`/dashboard/copy-trading?whale=${encodeURIComponent(t.address)}&chain=${encodeURIComponent(t.chain)}&label=${encodeURIComponent(t.label ?? '')}`);

  const list = rows ?? [];

  return (
    <div className="min-h-screen bg-[#05081E] text-white pb-20">
      <div className="sticky top-0 z-30 bg-[#05081E]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <BackButton compact />
          <div className="flex items-center gap-2 min-w-0">
            <Star className="w-4 h-4 text-amber-300 shrink-0" fill="currentColor" />
            <h1 className="text-sm font-semibold tracking-tight">Watchlist</h1>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Link href="/dashboard/whale-tracker" className="nl-btn-neon !px-3 !py-1.5 !text-[11px]">Live Feed</Link>
            <Link href="/dashboard/whale-tracker/directory" className="nl-btn-neon !px-3 !py-1.5 !text-[11px]">Directory</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {error && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-sm mb-4">{error}</div>
        )}
        {rows === null ? (
          <div className="flex items-center justify-center py-24 text-slate-500"><Loader2 className="w-5 h-5 animate-spin me-2" /> Loading your watchlist…</div>
        ) : list.length === 0 ? (
          <div className="text-center py-24">
            <Star className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-300 font-semibold mb-1">No whales watched yet.</p>
            <p className="text-slate-500 text-sm mb-4">Tap the ★ on any whale in the directory or live feed to add it here.</p>
            <Link href="/dashboard/whale-tracker/directory" className="nl-btn-neon !px-4 !py-2 !text-xs">Browse the directory</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((r) => {
              const t = toCardData(r);
              return (
                <TraderCard
                  key={`${r.chain}:${r.whale_address}`}
                  trader={t}
                  watched
                  onOpen={() => openProfile(t)}
                  onFollow={() => setFollowTarget(t)}
                  onToggleWatch={() => unwatch(t)}
                  onCopy={() => startCopy(t)}
                />
              );
            })}
          </div>
        )}
      </div>

      {followTarget && (
        <FollowWhaleModal
          whale={followTarget as never}
          onClose={() => setFollowTarget(null)}
          onDone={() => setFollowTarget(null)}
        />
      )}
    </div>
  );
}
