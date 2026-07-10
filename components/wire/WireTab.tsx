'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Sparkles, TrendingUp, Users, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WireComposer } from './WireComposer';
import { WirePostCard, type WirePost } from './WirePostCard';
import { WireThread } from './WireThread';
import { WIRE_TOPICS } from '@/lib/wire/topics';

type FeedKind = 'signal' | 'pack';

/**
 * WireTab — the full Wire feed tab.
 *
 * Logged-in users see the composer at the top; logged-out users see a sign-in
 * prompt. Below is the live, cursor-paginated feed of wires. Like and repost
 * are optimistic and reconciled against the server's authoritative counts.
 *
 * The Gift flow is owned by another surface: this tab only renders a Gift
 * button that invokes the `onGift(post)` prop with the wire being gifted.
 *
 * Export contract:
 *   export default function WireTab(props: WireTabProps)
 *   WireTabProps = { onGift?: (post: WirePost) => void; author?: string; reposts?: string }
 *   - onGift   : opened by the Gift button; receives the displayed WirePost.
 *   - author   : when set, renders that user's timeline instead of the global feed.
 *   - reposts  : when set, renders that user's reposts.
 */

export interface WireTabProps {
  onGift?: (post: WirePost) => void;
  /** Optional: render a single author's timeline (profile page). */
  author?: string;
  /** Optional: render a single user's reposts. */
  reposts?: string;
}

/** Update any post matching `id`, including an `original` nested inside a repost. */
function patchPost(posts: WirePost[], id: string, patch: (p: WirePost) => WirePost): WirePost[] {
  return posts.map((p) => {
    let next = p;
    if (p.id === id) next = patch(p);
    if (next.original && next.original.id === id) {
      next = { ...next, original: patch(next.original) };
    }
    return next;
  });
}

export default function WireTab({ onGift, author, reposts }: WireTabProps) {
  const { user, loading: authLoading } = useAuth();
  // The main feed (global) shows the Signal/Pack tabs + catalogue chips. Profile
  // views (author / reposts) reuse this component without that chrome.
  const isMainFeed = !author && !reposts;

  const [posts, setPosts] = useState<WirePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [feed, setFeed] = useState<FeedKind>('signal');
  const [tag, setTag] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const inFlightLike = useRef<Set<string>>(new Set());
  const inFlightRepost = useRef<Set<string>>(new Set());

  const buildUrl = useCallback(
    (c?: string | null) => {
      const qs = new URLSearchParams();
      if (author) qs.set('author', author);
      if (reposts) qs.set('reposts', reposts);
      if (isMainFeed) qs.set('feed', feed);
      if (isMainFeed && tag) qs.set('tag', tag);
      if (c) qs.set('cursor', c);
      const s = qs.toString();
      return `/api/wire/posts${s ? `?${s}` : ''}`;
    },
    [author, reposts, isMainFeed, feed, tag],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReason(null);
    try {
      const res = await fetch(buildUrl());
      if (!res.ok) {
        setError('Could not load the wire');
        return;
      }
      const j = await res.json();
      const list: WirePost[] = Array.isArray(j.posts) ? j.posts : [];
      setPosts(list);
      setCursor(j.nextCursor ?? null);
      setDone(!j.nextCursor);
      setReason(typeof j.reason === 'string' ? j.reason : null);
    } catch {
      setError('Network error loading the wire');
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || done || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(cursor));
      if (res.ok) {
        const j = await res.json();
        const list: WirePost[] = Array.isArray(j.posts) ? j.posts : [];
        // The Signal feed re-ranks a live 48h window on every request, so an
        // offset page can re-return a post that shifted rank between requests.
        // Dedupe against what's already loaded to avoid duplicate React keys
        // and repeated cards.
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = list.filter((p) => !seen.has(p.id));
          return [...prev, ...fresh];
        });
        setCursor(j.nextCursor ?? null);
        setDone(!j.nextCursor);
      }
    } catch {
      /* keep existing feed on failure */
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, cursor, done, loadingMore]);

  const handlePosted = useCallback((post: WirePost) => {
    setPosts((prev) => [post, ...prev]);
    setComposerOpen(false);
  }, []);

  // Close the composer sheet on Escape.
  useEffect(() => {
    if (!composerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setComposerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composerOpen]);

  const handleLike = useCallback(
    async (post: WirePost) => {
      if (!user) return;
      const id = post.id;
      if (inFlightLike.current.has(id)) return;
      inFlightLike.current.add(id);

      const nextLiked = !post.liked;
      // Optimistic
      setPosts((prev) =>
        patchPost(prev, id, (p) => ({
          ...p,
          liked: nextLiked,
          like_count: Math.max(0, (p.like_count ?? 0) + (nextLiked ? 1 : -1)),
        })),
      );

      try {
        const res = await fetch(`/api/wire/posts/${id}/like`, { method: nextLiked ? 'POST' : 'DELETE' });
        if (!res.ok) throw new Error('like failed');
        const j = await res.json();
        // Reconcile with the server's authoritative count.
        setPosts((prev) =>
          patchPost(prev, id, (p) => ({
            ...p,
            liked: typeof j.liked === 'boolean' ? j.liked : nextLiked,
            like_count: typeof j.like_count === 'number' ? j.like_count : p.like_count,
          })),
        );
      } catch {
        // Revert
        setPosts((prev) =>
          patchPost(prev, id, (p) => ({
            ...p,
            liked: !nextLiked,
            like_count: Math.max(0, (p.like_count ?? 0) + (nextLiked ? -1 : 1)),
          })),
        );
      } finally {
        inFlightLike.current.delete(id);
      }
    },
    [user],
  );

  const handleRepost = useCallback(
    async (post: WirePost) => {
      if (!user) return;
      const id = post.id;
      if (inFlightRepost.current.has(id)) return;
      inFlightRepost.current.add(id);

      const nextReposted = !post.reposted;
      setPosts((prev) =>
        patchPost(prev, id, (p) => ({
          ...p,
          reposted: nextReposted,
          repost_count: Math.max(0, (p.repost_count ?? 0) + (nextReposted ? 1 : -1)),
        })),
      );

      try {
        const res = await fetch(`/api/wire/posts/${id}/repost`, { method: nextReposted ? 'POST' : 'DELETE' });
        if (!res.ok) throw new Error('repost failed');
        const j = await res.json();
        setPosts((prev) =>
          patchPost(prev, id, (p) => ({
            ...p,
            reposted: typeof j.reposted === 'boolean' ? j.reposted : nextReposted,
            repost_count: typeof j.repost_count === 'number' ? j.repost_count : p.repost_count,
          })),
        );
      } catch {
        setPosts((prev) =>
          patchPost(prev, id, (p) => ({
            ...p,
            reposted: !nextReposted,
            repost_count: Math.max(0, (p.repost_count ?? 0) + (nextReposted ? -1 : 1)),
          })),
        );
      } finally {
        inFlightRepost.current.delete(id);
      }
    },
    [user],
  );

  const handleGift = useCallback(
    (post: WirePost) => {
      onGift?.(post);
    },
    [onGift],
  );

  const handleComment = useCallback((post: WirePost) => {
    setOpenThreadId((cur) => (cur === post.id ? null : post.id));
  }, []);

  // Keep a card's reply_count live as replies are added / removed in its thread.
  const bumpReplyCount = useCallback((id: string, delta: number) => {
    setPosts((prev) =>
      patchPost(prev, id, (p) => ({ ...p, reply_count: Math.max(0, (p.reply_count ?? 0) + delta) })),
    );
  }, []);

  const handleDelete = useCallback(async (post: WirePost) => {
    // Optimistic removal (remove the wire itself and any repost of it).
    const removedId = post.id;
    let snapshot: WirePost[] = [];
    setPosts((prev) => {
      snapshot = prev;
      return prev.filter((p) => p.id !== removedId && p.repost_of !== removedId);
    });
    try {
      const res = await fetch(`/api/wire/posts/${removedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      setPosts(snapshot); // restore on failure
    }
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Sign-in prompt (logged-out). Logged-in users post via the + button
          docked at the bottom-right of the feed area — see the FAB below. */}
      {isMainFeed && !authLoading && !user ? (
        <div className="nl-glass rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-3" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>
            <Sparkles className="w-5 h-5 text-[#4d94ff]" />
          </div>
          <h3 className="text-white font-semibold text-lg">Join the wire</h3>
          <p className="text-white/55 text-sm mt-1 mb-4">Sign in to post, like, repost and gift across the platform.</p>
          <Link href="/login" className="naka-button-primary inline-flex">Sign in</Link>
        </div>
      ) : null}

      {/* Signal / Pack tabs + sticky catalogue chips (main feed only) */}
      {isMainFeed ? (
        <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-2 bg-gradient-to-b from-black/40 to-transparent backdrop-blur-sm">
          <div className="flex items-center gap-1 nl-glass rounded-2xl p-1">
            {([
              { key: 'signal' as FeedKind, label: 'Signal', Icon: TrendingUp },
              { key: 'pack' as FeedKind, label: 'Pack', Icon: Users },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFeed(key);
                  setOpenThreadId(null);
                }}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl transition ${
                  feed === key ? 'bg-[#0066FF]/15 text-white border border-[#0066FF]/40' : 'text-white/55 hover:text-white'
                }`}
                aria-pressed={feed === key}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Catalogue filter — single-select, horizontal-scroll */}
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setTag(null)}
              className={`flex-shrink-0 text-sm font-medium px-3 py-1.5 rounded-full border transition ${
                tag === null ? 'bg-[#0066FF]/20 text-[#4d94ff] border-[#0066FF]/50' : 'text-white/55 border-white/12 hover:text-white hover:border-white/25'
              }`}
              aria-pressed={tag === null}
            >
              All
            </button>
            {WIRE_TOPICS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTag((cur) => (cur === t.value ? null : t.value))}
                className={`flex-shrink-0 text-sm font-medium px-3 py-1.5 rounded-full border transition ${
                  tag === t.value ? 'bg-[#0066FF]/20 text-[#4d94ff] border-[#0066FF]/50' : 'text-white/55 border-white/12 hover:text-white hover:border-white/25'
                }`}
                aria-pressed={tag === t.value}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="nl-glass rounded-2xl p-6 text-center">
          <p className="text-white/60 text-sm">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-3 text-[#4d94ff] text-sm hover:underline">
            Try again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="nl-glass rounded-2xl p-10 text-center">
          {isMainFeed && feed === 'pack' && reason === 'no_follows' ? (
            <>
              <p className="text-white/70 font-medium">Your Pack is empty</p>
              <p className="text-white/45 text-sm mt-1">Follow builders to fill your Pack.</p>
            </>
          ) : isMainFeed && feed === 'pack' && reason === 'signed_out' ? (
            <>
              <p className="text-white/70 font-medium">Sign in to see your Pack</p>
              <p className="text-white/45 text-sm mt-1">Your Pack shows wires from people you follow.</p>
            </>
          ) : isMainFeed && feed === 'pack' ? (
            <>
              <p className="text-white/70 font-medium">Nothing from your Pack yet</p>
              <p className="text-white/45 text-sm mt-1">{tag ? 'No posts under this topic from people you follow.' : 'People you follow have not posted yet.'}</p>
            </>
          ) : isMainFeed && tag ? (
            <>
              <p className="text-white/70 font-medium">No wires under this topic</p>
              <p className="text-white/45 text-sm mt-1">Try another catalogue filter.</p>
            </>
          ) : (
            <>
              <p className="text-white/70 font-medium">No wires yet</p>
              <p className="text-white/45 text-sm mt-1">
                {reposts ? 'No reposts to show.' : author ? 'Nothing posted here yet.' : 'Be the first to post on the wire.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <div key={`${p.id}-${p.reposted_at ?? p.created_at}`}>
              <WirePostCard
                post={p}
                currentUserId={user?.id ?? null}
                onLike={handleLike}
                onRepost={handleRepost}
                onGift={handleGift}
                onDelete={handleDelete}
                onComment={p.repost_of ? undefined : handleComment}
                threadOpen={openThreadId === p.id}
              />
              {openThreadId === p.id ? (
                <WireThread
                  postId={p.id}
                  currentUserId={user?.id ?? null}
                  authorAvatarUrl={(user as any)?.avatar_url ?? null}
                  authorDisplayName={user?.first_name || user?.username || 'You'}
                  onGift={handleGift}
                  onCountDelta={(d) => bumpReplyCount(p.id, d)}
                />
              ) : null}
            </div>
          ))}

          {!done ? (
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="nl-glass rounded-xl px-5 py-2.5 text-sm text-white/70 hover:text-white transition disabled:opacity-60"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Load more'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Floating "+" — docked at the bottom-right of the feed area. Opens the
          composer as a sheet. Main feed + signed-in only; sits above the
          dashboard bottom nav. */}
      {isMainFeed && !authLoading && user ? (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-[#0066FF]/30 transition-transform hover:scale-105 active:scale-95 border border-white/15"
          style={{ background: 'linear-gradient(135deg,#0066FF,#4d94ff)' }}
          aria-label="Create a post"
          title="Create a post"
        >
          <Plus className="w-6 h-6" />
        </button>
      ) : null}

      {/* Composer sheet */}
      {isMainFeed && composerOpen && user ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create a post"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setComposerOpen(false)}
          />
          <div className="relative w-full max-w-2xl animate-slide-up">
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-sm font-medium text-white/70">New post</span>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <WireComposer
              avatarUrl={(user as any).avatar_url ?? null}
              displayName={user.first_name || user.username || 'You'}
              userId={user.id}
              onPosted={handlePosted}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
