'use client';

/**
 * CoinRoom - a live chat panel for a single coin. Real messages from
 * /api/coins/[chain]/[address]/room, polled every 6s. Signed-in users get a
 * composer (Enter to send); signed-out users get an honest sign-in prompt.
 * Empty rooms show an honest "be the first" state, never a blank titled shell.
 * Edge-lit glass, brand accents, flat icons, no arrows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { MessagesSquare, Loader2 } from 'lucide-react';
import { shortAgo } from '@/lib/coins/format';
import type { Coin } from '@/lib/coins/types';

const POLL_MS = 6000;
const MAX_BODY = 500;

interface RoomAuthor {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
}

interface RoomMessage {
  id: string;
  body: string;
  created_at: string;
  author: RoomAuthor | null;
}

function authorName(a: RoomAuthor | null): string {
  return (a?.display_name || a?.username || 'anon').trim();
}

function Avatar({ author, size = 30 }: { author: RoomAuthor | null; size?: number }) {
  const initial = authorName(author).charAt(0).toUpperCase();
  if (author?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatar_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover ring-1 ring-inset ring-white/10 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white/90 font-semibold ring-1 ring-inset ring-white/10"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#0066FF33,#00C8FF33)', fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}

export function CoinRoom({ coin, canPost }: { coin: Coin; canPost: boolean }) {
  const symbol = (coin.symbol || '').trim();
  const [messages, setMessages] = useState<RoomMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}/room`, { cache: 'no-store' });
      if (!r.ok) { setMessages((prev) => prev ?? []); return; }
      const j = await r.json();
      setMessages(Array.isArray(j.messages) ? j.messages : []);
    } catch {
      setMessages((prev) => prev ?? []);
    }
  }, [coin.chain, coin.tokenAddress]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Keep the view pinned to the newest message when the user is already at the
  // bottom, so incoming chat doesn't yank them away mid-scroll.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (r.ok) {
        const j = await r.json();
        setDraft('');
        atBottomRef.current = true;
        if (j?.message) {
          setMessages((prev) => [...(prev ?? []), j.message as RoomMessage]);
        } else {
          await load();
        }
      }
    } finally {
      setSending(false);
    }
  }, [draft, sending, coin.chain, coin.tokenAddress, load]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="nl-glass rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: 520 }}>
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/[0.06]">
        <MessagesSquare className="w-[18px] h-[18px] text-[#7FB2FF]" />
        <h3 className="text-[14px] font-bold text-white">
          {symbol ? `$${symbol} room` : 'Coin room'}
        </h3>
        {messages && messages.length > 0 ? (
          <span className="ms-auto text-[11px] font-semibold text-white/40 tabular-nums">
            {messages.length} live
          </span>
        ) : null}
      </div>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto no-scrollbar px-3.5 py-3 space-y-3 min-h-[160px]"
      >
        {messages === null ? (
          <div className="flex items-center justify-center py-10 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4">
            <MessagesSquare className="w-7 h-7 text-[#7FB2FF]/60 mb-2.5" />
            <p className="text-[13px] text-white/50">
              Be the first to say something about {symbol ? `$${symbol}` : 'this coin'}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2.5"
              >
                <Avatar author={m.author} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-white truncate">{authorName(m.author)}</span>
                    <span className="text-[11px] text-white/35 tabular-nums shrink-0">
                      {shortAgo(new Date(m.created_at).getTime())}
                    </span>
                  </div>
                  <p className="text-[13px] leading-snug text-white/85 whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {canPost ? (
        <div className="border-t border-white/[0.06] p-2.5">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
              onKeyDown={onKeyDown}
              placeholder={symbol ? `Message the $${symbol} room` : 'Message the room'}
              maxLength={MAX_BODY}
              className="flex-1 min-w-0 bg-white/[0.04] rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none ring-1 ring-inset ring-white/10 focus:ring-[#0066FF]/60 transition"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white bg-[#0066FF] hover:bg-[#0a72ff] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-white/[0.06] p-3 text-center">
          <p className="text-[12.5px] text-white/50">
            <Link href="/login" className="font-semibold text-[#7FB2FF] hover:text-white">Sign in</Link>
            {' '}to join the conversation
          </p>
        </div>
      )}
    </div>
  );
}
