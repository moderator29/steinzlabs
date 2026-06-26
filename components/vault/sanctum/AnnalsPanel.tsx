'use client';

import { useEffect, useState } from 'react';

interface CatalogEntry {
  id: string;
  code: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'mythic';
}

interface EarnedEntry {
  achievement_id: string;
  earned_at: string;
  note: string | null;
}

interface AnnalsResponse {
  catalog: CatalogEntry[];
  earnings: EarnedEntry[];
}

const TIER_COLOR: Record<CatalogEntry['tier'], { ring: string; label: string }> = {
  bronze: { ring: 'rgba(205,127,50,0.65)', label: '#CD7F32' },
  silver: { ring: 'rgba(203,213,225,0.7)', label: '#CBD5E1' },
  gold: { ring: 'rgba(255,216,107,0.85)', label: '#FFD86B' },
  mythic: { ring: 'rgba(220,20,60,0.9)', label: '#DC143C' },
};

/**
 * The Annals · every cult member sees the catalog plus their own earnings.
 * Earned rows highlight in tier colour; locked rows render dimmed so the
 * surface communicates the climb without an explicit progress bar.
 */
export function AnnalsPanel() {
  const [state, setState] = useState<AnnalsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/sanctum/annals', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AnnalsResponse | null) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  const earnedMap = new Map(state.earnings.map((e) => [e.achievement_id, e]));
  const totalEarned = state.earnings.length;
  const totalCatalog = state.catalog.length;

  return (
    <article className="sanctum-subchamber sanctum-subchamber--annals" aria-label="The Annals">
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">The Annals</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#FFD86B]">
          {totalEarned} / {totalCatalog}
        </span>
      </header>
      <h3 className="sanctum-subchamber__title">Achievements forged into the record</h3>
      <p className="sanctum-subchamber__tagline">
        Bronze, silver, gold, mythic. Each one earned, none claimed.
      </p>

      {totalCatalog === 0 ? (
        <p className="mt-4 text-[12px] text-[#7F8AA8]">The catalog is empty.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {state.catalog.map((c) => {
            const earned = earnedMap.get(c.id);
            const colors = TIER_COLOR[c.tier];
            return (
              <li
                key={c.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  earned ? 'bg-white/[0.04]' : 'bg-white/[0.01] opacity-60'
                }`}
                style={{
                  borderColor: earned ? colors.ring : 'rgba(255,255,255,0.08)',
                  boxShadow: earned ? `inset 0 0 0 1px ${colors.ring}` : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: colors.label, boxShadow: `0 0 6px ${colors.ring}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[13px] font-medium text-white truncate">{c.title}</h4>
                      <span
                        className="text-[9px] uppercase tracking-[0.22em] flex-shrink-0"
                        style={{ color: colors.label }}
                      >
                        {c.tier}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#B4C0E0] mt-0.5">{c.description}</p>
                    {earned ? (
                      <p
                        className="text-[10px] uppercase tracking-[0.18em] mt-1"
                        style={{ color: colors.label }}
                      >
                        Earned {new Date(earned.earned_at).toLocaleDateString()}
                        {earned.note ? ` · ${earned.note}` : ''}
                      </p>
                    ) : (
                      <p className="text-[10px] uppercase tracking-[0.18em] mt-1 text-[#7F8AA8]">
                        Locked
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="sanctum-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
