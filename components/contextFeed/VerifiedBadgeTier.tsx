'use client';

import { ShieldCheck, Crown, Eye } from 'lucide-react';

/**
 * Three-tier verified badge for context-feed cards (OpenSea-style).
 * Layered on top of the existing trust-score number so users see at a
 * glance whether an event was simply 'verified', or had a stronger
 * signal — whale-aligned (a known whale also moved into this token)
 * or watchlist-hit (the event's token is on the user's personal
 * watchlist). Audit B.9 P1.
 */

export type VerifiedTier = 'verified' | 'whale-aligned' | 'watchlist-hit';

export interface VerifiedBadgeTierProps {
  tier: VerifiedTier;
  /** Optional context for the tooltip (e.g. whale name, watchlist label). */
  context?: string;
}

const META: Record<VerifiedTier, { label: string; icon: typeof ShieldCheck; bg: string; text: string }> = {
  verified: {
    label: 'Verified',
    icon: ShieldCheck,
    bg: 'bg-emerald-500/15 border-emerald-500/40',
    text: 'text-emerald-300',
  },
  'whale-aligned': {
    label: 'Whale-aligned',
    icon: Crown,
    bg: 'bg-violet-500/15 border-violet-500/40',
    text: 'text-violet-300',
  },
  'watchlist-hit': {
    label: 'Watchlist hit',
    icon: Eye,
    bg: 'bg-amber-500/15 border-amber-500/40',
    text: 'text-amber-300',
  },
};

export function VerifiedBadgeTier({ tier, context }: VerifiedBadgeTierProps) {
  const m = META[tier];
  const Icon = m.icon;
  const title = context ? `${m.label} · ${context}` : m.label;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${m.bg} ${m.text}`}
      title={title}
      aria-label={title}
    >
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}
