'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Lock, Search, X, MoreHorizontal, CheckCheck, Filter, Volume2, Eye } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { supabase } from '@/lib/supabase';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { messagesHowItWorks } from '@/lib/howItWorks/content/messages';

interface Conversation {
  id: string;
  peer_id: string;
  sealed_conversation_key: string;
  last_message_at: string | null;
  last_message_preview?: string | null;
  is_encrypted?: boolean;
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
/** Inbox row snippet. The DB trigger fills last_message_preview only for
 *  plaintext conversations; for true E2E threads the body never leaves the
 *  client so we show "Encrypted message", and a brand-new (empty) thread
 *  shows "New". */
function previewText(c: Conversation): string {
  if (c.last_message_preview) return c.last_message_preview;
  if (c.last_message_at) return c.is_encrypted ? 'Encrypted message' : 'New message';
  return 'New';
}

function SettingToggle({ label, icon: Icon, on, onClick }: { label: string; icon: React.ComponentType<{ className?: string }>; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-start flex items-center gap-2 px-2 py-2 rounded-lg text-[12px] text-slate-200 hover:bg-white/[0.05]">
      <Icon className="w-3.5 h-3.5 text-white/60" />
      <span className="flex-1">{label}</span>
      <span className={`w-7 h-4 sm:w-8 sm:h-4 rounded-md relative transition ${on ? 'bg-[#0066FF]' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-[3px] bg-white transition-all ${on ? 'left-3.5 sm:left-[18px]' : 'left-0.5'}`} />
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

  // Resolve a batch of peer ids in ONE request (replaces the per-conversation
  // N+1 of /api/social/profile/{id}). Identity is kept stable (no `peers` dep)
  // so realtime/load effects don't churn — the dedupe reads the latest cache
  // through the functional setState below.
  const loadPeers = useCallback(async (ids: string[]) => {
    const unique = Array.from(new Set(ids));
    try {
      const r = await fetch('/api/social/profile/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unique }),
      });
      if (!r.ok) return;
      const j = await r.json();
      const map = (j?.profiles ?? {}) as Record<string, PeerInfo>;
      if (Object.keys(map).length) setPeers((prev) => ({ ...prev, ...map }));
    } catch {
      /* network blip — rows fall back to their placeholder name */
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/social/dm/conversations');
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed'); return; }
      const list: Conversation[] = json.conversations ?? [];
      setConvos(list);
      const ids = list.map((c) => c.peer_id);
      if (ids.length) await loadPeers(ids);
    } catch {
      setError('Network error');
    }
  }, [loadPeers]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  // Supabase Realtime — keep the inbox live without a refresh. The
  // trg_dm_bump_last trigger writes last_message_at/preview/unread onto
  // dm_conversations for every message, so a single subscription filtered to
  // the two rows this user participates in captures new DMs, requests, and
  // unread-count changes — no unfiltered platform-wide dm_messages listener
  // (which never scaled and stormed refetches) required.
  // Mirrors the thread page's subscribe-and-resubscribe-on-visibility pattern.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cleanup: (() => void) | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;

      // Debounce the refetch: a single conversation can fire many
      // dm_conversations UPDATE events in a burst (read-receipts, rapid
      // back-and-forth all bump last_message_at/unread), and an un-debounced
      // refetch storms /api/social/dm/conversations once per event. Coalesce a
      // burst into one trailing reload ~350ms after the last event.
      const onChange = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { void loadConversations(); }, 350);
      };
      const subscribe = (suffix: string) =>
        supabase
          .channel(`inbox:${uid}${suffix}`)
          // Either side of a conversation the user participates in.
          .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations', filter: `user_a_id=eq.${uid}` }, onChange)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations', filter: `user_b_id=eq.${uid}` }, onChange)
          .subscribe();

      channel = subscribe('');

      const onVisibility = () => {
        if (document.visibilityState !== 'visible' || !channel) return;
        void supabase.removeChannel(channel);
        channel = subscribe(`:${Date.now()}`);
        void loadConversations();
      };
      document.addEventListener('visibilitychange', onVisibility);
      cleanup = () => {
        document.removeEventListener('visibilitychange', onVisibility);
        if (debounceTimer) clearTimeout(debounceTimer);
        if (channel) void supabase.removeChannel(channel);
      };
      if (cancelled) cleanup();
    })();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (cleanup) cleanup();
      else if (channel) void supabase.removeChannel(channel);
    };
  }, [loadConversations]);

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
          <div className={`text-[11px] truncate ${c.unread ? 'text-slate-300' : 'text-slate-500'}`}>{previewText(c)}</div>
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
        {/* Inbox Back always returns to the dashboard. Using smartBack /
            router.back() here looped the user between the inbox and a
            just-opened thread (the thread's Back pushes /dashboard/messages,
            so router.back() on the list walked straight back into the thread).
            An explicit target guarantees a path home. */}
        <BackButton href="/dashboard" forceHref />
        <div className="flex-1 flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2 min-w-0">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people by username or name…"
            className="flex-1 bg-transparent outline-none text-base text-white placeholder-slate-500 min-w-0"
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
                {/* Encryption is per-conversation (E2E when both sides have keys,
                    otherwise plaintext). The blanket "End-to-end encrypted" claim
                    was misleading at the inbox level — each thread shows its own
                    real state in its header instead. */}
                <div className="px-2 py-1.5 flex items-center gap-1.5 text-[10px] text-white/50"><Lock className="w-3 h-3" /> Encryption is shown per conversation</div>
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
        /* overflow-hidden clips each row's square tap/hover fill to the card's
           rounded corners so the active-row highlight can't bleed past the
           first/last row edges (nl-glass itself never sets overflow). */
        <GlassCard className="divide-y divide-white/[0.05] overflow-hidden">
          {shown.map((c) => <ConvoRow key={c.id} c={c} />)}
        </GlassCard>
      )}
    </div>
  );
}
