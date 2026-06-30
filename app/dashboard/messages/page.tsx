'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Lock, Search, X, MoreHorizontal, CheckCheck, Filter, Volume2, Eye } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { messagesHowItWorks } from '@/lib/howItWorks/content/messages';

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
function SettingToggle({ label, icon: Icon, on, onClick }: { label: string; icon: React.ComponentType<{ className?: string }>; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-start flex items-center gap-2 px-2 py-2 rounded-lg text-[12px] text-slate-200 hover:bg-white/[0.05]">
      <Icon className="w-3.5 h-3.5 text-white/60" />
      <span className="flex-1">{label}</span>
      <span className={`w-7 h-4 rounded-full relative transition ${on ? 'bg-[#0066FF]' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export default function MessagesInboxPage() {
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'primary' | 'requests'>('primary');

  // user search (always-visible long bar)
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchUser[] | null>(null);
  // settings menu (replaces the E2E pill)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [receiptsOn, setReceiptsOn] = useState(true);
  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem('naka_dm_sound') !== '0');
      setReceiptsOn(localStorage.getItem('naka_dm_receipts') !== '0');
    } catch { /* defaults */ }
  }, []);
  const markAllRead = useCallback(async () => {
    const list = convos ?? [];
    await Promise.all(list.filter((c) => !c.is_request && (c.unread ?? 0) > 0).map((c) =>
      fetch('/api/social/dm/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: c.id, action: 'read_all' }) }).catch(() => {}),
    ));
    setConvos((prev) => prev ? prev.map((c) => ({ ...c, unread: 0 })) : prev);
    setSettingsOpen(false);
  }, [convos]);

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
  let shown = tab === 'primary' ? primary : requests;
  if (unreadOnly) shown = shown.filter((c) => (c.unread ?? 0) > 0);

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
      {/* Header: back · always-visible long search · settings dot (no title/E2E) */}
      <div className="flex items-center gap-2 mb-3">
        <BackButton />
        <div className="flex-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2 min-w-0">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people by username or name…"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-slate-500 min-w-0"
          />
          {q && <button onClick={() => setQ('')} aria-label="Clear"><X className="w-3.5 h-3.5 text-slate-500 hover:text-white" /></button>}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Message settings"
            style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 12px rgba(0,102,255,.18)' }}
            className="nl-glass p-2 rounded-lg text-white/80 hover:text-white"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 mt-2 w-60 nl-glass rounded-xl p-1.5 z-50">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Message settings</div>
                <button onClick={markAllRead} className="w-full text-start flex items-center gap-2 px-2 py-2 rounded-lg text-[12px] text-slate-200 hover:bg-white/[0.05]"><CheckCheck className="w-3.5 h-3.5 text-blue-300" /> Mark all as read</button>
                <SettingToggle label="Show unread only" icon={Filter} on={unreadOnly} onClick={() => setUnreadOnly((v) => !v)} />
                <SettingToggle label="Notification sound" icon={Volume2} on={soundOn} onClick={() => { setSoundOn((v) => { const n = !v; try { localStorage.setItem('naka_dm_sound', n ? '1' : '0'); } catch {} return n; }); }} />
                <SettingToggle label="Read receipts" icon={Eye} on={receiptsOn} onClick={() => { setReceiptsOn((v) => { const n = !v; try { localStorage.setItem('naka_dm_receipts', n ? '1' : '0'); } catch {} return n; }); }} />
                <div className="my-1 border-t border-white/[0.06]" />
                <div className="px-2 py-1.5 flex items-center gap-1.5 text-[10px] text-emerald-300/80"><Lock className="w-3 h-3" /> End-to-end encrypted</div>
              </div>
            </>
          )}
        </div>
        <HowItWorksButton content={messagesHowItWorks} className="shrink-0" />
      </div>

      {/* User search results */}
      {q.trim() && results && (
        <GlassCard className="p-2 mb-3">
          <div className="divide-y divide-white/[0.05]">
            {results.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No users found</p>
            ) : results.map((u) => (
              <Link key={u.id} href={`/dashboard/messages/${u.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04]">
                {u.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 45%,#7C3AED)' }}>{(u.display_name || u.username || '?').slice(0, 1).toUpperCase()}</div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{u.display_name || u.username}</div>
                  <div className="text-[11px] text-slate-500 truncate">@{u.username}</div>
                </div>
              </Link>
            ))}
          </div>
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
            : unreadOnly
            ? 'No unread conversations.'
            : <>No conversations yet. Search above to find anyone, or visit <Link href="/discover" className="text-[var(--nl-blue,#0066FF)]">Discover</Link>.</>}
        </div>
      ) : (
        <GlassCard className="divide-y divide-white/[0.05]">
          {shown.map((c) => <ConvoRow key={c.id} c={c} />)}
        </GlassCard>
      )}
    </div>
  );
}
