'use client';

/**
 * CoinWireFeed - a coin's slice of The Wire, rendered with the EXACT same
 * WirePostCard the main Wire uses (signal rail, tier badge, rich text, inline
 * coin cards, action bar, gift, thread replies). It is not a look-alike: it is
 * the real Wire, scoped to one coin via the `cashtag` filter on
 * /api/wire/posts, so a coin's conversation looks and behaves identically to
 * the platform feed. A slim composer at the top posts a wire that always
 * carries $TICKER so it lands both here and on the main Wire. Real data only.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WirePostCard, type WirePost } from '@/components/wire/WirePostCard';
import { WireThreadPanel } from '@/components/wire/WireThreadPanel';
import type { GiftSuccessData } from '@/components/wire/GiftSuccessCard';
import type { Coin } from '@/lib/coins/types';

const GiftSheet = lazy(() => import('@/components/wire/GiftSheet').then((m) => ({ default: m.GiftSheet })));
const GiftSuccessCard = lazy(() => import('@/components/wire/GiftSuccessCard').then((m) => ({ default: m.GiftSuccessCard })));

/** Update any post matching `id`, including an `original` nested inside a repost. */
function patchPost(posts: WirePost[], id: string, patch: (p: WirePost) => WirePost): WirePost[] {
  return posts.map((p) => {
    let next = p;
    if (p.id === id) next = patch(p);
    if (next.original && next.original.id === id) next = { ...next, original: patch(next.original) };
    return next;
  });
}

export function CoinWireFeed({ coin, canPost }: { coin: Coin; canPost: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const symbol = (coin.symbol || '').replace(/[^a-zA-Z0-9]/g, '');

  const [posts, setPosts] = useState<WirePost[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [giftTarget, setGiftTarget] = useState<{ recipient: { id: string; username: string; display_name?: string | null; avatar_url?: string | null }; postId?: string | null } | null>(null);
  const [giftSuccess, setGiftSuccess] = useState<GiftSuccessData | null>(null);
  const inFlightLike = useRef<Set<string>>(new Set());
  const inFlightRepost = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!symbol) { setPosts([]); return; }
    try {
      const r = await fetch(`/api/wire/posts?cashtag=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
      const j = await r.json();
      setPosts(Array.isArray(j.posts) ? j.posts : []);
    } catch { setPosts([]); }
  }, [symbol]);

  useEffect(() => { void load(); }, [load]);

  const publish = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      await fetch(`/api/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}/wire`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
      });
      setDraft('');
      await load();
    } finally { setPosting(false); }
  };

  const handleLike = useCallback(async (post: WirePost) => {
    if (!user) return;
    const id = post.id;
    if (inFlightLike.current.has(id)) return;
    inFlightLike.current.add(id);
    const nextLiked = !post.liked;
    setPosts((prev) => (prev ? patchPost(prev, id, (p) => ({ ...p, liked: nextLiked, like_count: Math.max(0, (p.like_count ?? 0) + (nextLiked ? 1 : -1)) })) : prev));
    try {
      const res = await fetch(`/api/wire/posts/${id}/like`, { method: nextLiked ? 'POST' : 'DELETE' });
      if (!res.ok) throw new Error('like failed');
      const j = await res.json();
      setPosts((prev) => (prev ? patchPost(prev, id, (p) => ({ ...p, liked: typeof j.liked === 'boolean' ? j.liked : nextLiked, like_count: typeof j.like_count === 'number' ? j.like_count : p.like_count })) : prev));
    } catch {
      setPosts((prev) => (prev ? patchPost(prev, id, (p) => ({ ...p, liked: !nextLiked, like_count: Math.max(0, (p.like_count ?? 0) + (nextLiked ? -1 : 1)) })) : prev));
    } finally { inFlightLike.current.delete(id); }
  }, [user]);

  const handleRepost = useCallback(async (post: WirePost) => {
    if (!user) return;
    const id = post.id;
    if (inFlightRepost.current.has(id)) return;
    inFlightRepost.current.add(id);
    const nextReposted = !post.reposted;
    setPosts((prev) => (prev ? patchPost(prev, id, (p) => ({ ...p, reposted: nextReposted, repost_count: Math.max(0, (p.repost_count ?? 0) + (nextReposted ? 1 : -1)) })) : prev));
    try {
      const res = await fetch(`/api/wire/posts/${id}/repost`, { method: nextReposted ? 'POST' : 'DELETE' });
      if (!res.ok) throw new Error('repost failed');
      const j = await res.json();
      setPosts((prev) => (prev ? patchPost(prev, id, (p) => ({ ...p, reposted: typeof j.reposted === 'boolean' ? j.reposted : nextReposted, repost_count: typeof j.repost_count === 'number' ? j.repost_count : p.repost_count })) : prev));
    } catch {
      setPosts((prev) => (prev ? patchPost(prev, id, (p) => ({ ...p, reposted: !nextReposted, repost_count: Math.max(0, (p.repost_count ?? 0) + (nextReposted ? -1 : 1)) })) : prev));
    } finally { inFlightRepost.current.delete(id); }
  }, [user]);

  const handleGift = useCallback((post: WirePost) => {
    const a = post.author;
    if (!a?.username) return;
    setGiftTarget({ recipient: { id: a.id, username: a.username, display_name: a.display_name, avatar_url: a.avatar_url }, postId: post.id });
  }, []);

  const handleComment = useCallback((post: WirePost) => {
    setOpenThreadId((cur) => (cur === post.id ? null : post.id));
  }, []);

  const openPost = useCallback((post: WirePost) => { router.push(`/wire/${post.id}`); }, [router]);

  const bumpReplyCount = useCallback((id: string, delta: number) => {
    setPosts((prev) => (prev ? patchPost(prev, id, (p) => ({ ...p, reply_count: Math.max(0, (p.reply_count ?? 0) + delta) })) : prev));
  }, []);

  const handleDelete = useCallback(async (post: WirePost) => {
    const removedId = post.id;
    let snapshot: WirePost[] = [];
    setPosts((prev) => { snapshot = prev ?? []; return (prev ?? []).filter((p) => p.id !== removedId && p.repost_of !== removedId); });
    try {
      const res = await fetch(`/api/wire/posts/${removedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch { setPosts(snapshot); }
  }, []);

  return (
    <div>
      {canPost ? (
        <div className="nl-glass rounded-2xl p-3 mb-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={`Say something about $${symbol || coin.symbol}`}
            className="w-full bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-white/35">Lands here and on the main Wire.</span>
            <button
              type="button"
              onClick={publish}
              disabled={posting || !draft.trim()}
              className="rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}
            >
              {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Post
            </button>
          </div>
        </div>
      ) : null}

      {posts === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="nl-glass rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-3" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>
            <Sparkles className="w-5 h-5 text-[#4d94ff]" />
          </div>
          <p className="text-white/70 font-medium">No wires on ${symbol || coin.symbol} yet</p>
          <p className="text-white/45 text-sm mt-1">{canPost ? 'Start the conversation above.' : <Link href="/login" className="text-[#4d94ff] hover:underline">Sign in</Link>}</p>
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
              onComment={p.repost_of ? undefined : handleComment}
              onOpenPost={openPost}
              threadOpen={openThreadId === p.id}
            />
          ))}
        </div>
      )}

      {openThreadId && posts
        ? (() => {
            const op = posts.find((p) => p.id === openThreadId);
            if (!op) return null;
            return (
              <WireThreadPanel
                post={op}
                currentUserId={user?.id ?? null}
                authorAvatarUrl={(user as { avatar_url?: string | null } | null)?.avatar_url ?? null}
                authorDisplayName={user?.first_name || user?.username || 'You'}
                onClose={() => setOpenThreadId(null)}
                onLike={handleLike}
                onRepost={handleRepost}
                onGift={handleGift}
                onDelete={handleDelete}
                onCountDelta={(d) => bumpReplyCount(openThreadId, d)}
              />
            );
          })()
        : null}

      {giftTarget ? (
        <Suspense fallback={null}>
          <GiftSheet
            recipient={giftTarget.recipient}
            postId={giftTarget.postId}
            onClose={() => setGiftTarget(null)}
            onSuccess={(data) => { setGiftTarget(null); setGiftSuccess(data); }}
          />
        </Suspense>
      ) : null}
      {giftSuccess ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setGiftSuccess(null)} />
          <div className="relative">
            <Suspense fallback={null}>
              <GiftSuccessCard data={giftSuccess} onClose={() => setGiftSuccess(null)} />
            </Suspense>
          </div>
        </div>
      ) : null}
    </div>
  );
}
