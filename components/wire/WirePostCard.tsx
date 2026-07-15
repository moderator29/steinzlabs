'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Trash2, Repeat, X, ChevronLeft, ChevronRight, MoreHorizontal,
  VolumeX, Volume2, Share2, Check, Sparkles,
} from 'lucide-react';
import { TierBadge } from '@/components/ui/TierBadge';
import { wireTopicLabel } from '@/lib/wire/topics';
import { wireRelativeTime } from '@/lib/wire/format';
import { SignalRail } from './WireSignalRail';
import { renderRichText } from '@/lib/wire/richText';
import { WirePrediction as WirePredictionInline } from './WirePrediction';
import { WireActionBar } from './WireActionBar';

/**
 * WirePostCard - a single wire in The Wire's 2035 SocialFi language.
 *
 * A borderless flow-timeline row on a light refined-glass surface with a glowing
 * left "signal rail" whose intensity reflects the author's signal score, plus
 * data-native accents (tabular-nums, live $cashtag price chips). Identity carries
 * a transparent signal chip; value carries a glowing tip badge; a wire can carry
 * an inline mini-prediction. Reposts blend a glowing relay line with a quote
 * inset holding the original wire, labelled "relayed by @user".
 *
 * All rendering is defensive: missing author, missing counts and deleted
 * originals are handled with honest fallbacks, never a crash.
 */

export interface WireAuthor {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  /** Subscription tier — drives the real TierBadge (the gold Max coin etc.),
   *  the SAME verified mark shown on the profile. */
  tier?: string | null;
}

export interface WirePrediction {
  id: string;
  symbol: string;
  direction: 'above' | 'below';
  target: number;
  priceAtCreate: number | null;
  resolvesAt: string;
  status: string;
  agreeCount: number;
  agreed: boolean;
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
  /** The author's transparent 0-100 signal score (real, computed feed-side). */
  authorSignal?: number | null;
  /** The author's real success rate (0-100) from user_reputation — the SAME
   *  badge shown on the profile. Null when the author hides it. */
  authorSuccessRate?: number | null;
  /** An inline mini-prediction attached to this wire, if any. */
  prediction?: WirePrediction | null;
}

export interface WirePostCardProps {
  post: WirePost;
  currentUserId?: string | null;
  onLike: (post: WirePost) => void;
  onRepost: (post: WirePost) => void;
  onGift: (post: WirePost) => void;
  onDelete?: (post: WirePost) => void;
  /** Mute / unmute the wire's author (hides their wires from the viewer's feed). */
  onMute?: (post: WirePost, mute: boolean) => void;
  /** Whether the viewer has this author muted (drives the menu label). */
  muted?: boolean;
  /** Opens the reply thread for this wire. Omit to hide the Comment button. */
  onComment?: (post: WirePost) => void;
  /** Marks the thread as currently open (highlights the Comment button). */
  threadOpen?: boolean;
  /** Compact rendering for replies inside a thread (tighter, smaller avatar). */
  compact?: boolean;
  /** Clicking a #hashtag in the body filters The Wire to that tag. */
  onHashtag?: (tag: string) => void;
  /**
   * Opens the wire's dedicated page (like X). When set, tapping anywhere on the
   * card that is not an interactive control navigates to that wire. Omitted for
   * cards already shown inside a thread (parent card / replies).
   */
  onOpenPost?: (post: WirePost) => void;
}

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0)}`;
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
 * MediaGallery - a responsive image gallery for a wire (1-4 images).
 * 1 = full width, 2 = side by side, 3 = one large + two stacked, 4 = 2x2 grid.
 * Tapping any image opens a lightbox with arrow / keyboard navigation.
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
      <img src={url} alt="" loading="lazy" className="w-full h-full object-cover transition group-hover:opacity-90" />
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

/** A glowing "$X earned" badge, shown only when a wire has really earned tips. */
function TipBadge({ usd }: { usd: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"
      style={{ boxShadow: '0 0 14px rgba(16,185,129,0.22)' }}
      title={`This wire has earned $${usd.toFixed(2)} in tips`}
    >
      <Sparkles className="w-3 h-3" />
      <span className="tabular-nums">{fmtUsd(usd)}</span> earned
    </span>
  );
}

/**
 * The identity + content of a single wire (no action bar). Reused for a normal
 * wire and, inside the quote inset, for a repost's original.
 */
function WireBody({
  post,
  currentUserId,
  onDelete,
  onMute,
  muted,
  onHashtag,
  onShare,
  compact,
  inset,
}: {
  post: WirePost;
  currentUserId?: string | null;
  onDelete?: (post: WirePost) => void;
  onMute?: (post: WirePost, mute: boolean) => void;
  muted?: boolean;
  onHashtag?: (tag: string) => void;
  onShare: (post: WirePost) => void;
  compact?: boolean;
  inset?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const author = post.author;
  const name = author?.display_name || author?.username || 'Unknown';
  const handle = author?.username ? `@${author.username}` : '';
  const isOwn = !!currentUserId && post.author_id === currentUserId;
  const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean) : [];
  const avatarSize = compact ? 34 : inset ? 30 : 44;
  const giftUsd = typeof post.gift_total_usd === 'number' && post.gift_total_usd > 0 ? post.gift_total_usd : 0;

  const galleryUrls =
    Array.isArray(post.media_urls) && post.media_urls.length > 0
      ? post.media_urls.filter(Boolean)
      : post.media_url
        ? [post.media_url]
        : [];

  // Author profile link — avatar + name/handle route to the author's profile.
  // When the author IS the viewer, route to their OWN profile tab (editable, in
  // the dashboard) instead of the public /u/[username] "view as visitor" page.
  // Guarded so a wire whose author has no username stays non-navigating.
  const isSelf = !!currentUserId && author?.id === currentUserId;
  const profileHref = isSelf
    ? '/dashboard?tab=profile'
    : author?.username ? `/u/${author.username}` : null;

  return (
    <div className="flex gap-3">
      {profileHref ? (
        <Link href={profileHref} onClick={(e) => e.stopPropagation()} className="flex-shrink-0" aria-label={`View @${author!.username}`}>
          <Avatar author={author} size={avatarSize} />
        </Link>
      ) : (
        <Avatar author={author} size={avatarSize} />
      )}
      <div className="min-w-0 flex-1">
        {/* Header row: name/badges/handle/time wrap within their own column so
            the ... menu stays pinned top-right and never wraps to center. */}
        <div className="flex items-start gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
            {profileHref ? (
              <Link
                href={profileHref}
                onClick={(e) => e.stopPropagation()}
                className={`font-semibold text-white truncate max-w-[10rem] hover:underline ${inset ? 'text-sm' : ''}`}
              >
                {name}
              </Link>
            ) : (
              <span className={`font-semibold text-white truncate max-w-[10rem] ${inset ? 'text-sm' : ''}`}>{name}</span>
            )}
            {/* The REAL verified mark — the same tier badge (gold Max coin etc.)
                shown next to the name on the profile. Free users get none. */}
            <TierBadge tier={author?.tier} size={inset ? 15 : 17} nonInteractive />
            {handle ? (
              profileHref ? (
                <Link href={profileHref} onClick={(e) => e.stopPropagation()} className="text-white/45 text-sm truncate hover:underline">
                  {handle}
                </Link>
              ) : (
                <span className="text-white/45 text-sm truncate">{handle}</span>
              )
            ) : null}
            <span className="text-white/30 text-sm">·</span>
            <time className="text-white/45 text-sm" dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
              {wireRelativeTime(post.created_at)}
            </time>
          </div>

          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="text-white/30 hover:text-white transition p-1 rounded-md"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="w-[18px] h-[18px]" />
            </button>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div role="menu" className="absolute right-0 z-20 mt-1 w-52 nl-glass rounded-xl p-1 shadow-[0_16px_50px_rgba(0,0,0,0.55)]">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onShare(post); }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white transition text-left"
                  >
                    <Share2 className="w-4 h-4 flex-shrink-0" /> Share wire
                  </button>
                  {isOwn && onDelete ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); onDelete(post); }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 transition text-left"
                    >
                      <Trash2 className="w-4 h-4 flex-shrink-0" /> Delete wire
                    </button>
                  ) : null}
                  {!isOwn && onMute && author?.id ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); onMute(post, !muted); }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white transition text-left"
                    >
                      {muted ? <Volume2 className="w-4 h-4 flex-shrink-0" /> : <VolumeX className="w-4 h-4 flex-shrink-0" />}
                      <span className="truncate">{muted ? 'Unmute' : 'Mute'} {handle || name}</span>
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>

        {post.body ? (
          <p className={`mt-1.5 text-white/90 whitespace-pre-wrap break-words leading-relaxed ${inset ? 'text-sm' : 'text-[15px]'}`}>
            {renderRichText(post.body, { onHashtag })}
          </p>
        ) : null}

        <MediaGallery urls={galleryUrls} />

        {post.prediction ? <WirePredictionInline prediction={post.prediction} currentUserId={currentUserId} /> : null}

        {tags.length > 0 || giftUsd > 0 ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {giftUsd > 0 ? <TipBadge usd={giftUsd} /> : null}
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
      </div>
    </div>
  );
}

/** Build the absolute public URL for a wire (used by the Share action). */
function wireShareUrl(id: string): string {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  return `${origin}/wire/${id}`;
}

export function WirePostCard({
  post,
  currentUserId,
  onLike,
  onRepost,
  onGift,
  onDelete,
  onMute,
  muted,
  onComment,
  threadOpen,
  compact,
  onHashtag,
  onOpenPost,
}: WirePostCardProps) {
  const reduced = useReducedMotion();
  const [toast, setToast] = useState<string | null>(null);

  const isRepost = !!post.repost_of;
  const original = post.original && !post.original.deleted_at ? post.original : null;
  const display = isRepost ? original : post;
  const reposter = post.author;

  const pad = compact ? 'p-3' : 'p-4';

  const share = async (target: WirePost) => {
    const url = wireShareUrl(target.id);
    const author = target.author?.display_name || target.author?.username || 'Someone';
    const title = `${author} on The Wire`;
    const text = (target.body || '').slice(0, 140);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      // user dismissed the share sheet, or it failed - fall through to copy
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setToast('Link copied');
        setTimeout(() => setToast(null), 1800);
        return;
      }
    } catch {
      // clipboard blocked
    }
    setToast(url);
    setTimeout(() => setToast(null), 3000);
  };

  const ShareToast = toast ? (
    <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-[110]">
      <div className="nl-glass rounded-full px-4 py-2 text-sm text-white/90 inline-flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <Check className="w-4 h-4 text-emerald-400" />
        <span className="truncate max-w-[70vw]">{toast}</span>
      </div>
    </div>
  ) : null;

  // A repost whose original is gone.
  if (isRepost && !display) {
    return (
      <article className={`nl-glass rounded-2xl ${pad}`}>
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
          <Repeat className="w-3.5 h-3.5" />
          <span>relayed by {reposter?.username ? `@${reposter.username}` : 'someone'}</span>
        </div>
        <p className="text-sm text-white/40 italic">This wire is no longer available.</p>
      </article>
    );
  }

  const shown = display as WirePost;

  // Whole-card open (X-style): tapping the card opens the wire's dedicated page,
  // but never when the tap lands on a control (button/link/field), inside an
  // open overlay, or while the viewer is selecting text.
  const openTarget = shown;
  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!onOpenPost) return;
    const el = e.target as HTMLElement | null;
    if (el && el.closest('a,button,input,textarea,label,[role="dialog"],[role="menu"]')) return;
    if (typeof window !== 'undefined') {
      const sel = window.getSelection?.();
      if (sel && sel.toString().length > 0) return;
    }
    onOpenPost(openTarget);
  };

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      onClick={onOpenPost ? handleCardClick : undefined}
      className={`group relative overflow-hidden nl-glass rounded-2xl ${pad} ${onOpenPost ? 'cursor-pointer' : ''}`}
    >
      <SignalRail signal={shown.authorSignal} />
      {ShareToast}

      <div className="relative ps-3">
        {isRepost ? (
          <div className="relative">
            {/* Relay header + glowing connective line into the quote inset */}
            <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2">
              <Repeat className="w-3.5 h-3.5 text-emerald-400/80" />
              <span>relayed by {reposter?.username ? `@${reposter.username}` : 'someone'}</span>
            </div>
            <div className="relative ps-4">
              {/* the relay line */}
              <div
                className="absolute left-[5px] top-0 bottom-0 w-[2px] rounded-full"
                style={{ background: 'linear-gradient(to bottom, #34d399, rgba(52,211,153,0.15))' }}
                aria-hidden
              />
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <WireBody
                  post={shown}
                  currentUserId={currentUserId}
                  onDelete={onDelete}
                  onMute={onMute}
                  muted={muted}
                  onHashtag={onHashtag}
                  onShare={share}
                  inset
                />
              </div>
            </div>
          </div>
        ) : (
          <WireBody
            post={shown}
            currentUserId={currentUserId}
            onDelete={onDelete}
            onMute={onMute}
            muted={muted}
            onHashtag={onHashtag}
            onShare={share}
            compact={compact}
          />
        )}

        <WireActionBar
          post={shown}
          onLike={onLike}
          onRepost={onRepost}
          onGift={onGift}
          onComment={onComment}
          threadOpen={threadOpen}
          compact={compact}
        />
      </div>
    </motion.article>
  );
}

export default WirePostCard;
