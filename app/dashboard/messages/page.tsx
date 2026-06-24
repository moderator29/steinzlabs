'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Lock } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface Conversation {
  id: string;
  peer_id: string;
  sealed_conversation_key: string;
  last_message_at: string | null;
  created_at: string;
  archived: boolean;
}

interface PeerInfo {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * /dashboard/messages — encrypted DM inbox.
 *
 * Replaces the prior stub group-chat shell. Lists real conversations
 * from /api/social/dm/conversations. Server returns ciphertext + the
 * sealed conversation key for the caller; no message preview is
 * surfaced because plaintext never reaches the inbox view (it lives
 * only inside the thread page after libsodium unseals the key).
 */
export default function MessagesInboxPage() {
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/social/dm/conversations');
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json.error ?? 'Failed'); return; }
        setConvos(json.conversations ?? []);
        const ids = (json.conversations ?? []).map((c: Conversation) => c.peer_id);
        if (ids.length) {
          const peersData: Record<string, PeerInfo> = {};
          await Promise.all(ids.map(async (id: string) => {
            const r = await fetch(`/api/social/profile/${encodeURIComponent(id)}`).catch(() => null);
            if (r && r.ok) {
              const pj = await r.json();
              peersData[id] = {
                id: pj.profile.id,
                username: pj.profile.username,
                display_name: pj.profile.display_name,
                avatar_url: pj.profile.avatar_url,
              };
            }
          }));
          if (!cancelled) setPeers(peersData);
        }
      } catch {
        if (!cancelled) setError('Network error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <BackButton />
        <MessageCircle className="w-5 h-5 text-[var(--nl-blue,#0066FF)]" />
        <h1 className="text-xl sm:text-2xl font-bold text-white">Messages</h1>
        <span className="ms-auto inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
          <Lock className="w-3 h-3" />End-to-end encrypted
        </span>
      </div>
      {error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : convos === null ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : convos.length === 0 ? (
        <div className="text-sm text-slate-400 italic">
          No conversations yet. Mutual follows can DM you — find people on{' '}
          <Link href="/discover" className="text-[var(--nl-blue,#0066FF)]">Discover</Link>.
        </div>
      ) : (
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] divide-y divide-white/[0.05]">
          {convos.map((c) => {
            const peer = peers[c.peer_id];
            const initial = (peer?.display_name || peer?.username || '?').slice(0, 1).toUpperCase();
            return (
              <Link
                key={c.id}
                href={`/dashboard/messages/${c.peer_id}`}
                className="flex items-center gap-3 p-3 hover:bg-white/[0.025]"
              >
                {peer?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={peer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-sm font-bold text-white">
                    {initial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{peer?.display_name || peer?.username || 'Unknown user'}</div>
                  <div className="text-[11px] text-slate-500">@{peer?.username ?? '—'}</div>
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'New'}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
