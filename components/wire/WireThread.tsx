'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, CornerDownRight } from 'lucide-react';
import { WirePostCard, type WirePost } from './WirePostCard';

/**
 * WireThread - the reply thread for a single wire.
 *
 * Renders inline under its parent card (mobile-first, no separate route). Loads
 * replies from GET /api/wire/posts/[id]/replies, posts new replies via
 * POST /api/wire/posts/[id]/reply, and renders each reply as a compact
 * WirePostCard with its own optimistic like / repost / delete. Threads are a
 * single level deep: replies do not expose a Comment button.
 *
 * All actions are owner-scoped server-side (author_id / user_id derived from the
 * session); this component never sends a client-supplied owner id.
 */

const MAX = 600;

export interface WireThreadProps {
  postId: string;
  currentUserId?: string | null;
  authorAvatarUrl?: string | null;
  authorDisplayName?: string | null;
  onGift: (post: WirePost) => void;
  /** Fired after a reply is created / deleted so the parent count stays live. */
  onCountDelta?: (delta: number) => void;
  /** Pin the reply composer to the bottom of the viewport (X-style), with the
   *  replies listed above it. Used on the dedicated /wire/[id] page. */
  stickyComposer?: boolean;
  /** Nesting depth. Replies can be replied to (threaded); depth caps the visual
   *  indent so deep chains stay readable on mobile. */
  depth?: number;
}

// How many levels of nested replies we render inline before we stop indenting
// further (deeper replies still thread correctly, just without extra inset).
const MAX_THREAD_DEPTH = 4;

export function WireThread({
  postId,
  currentUserId,
  authorAvatarUrl,
  authorDisplayName,
  onGift,
  onCountDelta,
  stickyComposer,
  depth = 0,
}: WireThreadProps) {
  const [replies, setReplies] = useState<WirePost[]>([]);
  // Which replies have their own nested reply thread expanded (reply-to-a-reply).
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const toggleThread = useCallback((id: string) => {
    setOpenThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  // X-style: the composer stays collapsed as a single "Post your reply" pill and
  // only expands into the full textarea when tapped (or while it holds text).
  const [expanded, setExpanded] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const inFlightLike = useRef<Set<string>>(new Set());
  const inFlightRepost = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wire/posts/${postId}/replies?order=asc`);
      if (!res.ok) {
        setError('Could not load replies');
        return;
      }
      const j = await res.json();
      setReplies(Array.isArray(j.replies) ? j.replies : []);
      setCursor(j.nextCursor ?? null);
    } catch {
      setError('Network error loading replies');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/wire/posts/${postId}/replies?order=asc&cursor=${encodeURIComponent(cursor)}`);
      if (res.ok) {
        const j = await res.json();
        const list: WirePost[] = Array.isArray(j.replies) ? j.replies : [];
        setReplies((prev) => [...prev, ...list]);
        setCursor(j.nextCursor ?? null);
      }
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, postId]);

  const submitReply = useCallback(async () => {
    const text = body.trim();
    if (!text || text.length > MAX || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch(`/api/wire/posts/${postId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setPostError(j?.error || 'Could not post your reply');
        return;
      }
      const { post } = await res.json();
      if (post) {
        setReplies((prev) => [...prev, post]); // oldest-first: newest at the end
        onCountDelta?.(1);
      }
      setBody('');
      setExpanded(false);
    } catch {
      setPostError('Network error. Try again.');
    } finally {
      setPosting(false);
    }
  }, [body, posting, postId, onCountDelta]);

  const openComposer = useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => taRef.current?.focus());
  }, []);

  const patch = (id: string, fn: (p: WirePost) => WirePost) =>
    setReplies((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));

  const handleLike = useCallback(async (post: WirePost) => {
    if (!currentUserId) return;
    const id = post.id;
    if (inFlightLike.current.has(id)) return;
    inFlightLike.current.add(id);
    const next = !post.liked;
    patch(id, (p) => ({ ...p, liked: next, like_count: Math.max(0, (p.like_count ?? 0) + (next ? 1 : -1)) }));
    try {
      const res = await fetch(`/api/wire/posts/${id}/like`, { method: next ? 'POST' : 'DELETE' });
      if (!res.ok) throw new Error('like failed');
      const j = await res.json();
      patch(id, (p) => ({
        ...p,
        liked: typeof j.liked === 'boolean' ? j.liked : next,
        like_count: typeof j.like_count === 'number' ? j.like_count : p.like_count,
      }));
    } catch {
      patch(id, (p) => ({ ...p, liked: !next, like_count: Math.max(0, (p.like_count ?? 0) + (next ? -1 : 1)) }));
    } finally {
      inFlightLike.current.delete(id);
    }
  }, [currentUserId]);

  const handleRepost = useCallback(async (post: WirePost) => {
    if (!currentUserId) return;
    const id = post.id;
    if (inFlightRepost.current.has(id)) return;
    inFlightRepost.current.add(id);
    const next = !post.reposted;
    patch(id, (p) => ({ ...p, reposted: next, repost_count: Math.max(0, (p.repost_count ?? 0) + (next ? 1 : -1)) }));
    try {
      const res = await fetch(`/api/wire/posts/${id}/repost`, { method: next ? 'POST' : 'DELETE' });
      if (!res.ok) throw new Error('repost failed');
      const j = await res.json();
      patch(id, (p) => ({
        ...p,
        reposted: typeof j.reposted === 'boolean' ? j.reposted : next,
        repost_count: typeof j.repost_count === 'number' ? j.repost_count : p.repost_count,
      }));
    } catch {
      patch(id, (p) => ({ ...p, reposted: !next, repost_count: Math.max(0, (p.repost_count ?? 0) + (next ? -1 : 1)) }));
    } finally {
      inFlightRepost.current.delete(id);
    }
  }, [currentUserId]);

  const handleDelete = useCallback(async (post: WirePost) => {
    const id = post.id;
    let snapshot: WirePost[] = [];
    setReplies((prev) => {
      snapshot = prev;
      return prev.filter((p) => p.id !== id);
    });
    onCountDelta?.(-1);
    try {
      const res = await fetch(`/api/wire/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      setReplies(snapshot);
      onCountDelta?.(1);
    }
  }, [onCountDelta]);

  const len = body.length;
  const over = len > MAX;
  const canReply = body.trim().length > 0 && !over && !posting;
  const initial = (authorDisplayName || '?').trim().charAt(0).toUpperCase();

  const composerEl = currentUserId ? (
    !expanded && !body.trim() ? (
      <button
        type="button"
        onClick={openComposer}
        className="w-full flex items-center gap-2.5 nl-glass rounded-full px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
        aria-label="Post your reply"
      >
        {authorAvatarUrl ? (
          <img src={authorAvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0" />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white/90 text-sm font-semibold border border-white/10"
            style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}
          >
            {initial}
          </div>
        )}
        <span className="text-sm text-white/40">Post your reply</span>
      </button>
    ) : (
      <div className="nl-glass rounded-2xl p-3">
        <div className="flex gap-2.5">
          {authorAvatarUrl ? (
            <img src={authorAvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white/90 text-sm font-semibold border border-white/10"
              style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <textarea
              ref={taRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => { if (!body.trim()) setExpanded(false); }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submitReply();
                if (e.key === 'Escape' && !body.trim()) setExpanded(false);
              }}
              placeholder="Post your reply"
              rows={3}
              className="w-full bg-transparent resize-none outline-none text-base sm:text-sm text-white placeholder:text-white/35 leading-relaxed"
            />
            {postError ? <div className="mt-1 text-xs text-red-400" role="alert">{postError}</div> : null}
            <div className="mt-2 flex items-center justify-end gap-3">
              <span className={`text-xs tabular-nums ${over ? 'text-red-400' : 'text-white/40'}`}>{len}/{MAX}</span>
              <button
                type="button"
                onClick={() => void submitReply()}
                disabled={!canReply}
                className="naka-button-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Reply
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  ) : null;

  const repliesEl = loading ? (
    <div className="flex items-center justify-center py-6 text-white/40">
      <Loader2 className="w-4 h-4 animate-spin" />
    </div>
  ) : error ? (
    <div className="nl-glass rounded-2xl p-4 text-center">
      <p className="text-white/60 text-sm">{error}</p>
      <button type="button" onClick={() => void load()} className="mt-2 text-[#4d94ff] text-sm hover:underline">
        Try again
      </button>
    </div>
  ) : replies.length === 0 ? (
    <div className="flex items-center gap-2 text-white/45 text-sm py-3 ps-1">
      <CornerDownRight className="w-4 h-4" />
      No replies yet. Be the first to reply.
    </div>
  ) : (
    <div className="space-y-2.5">
      {replies.map((r) => {
        const threadOpen = openThreads.has(r.id);
        return (
          <div key={r.id}>
            <WirePostCard
              post={r}
              currentUserId={currentUserId ?? null}
              compact
              onLike={handleLike}
              onRepost={handleRepost}
              onGift={onGift}
              onDelete={handleDelete}
              // Let users reply to a comment and interact inside the thread,
              // not only on the original post. Opens this comment's own nested
              // reply thread inline.
              onComment={currentUserId ? () => toggleThread(r.id) : undefined}
              threadOpen={threadOpen}
            />
            {threadOpen ? (
              <div className={depth < MAX_THREAD_DEPTH ? 'ms-3 ps-3 border-s border-white/10 mt-1.5' : 'mt-1.5'}>
                <WireThread
                  postId={r.id}
                  currentUserId={currentUserId}
                  authorAvatarUrl={authorAvatarUrl}
                  authorDisplayName={authorDisplayName}
                  onGift={onGift}
                  onCountDelta={(d) => patch(r.id, (p) => ({ ...p, reply_count: Math.max(0, (p.reply_count ?? 0) + d) }))}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      {cursor ? (
        <div className="flex justify-center py-1">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="text-sm text-white/60 hover:text-white transition disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Load more replies'}
          </button>
        </div>
      ) : null}
    </div>
  );

  // Sticky mode (the /wire/[id] page): replies first, composer pinned to the
  // bottom of the viewport like X. Default mode keeps the composer on top for
  // the inline in-feed thread.
  if (stickyComposer) {
    return (
      <div className="mt-2 space-y-3">
        {repliesEl}
        {composerEl ? (
          <div className="sticky bottom-0 z-20 -mx-4 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#05080F]/92 backdrop-blur-md border-t border-white/10">
            {composerEl}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 ms-3 ps-3 border-s border-white/10 space-y-3">
      {composerEl}
      {repliesEl}
    </div>
  );
}

export default WireThread;
