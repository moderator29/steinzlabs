'use client';

import { useState } from 'react';
import { Heart, Repeat2, Gift, Trash2, Repeat } from 'lucide-react';
import { VerifiedGoldBadge } from '@/components/ui/VerifiedGoldBadge';

/**
 * WirePostCard — a single wire.
 *
 * Renders the author identity (avatar, display name, @username, verified mark,
 * relative time), the body, optional media, and the action row
 * (Like / Repost / Gift). Reposts render the ORIGINAL wire with a
 * "@user reposted" banner above it and act on the original.
 *
 * All rendering is defensive: missing author, missing counts, and deleted
 * originals are handled with honest fallbacks — never a crash.
 */

export interface WireAuthor {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
}

export interface WirePost {
  id: string;
  author_id: string;
  body: string | null;
  media_url: string | null;
  repost_of: string | null;
  reply_to: string | null;
  like_count: number | null;
  repost_count: number | null;
  reply_count: number | null;
  gift_count: number | null;
  gift_total_usd: number | null;
  created_at: string;
  deleted_at?: string | null;
  author?: WireAuthor | null;
  original?: WirePost | null;
  liked?: boolean;
  reposted?: boolean;
  reposted_at?: string | null;
}

export interface WirePostCardProps {
  post: WirePost;
  currentUserId?: string | null;
  onLike: (post: WirePost) => void;
  onRepost: (post: WirePost) => void;
  onGift: (post: WirePost) => void;
  onDelete?: (post: WirePost) => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtCount(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `${(v / 1_000_000).toFixed(1)}m`;
}

function Avatar({ author, size = 44 }: { author?: WireAuthor | null; size?: number }) {
  const initial = (author?.display_name || author?.username || '?').trim().charAt(0).toUpperCase();
  if (author?.avatar_url) {
    return (
      <img
        src={author.avatar_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover border border-white/10 flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white/90 font-semibold border border-white/10"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}
    >
      {initial}
    </div>
  );
}

export function WirePostCard({ post, currentUserId, onLike, onRepost, onGift, onDelete }: WirePostCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isRepost = !!post.repost_of;
  // The wire actually shown / acted upon. For a repost this is the original —
  // treat a soft-deleted original as unavailable.
  const original = post.original && !post.original.deleted_at ? post.original : null;
  const display = isRepost ? original : post;
  const reposter = post.author;

  if (isRepost && !display) {
    return (
      <article className="nl-glass rounded-2xl p-4">
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
          <Repeat className="w-3.5 h-3.5" />
          <span>{reposter?.username ? `@${reposter.username}` : 'Someone'} reposted</span>
        </div>
        <p className="text-sm text-white/40 italic">This wire is no longer available.</p>
      </article>
    );
  }

  const shown = display as WirePost;
  const author = shown.author;
  const name = author?.display_name || author?.username || 'Unknown';
  const handle = author?.username ? `@${author.username}` : '';
  const isOwn = !!currentUserId && shown.author_id === currentUserId;

  return (
    <article className="nl-glass rounded-2xl p-4">
      {isRepost && (
        <div className="flex items-center gap-1.5 text-xs text-white/45 mb-2 ps-1">
          <Repeat className="w-3.5 h-3.5" />
          <span>{reposter?.username ? `@${reposter.username}` : 'Someone'} reposted</span>
        </div>
      )}

      <div className="flex gap-3">
        <Avatar author={author} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-white truncate max-w-[12rem]">{name}</span>
            {author?.is_verified ? <VerifiedGoldBadge size={15} title="Verified" /> : null}
            {handle ? <span className="text-white/45 text-sm truncate">{handle}</span> : null}
            <span className="text-white/30 text-sm">·</span>
            <time className="text-white/45 text-sm" dateTime={shown.created_at} title={new Date(shown.created_at).toLocaleString()}>
              {relativeTime(shown.created_at)}
            </time>
            {isOwn && onDelete ? (
              <button
                type="button"
                onClick={() => (confirmDelete ? onDelete(shown) : setConfirmDelete(true))}
                onBlur={() => setConfirmDelete(false)}
                className="ms-auto text-white/30 hover:text-red-400 transition p-1 rounded-md"
                aria-label={confirmDelete ? 'Confirm delete wire' : 'Delete wire'}
                title={confirmDelete ? 'Click again to delete' : 'Delete'}
              >
                {confirmDelete ? <span className="text-[11px] text-red-400 font-medium px-1">Delete?</span> : <Trash2 className="w-4 h-4" />}
              </button>
            ) : null}
          </div>

          {shown.body ? (
            <p className="mt-1.5 text-[15px] text-white/90 whitespace-pre-wrap break-words leading-relaxed">{shown.body}</p>
          ) : null}

          {shown.media_url ? (
            <div className="mt-3 rounded-xl overflow-hidden border border-white/10 max-w-full">
              <img src={shown.media_url} alt="" className="w-full max-h-[420px] object-cover" loading="lazy" />
            </div>
          ) : null}

          {/* Action row */}
          <div className="mt-3 flex items-center gap-1 text-white/50 text-sm">
            <button
              type="button"
              onClick={() => onLike(shown)}
              className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition hover:bg-red-500/10 ${shown.liked ? 'text-red-400' : 'hover:text-red-400'}`}
              aria-pressed={!!shown.liked}
              aria-label="Like"
            >
              <Heart className={`w-[18px] h-[18px] ${shown.liked ? 'fill-current' : ''}`} />
              <span className="tabular-nums">{fmtCount(shown.like_count)}</span>
            </button>

            <button
              type="button"
              onClick={() => onRepost(shown)}
              className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition hover:bg-emerald-500/10 ${shown.reposted ? 'text-emerald-400' : 'hover:text-emerald-400'}`}
              aria-pressed={!!shown.reposted}
              aria-label="Repost"
            >
              <Repeat2 className="w-[18px] h-[18px]" />
              <span className="tabular-nums">{fmtCount(shown.repost_count)}</span>
            </button>

            <button
              type="button"
              onClick={() => onGift(shown)}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition hover:bg-[#0066FF]/12 hover:text-[#4d94ff]"
              aria-label="Gift"
            >
              <Gift className="w-[18px] h-[18px]" />
              <span className="tabular-nums">{fmtCount(shown.gift_count)}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default WirePostCard;
