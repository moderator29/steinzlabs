'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { TierBadge } from '@/components/ui/TierBadge';

/**
 * SearchBox — 300ms-debounced live autocomplete over /api/social/search.
 * Used by /discover and the bottom-nav Find button. Aborts in-flight
 * requests on every keystroke so the latest typed query always wins.
 */

interface User {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  verified_badge: string | null;
  is_chosen: boolean | null;
}

export function SearchBox({ autoFocus = false, onResultClick }: { autoFocus?: boolean; onResultClick?: (u: User) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/social/search?q=${encodeURIComponent(q.trim())}&limit=10`, { signal: ctrl.signal });
        const json = await res.json();
        setResults(json.users ?? []);
      } catch {
        /* aborted or network — silently ignore; UI shows old results */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 focus-within:border-[var(--nl-blue,#0066FF)]/60">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) router.push(`/discover?q=${encodeURIComponent(q.trim())}`); }}
          placeholder="Search users by username, name, badge…"
          // §search-zoom — iOS Safari auto-zooms any focused input whose
          // font-size is < 16px. text-sm (14px) caused the view to jump/zoom
          // on focus; text-base (16px) keeps the page stable, no zoom.
          className="flex-1 bg-transparent outline-none text-base text-white placeholder:text-slate-500"
          aria-label="Search users"
        />
        {q && (
          <button onClick={() => setQ('')} className="text-slate-400 hover:text-white" aria-label="Clear search">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {results !== null && q.trim() && (
        <div className="absolute top-full mt-2 left-0 right-0 rounded-xl bg-[#0F1627] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 max-h-80 overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-slate-400">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-slate-400">No users match &quot;{q}&quot;.</div>
          ) : (
            <>
              {results.map((u) => (
                <Link
                  key={u.id}
                  href={`/u/${u.username ?? u.id}`}
                  onClick={() => onResultClick?.(u)}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04]"
                >
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-[10px] font-bold text-white">
                      {(u.display_name || u.username || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-white truncate">{u.display_name || u.username}</span>
                      {/* §8 — surface the tier/verified badge next to the name. */}
                      {u.tier && u.tier !== 'free' && <TierBadge tier={u.tier} size={13} />}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">@{u.username}</div>
                  </div>
                </Link>
              ))}
              <Link href={`/discover?q=${encodeURIComponent(q.trim())}`} className="block text-center px-3 py-2 text-[11px] text-[var(--nl-blue,#0066FF)] hover:bg-white/[0.04]">
                View all results →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
