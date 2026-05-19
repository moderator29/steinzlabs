'use client';

import { useEffect, useMemo, useState } from 'react';

type Slot = 'avatar' | 'frame' | 'glow' | 'banner' | 'title' | 'sigil';

interface Cosmetic {
  id: string;
  slot: Slot;
  code: string;
  label: string;
  asset_url: string | null;
  preview_color: string | null;
  requires_achievement_code: string | null;
}

interface LoadoutEntry {
  slot: Slot;
  cosmetic_id: string;
  equipped_at: string;
}

interface MantleResponse {
  slots: readonly Slot[];
  cosmetics: Cosmetic[];
  loadout: LoadoutEntry[];
  earnedAchievementCodes: string[];
}

const SLOT_TITLE: Record<Slot, string> = {
  avatar: 'Avatar',
  frame: 'Frame',
  glow: 'Glow',
  banner: 'Banner',
  title: 'Title',
  sigil: 'Sigil',
};

/**
 * The Mantle — dressing room. Six slots, swatches drawn from
 * preview_color when asset_url isn't ready yet. Tabs switch the focused
 * slot; equipping is one click and writes through to cult_member_loadouts.
 */
export function MantlePanel() {
  const [state, setState] = useState<MantleResponse | null>(null);
  const [focusSlot, setFocusSlot] = useState<Slot>('avatar');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/cult/sanctum/mantle', { credentials: 'include' });
    if (!res.ok) {
      setState(null);
      return;
    }
    setState((await res.json()) as MantleResponse);
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/sanctum/mantle', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MantleResponse | null) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const equippedBySlot = useMemo(() => {
    const m = new Map<Slot, string>();
    for (const e of state?.loadout ?? []) m.set(e.slot, e.cosmetic_id);
    return m;
  }, [state?.loadout]);

  if (!state) return null;
  const earned = new Set(state.earnedAchievementCodes);
  const itemsForSlot = state.cosmetics.filter((c) => c.slot === focusSlot);

  async function equip(c: Cosmetic) {
    if (c.requires_achievement_code && !earned.has(c.requires_achievement_code)) {
      setError('achievement_required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cult/sanctum/mantle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slot: c.slot, cosmetic_id: c.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'equip_failed');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="sanctum-subchamber sanctum-subchamber--mantle" aria-label="The Mantle">
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">The Mantle</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0]">
          {equippedBySlot.size} / {state.slots.length} equipped
        </span>
      </header>
      <h3 className="sanctum-subchamber__title">Dress the cult</h3>
      <p className="sanctum-subchamber__tagline">
        Six slots. Pick what carries forward when the cult sees you.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {state.slots.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFocusSlot(s)}
            aria-pressed={focusSlot === s}
            className={`rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
              focusSlot === s
                ? 'border-[#00C8FF]/60 text-white bg-[#00C8FF]/[0.08]'
                : 'border-white/10 text-[#B4C0E0] hover:bg-white/[0.04]'
            }`}
          >
            {SLOT_TITLE[s]}
            {equippedBySlot.has(s) ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {itemsForSlot.map((c) => {
          const equipped = equippedBySlot.get(focusSlot) === c.id;
          const locked = !!c.requires_achievement_code && !earned.has(c.requires_achievement_code);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => equip(c)}
                disabled={busy || equipped || locked}
                className={`w-full rounded-lg border px-3 py-2 text-start text-[12px] ${
                  equipped
                    ? 'border-[#00C8FF]/60 bg-[#00C8FF]/[0.08]'
                    : locked
                      ? 'border-white/5 bg-white/[0.02] opacity-60 cursor-not-allowed'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
                aria-label={`Equip ${c.label}${locked ? ' (locked)' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      background:
                        c.preview_color && c.preview_color !== 'transparent'
                          ? c.preview_color
                          : '#0b1022',
                      boxShadow:
                        c.preview_color && c.preview_color !== 'transparent'
                          ? `0 0 6px ${c.preview_color}`
                          : undefined,
                      border:
                        c.preview_color === 'transparent'
                          ? '1px dashed rgba(255,255,255,0.3)'
                          : undefined,
                    }}
                  />
                  <span className="flex-1 truncate text-white">{c.label}</span>
                </span>
                {locked ? (
                  <span className="block mt-1 text-[9px] uppercase tracking-[0.18em] text-[#FF1744]">
                    Requires {c.requires_achievement_code}
                  </span>
                ) : equipped ? (
                  <span className="block mt-1 text-[9px] uppercase tracking-[0.18em] text-[#00C8FF]">
                    Equipped
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="mt-2 text-[11px] text-[#FF1744]" role="alert">
          {error === 'achievement_required'
            ? 'This cosmetic is gated by an achievement you have not earned yet.'
            : error === 'slot_mismatch'
              ? 'That cosmetic does not fit this slot.'
              : 'Equip failed. Try again.'}
        </p>
      ) : null}

      <div className="sanctum-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
