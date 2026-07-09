'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WireComposer } from './WireComposer';
import { WirePostCard, type WirePost } from './WirePostCard';

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
  const [posts, setPosts] = useState<WirePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlightLike = useRef<Set<string>>(new Set());
  const inFlightRepost = useRef<Set<string>>(new Set());

  const buildUrl = useCallback(
    (c?: string | null) => {
      const qs = new URLSearchParams();
      if (author) qs.set('author', author);
      if (reposts) qs.set('reposts', reposts);
      if (c) qs.set('cursor', c);
      const s = qs.toString();
      return `/api/wire/posts${s ? `?${s}` : ''}`;
    },
    [author, reposts],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
        setPosts((prev) => [...prev, ...list]);
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
  }, []);

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
      {/* Composer or sign-in prompt */}
      {!author && !reposts ? (
        authLoading ? null : user ? (
          <WireComposer
            avatarUrl={(user as any).avatar_url ?? null}
            displayName={user.first_name || user.username || 'You'}
            onPosted={handlePosted}
          />
        ) : (
          <div className="nl-glass rounded-2xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-3" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>
              <Sparkles className="w-5 h-5 text-[#4d94ff]" />
            </div>
            <h3 className="text-white font-semibold text-lg">Join the wire</h3>
            <p className="text-white/55 text-sm mt-1 mb-4">Sign in to post, like, repost and gift across the platform.</p>
            <Link href="/login" className="naka-button-primary inline-flex">Sign in</Link>
          </div>
        )
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
          <p className="text-white/70 font-medium">No wires yet</p>
          <p className="text-white/45 text-sm mt-1">
            {reposts ? 'No reposts to show.' : author ? 'Nothing posted here yet.' : 'Be the first to post on the wire.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <WirePostCard
              key={`${p.id}-${p.reposted_at ?? p.created_at}`}
              post={p}
              currentUserId={user?.id ?? null}
              onLike={handleLike}
              onRepost={handleRepost}
              onGift={handleGift}
              onDelete={handleDelete}
            />
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
    </div>
  );
}
