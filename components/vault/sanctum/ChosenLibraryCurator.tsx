'use client';

import { useEffect, useState } from 'react';

interface Track {
  id: string;
  title: string;
  artist: string;
  storage_path: string;
  display_order: number;
}

/**
 * Chosen-only Sanctum Library curator. Reorders / soft-deletes tracks via
 * /api/cult/sanctum/library/reorder and /api/cult/sanctum/library/[id].
 *
 * Up/down arrow controls (instead of drag-drop) so the surface is keyboard
 * + screen-reader navigable. The reorder API accepts any new order, so a
 * future drag-drop swap is pure UI.
 */
export function ChosenLibraryCurator() {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [isChosen, setIsChosen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/cult/me', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/cult/sanctum/library', { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([me, lib]) => {
        if (cancelled) return;
        setIsChosen(!!me?.isChosen);
        setTracks((lib?.tracks ?? []) as Track[]);
      })
      .catch(() => {
        if (!cancelled) setIsChosen(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isChosen !== true || !tracks) return null;
  if (tracks.length === 0) return null;

  async function commitOrder(next: Track[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cult/sanctum/library/reorder', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order: next.map((t) => t.id) }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'reorder_failed');
        return;
      }
      setTracks(next.map((t, i) => ({ ...t, display_order: i })));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    if (!tracks) return;
    const target = index + direction;
    if (target < 0 || target >= tracks.length) return;
    const next = tracks.slice();
    [next[index], next[target]] = [next[target], next[index]];
    void commitOrder(next);
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cult/sanctum/library/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'remove_failed');
        return;
      }
      setTracks((tracks ?? []).filter((t) => t.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="sanctum-subchamber sanctum-subchamber--chosen"
      aria-label="Chosen — curate the Library"
      style={{ outline: '1px solid rgba(255,216,107,0.55)', outlineOffset: '-1px' }}
    >
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#FFD86B]">Chosen path</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">
          {tracks.length} tracks
        </span>
      </header>
      <h3 className="sanctum-subchamber__title">Curate the Library</h3>
      <p className="sanctum-subchamber__tagline">
        The order is yours. The cult hears what you choose, in the sequence you choose.
      </p>

      <ul className="mt-4 flex flex-col gap-1.5" aria-busy={busy}>
        {tracks.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <span className="w-5 text-right text-[10px] text-[#7F8AA8]">{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-[13px] text-white">{t.title}</span>
              <span className="block truncate text-[11px] text-[#B4C0E0]">{t.artist}</span>
            </span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={busy || i === 0}
              aria-label={`Move ${t.title} up`}
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#B4C0E0] hover:bg-white/[0.06] disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={busy || i === tracks.length - 1}
              aria-label={`Move ${t.title} down`}
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#B4C0E0] hover:bg-white/[0.06] disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(t.id)}
              disabled={busy}
              aria-label={`Remove ${t.title} from the library`}
              className="rounded-md border border-[#FF1744]/30 px-2 py-1 text-[11px] text-[#FF1744] hover:bg-[#FF1744]/10 disabled:opacity-30"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="mt-2 text-[11px] text-[#FF1744]" role="alert">
          {error === 'chosen_only'
            ? 'Only the Chosen may curate.'
            : error === 'order_required'
              ? 'Reorder rejected — empty order.'
              : 'Action failed. Try again.'}
        </p>
      ) : null}

      <div className="sanctum-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
