'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Repeat, ArrowUpRight, ArrowLeft } from 'lucide-react';
import { VerifiedGoldBadge } from '@/components/ui/VerifiedGoldBadge';
import { SignalRail } from '@/components/wire/WireSignalRail';
import { SuccessRateBadge } from '@/components/social/SuccessRateBadge';
import { CashtagChip } from '@/components/wire/CashtagChip';
import { WirePrediction } from '@/components/wire/WirePrediction';
import { WireThread } from '@/components/wire/WireThread';
import { useAuth } from '@/lib/hooks/useAuth';
import { wireRelativeTime, formatWireCount } from '@/lib/wire/format';
import type { WirePost } from '@/components/wire/WirePostCard';
import { Heart, MessageCircle, Repeat2, Gift } from 'lucide-react';

/**
 * PublicWire - a read-only render of a single wire for the public share page.
 * Signed-out safe: no engagement actions, just the wire in the SocialFi style
 * plus live $cashtag chips and any inline prediction (agree is disabled without
 * a session). Real data only.
 */

const TOKEN_RE = /(#[\p{L}\p{N}_]+|\$[A-Za-z][A-Za-z0-9]{0,9})/gu;

function renderBody(text: string): React.ReactNode[] {
  return text.split(TOKEN_RE).map((part, i) => {
    if (i % 2 === 1) {
      if (part.startsWith('#')) {
        return (
          <span key={i} className="text-[#4d94ff] font-medium">
            {part}
          </span>
        );
      }
      return <CashtagChip key={i} symbol={part.slice(1)} />;
    }
    return <span key={i}>{part}</span>;
  });
}

function Avatar({ post, size = 44 }: { post: WirePost; size?: number }) {
  const a = post.author;
  const initial = (a?.display_name || a?.username || '?').trim().charAt(0).toUpperCase();
  if (a?.avatar_url) {
    return (
      <img
        src={a.avatar_url}
        alt=""
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

function Stat({ icon, n }: { icon: React.ReactNode; n: number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-white/50 text-sm">
      {icon}
      <span className="tabular-nums">{formatWireCount(n)}</span>
    </span>
  );
}

/**
 * Back control for the wire detail page — sits at the very top. Uses history
 * back when there is somewhere to return to, otherwise falls back to the Wire
 * feed so a visitor landing on a shared link is never dead-ended.
 */
export function WireBackButton() {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/dashboard?subtab=wire');
  };
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Back"
      className="inline-flex items-center gap-1.5 mb-4 rounded-full nl-glass border border-white/10 pl-2 pr-3 py-1.5 text-sm text-white/80 hover:text-white transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );
}

export function PublicWire({ post }: { post: WirePost }) {
  const isRepost = !!post.repost_of;
  const original = post.original && !post.original.deleted_at ? post.original : null;
  const shown = isRepost ? original ?? post : post;
  const a = shown.author;
  const name = a?.display_name || a?.username || 'Unknown';
  const handle = a?.username ? `@${a.username}` : '';
  const giftUsd = typeof shown.gift_total_usd === 'number' && shown.gift_total_usd > 0 ? shown.gift_total_usd : 0;
  const galleryUrls =
    Array.isArray(shown.media_urls) && shown.media_urls.length > 0
      ? shown.media_urls.filter(Boolean)
      : shown.media_url
        ? [shown.media_url]
        : [];

  return (
    <article className="relative overflow-hidden nl-glass rounded-2xl p-4 sm:p-5">
      <SignalRail signal={shown.authorSignal} />
      <div className="relative ps-3">
        {isRepost ? (
          <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2">
            <Repeat className="w-3.5 h-3.5 text-emerald-400/80" />
            <span>relayed by {post.author?.username ? `@${post.author.username}` : 'someone'}</span>
          </div>
        ) : null}

        <div className="flex gap-3">
          <Avatar post={shown} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-white truncate max-w-[12rem]">{name}</span>
              {a?.is_verified ? <VerifiedGoldBadge size={15} title="Verified" /> : null}
              {/* Real success-rate badge (same as the profile), not the signal number. */}
              <SuccessRateBadge value={shown.authorSuccessRate ?? null} />
              {handle ? <span className="text-white/45 text-sm truncate">{handle}</span> : null}
              <span className="text-white/30 text-sm">·</span>
              <time className="text-white/45 text-sm" dateTime={shown.created_at}>
                {wireRelativeTime(shown.created_at)}
              </time>
            </div>

            {shown.body ? (
              <p className="mt-1.5 text-[15px] text-white/90 whitespace-pre-wrap break-words leading-relaxed">
                {renderBody(shown.body)}
              </p>
            ) : null}

            {galleryUrls.length > 0 ? (
              <div className={`mt-3 grid gap-1 rounded-xl overflow-hidden border border-white/10 ${galleryUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {galleryUrls.slice(0, 4).map((u) => (
                  <img key={u} src={u} alt="" className="w-full max-h-[420px] object-cover" />
                ))}
              </div>
            ) : null}

            {shown.prediction ? <WirePrediction prediction={shown.prediction} currentUserId={null} /> : null}

            {giftUsd > 0 ? (
              <div className="mt-2.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"
                  style={{ boxShadow: '0 0 14px rgba(16,185,129,0.22)' }}
                >
                  <ArrowUpRight className="w-3 h-3" />
                  <span className="tabular-nums">${giftUsd.toFixed(2)}</span> earned
                </span>
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-4">
              <Stat icon={<Heart className="w-[18px] h-[18px]" />} n={shown.like_count} />
              <Stat icon={<MessageCircle className="w-[18px] h-[18px]" />} n={shown.reply_count} />
              <Stat icon={<Repeat2 className="w-[18px] h-[18px]" />} n={shown.repost_count} />
              <Stat icon={<Gift className="w-[18px] h-[18px]" />} n={shown.gift_count} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * WireComments - the reply thread on the dedicated wire page. Signed-in visitors
 * can reply and act; signed-out visitors see the conversation read-only. The
 * thread id drives its own fetches, so it stays in sync with the real replies.
 */
export function WireComments({ postId }: { postId: string }) {
  const { user } = useAuth();
  return (
    <div className="mt-5">
      <WireThread
        postId={postId}
        currentUserId={user?.id ?? null}
        authorAvatarUrl={(user as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        authorDisplayName={user?.first_name || user?.username || 'You'}
        onGift={() => {}}
        stickyComposer
      />
    </div>
  );
}

export function OpenInAppCta() {
  // Signed-in members are already inside Naka Labs and get the inline reply
  // composer — the big "Open in Naka Labs" button only made sense for signed-out
  // visitors landing on a shared wire, so hide it once a session exists.
  const { user } = useAuth();
  if (user) return null;
  return (
    <Link
      href="/dashboard?subtab=wire"
      className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-white font-semibold text-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: 'linear-gradient(135deg,#0066FF 0%,#5566FF 100%)',
        boxShadow: '0 8px 28px rgba(0,102,255,0.4)',
      }}
    >
      Open in Naka Labs
    </Link>
  );
}
