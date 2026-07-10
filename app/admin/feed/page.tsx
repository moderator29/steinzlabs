'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RefreshCw, Heart, Repeat2, Gift, MessageCircle, Trash2, Info } from 'lucide-react';

interface TopPost {
  id: string;
  author_id: string | null;
  body: string | null;
  like_count: number;
  repost_count: number;
  reply_count: number;
  gift_count: number;
  gift_total_usd: number;
  engagement: number;
  created_at: string;
  deleted_at: string | null;
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

interface FeedData {
  stats: {
    total_posts: number;
    live_posts: number;
    deleted_posts: number;
    posts_24h: number;
    posts_7d: number;
    active_posters_7d: number;
  };
  topPosts: TopPost[];
  postReportsSupported: boolean;
}

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function fmtUsd(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

export default function FeedModerationPage() {
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feed', { headers: authHeader() });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('[admin/feed] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deletePost = async (id: string) => {
    if (!confirm('Soft-delete this post? It will be hidden from the Wire feed.')) return;
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/feed', {
        method: 'DELETE',
        headers: authHeader(),
        body: JSON.stringify({ post_id: id }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  const stats = data?.stats;
  const cards = [
    { label: 'Total Posts', value: stats?.total_posts ?? 0 },
    { label: 'Live Posts', value: stats?.live_posts ?? 0 },
    { label: 'Posts (24h)', value: stats?.posts_24h ?? 0 },
    { label: 'Posts (7d)', value: stats?.posts_7d ?? 0 },
    { label: 'Active Posters (7d)', value: stats?.active_posters_7d ?? 0 },
    { label: 'Deleted Posts', value: stats?.deleted_posts ?? 0 },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Feed / Wire Moderation</h1>
          <p className="text-xs text-gray-500 mt-0.5">Post activity, engagement leaders and moderation for the Wire feed</p>
        </div>
        <button onClick={load} disabled={loading} className="nl-button nl-button--ghost">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="nl-glass rounded-2xl p-4">
            <div className="text-[11px] text-gray-400 mb-1">{c.label}</div>
            <div className="text-xl font-bold text-white tabular-nums">{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {!data?.postReportsSupported && (
        <div className="nl-glass rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#0066FF] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-400">
            Post-level reports are not tracked yet. Account-level reports live under Social Reports.
          </p>
        </div>
      )}

      <div className="nl-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Top Posts by Engagement</h3>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <div className="w-4 h-4 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
            <span className="text-xs text-gray-500">Loading feed...</span>
          </div>
        ) : (data?.topPosts.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-sm text-gray-400">No posts yet</p>
            <p className="text-xs text-gray-600 mt-1">Top posts will appear here as the Wire feed fills up</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {data!.topPosts.map((p) => (
              <div key={p.id} className="px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-white truncate">
                        {p.author?.display_name || (p.author?.username ? `@${p.author.username}` : 'Unknown author')}
                      </span>
                      {p.author?.username && p.author?.display_name && (
                        <span className="text-[11px] text-gray-500 truncate">@{p.author.username}</span>
                      )}
                      <span className="text-[11px] text-gray-600 ms-auto flex-shrink-0">
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 line-clamp-2 break-words">{p.body || <span className="text-gray-600 italic">No text</span>}</p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400">
                      <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{p.like_count}</span>
                      <span className="inline-flex items-center gap-1"><Repeat2 className="w-3 h-3" />{p.repost_count}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" />{p.reply_count}</span>
                      <span className="inline-flex items-center gap-1"><Gift className="w-3 h-3" />{p.gift_count}</span>
                      {p.gift_total_usd > 0 && <span className="text-emerald-400">{fmtUsd(p.gift_total_usd)}</span>}
                      <span className="text-[#0066FF] font-semibold">score {p.engagement}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deletePost(p.id)}
                    disabled={busyId === p.id}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
