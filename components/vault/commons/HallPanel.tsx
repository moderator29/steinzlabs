'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Send } from 'lucide-react';

interface Msg {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  author: { name: string };
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function HallPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cult/hall', { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const json = (await res.json()) as { messages: Msg[] };
      setMessages(json.messages);
      setError(null);
    } catch {
      setError('Could not reach the Hall.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/cult/hall', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (res.status === 429) { setError('Slow down — the Hall is listening.'); return; }
      if (!res.ok) throw new Error('send');
      setDraft('');
      setError(null);
      await load();
    } catch {
      setError('Message did not send.');
    } finally {
      setSending(false);
    }
  }, [draft, sending, load]);

  return (
    <div className="flex h-[min(70vh,640px)] flex-col rounded-2xl border border-white/10 bg-[#070A16]/80 backdrop-blur">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
        {loading ? (
          <p className="text-center text-sm text-[#8C9AC0]">Opening the Hall…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#8C9AC0]">The Hall is silent. Be the first to speak.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
              <div className="mb-1 flex items-center gap-2 px-1">
                <span className="text-[12px] font-semibold text-[#C8D6FF]">
                  {m.author.name}
                </span>
                <span className="text-[10px] text-[#6B779C]">{timeAgo(m.created_at)}</span>
              </div>
              <p className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                m.mine
                  ? 'bg-gradient-to-br from-[#3D5AFE]/30 to-[#E11D48]/20 text-white'
                  : 'bg-white/[0.05] text-[#E6ECFF]'
              }`}>
                {m.body}
              </p>
            </div>
          ))
        )}
      </div>

      {error && <p className="px-5 pb-1 text-center text-[12px] text-[#FF9DB0]">{error}</p>}

      <form
        className="flex items-center gap-2 border-t border-white/10 p-3"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={600}
          placeholder="Speak to the Hall…"
          aria-label="Message the Hall"
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[14px] text-white placeholder:text-[#6B779C] focus:border-[#3D5AFE]/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Send message"
          className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#3D5AFE] to-[#E11D48] text-white transition disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
