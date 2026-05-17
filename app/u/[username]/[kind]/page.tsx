'use client';

import { use, useEffect, useState } from 'react';
import BackButton from '@/components/ui/BackButton';
import { UserListRow } from '@/components/social/UserListRow';

/**
 * /u/[username]/followers and /u/[username]/following — dedicated
 * full-page X-style lists with in-list search + sort + infinite scroll.
 */

interface ListUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  verified_badge: string | null;
  is_chosen: boolean | null;
  success_rate: number | null;
  i_follow: boolean;
  pending_outgoing?: boolean;
}

export default function FollowsListPage({ params }: { params: Promise<{ username: string; kind: string }> }) {
  const { username, kind } = use(params);
  if (kind !== 'followers' && kind !== 'following') {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Unknown list</div>;
  }
  return <FollowsListContent username={username} kind={kind} />;
}

function FollowsListContent({ username, kind }: { username: string; kind: 'followers' | 'following' }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<ListUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'success'>('recent');

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/social/profile/${encodeURIComponent(username)}`);
      if (res.ok) { const json = await res.json(); setUserId(json.profile.id); }
    })();
  }, [username]);

  const loadMore = async () => {
    if (!userId || loading || done) return;
    setLoading(true);
    const params = new URLSearchParams({ user_id: userId, kind, limit: '20', sort });
    if (cursor) params.set('cursor', cursor);
    if (q) params.set('q', q);
    const res = await fetch(`/api/social/follows/list?${params}`);
    const json = await res.json();
    if (res.ok) {
      setUsers((prev) => [...prev, ...(json.users ?? [])]);
      setCursor(json.next_cursor);
      if (!json.next_cursor || (json.users ?? []).length === 0) setDone(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    setUsers([]); setCursor(null); setDone(false);
  }, [q, sort, userId]);

  useEffect(() => { if (userId && users.length === 0 && !done) void loadMore(); /* eslint-disable-next-line */ }, [userId, q, sort]);

  // Infinite scroll
  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 600) void loadMore();
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line
  }, [userId, cursor, q, sort, loading, done]);

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <BackButton />
        <h1 className="text-xl font-bold text-white capitalize">@{username}&apos;s {kind}</h1>
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${kind}…`}
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'recent' | 'success')}
          className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="recent">Recent</option>
          <option value="success">Highest Success</option>
        </select>
      </div>
      {users.length === 0 && done ? (
        <div className="text-sm text-slate-400 italic">No {kind} match.</div>
      ) : (
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] divide-y divide-white/[0.05]">
          {users.map((u) => <UserListRow key={u.id} user={u} />)}
        </div>
      )}
      {loading && <div className="text-center text-[12px] text-slate-400 py-4">Loading…</div>}
      {done && users.length > 0 && <div className="text-center text-[11px] text-slate-500 py-4">End of list.</div>}
    </div>
  );
}
