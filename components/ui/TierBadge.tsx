'use client';

/**
 * TierBadge — tier-aware verified mark shown next to a user's display name
 * across the platform.
 *
 *   Mini       → blue badge       (/branding/badge-mini.png)
 *   Pro        → platinum badge   (/branding/badge-pro.png)
 *   Max        → gold badge       (/branding/badge-max.png)
 *   Naka Cult  → cult sigil       (/branding/badge-naka-cult.png)
 *
 * Click the badge → a popover appears with a short tier-specific line.
 * Free users get no badge.
 */

import { useEffect, useRef, useState } from 'react';
import type { Tier } from '@/lib/subscriptions/tierCheck';

interface TierBadgeProps {
  tier: Tier | string | null | undefined;
  size?: number;
  title?: string;
  className?: string;
  /** Disable the click-popover (e.g. when the badge sits inside another button). */
  nonInteractive?: boolean;
}

type Variant = 'mini' | 'pro' | 'max' | 'naka_cult';

const VARIANTS: Record<Variant, { src: string; label: string; message: string; ringRgba: string }> = {
  mini: {
    src: '/branding/badge-mini.png',
    label: 'Mini plan',
    message: 'Mini Plan — welcome to the Naka ecosystem. The journey begins.',
    ringRgba: 'rgba(59,130,246,0.55)',
  },
  pro: {
    src: '/branding/badge-pro.png',
    label: 'Pro plan',
    message: 'Pro Plan — built for serious traders. Your edge, sharpened.',
    ringRgba: 'rgba(203,213,225,0.55)',
  },
  max: {
    src: '/branding/badge-max.png',
    label: 'Max plan',
    message: 'Max Plan — a legend in the making. Top tier. Top access. No limits.',
    ringRgba: 'rgba(250,204,21,0.6)',
  },
  naka_cult: {
    src: '/branding/badge-naka-cult.png',
    label: 'Naka Cult',
    message: 'Naka Cult — the lineage. Vault entry, the Conclave, the Oracle, the Sanctum.',
    ringRgba: 'rgba(220,20,60,0.6)',
  },
};

function resolveVariant(tier: TierBadgeProps['tier']): Variant | null {
  const t = (tier ?? 'free').toString().toLowerCase();
  if (t === 'naka_cult') return 'naka_cult';
  if (t === 'max' || t === 'mini' || t === 'pro') return t;
  return null;
}

export function TierBadge({ tier, size = 16, title, className, nonInteractive }: TierBadgeProps) {
  const variant = resolveVariant(tier);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!variant) return null;
  const v = VARIANTS[variant];

  const img = (
    <img
      src={v.src}
      alt={title ?? v.label}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        flexShrink: 0,
        objectFit: 'contain',
        verticalAlign: 'middle',
        filter: `drop-shadow(0 0 4px ${v.ringRgba})`,
      }}
    />
  );

  if (nonInteractive) return img;

  return (
    <span ref={wrapRef} className="relative inline-flex items-center" style={{ lineHeight: 0 }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center p-0 m-0 bg-transparent border-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-full"
        aria-label={title ?? v.label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={title ?? v.label}
        style={{ lineHeight: 0 }}
      >
        {img}
      </button>

      {open && (
        <span
          role="dialog"
          aria-label={`${v.label} details`}
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-[240px] max-w-[80vw] rounded-xl border border-white/10 bg-[#0b1022]/95 backdrop-blur px-3 py-2.5 text-left shadow-2xl"
          style={{ boxShadow: `0 10px 40px -10px ${v.ringRgba}, 0 2px 8px rgba(0,0,0,0.45)` }}
        >
          <span className="flex items-center gap-1.5 mb-1">
            <img src={v.src} alt="" width={14} height={14} style={{ objectFit: 'contain' }} />
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
              {v.label}
            </span>
          </span>
          <span className="block text-[12px] leading-snug text-slate-100">{v.message}</span>
        </span>
      )}
    </span>
  );
}

// ─── Back-compat named exports ────────────────────────────────────────────
// These used to be hand-rolled SVGs. They now render the same PNG art as
// <TierBadge /> for the matching tier so any consumer still works.
export function BlueBadge(props: Omit<TierBadgeProps, 'tier'>) {
  return <TierBadge tier="mini" {...props} />;
}
export function PlatinumBadge(props: Omit<TierBadgeProps, 'tier'>) {
  return <TierBadge tier="pro" {...props} />;
}
export function GoldBadge(props: Omit<TierBadgeProps, 'tier'>) {
  return <TierBadge tier="max" {...props} />;
}
