'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Lock, LockOpen, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  decryptMessage,
  encryptMessage,
  generateConversationKey,
  openConversationKey,
  sealConversationKey,
} from '@/lib/social/encryption';
import { ensureKeyVault, fetchPeerPublicKey } from '@/lib/social/keyVault';
import { sanitizeMessageBody } from '@/lib/social/sanitizeMessageBody';

/**
 * /dashboard/messages/[peerId] — DM thread (X-style full page).
 *
 * Encryption is real and best-effort, never blocking: when the peer has a
 * published box public key we generate a conversation key, seal it to BOTH
 * participants and create the conversation ENCRYPTED from message 1 (libsodium
 * E2E). When the peer hasn't published a key we fall back to PLAINTEXT so the
 * conversation still works exactly like X (messages sent with an empty `iv`
 * sentinel and read verbatim). The header reflects the conversation's REAL
 * per-conversation state — it only shows the lock when a key is actually in use.
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

/** Time-only for messages sent today; a short "Mon D, h:mm AM" for older days. */
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}

export default function DmThreadPage({ params }: { params: Promise<{ peerId: string }> }) {
  const { peerId } = use(params);
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [convKey, setConvKey] = useState<Uint8Array | null>(null);
  // Plaintext mode — set when the conversation opened without E2E keys.
  const [plaintext, setPlaintext] = useState(false);
  // The conversation's REAL encryption state (from the server row). The header
  // only claims "Encrypted" when this is true AND the key is actually loaded,
  // so the UI never overstates what's happening to the bytes.
  const [isEncrypted, setIsEncrypted] = useState(false);
  // TOFU: true when the peer's server-provided public key differs from the one
  // first pinned for them. Encryption is server-mediated (the server hands back
  // the peer key), so a change may indicate a MITM key swap — warn, don't hide.
  const [peerKeyChanged, setPeerKeyChanged] = useState(false);
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
  // Tracks whether the first history render has been positioned. The initial
  // jump is instant (no animation); messages arriving after mount scroll smoothly.
  const didInitialScroll = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Bootstrap — open (or create) the conversation with REAL E2E when possible.
  //  1. Load my keypair + the peer's published public key, generate a fresh
  //     conversation key and seal it to both sides. The conversation is created
  //     ENCRYPTED from message 1 (is_encrypted=true server-side).
  //  2. If the peer hasn't published a key (or any crypto step fails) we create
  //     the conversation in PLAINTEXT — and the header says so honestly.
  //  3. For an EXISTING conversation the server returns its stored sealed key;
  //     we unseal it so history decrypts, and trust the row's is_encrypted flag.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setError('Sign in to message'); return; }
      if (cancelled) return;
      setMe(user.id);

      // Try to establish E2E material BEFORE creating the conversation, so a
      // brand-new thread is encrypted from the first message. Best-effort: any
      // failure (peer has no key, vault error) falls through to plaintext.
      let sealedSelf: string | undefined;
      let sealedPeer: string | undefined;
      let freshKey: Uint8Array | null = null;
      let myKeys: { publicKey: string; privateKey: string } | null = null;
      try {
        myKeys = await ensureKeyVault();
        const peerKey = await fetchPeerPublicKey(peerId);
        if (!cancelled && peerKey.changed) setPeerKeyChanged(true);
        freshKey = await generateConversationKey();
        sealedSelf = await sealConversationKey(freshKey, myKeys.publicKey);
        sealedPeer = await sealConversationKey(freshKey, peerKey.publicKey);
      } catch {
        // Peer has no published key (or vault failed) — plaintext fallback.
        sealedSelf = undefined;
        sealedPeer = undefined;
        freshKey = null;
      }
      if (cancelled) return;

      let conv:
        | { id: string; request_state?: string; requested_by?: string | null; sealed_conversation_key?: string; is_encrypted?: boolean }
        | null = null;
      try {
        const res = await fetch('/api/social/dm/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peer_id: peerId, sealed_key_self: sealedSelf, sealed_key_peer: sealedPeer }),
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
      setIsEncrypted(!!conv.is_encrypted);

      const sealed = conv.sealed_conversation_key;
      if (sealed && sealed !== 'plain') {
        // The server returns the authoritative stored key. For a brand-new
        // encrypted thread it's the one we just sealed (use freshKey directly);
        // for an existing thread, unseal with my keypair.
        if (freshKey && sealedSelf && sealed === sealedSelf) {
          setConvKey(freshKey);
        } else {
          try {
            const keys = myKeys ?? (await ensureKeyVault());
            const opened = await openConversationKey(sealed, keys.publicKey, keys.privateKey);
            if (!cancelled) setConvKey(opened);
          } catch {
            // Can't open the stored key on this device (key rotation / lost
            // device). Do NOT downgrade to plaintext — that would send cleartext
            // into a thread the peer reads as encrypted. Keep it locked: leave
            // convKey null + plaintext false so the composer stays disabled, and
            // surface why. History stays unreadable here (correct — the key is
            // genuinely unavailable on this device).
            if (!cancelled) {
              setIsEncrypted(true);
              setError('This encrypted conversation can’t be unlocked on this device.');
            }
          }
        }
      } else {
        // No real key stored — plaintext conversation.
        setPlaintext(true);
        setIsEncrypted(false);
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
      const oldest = messages[0];
      const res = await fetch(`/api/social/dm/messages?conversation_id=${conversationId}&before=${encodeURIComponent(oldest.created_at)}&before_id=${encodeURIComponent(oldest.id)}&limit=50`);
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
    // #33: read receipts (and soft-deletes) arrive as UPDATEs, not INSERTs —
    // patch read_at into the matching message so "· Read" updates live instead
    // of only on reload.
    const handleUpdate = (payload: { new: ServerMessage }) => {
      const m = payload.new;
      setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, read_at: m.read_at } : p)));
    };
    const subscribe = (suffix: string) =>
      supabase
        .channel(`dm:${conversationId}${suffix}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` }, handleInsert)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` }, handleUpdate)
        .subscribe();
    let channel = subscribe('');

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void supabase.removeChannel(channel);
      channel = subscribe(`:${Date.now()}`);
      void loadHistory();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, ready, convKey, decodeRow, loadHistory]);

  // Auto-scroll: the first history render jumps instantly (no animation jank on
  // open); every message that arrives AFTER mount scrolls smoothly.
  useEffect(() => {
    if (messages.length === 0) return;
    if (!didInitialScroll.current) {
      endRef.current?.scrollIntoView({ behavior: 'auto' });
      didInitialScroll.current = true;
    } else {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

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
      // Shadow-block consistency: if the peer is blocked we drop their messages
      // from the live thread, so we must not render their typing indicator either.
      if (blockedPeerRef.current) return;
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

  // Grow the composer textarea with its content, capped at ~5 lines, then let
  // it scroll internally. Reset on send so it snaps back to one line.
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 5 * 24; // ~5 lines at the textarea's line-height
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, []);
  useEffect(() => { autoResize(); }, [draft, autoResize]);

  // Throttle typing broadcasts to ~1 every 2s.
  const notifyTyping = useCallback(() => {
    if (!me || !typingChannelRef.current) return;
    // Don't broadcast typing to a peer we've blocked (shadow-block consistency).
    if (blockedPeerRef.current) return;
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
      // Idempotency key so a retried request (network blip, double-tap) doesn't
      // create a duplicate row — the server dedupes on it and reports success.
      const clientMsgId = crypto.randomUUID();
      // Encrypt when we have a key; otherwise send plaintext with an empty iv.
      const payload = convKey
        ? { conversation_id: conversationId, client_msg_id: clientMsgId, ...(await encryptMessage(body, convKey)) }
        : { conversation_id: conversationId, client_msg_id: clientMsgId, encrypted_content: body, iv: '' };
      const res = await fetch('/api/social/dm/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        // Make the common failures actionable rather than terse.
        if (res.status === 429) setError("You're sending too fast. Wait a few seconds and try again.");
        else if (res.status === 403) setError(j?.error ?? 'You can\'t message this user (blocked or messages disabled).');
        else setError(j?.error ?? 'Could not send.');
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
    } catch {
      // Network/throw path: the draft was never cleared (we only clear on a 2xx),
      // so the user's text is intact — just surface the failure instead of the
      // message silently vanishing.
      setError('Could not send. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const peerName = peer?.display_name || peer?.username || 'Conversation';
  const peerHref = `/u/${peer?.username ?? peerId}`;

  return (
    // Full-screen fixed overlay so the thread escapes the dashboard chrome
    // (aurora bg + banners) that was clipping the header at the top and pushing
    // the composer off the bottom. inset-0 + max-w-2xl + mx-auto centres it on
    // desktop and fills the viewport on mobile; h-dvh tracks the mobile URL bar.
    <div
      data-overlay
      className="fixed inset-0 z-[60] mx-auto flex h-[100dvh] max-w-2xl flex-col overflow-x-hidden"
      style={{
        // Own opaque brand canvas so nothing on a lower layer (a nav / VTX
        // active-tab highlight pill) bleeds through the transparent overlay.
        // Deep-navy base keeps it sealed; the two soft radial glows preserve
        // the brand aurora feel instead of a flat box.
        background:
          'radial-gradient(ellipse 90% 55% at 15% 0%, rgba(0,102,255,0.14) 0%, transparent 55%), radial-gradient(ellipse 90% 55% at 85% 12%, rgba(0,200,255,0.08) 0%, transparent 55%), var(--nl-canvas-base, #050816)',
      }}
    >
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
            <div
              className="inline-flex items-center gap-1 text-[10px] leading-tight"
              title={
                isEncrypted && convKey
                  ? 'Encrypted. Message content is encrypted with libsodium, but public keys are distributed through our server, so we do not call this fully end-to-end verified.'
                  : 'Not encrypted'
              }
            >
              {isEncrypted && convKey
                ? peerKeyChanged
                  ? <span className="text-amber-300 inline-flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />Key changed</span>
                  : <span className="text-emerald-300/90 inline-flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" />Encrypted</span>
                : plaintext
                  ? <span className="text-slate-500 inline-flex items-center gap-1"><LockOpen className="w-2.5 h-2.5" />Not encrypted</span>
                  : <span className="text-slate-500">{peer?.username ? `@${peer.username}` : ''}</span>}
            </div>
          </div>
        </Link>
      </div>

      {/* Peer key changed — TOFU warning. The key distributed by the server for
          this peer differs from the one we first pinned, which can mean the peer
          reset their device/keypair OR that key distribution was tampered with.
          Surface it instead of silently trusting the new key. */}
      {peerKeyChanged && (
        <div className="mx-3 mt-3 rounded-xl border border-amber-400/40 bg-amber-400/[0.08] p-3 flex items-start gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="min-w-0 text-[12px] text-amber-100/90">
            <span className="font-semibold text-amber-200">This contact’s encryption key changed.</span>{' '}
            New messages are encrypted to the new key. This is expected if they reset their device, but if you weren’t expecting it, verify with them through another channel before sharing anything sensitive.
          </div>
        </div>
      )}

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

      {/* Scrollable conversation — min-h-0 lets flex-1 actually scroll inside
          the fixed column instead of overflowing past the composer. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 space-y-2">
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
              {isEncrypted && convKey ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
              {isEncrypted && convKey ? 'Messages in this thread are encrypted. Keys are distributed through our server.' : 'Messages are not encrypted.'}
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
                  <div className={`text-[11px] mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>{formatMessageTime(m.created_at)}{mine && m.read_at ? ' · Read' : ''}</div>
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

      {/* Composer — pinned at the bottom, always usable once ready. The
          naka-safe-bottom class pads past the iPhone home indicator. */}
      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-end gap-2 px-3 sm:px-4 py-3 shrink-0 border-t border-[#0066FF]/20 naka-safe-bottom"
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); notifyTyping(); }}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={ready ? 'Message…' : 'Opening conversation…'}
          disabled={!ready || sending}
          maxLength={4096}
          rows={1}
          className="flex-1 min-w-0 resize-none bg-[#0066FF]/[0.06] border border-[#0066FF]/25 rounded-2xl px-4 py-2.5 text-base leading-6 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0066FF]/60 disabled:opacity-50"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(0,102,255,.06), 0 0 12px rgba(0,102,255,.08)' }}
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
