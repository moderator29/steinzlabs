'use client';

import { useEffect, useRef, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/**
 * VTX Sage — the cult's private oracle voice. A focused chat surface that
 * sits inside the Oracle hub, separate from /dashboard/vtx-ai. Persona +
 * history live on the server; the client only renders.
 */
export function VtxSagePanel() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/oracle/sage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { messages?: Message[] } | null) => {
        if (!cancelled) setMessages(data?.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  if (messages === null) return null;

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    // Optimistically append the user turn so the surface feels live.
    const userMsg: Message = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...(m ?? []), userMsg]);
    setDraft('');
    try {
      const res = await fetch('/api/cult/oracle/sage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const json = (await res.json().catch(() => null)) as
        | { reply?: string; error?: string }
        | null;
      if (!res.ok || !json?.reply) {
        setError(json?.error ?? 'sage_failed');
        // Roll back the optimistic user turn so the user can retry; the
        // server already persisted it but the UI staying consistent with the
        // server is less important than letting them resend.
        return;
      }
      setMessages((m) => [
        ...(m ?? []),
        {
          role: 'assistant',
          content: json.reply!,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <article
      className="oracle-subchamber oracle-subchamber--sage"
      aria-label="VTX Sage — cult oracle voice"
    >
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">VTX Sage</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0]">private to you</span>
      </header>
      <h3 className="oracle-subchamber__title">The oracle&apos;s voice</h3>
      <p className="oracle-subchamber__tagline">
        Ask the Sage. Ink, parchment, framings — no prices fabricated, no advice given.
      </p>

      <div
        className="mt-4 max-h-[380px] overflow-y-auto rounded-lg border border-white/10 bg-[#0b1022]/40 p-3"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-[12px] text-[#7F8AA8]">
            The Sage is silent. Speak first.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m, i) => (
              <li
                key={`${m.created_at}-${i}`}
                className={`rounded-md px-3 py-2 text-[13px] whitespace-pre-wrap ${
                  m.role === 'assistant'
                    ? 'border border-[#00C8FF]/20 bg-[#00C8FF]/[0.04] text-[#E6ECFF]'
                    : 'border border-white/10 bg-white/[0.03] text-white'
                }`}
              >
                <span className="block text-[10px] uppercase tracking-[0.18em] text-[#7F8AA8] mb-1">
                  {m.role === 'assistant' ? 'Sage' : 'You'}
                </span>
                {m.content}
              </li>
            ))}
          </ul>
        )}
        {sending ? (
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#00C8FF]">
            The Sage listens…
          </p>
        ) : null}
        <div ref={tailRef} />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Speak to the Sage. Ctrl/Cmd+Enter to send."
          className="rounded-md border border-white/10 bg-[#0b1022] px-3 py-2 text-[13px] text-[#E6ECFF] outline-none focus:border-[#00C8FF]/60"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#7F8AA8]">{draft.trim().length} / 4000</span>
          <button
            type="button"
            onClick={send}
            disabled={sending || draft.trim().length === 0}
            className="nl-button inline-flex items-center justify-center px-4 py-2 text-[11px] uppercase tracking-[0.18em] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {error ? (
          <p className="text-[11px] text-[#FF1744]" role="alert">
            {error === 'anthropic_not_configured'
              ? 'The Sage is offline. Set ANTHROPIC_API_KEY.'
              : error === 'message_too_long'
                ? 'Message too long. Trim and try again.'
                : 'The Sage did not answer. Try again.'}
          </p>
        ) : null}
      </div>

      <div className="oracle-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
