'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { MessageCircle, Lock, Search, X } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { GlassCard } from '@/components/ui/GlassCard';

interface Conversation {
  id: string;
  peer_id: string;
  sealed_conversation_key: string;
  last_message_at: string | null;
  created_at: string;
  archived: boolean;
  request_state?: 'pending' | 'accepted' | 'declined';
  is_request?: boolean;
  unread?: number;
}

interface PeerInfo {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface SearchUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * /dashboard/messages — encrypted DM inbox, X/Instagram style.
 *
 * Two tabs: Primary (accepted conversations) and Requests (DMs from people
 * you don't follow back, pending your acceptance). A search box finds any
 * platform user to start a new conversation. Plaintext never reaches the
 * inbox — message bodies live only inside the thread after libsodium unseals.
 */
export default function MessagesInboxPage() {
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'primary' | 'requests'>('primary');

  // user search
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchUser[] | null>(null);

  const loadPeers = useCallback(async (ids: string[]) => {
    const peersData: Record<string, PeerInfo> = {};
    await Promise.all(ids.map(async (id) => {
      const r = await fetch(`/api/social/profile/${encodeURIComponent(id)}`).catch(() => null);
      if (r && r.ok) {
        const pj = await r.json();
        if (pj?.profile) peersData[id] = {
          id: pj.profile.id, username: pj.profile.username,
          display_name: pj.profile.display_name, avatar_url: pj.profile.avatar_url,
        };
      }
    }));
    setPeers((prev) => ({ ...prev, ...peersData }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/social/dm/conversations');
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json.error ?? 'Failed'); return; }
        const list: Conversation[] = json.conversations ?? [];
        setConvos(list);
        const ids = list.map((c) => c.peer_id);
        if (ids.length) await loadPeers(ids);
      } catch {
        if (!cancelled) setError('Network error');
      }
    })();
    return () => { cancelled = true; };
  }, [loadPeers]);

  // Debounced user search.
  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/social/search?q=${encodeURIComponent(q.trim())}&limit=12`);
        const j = await r.json();
        if (!cancelled) setResults(j.users ?? []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const primary = (convos ?? []).filter((c) => !c.is_request);
  const requests = (convos ?? []).filter((c) => c.is_request);
  const shown = tab === 'primary' ? primary : requests;

  const ConvoRow = ({ c }: { c: Conversation }) => {
    const peer = peers[c.peer_id];
    const initial = (peer?.display_name || peer?.username || '?').slice(0, 1).toUpperCase();
    return (
      <Link key={c.id} href={`/dashboard/messages/${c.peer_id}`} className="flex items-center gap-3 p-3 hover:bg-white/[0.025]">
        {peer?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-sm font-bold text-white">{initial}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className={`text-sm truncate ${c.unread ? 'font-bold text-white' : 'font-semibold text-white'}`}>{peer?.display_name || peer?.username || 'Unknown user'}</div>
          <div className="text-[11px] text-slate-500">@{peer?.username ?? '—'}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-[11px] text-slate-500 tabular-nums">
            {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'New'}
          </div>
          {!!c.unread && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--nl-blue,#0066FF)] text-white text-[10px] font-bold flex items-center justify-center">
              {c.unread > 99 ? '99+' : c.unread}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <BackButton />
        <MessageCircle className="w-5 h-5 text-[var(--nl-blue,#0066FF)]" />
        <h1 className="text-xl sm:text-2xl font-bold text-white">Messages</h1>
        <button
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Find people to message"
          className="ms-auto p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
          <Lock className="w-3 h-3" />E2E
        </span>
      </div>

      {/* User search — find anyone on the platform to start a DM */}
      {searchOpen && (
        <GlassCard className="p-3 mb-3">
          <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people by username or name…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-slate-500"
            />
            {q && <button onClick={() => setQ('')} aria-label="Clear"><X className="w-3.5 h-3.5 text-slate-500 hover:text-white" /></button>}
          </div>
          {results && (
            <div className="mt-2 divide-y divide-white/[0.05]">
              {results.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No users found</p>
              ) : results.map((u) => (
                <Link key={u.id} href={`/dashboard/messages/${u.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04]">
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-xs font-bold text-white">{(u.display_name || u.username || '?').slice(0, 1).toUpperCase()}</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{u.display_name || u.username}</div>
                    <div className="text-[11px] text-slate-500 truncate">@{u.username}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Primary / Requests tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl mb-3">
        {(['primary', 'requests'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[12px] font-semibold rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-[var(--nl-blue,#0066FF)] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'requests' ? `Requests${requests.length ? ` (${requests.length})` : ''}` : 'Primary'}
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : convos === null ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="text-sm text-slate-400 italic">
          {tab === 'requests'
            ? 'No message requests.'
            : <>No conversations yet. Tap the search icon to find people, or visit <Link href="/discover" className="text-[var(--nl-blue,#0066FF)]">Discover</Link>.</>}
        </div>
      ) : (
        <GlassCard className="divide-y divide-white/[0.05]">
          {shown.map((c) => <ConvoRow key={c.id} c={c} />)}
        </GlassCard>
      )}
    </div>
  );
}
