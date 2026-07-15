'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Loader2, Plus, Settings2, Sparkles, TrendingUp, Users, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WirePostCard, type WirePost } from './WirePostCard';
import { WireThreadPanel } from './WireThreadPanel';
import { WIRE_TOPICS } from '@/lib/wire/topics';

type FeedKind = 'latest' | 'signal' | 'pack';

/**
 * WireTab - the full Wire feed tab.
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
  /** Optional: render a single user's replies (profile Replies sub-tab). */
  repliesBy?: string;
  /** Optional: render a single author's media wires (profile Media sub-tab). */
  mediaAuthor?: string;
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

export default function WireTab({ onGift, author, reposts, repliesBy, mediaAuthor }: WireTabProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // The main feed (global) shows the Signal/Pack tabs + catalogue chips. Profile
  // views (author / reposts / replies / media) reuse this component without that
  // chrome.
  const isMainFeed = !author && !reposts && !repliesBy && !mediaAuthor;

  const [posts, setPosts] = useState<WirePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // The default landing feed is Latest: the reliable general Wire (every
  // top-level wire, newest first, no time window). Signal (48h trending) and
  // Pack (people you follow) are opt-in tabs. Landing on Latest means the Wire
  // always shows existing wires instead of going empty when nothing is trending.
  const [feed, setFeed] = useState<FeedKind>('latest');
  // Catalogue topic the viewer wants to see, chosen in the Wire settings panel.
  // Empty = the general Wire (no topic filter). One tap selects a topic, applies
  // it, and closes the picker; tapping All returns to the full feed.
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // A hashtag the viewer tapped inside a wire body - filters the visible feed
  // to wires that mention it. Freeform, so it's applied client-side.
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const inFlightLike = useRef<Set<string>>(new Set());
  const inFlightRepost = useRef<Set<string>>(new Set());

  const buildUrl = useCallback(
    (c?: string | null) => {
      const qs = new URLSearchParams();
      if (author) qs.set('author', author);
      if (mediaAuthor) {
        qs.set('author', mediaAuthor);
        qs.set('media', '1');
      }
      if (reposts) qs.set('reposts', reposts);
      if (repliesBy) qs.set('repliesBy', repliesBy);
      // Latest is the general feed: the route returns it when no `feed` param is
      // present, so we only send `feed` for Signal / Pack.
      if (isMainFeed && feed !== 'latest') qs.set('feed', feed);
      if (isMainFeed && selectedTopics.length) qs.set('tags', selectedTopics.join(','));
      if (c) qs.set('cursor', c);
      const s = qs.toString();
      return `/api/wire/posts${s ? `?${s}` : ''}`;
    },
    [author, reposts, repliesBy, mediaAuthor, isMainFeed, feed, selectedTopics],
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

  // Show a just-published wire immediately. The compose page sets the
  // `nl-wire-posted` flag on success; when we return here (mount or the tab
  // regaining focus) we refetch the latest feed and clear the flag. This
  // defeats Next.js's client router cache restoring a stale snapshot, which is
  // why a new wire previously only appeared after a hard reload.
  const lastPostedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isMainFeed) return;
    const maybeRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      let flag: string | null = null;
      try { flag = window.localStorage.getItem('nl-wire-posted'); } catch { /* ignore */ }
      if (flag && flag !== lastPostedRef.current) {
        lastPostedRef.current = flag;
        try { window.localStorage.removeItem('nl-wire-posted'); } catch { /* ignore */ }
        void load();
      }
    };
    maybeRefresh();
    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);
    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [isMainFeed, load]);

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

  // Tapping a topic applies it immediately and closes the picker (single active
  // topic). Tapping the already-active topic clears it, returning to the full
  // feed. selectedTopics is a dependency of buildUrl, so the feed reloads on its
  // own the moment this state changes (auto-apply).
  const selectTopic = useCallback((value: string) => {
    setSelectedTopics((prev) => (prev.length === 1 && prev[0] === value ? [] : [value]));
    setSettingsOpen(false);
    setOpenThreadId(null);
  }, []);

  // The "All" pseudo-chip: no topic filter. Applies and closes the picker.
  const clearTopics = useCallback(() => {
    setSelectedTopics([]);
    setSettingsOpen(false);
    setOpenThreadId(null);
  }, []);

  const handleHashtag = useCallback((tag: string) => {
    setActiveHashtag(tag);
    setOpenThreadId(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Freeform hashtag filter, applied over the loaded page (real data only -
  // matches the raw #token in the body or a catalogue tag on the wire).
  const visiblePosts = useMemo(() => {
    if (!activeHashtag) return posts;
    const needle = activeHashtag.toLowerCase();
    const re = new RegExp(`#${needle}(?![\\p{L}\\p{N}_])`, 'iu');
    return posts.filter((p) => {
      const inBody = typeof p.body === 'string' && re.test(p.body);
      const inTags = Array.isArray(p.tags) && p.tags.some((t) => String(t).toLowerCase() === needle);
      const inOrig =
        p.original && typeof p.original.body === 'string' && re.test(p.original.body);
      return inBody || inTags || inOrig;
    });
  }, [posts, activeHashtag]);

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

  // Tapping a card (outside its controls) opens the wire's dedicated page.
  const openPost = useCallback((post: WirePost) => {
    router.push(`/wire/${post.id}`);
  }, [router]);

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

  // Muted authors: load the viewer's mute set once, drive the post menu label,
  // and hide a muted author's wires from the feed immediately on mute.
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setMutedIds(new Set()); return; }
    let cancelled = false;
    fetch('/api/wire/mute')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.muted)) setMutedIds(new Set(d.muted)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const handleMute = useCallback(async (post: WirePost, mute: boolean) => {
    const authorId = post.author_id;
    if (!authorId) return;
    let snapshot: WirePost[] = [];
    setMutedIds((prev) => {
      const n = new Set(prev);
      if (mute) n.add(authorId); else n.delete(authorId);
      return n;
    });
    if (mute) {
      setPosts((prev) => {
        snapshot = prev;
        // Drop the muted author's own wires and their reposts from the feed.
        return prev.filter((p) => p.author_id !== authorId && p.original?.author_id !== authorId);
      });
    }
    try {
      const res = await fetch('/api/wire/mute', {
        method: mute ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authorId }),
      });
      if (!res.ok) throw new Error('mute failed');
    } catch {
      // Roll back the optimistic changes on failure.
      setMutedIds((prev) => {
        const n = new Set(prev);
        if (mute) n.delete(authorId); else n.add(authorId);
        return n;
      });
      if (mute && snapshot.length) setPosts(snapshot);
    }
  }, [user]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Sign-in prompt (logged-out). Logged-in users post via the + button
          docked at the bottom-right of the feed area - see the FAB below. */}
      {isMainFeed && !authLoading && !user ? (
        <div className="nl-glass rounded-2xl p-6 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-3" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>
            <Sparkles className="w-5 h-5 text-[#4d94ff]" />
          </div>
          <h3 className="text-white font-semibold text-lg">Join The Wire</h3>
          <p className="text-white/55 text-sm mt-1 mb-4">Sign in to post, like, repost and gift across the platform.</p>
          <Link href="/login" className="naka-button-primary inline-flex">Sign in</Link>
        </div>
      ) : null}

      {/* Signal / Pack tabs + The Wire settings (main feed only) */}
      {isMainFeed ? (
        <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-2 bg-gradient-to-b from-black/40 to-transparent backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 nl-glass rounded-2xl p-1 flex-1 min-w-0">
              {([
                { key: 'latest' as FeedKind, label: 'Latest', Icon: Clock },
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
                  className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1 text-[13px] font-medium py-2 rounded-xl transition ${
                    feed === key ? 'bg-[#0066FF]/15 text-white border border-[#0066FF]/40' : 'text-white/55 hover:text-white'
                  }`}
                  aria-pressed={feed === key}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* The Wire settings - opens the slim topic-filter panel */}
            <button
              type="button"
              onClick={() => setSettingsOpen((s) => !s)}
              className={`relative flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-2xl nl-glass transition ${
                settingsOpen || selectedTopics.length ? 'text-[#4d94ff]' : 'text-white/55 hover:text-white'
              }`}
              aria-label="The Wire settings"
              aria-pressed={settingsOpen}
              title="The Wire settings"
            >
              <Settings2 className="w-[18px] h-[18px]" />
              {selectedTopics.length ? (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#0066FF] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                  {selectedTopics.length}
                </span>
              ) : null}
            </button>
          </div>

          {/* Slim, glass topic-filter panel (only when open). One tap on a topic
              applies it and closes the panel; "All" clears the filter. */}
          {settingsOpen ? (
            <div className="mt-2 nl-glass rounded-xl p-3">
              <span className="block text-xs font-medium text-white/60 mb-2">Filter The Wire by topic</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={clearTopics}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition ${
                    selectedTopics.length === 0
                      ? 'bg-[#0066FF]/20 text-[#4d94ff] border-[#0066FF]/50'
                      : 'text-white/60 border-[#0066FF]/25 bg-white/[0.02] hover:text-white hover:border-[#0066FF]/50'
                  }`}
                  aria-pressed={selectedTopics.length === 0}
                >
                  All
                </button>
                {WIRE_TOPICS.map((t) => {
                  const active = selectedTopics.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => selectTopic(t.value)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition ${
                        active
                          ? 'bg-[#0066FF]/20 text-[#4d94ff] border-[#0066FF]/50'
                          : 'text-white/60 border-[#0066FF]/25 bg-white/[0.02] hover:text-white hover:border-[#0066FF]/50'
                      }`}
                      aria-pressed={active}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Active hashtag filter chip */}
          {activeHashtag ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-white/45">Filtering</span>
              <button
                type="button"
                onClick={() => setActiveHashtag(null)}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-[#0066FF]/15 text-[#4d94ff] border border-[#0066FF]/40 hover:bg-[#0066FF]/25 transition"
                title="Clear hashtag filter"
              >
                #{activeHashtag}
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : null}
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
      ) : visiblePosts.length === 0 ? (
        <div className="nl-glass rounded-2xl p-10 text-center">
          {isMainFeed && activeHashtag ? (
            <>
              <p className="text-white/70 font-medium">No wires mention #{activeHashtag}</p>
              <button type="button" onClick={() => setActiveHashtag(null)} className="text-[#4d94ff] text-sm mt-1 hover:underline">
                Clear filter
              </button>
            </>
          ) : isMainFeed && feed === 'pack' && reason === 'no_follows' ? (
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
              <p className="text-white/45 text-sm mt-1">{selectedTopics.length ? 'No posts under this topic from people you follow.' : 'People you follow have not posted yet.'}</p>
            </>
          ) : isMainFeed && selectedTopics.length ? (
            <>
              <p className="text-white/70 font-medium">No wires under this topic yet</p>
              <p className="text-white/45 text-sm mt-1">Pick another topic, or choose All to see everything.</p>
            </>
          ) : (
            <>
              <p className="text-white/70 font-medium">No wires yet</p>
              <p className="text-white/45 text-sm mt-1">
                {reposts
                  ? 'No relays to show.'
                  : repliesBy
                    ? 'No replies yet.'
                    : mediaAuthor
                      ? 'No media wires yet.'
                      : author
                        ? 'Nothing posted here yet.'
                        : 'Be the first to post on The Wire.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((p) => (
            <div key={`${p.id}-${p.reposted_at ?? p.created_at}`}>
              <WirePostCard
                post={p}
                currentUserId={user?.id ?? null}
                onLike={handleLike}
                onRepost={handleRepost}
                onGift={handleGift}
                onDelete={handleDelete}
                onMute={user ? handleMute : undefined}
                muted={mutedIds.has(p.original?.author_id ?? p.author_id)}
                onComment={p.repost_of ? undefined : handleComment}
                onHashtag={handleHashtag}
                onOpenPost={openPost}
                threadOpen={openThreadId === p.id}
              />
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

      {/* Reply thread - opens as a right-side panel (desktop/tablet) or a
          full-screen sheet (mobile) only when the comment icon is tapped. */}
      {openThreadId
        ? (() => {
            const openPost = posts.find((p) => p.id === openThreadId);
            if (!openPost) return null;
            return (
              <WireThreadPanel
                post={openPost}
                currentUserId={user?.id ?? null}
                authorAvatarUrl={(user as { avatar_url?: string | null })?.avatar_url ?? null}
                authorDisplayName={user?.first_name || user?.username || 'You'}
                onClose={() => setOpenThreadId(null)}
                onLike={handleLike}
                onRepost={handleRepost}
                onGift={handleGift}
                onDelete={handleDelete}
                onMute={user ? handleMute : undefined}
                muted={mutedIds.has(openPost.original?.author_id ?? openPost.author_id)}
                onHashtag={handleHashtag}
                onCountDelta={(d) => bumpReplyCount(openThreadId, d)}
              />
            );
          })()
        : null}

      {/* Floating "+" - docked at the bottom-right of the feed area. Opens the
          dedicated, full-screen compose page. Main feed + signed-in only; sits
          above the dashboard bottom nav. Deep neon-blue to match the platform's
          primary buttons. */}
      {isMainFeed && !authLoading && user ? (
        <Link
          href="/dashboard/compose"
          className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 border border-white/15"
          style={{
            background: 'linear-gradient(135deg,#0066FF 0%,#5566FF 100%)',
            boxShadow: '0 8px 28px rgba(0,102,255,0.45), 0 0 24px rgba(0,102,255,0.25)',
          }}
          aria-label="Create a post on The Wire"
          title="Create a post"
        >
          <Plus className="w-6 h-6" />
        </Link>
      ) : null}
    </div>
  );
}
