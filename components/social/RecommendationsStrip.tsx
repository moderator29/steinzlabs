'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { FollowButton } from './FollowButton';

/**
 * RecommendationsStrip — "You might like to follow" horizontal carousel.
 * Dismissals stay in localStorage and ride to the server as a header
 * so the next refresh excludes them.
 */

interface RecommendedUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  is_chosen: boolean | null;
  success_rate: number | null;
  reason: string;
}

const DISMISS_KEY = 'naka_recs_dismissed';

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveDismissed(s: Set<string>) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(s).slice(-200))); } catch { /* full storage */ }
}

export function RecommendationsStrip() {
  const [users, setUsers] = useState<RecommendedUser[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => { setDismissed(loadDismissed()); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/social/recommendations', {
          headers: { 'x-dismissed-recommendations': Array.from(dismissed).join(',') },
          cache: 'no-store',
        });
        const json = await res.json();
        if (!cancelled) setUsers(json.users ?? []);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [dismissed]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed); next.add(id); saveDismissed(next); setDismissed(next);
  };

  if (users === null) return null;
  if (users.length === 0) return null;

  return (
    <section className="rounded-2xl nl-glass p-4">
      <header className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[var(--nl-blue,#0066FF)]" />
        <h2 className="text-sm font-bold text-white tracking-wide">You might like to follow</h2>
      </header>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
        {users.map((u) => (
          <div key={u.id} className="snap-start shrink-0 w-44 rounded-xl nl-glass p-3 relative">
            <button
              onClick={() => dismiss(u.id)}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/[0.04] hover:bg-white/[0.10] text-slate-400 hover:text-white flex items-center justify-center"
              aria-label={`Dismiss ${u.username ?? 'user'}`}
              title="Not interested"
            >
              <X className="w-3 h-3" />
            </button>
            <Link href={`/u/${u.username ?? u.id}`} className="block">
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-white/10 mb-2" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-sm font-bold text-white mb-2">
                  {(u.display_name || u.username || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="text-[12px] font-semibold text-white truncate">{u.display_name || u.username}</div>
              <div className="text-[10px] text-slate-400 truncate">@{u.username}</div>
              <div className="text-[10px] text-[var(--nl-blue,#0066FF)] mt-1 truncate">{u.reason}</div>
            </Link>
            <div className="mt-2">
              <FollowButton targetId={u.id} initialState="not_following" size="sm" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
