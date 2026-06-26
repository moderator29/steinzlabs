'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Send, ShieldCheck } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
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
 * /dashboard/messages/[peerId] — encrypted DM thread.
 *
 * Bootstraps: lazy-init the caller's libsodium key vault → fetch peer
 * public key → upsert dm_conversations with two sealed copies of a
 * fresh symmetric key → fetch + decrypt history → subscribe to
 * Supabase Realtime for live deliveries.
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

export default function DmThreadPage({ params }: { params: Promise<{ peerId: string }> }) {
  const { peerId } = use(params);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [convKey, setConvKey] = useState<Uint8Array | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('Sign in to message'); return; }
        if (cancelled) return;
        setMe(user.id);

        const myKeys = await ensureKeyVault();
        const peerPublic = await fetchPeerPublicKey(peerId);
        const newKey = await generateConversationKey();
        const sealedSelf = await sealConversationKey(newKey, myKeys.publicKey);
        const sealedPeer = await sealConversationKey(newKey, peerPublic);

        const res = await fetch('/api/social/dm/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peer_id: peerId, sealed_key_self: sealedSelf, sealed_key_peer: sealedPeer }),
        });
        if (!res.ok) { const j = await res.json().catch(() => null); setError(j?.error ?? 'Could not open conversation'); return; }
        const conv = await res.json();
        if (cancelled) return;
        setConversationId(conv.id);
        // The server may have returned the EXISTING sealed key (upsert
        // happy path) — unseal that one instead of using the brand-new
        // key we just generated, so history decrypts.
        const sealed = conv.sealed_conversation_key as string;
        const opened = await openConversationKey(sealed, myKeys.publicKey, myKeys.privateKey);
        setConvKey(opened);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open conversation');
      }
    })();
    return () => { cancelled = true; };
  }, [peerId]);

  const decryptBatch = useCallback(async (rows: ServerMessage[], key: Uint8Array): Promise<UiMessage[]> => {
    const out: UiMessage[] = [];
    for (const m of rows) {
      try {
        const body = await decryptMessage({ encrypted_content: m.encrypted_content, iv: m.iv }, key);
        out.push({ id: m.id, sender_id: m.sender_id, body, created_at: m.created_at, read_at: m.read_at });
      } catch {
        out.push({ id: m.id, sender_id: m.sender_id, body: '[unable to decrypt]', created_at: m.created_at, read_at: m.read_at });
      }
    }
    return out;
  }, []);

  // Initial history fetch + decrypt (newest 100)
  const loadHistory = useCallback(async () => {
    if (!conversationId || !convKey) return;
    const res = await fetch(`/api/social/dm/messages?conversation_id=${conversationId}&limit=100`);
    if (!res.ok) return;
    const json = await res.json();
    const rows = (json.messages ?? []) as ServerMessage[];
    const decrypted = await decryptBatch(rows, convKey);
    decrypted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setMessages(decrypted);
    setHasMoreOlder(rows.length >= 100);
  }, [conversationId, convKey, decryptBatch]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // DM7: paginate older messages by cursor (?before=<oldest.created_at>)
  const loadOlder = useCallback(async () => {
    if (!conversationId || !convKey || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0].created_at;
      const res = await fetch(`/api/social/dm/messages?conversation_id=${conversationId}&before=${encodeURIComponent(oldest)}&limit=50`);
      if (!res.ok) return;
      const json = await res.json();
      const rows = (json.messages ?? []) as ServerMessage[];
      if (rows.length === 0) { setHasMoreOlder(false); return; }
      const older = await decryptBatch(rows, convKey);
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
  }, [conversationId, convKey, loadingOlder, messages, decryptBatch]);

  // Supabase Realtime subscription for live deliveries. DM4: resubscribe
  // on tab visibility change so backgrounded tabs reconnect cleanly when
  // the user returns instead of silently missing deliveries.
  useEffect(() => {
    if (!conversationId || !convKey) return;
    let channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const m = payload.new as ServerMessage;
          try {
            const body = await decryptMessage({ encrypted_content: m.encrypted_content, iv: m.iv }, convKey);
            setMessages((prev) => prev.some((p) => p.id === m.id) ? prev : [...prev, { id: m.id, sender_id: m.sender_id, body, created_at: m.created_at, read_at: m.read_at }]);
          } catch { /* decrypt failed — ignore one row */ }
        },
      )
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void supabase.removeChannel(channel);
      channel = supabase
        .channel(`dm:${conversationId}:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` },
          async (payload) => {
            const m = payload.new as ServerMessage;
            try {
              const body = await decryptMessage({ encrypted_content: m.encrypted_content, iv: m.iv }, convKey);
              setMessages((prev) => prev.some((p) => p.id === m.id) ? prev : [...prev, { id: m.id, sender_id: m.sender_id, body, created_at: m.created_at, read_at: m.read_at }]);
            } catch { /* decrypt failed */ }
          },
        )
        .subscribe();
      // Resync any messages that arrived while the tab was hidden.
      void loadHistory();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, convKey, loadHistory]);

  // Auto-scroll on new message
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    if (!conversationId || !convKey || !draft.trim()) return;
    setSending(true);
    try {
      const enc = await encryptMessage(draft.trim(), convKey);
      const res = await fetch('/api/social/dm/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, encrypted_content: enc.encrypted_content, iv: enc.iv }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? 'Could not send');
        return;
      }
      setDraft('');
      // Realtime will deliver our own row; nothing to do here.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <BackButton />
        <h1 className="text-base font-semibold text-white">Conversation</h1>
        <span className="ms-auto inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
          <ShieldCheck className="w-3 h-3" />Encrypted
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 mb-3 rounded-xl nl-glass p-3">
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
          <div className="text-sm text-red-400">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-slate-400 italic flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" />Say hello — messages in this thread never touch the server unencrypted.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine
                    ? 'bg-[var(--nl-blue,#0066FF)]/15 border border-[var(--nl-blue,#0066FF)]/25 text-white'
                    : 'bg-white/[0.04] border border-white/[0.06] text-slate-100'
                }`}>
                  <div className="whitespace-pre-wrap">{sanitizeMessageBody(m.body)}</div>
                  <div className="text-[9px] text-slate-400 mt-1">{new Date(m.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={convKey ? 'Encrypted message…' : 'Setting up encryption…'}
          disabled={!convKey || sending}
          maxLength={4096}
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 disabled:opacity-50"
          aria-label="Type your message"
        />
        <button
          type="submit"
          disabled={!convKey || sending || !draft.trim()}
          className="px-4 py-2.5 rounded-xl bg-[var(--nl-blue,#0066FF)] hover:bg-[var(--nl-blue-strong,#0052CC)] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />Send
        </button>
      </form>
    </div>
  );
}
