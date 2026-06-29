'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Copy as CopyIcon, X } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import TraderCard, { type TraderCardData } from '@/components/whales/TraderCard';
import FollowWhaleModal from '@/components/whales/FollowWhaleModal';

/**
 * /dashboard/whale-tracker/copy-trade — find a whale to copy-trade. Search reads
 * straight from the whale directory (/api/whales/directory); if the whale is
 * tracked, it surfaces here and can be copied. Defaults to the top daily-active
 * traders (the genuinely copy-tradeable set) when no query is entered.
 */

interface DirRow extends TraderCardData { id?: string }

export default function CopyTradeSearchPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<DirRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [copyTarget, setCopyTarget] = useState<TraderCardData | null>(null);

  const load = useCallback(async (query: string) => {
    setRows(null); setError(null);
    try {
      const p = new URLSearchParams({ limit: '24', sort: 'volume' });
      if (query.trim()) p.set('q', query.trim());
      else p.set('activity', 'daily'); // default: genuinely active traders
      const res = await fetch(`/api/whales/directory?${p}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { setError('Could not load traders'); setRows([]); return; }
      const d = (await res.json()) as { whales?: DirRow[] };
      setRows(d.whales ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setRows([]);
    }
  }, []);

  // Debounce the search.
  useEffect(() => {
    const t = setTimeout(() => void load(q), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

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
    <div className="min-h-screen bg-[#05081E] text-white pb-20">
      <div className="sticky top-0 z-30 bg-[#05081E]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <BackButton compact />
          <div className="flex items-center gap-2 min-w-0">
            <CopyIcon className="w-4 h-4 text-emerald-300 shrink-0" />
            <h1 className="text-sm font-semibold tracking-tight">Copy Trade</h1>
          </div>
          <nav className="ms-auto flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
            <Link href="/dashboard/whale-tracker" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Live Feed</Link>
            <Link href="/dashboard/whale-tracker/directory" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Directory</Link>
            <Link href="/dashboard/whale-tracker/watchlist" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Watchlist</Link>
          </nav>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-2 nl-glass rounded-lg px-3 py-2.5">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a whale to copy by label or address…"
              className="flex-1 bg-transparent outline-none text-sm placeholder-slate-500"
              autoFocus
            />
            {q && <button onClick={() => setQ('')} aria-label="Clear" className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 px-1">
            {q ? 'Searching the whale directory…' : 'Showing top daily-active traders. Search to find a specific whale.'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm mb-4">{error}</div>}
        {rows === null ? (
          <div className="flex items-center justify-center py-24 text-slate-500"><Loader2 className="w-5 h-5 animate-spin me-2" /> Loading…</div>
        ) : list.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-300 font-semibold mb-1">{q ? 'No whale matches that search.' : 'No active traders to copy yet.'}</p>
            <p className="text-slate-500 text-sm">{q ? 'Try a different label or paste a full address.' : 'Active traders appear here as the discovery cron populates volume.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
      </div>

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
