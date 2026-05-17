'use client';

/**
 * Friend.tech-style social attribution chip for context-feed cards.
 * Renders 'N users endorsed bullish' or 'N watchlists hit' with a
 * stacked avatar preview of the top-K endorsers. Audit B.9 P1.
 *
 * Visuals stay deliberately compact — the chip sits inline with
 * other meta chips on the proof card, not as a full row.
 */

import { Users } from 'lucide-react';

export interface AttributionUser {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface SocialAttributionProps {
  /** Total endorsement count across the platform. */
  count: number;
  /** Up to ~5 sample users for the stacked avatar preview. */
  sample: AttributionUser[];
  /** Verb describing what the users did. */
  verb?: 'endorsed bullish' | 'endorsed bearish' | 'added to watchlist';
}

function initial(name: string): string {
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

export function SocialAttribution({ count, sample, verb = 'endorsed bullish' }: SocialAttributionProps) {
  if (count <= 0) return null;
  const top = sample.slice(0, 5);
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/10 text-[11px]">
      <div className="flex -space-x-2">
        {top.map((u) =>
          u.avatarUrl ? (
            <img
              key={u.id}
              src={u.avatarUrl}
              alt=""
              loading="lazy"
              className="w-5 h-5 rounded-full border border-[#0F1320] object-cover"
            />
          ) : (
            <span
              key={u.id}
              aria-hidden
              className="w-5 h-5 rounded-full border border-[#0F1320] bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] text-[10px] font-bold text-white flex items-center justify-center"
            >
              {initial(u.displayName)}
            </span>
          ),
        )}
        {count > top.length ? (
          <span
            aria-hidden
            className="w-5 h-5 rounded-full border border-[#0F1320] bg-white/[0.06] text-[9px] font-bold text-slate-300 flex items-center justify-center"
          >
            +{Math.min(99, count - top.length)}
          </span>
        ) : null}
      </div>
      <span className="text-slate-300">
        <span className="font-semibold text-white tabular-nums">{count.toLocaleString('en-US')}</span> {verb}
      </span>
      <Users className="w-3 h-3 text-slate-500" />
    </div>
  );
}
