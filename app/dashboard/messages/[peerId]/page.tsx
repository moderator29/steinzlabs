'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, LockOpen, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  decryptMessage,
  encryptMessage,
  openConversationKey,
} from '@/lib/social/encryption';
import { ensureKeyVault } from '@/lib/social/keyVault';
import { sanitizeMessageBody } from '@/lib/social/sanitizeMessageBody';

/**
 * /dashboard/messages/[peerId] — DM thread (X-style full page).
 *
 * Encryption is best-effort, never blocking: if both sides have a published
 * key we run E2E (libsodium); if the peer hasn't enabled keys we fall back to
 * PLAINTEXT so the conversation still works exactly like X (messages are sent
 * with an empty `iv` sentinel and read verbatim). The header shows which mode
 * is active.
 */

interface ServerMessage {
  id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  created_at: string;
  read_at: string | null;
  deleted_at: string | null;
}

interface UiMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface PeerInfo { username: string | null; display_name: string | null; avatar_url: string | null; created_at?: string | null }

export default function DmThreadPage({ params }: { params: Promise<{ peerId: string }> }) {
  const { peerId } = use(params);
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [convKey, setConvKey] = useState<Uint8Array | null>(null);
  // Plaintext mode — set when the conversation opened without E2E keys.
  const [plaintext, setPlaintext] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  // #43: whether *I* have blocked the peer. The send API shadow-accepts a
  // blocked peer's message (they don't learn they're blocked), so the row
  // still inserts and Realtime would otherwise deliver it to me. A ref (not
  // state) so the realtime handler reads the latest value without resubscribing.
  const blockedPeerRef = useRef(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [requestState, setRequestState] = useState<string | null>(null);
  const [requestedBy, setRequestedBy] = useState<string | null>(null);
  const [peer, setPeer] = useState<PeerInfo | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Conversation is usable once we have a real E2E key OR we're in plaintext mode.
  const ready = !!convKey || plaintext;

  // Mark all received messages in this conversation as read.
  const markRead = useCallback(async () => {
    if (!conversationId) return;
    await fetch('/api/social/dm/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, action: 'read_all' }),
    }).catch(() => {});
  }, [conversationId]);

  // Peer header info.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/social/profile/${encodeURIComponent(peerId)}`).catch(() => null);
      if (r && r.ok && !cancelled) {
        const j = await r.json();
        if (j?.profile) setPeer({ username: j.profile.username, display_name: j.profile.display_name, avatar_url: j.profile.avatar_url, created_at: j.profile.created_at });
      }
    })();
    return () => { cancelled = true; };
  }, [peerId]);

  // This is an incoming request the current user can accept/decline when it's
  // pending AND the *peer* initiated it.
  const isIncomingRequest = requestState === 'pending' && requestedBy === peerId;

  const respondToRequest = useCallback(async (action: 'accept' | 'decline') => {
    if (!conversationId) return;
    await fetch('/api/social/dm/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, action }),
    });
    if (action === 'accept') setRequestState('accepted');
    else router.push('/dashboard/messages');
  }, [conversationId, router]);

  // Bootstrap — PLAINTEXT-FIRST for instant open (no libsodium WASM / peer-key
  // round-trip on the hot path, which was the ~10s stall). We open the
  // conversation immediately; if it turns out to be an EXISTING encrypted
  // thread, we unseal its key in the background so history decrypts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setError('Sign in to message'); return; }
      if (cancelled) return;
      setMe(user.id);

      let conv: { id: string; request_state?: string; requested_by?: string | null; sealed_conversation_key?: string } | null = null;
      try {
        const res = await fetch('/api/social/dm/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peer_id: peerId }),
        });
        if (!res.ok) { const j = await res.json().catch(() => null); if (!cancelled) setError(j?.error ?? 'Could not open conversation'); return; }
        conv = await res.json();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open conversation');
        return;
      }
      if (cancelled || !conv) return;
      setConversationId(conv.id);
      setRequestState(conv.request_state ?? 'accepted');
      setRequestedBy(conv.requested_by ?? null);

      const sealed = conv.sealed_conversation_key;
      if (sealed && sealed !== 'plain') {
        // Existing encrypted thread — unseal in the background. If the vault
        // can't open it, degrade to plaintext rather than blocking.
        try {
          const myKeys = await ensureKeyVault();
          const opened = await openConversationKey(sealed, myKeys.publicKey, myKeys.privateKey);
          if (!cancelled) setConvKey(opened);
        } catch {
          if (!cancelled) setPlaintext(true);
        }
      } else {
        setPlaintext(true);
      }
    })();
    return () => { cancelled = true; };
  }, [peerId]);

  // Decode a stored row → plaintext body. Empty iv ⇒ plaintext (read verbatim);
  // otherwise decrypt with the conversation key.
  const decodeRow = useCallback(async (m: ServerMessage, key: Uint8Array | null): Promise<string> => {
    if (!m.iv) return m.encrypted_content;
    if (!key) return '[encrypted message]';
    try {
      return await decryptMessage({ encrypted_content: m.encrypted_content, iv: m.iv }, key);
    } catch {
      return '[unable to decrypt]';
    }
  }, []);

  const decodeBatch = useCallback(async (rows: ServerMessage[], key: Uint8Array | null): Promise<UiMessage[]> => {
    const out: UiMessage[] = [];
    for (const m of rows) {
      out.push({ id: m.id, sender_id: m.sender_id, body: await decodeRow(m, key), created_at: m.created_at, read_at: m.read_at });
    }
    return out;
  }, [decodeRow]);

  // Initial history fetch + decode (newest 100)
  const loadHistory = useCallback(async () => {
    if (!conversationId || !ready) return;
    const res = await fetch(`/api/social/dm/messages?conversation_id=${conversationId}&limit=100`);
    if (!res.ok) return;
    const json = await res.json();
    const rows = (json.messages ?? []) as ServerMessage[];
    const decoded = await decodeBatch(rows, convKey);
    decoded.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setMessages(decoded);
    setHasMoreOlder(rows.length >= 100);
  }, [conversationId, ready, convKey, decodeBatch]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Paginate older messages by cursor (?before=<oldest.created_at>)
  const loadOlder = useCallback(async () => {
    if (!conversationId || !ready || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0].created_at;
      const res = await fetch(`/api/social/dm/messages?conversation_id=${conversationId}&before=${encodeURIComponent(oldest)}&limit=50`);
      if (!res.ok) return;
      const json = await res.json();
      const rows = (json.messages ?? []) as ServerMessage[];
      if (rows.length === 0) { setHasMoreOlder(false); return; }
      const older = await decodeBatch(rows, convKey);
      setMessages((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...older.filter((o) => !seen.has(o.id)), ...prev];
        merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return merged;
      });
      if (rows.length < 50) setHasMoreOlder(false);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, ready, convKey, loadingOlder, messages, decodeBatch]);

  // #43: load whether I've blocked the peer so the realtime handler can drop
  // their shadow-blocked messages from my live thread.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('social_blocks')
        .select('blocked_id')
        .eq('blocker_id', me)
        .eq('blocked_id', peerId)
        .maybeSingle();
      if (!cancelled) blockedPeerRef.current = !!data;
    })();
    return () => { cancelled = true; };
  }, [me, peerId]);

  // Supabase Realtime subscription for live deliveries. Resubscribe on tab
  // visibility change so backgrounded tabs reconnect cleanly.
  useEffect(() => {
    if (!conversationId || !ready) return;
    const handleInsert = async (payload: { new: ServerMessage }) => {
      const m = payload.new;
      // #43: drop live messages from a peer I've blocked (shadow block) instead
      // of leaking them into my open thread.
      if (blockedPeerRef.current && m.sender_id === peerId) return;
      const body = await decodeRow(m, convKey);
      setMessages((prev) => prev.some((p) => p.id === m.id) ? prev : [...prev, { id: m.id, sender_id: m.sender_id, body, created_at: m.created_at, read_at: m.read_at }]);
    };
    let channel = supabase
      .channel(`dm:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` }, handleInsert)
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void supabase.removeChannel(channel);
      channel = supabase
        .channel(`dm:${conversationId}:${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` }, handleInsert)
        .subscribe();
      void loadHistory();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, ready, convKey, decodeRow, loadHistory]);

  // Auto-scroll on new message
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Mark the thread read on open and whenever new messages arrive while visible.
  useEffect(() => {
    if (!conversationId) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    void markRead();
  }, [conversationId, messages.length, markRead]);

  // Typing indicator over an ephemeral broadcast channel (no DB writes).
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase.channel(`dm-typing:${conversationId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'typing' }, (msg) => {
      const p = msg.payload as { user_id?: string };
      if (p?.user_id && p.user_id === peerId) {
        setPeerTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setPeerTyping(false), 3500);
      }
    }).subscribe();
    typingChannelRef.current = ch;
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [conversationId, peerId]);

  // Throttle typing broadcasts to ~1 every 2s.
  const notifyTyping = useCallback(() => {
    if (!me || !typingChannelRef.current) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: me } });
  }, [me]);

  const send = async () => {
    if (!conversationId || !ready || !draft.trim()) return;
    const body = draft.trim();
    setSending(true);
    try {
      // Encrypt when we have a key; otherwise send plaintext with an empty iv.
      const payload = convKey
        ? { conversation_id: conversationId, ...(await encryptMessage(body, convKey)) }
        : { conversation_id: conversationId, encrypted_content: body, iv: '' };
      const res = await fetch('/api/social/dm/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? 'Could not send');
        return;
      }
      setDraft('');
      // Optimistic append (realtime will dedupe by id).
      const saved = await res.json().catch(() => null);
      if (saved?.message?.id) {
        setMessages((prev) => prev.some((p) => p.id === saved.message.id) ? prev : [...prev, {
          id: saved.message.id, sender_id: me ?? '', body, created_at: saved.message.created_at ?? new Date().toISOString(), read_at: null,
        }]);
      }
    } finally {
      setSending(false);
    }
  };

  const peerName = peer?.display_name || peer?.username || 'Conversation';
  const peerHref = `/u/${peer?.username ?? peerId}`;

  return (
    <div className="flex flex-col h-[100dvh] max-w-2xl mx-auto">
      {/* Header — compact back, peer (links to profile), encryption badge. */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 shrink-0 border-b border-[#0066FF]/20" style={{ boxShadow: '0 1px 0 rgba(0,102,255,.12)' }}>
        <button
          onClick={() => router.push('/dashboard/messages')}
          aria-label="Back to messages"
          className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/[0.06] transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Link href={peerHref} className="flex items-center gap-2 min-w-0 hover:opacity-90">
          {peer?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={peer.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-xs font-bold text-white">
              {(peer?.display_name || peer?.username || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate leading-tight">{peerName}</div>
            <div className="inline-flex items-center gap-1 text-[10px] leading-tight" title={plaintext ? 'Not end-to-end encrypted' : 'End-to-end encrypted'}>
              {plaintext
                ? <span className="text-slate-500 inline-flex items-center gap-1"><LockOpen className="w-2.5 h-2.5" />Unencrypted</span>
                : convKey
                  ? <span className="text-emerald-300/90 inline-flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" />Encrypted</span>
                  : <span className="text-slate-500">{peer?.username ? `@${peer.username}` : ''}</span>}
            </div>
          </div>
        </Link>
      </div>

      {/* Incoming request banner */}
      {isIncomingRequest && (
        <div className="mx-3 mt-3 rounded-xl nl-glass p-3 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0 text-[12px] text-slate-300">
            <span className="font-semibold text-white">Message request.</span> Accept to chat, or decline to remove it. Replying also accepts.
          </div>
          <button onClick={() => void respondToRequest('decline')} className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-slate-300 hover:text-white text-[12px] font-semibold">Decline</button>
          <button onClick={() => void respondToRequest('accept')} className="px-3 py-1.5 rounded-lg bg-[var(--nl-blue,#0066FF)] text-white text-[12px] font-semibold">Accept</button>
        </div>
      )}

      {/* Scrollable conversation */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-2">
        {messages.length > 0 && hasMoreOlder && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="text-[11px] text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-full px-3 py-1 disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}
        {error ? (
          <div className="text-sm text-red-400 px-1">{error}</div>
        ) : messages.length === 0 ? (
          // Empty state — peer profile + View Profile (X-style).
          <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
            <Link href={peerHref}>
              {peer?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={peer.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-2xl font-bold text-white">
                  {(peer?.display_name || peer?.username || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
            </Link>
            <div>
              <div className="text-base font-bold text-white">{peerName}</div>
              {peer?.username && <div className="text-[12px] text-slate-500">@{peer.username}</div>}
            </div>
            <Link
              href={peerHref}
              className="nl-glass px-6 py-2.5 rounded-xl text-[13px] font-bold text-white hover:-translate-y-px transition"
              style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.5), 0 0 16px rgba(0,102,255,.22)' }}
            >
              View Profile
            </Link>
            <p className="text-[11px] text-slate-500 max-w-xs inline-flex items-center gap-1.5 mt-1">
              {plaintext ? <LockOpen className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {plaintext ? 'Messages are not end-to-end encrypted.' : 'Messages in this thread are end-to-end encrypted.'}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  mine ? 'text-white rounded-br-md' : 'nl-glass text-slate-100 rounded-bl-md'
                }`}
                style={mine
                  ? { background: 'linear-gradient(135deg, #1E90FF 0%, #0066FF 60%, #2D5BFF 100%)', boxShadow: '0 0 14px rgba(0,102,255,.35), inset 0 1px 0 rgba(255,255,255,.22)' }
                  : { boxShadow: '0 0 0 1px rgba(0,102,255,.18)' }}>
                  <div className="whitespace-pre-wrap break-words">{sanitizeMessageBody(m.body)}</div>
                  <div className={`text-[9px] mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>{new Date(m.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{mine && m.read_at ? ' · Read' : ''}</div>
                </div>
              </div>
            );
          })
        )}
        {peerTyping && (
          <div className="flex justify-start">
            <div className="nl-glass rounded-2xl rounded-bl-md px-3 py-2 text-[11px] text-slate-300 inline-flex items-center gap-1.5" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.18)' }}>
              <span className="inline-flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '240ms' }} />
              </span>
              typing…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer — pinned at the bottom, always usable once ready. */}
      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-center gap-2 px-3 sm:px-4 py-3 shrink-0 border-t border-[#0066FF]/20"
      >
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); notifyTyping(); }}
          placeholder={ready ? 'Message…' : 'Opening conversation…'}
          disabled={!ready || sending}
          maxLength={4096}
          className="flex-1 bg-white/[0.05] border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[var(--nl-blue,#0066FF)]/50 disabled:opacity-50"
          aria-label="Type your message"
        />
        <button
          type="submit"
          disabled={!ready || sending || !draft.trim()}
          aria-label="Send message"
          style={{ background: 'linear-gradient(135deg, #1E90FF 0%, #0066FF 55%, #2D5BFF 100%)', boxShadow: '0 0 18px rgba(0,102,255,.55), inset 0 1px 0 rgba(255,255,255,.25)' }}
          className="w-10 h-10 shrink-0 rounded-full text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition hover:brightness-110"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
