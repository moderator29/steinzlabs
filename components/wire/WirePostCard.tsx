'use client';

import { useEffect, useState } from 'react';
import { Heart, Repeat2, Gift, Trash2, Repeat, MessageCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { VerifiedGoldBadge } from '@/components/ui/VerifiedGoldBadge';
import { wireTopicLabel } from '@/lib/wire/topics';

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
  /** Up to 4 bucket-scoped image URLs. Falls back to media_url for old rows. */
  media_urls?: string[] | null;
  repost_of: string | null;
  reply_to: string | null;
  like_count: number | null;
  repost_count: number | null;
  reply_count: number | null;
  gift_count: number | null;
  gift_total_usd: number | null;
  tags?: string[] | null;
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
  /** Opens the reply thread for this wire. Omit to hide the Comment button. */
  onComment?: (post: WirePost) => void;
  /** Marks the thread as currently open (highlights the Comment button). */
  threadOpen?: boolean;
  /** Compact rendering for replies inside a thread (tighter, smaller avatar). */
  compact?: boolean;
  /** Clicking a #hashtag in the body filters The Wire to that tag. */
  onHashtag?: (tag: string) => void;
}

// Matches a #hashtag token: letters, digits and underscores after the hash.
// Unicode-aware so non-latin tags still parse. Used to split a wire body into
// plain text and clickable hashtag chips.
const HASHTAG_RE = /(#[\p{L}\p{N}_]+)/gu;

/**
 * Render a wire body as React nodes, turning every #hashtag into a blue,
 * clickable link. Whitespace/newlines are preserved by the caller's
 * `whitespace-pre-wrap`. When no handler is given, hashtags still render blue
 * but are non-interactive.
 */
function renderBody(text: string, onHashtag?: (tag: string) => void): React.ReactNode[] {
  const parts = text.split(HASHTAG_RE);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // Odd indices are the captured #hashtag tokens.
      const tag = part.slice(1).toLowerCase();
      if (onHashtag) {
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHashtag(tag);
            }}
            className="text-[#4d94ff] hover:underline font-medium"
          >
            {part}
          </button>
        );
      }
      return (
        <span key={i} className="text-[#4d94ff] font-medium">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
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

/**
 * MediaGallery — a responsive image gallery for a wire (1–4 images).
 *
 * Layouts: 1 = full width · 2 = side by side · 3 = one large + two stacked ·
 * 4 = 2x2 grid. Every tile is rounded, object-cover, and never overflows the
 * card. Tapping any image opens a lightbox with arrow / keyboard navigation.
 */
function MediaGallery({ urls }: { urls: string[] }) {
  const imgs = urls.slice(0, 4);
  const count = imgs.length;

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, count]);

  if (count === 0) return null;

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const Tile = ({ url, i, className }: { url: string; i: number; className?: string }) => (
    <button
      type="button"
      onClick={() => openAt(i)}
      className={`relative block overflow-hidden bg-white/5 group ${className ?? ''}`}
      aria-label="View image"
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover transition group-hover:opacity-90"
      />
    </button>
  );

  let grid: React.ReactNode;
  if (count === 1) {
    grid = (
      <div className="rounded-xl overflow-hidden border border-white/10 max-w-full">
        <button type="button" onClick={() => openAt(0)} className="block w-full" aria-label="View image">
          <img src={imgs[0]} alt="" loading="lazy" className="w-full max-h-[420px] object-cover" />
        </button>
      </div>
    );
  } else if (count === 2) {
    grid = (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10 h-64">
        <Tile url={imgs[0]} i={0} />
        <Tile url={imgs[1]} i={1} />
      </div>
    );
  } else if (count === 3) {
    grid = (
      <div className="grid grid-cols-2 grid-rows-2 gap-1 rounded-xl overflow-hidden border border-white/10 h-72">
        <Tile url={imgs[0]} i={0} className="row-span-2" />
        <Tile url={imgs[1]} i={1} />
        <Tile url={imgs[2]} i={2} />
      </div>
    );
  } else {
    grid = (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10">
        {imgs.map((u, i) => (
          <Tile key={u} url={u} i={i} className="aspect-square" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3">
      {grid}
      {open ? (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i - 1 + count) % count);
                }}
                className="absolute left-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i + 1) % count);
                }}
                className="absolute right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          ) : null}
          <img
            src={imgs[index]}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {count > 1 ? (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
              {index + 1} / {count}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function WirePostCard({
  post,
  currentUserId,
  onLike,
  onRepost,
  onGift,
  onDelete,
  onComment,
  threadOpen,
  compact,
  onHashtag,
}: WirePostCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isRepost = !!post.repost_of;
  // The wire actually shown / acted upon. For a repost this is the original —
  // treat a soft-deleted original as unavailable.
  const original = post.original && !post.original.deleted_at ? post.original : null;
  const display = isRepost ? original : post;
  const reposter = post.author;

  const pad = compact ? 'p-3' : 'p-4';
  const avatarSize = compact ? 34 : 44;

  if (isRepost && !display) {
    return (
      <article className={`nl-glass rounded-2xl ${pad}`}>
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
  const tags = Array.isArray(shown.tags) ? shown.tags.filter(Boolean) : [];
  // Prefer media_urls[]; fall back to the legacy single media_url for old rows.
  const galleryUrls =
    Array.isArray(shown.media_urls) && shown.media_urls.length > 0
      ? shown.media_urls.filter(Boolean)
      : shown.media_url
        ? [shown.media_url]
        : [];

  return (
    <article className={`nl-glass rounded-2xl ${pad}`}>
      {isRepost && (
        <div className="flex items-center gap-1.5 text-xs text-white/45 mb-2 ps-1">
          <Repeat className="w-3.5 h-3.5" />
          <span>{reposter?.username ? `@${reposter.username}` : 'Someone'} reposted</span>
        </div>
      )}

      <div className="flex gap-3">
        <Avatar author={author} size={avatarSize} />
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
            <p className="mt-1.5 text-[15px] text-white/90 whitespace-pre-wrap break-words leading-relaxed">
              {renderBody(shown.body, onHashtag)}
            </p>
          ) : null}

          <MediaGallery urls={galleryUrls} />


          {tags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0066FF]/12 text-[#4d94ff] border border-[#0066FF]/25"
                >
                  {wireTopicLabel(t)}
                </span>
              ))}
            </div>
          ) : null}

          {/* Action row — Like · Comment · Repost · Gift */}
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

            {onComment ? (
              <button
                type="button"
                onClick={() => onComment(shown)}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition hover:bg-[#0066FF]/12 ${threadOpen ? 'text-[#4d94ff]' : 'hover:text-[#4d94ff]'}`}
                aria-expanded={!!threadOpen}
                aria-label="Comment"
              >
                <MessageCircle className="w-[18px] h-[18px]" />
                <span className="tabular-nums">{fmtCount(shown.reply_count)}</span>
              </button>
            ) : null}

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
