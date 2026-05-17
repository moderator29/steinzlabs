'use client';

import Link from 'next/link';
import { Clock, FileText, Lock } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * ResearchPostCard — single tile on the /research index + the
 * dashboard research rail. Visually consistent with the rest of
 * the platform's glass cards, with a tier-gated overlay for posts
 * the user doesn't have access to (rather than 404'ing or
 * silently hiding the row).
 */

export interface ResearchPostCardProps {
  id: string;
  title: string;
  excerpt: string;
  /** Author display name. */
  author: string;
  /** Author avatar URL. */
  authorAvatarUrl?: string | null;
  /** UNIX seconds. */
  publishedAt: number;
  /** Estimated read time in minutes. */
  readMinutes?: number;
  /** Tier required to read — null = public. */
  requiredTier?: 'free' | 'pro' | 'max' | 'naka_cult' | null;
  /** Whether the current user has access. */
  hasAccess?: boolean;
  /** Optional cover image. */
  coverUrl?: string | null;
  /** Optional category chip. */
  category?: string | null;
  /** Optional badge (NEW / EDITORS_PICK / TRENDING). */
  badge?: ReactNode;
}

function timeAgo(sec: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - sec);
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)}d ago`;
  return new Date(sec * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TIER_COLOR: Record<NonNullable<ResearchPostCardProps['requiredTier']>, string> = {
  free: '#94A3B8',
  pro: '#0A1EFF',
  max: '#7C3AED',
  naka_cult: '#DC143C',
};

export function ResearchPostCard(props: ResearchPostCardProps) {
  const locked = props.requiredTier && props.requiredTier !== 'free' && !props.hasAccess;
  const tierColor = props.requiredTier ? TIER_COLOR[props.requiredTier] : '#94A3B8';

  const inner = (
    <div className="relative h-full rounded-2xl border border-white/10 bg-white/[0.02] hover:border-[#0A1EFF]/40 transition-all overflow-hidden">
      {props.coverUrl ? (
        <div
          className="h-32 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${props.coverUrl})` }}
          aria-hidden
        />
      ) : null}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {props.category ? (
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">
              {props.category}
            </span>
          ) : null}
          {props.requiredTier && props.requiredTier !== 'free' ? (
            <span
              className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
              style={{ color: tierColor, background: `${tierColor}15`, border: `1px solid ${tierColor}55` }}
            >
              {props.requiredTier === 'naka_cult' ? 'NakaCult' : props.requiredTier}
            </span>
          ) : null}
          {props.badge ? <span className="ml-auto text-[10px]">{props.badge}</span> : null}
        </div>
        <h3 className="text-base font-bold text-white leading-snug line-clamp-2">{props.title}</h3>
        <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-3">{props.excerpt}</p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-auto">
          {props.authorAvatarUrl ? (
            <img src={props.authorAvatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" loading="lazy" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          <span className="text-slate-300 font-semibold">{props.author}</span>
          <span>·</span>
          <span>{timeAgo(props.publishedAt)}</span>
          {props.readMinutes ? (
            <>
              <span>·</span>
              <Clock className="w-3 h-3" />
              <span>{props.readMinutes}m read</span>
            </>
          ) : null}
        </div>
      </div>
      {locked ? (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full bg-black/70 border" style={{ borderColor: tierColor, color: tierColor }}>
            <Lock className="w-3 h-3" />
            {props.requiredTier === 'naka_cult' ? 'NakaCult only' : `${(props.requiredTier ?? '').toUpperCase()} tier`}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (locked) {
    return <div aria-label={`Locked: ${props.title}`}>{inner}</div>;
  }
  return (
    <Link href={`/research/${props.id}`} className="block h-full">
      {inner}
    </Link>
  );
}
