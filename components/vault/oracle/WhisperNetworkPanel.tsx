'use client';

import { useEffect, useState } from 'react';

interface Whisper {
  id: string;
  body: string;
  status: 'pending' | 'echoed' | 'silenced';
  echo_count: number;
  silence_count: number;
  created_at: string;
  resolved_at: string | null;
}

interface MyVote {
  whisper_id: string;
  vote: 'echo' | 'silence';
}

interface WhispersResponse {
  pending: Whisper[];
  resolved: Whisper[];
  myVotes: MyVote[];
}

const ECHO_REQUIRED = 5;
const SILENCE_REQUIRED = 3;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Whisper Network — anonymous intel surfaced by the cult.
 *
 * Any cult member can post a whisper (server stores the author for moderation
 * but never returns it). Members vote echo or silence; thresholds at 5 / 3
 * promote or kill. Self-vote is blocked server-side; double-vote is blocked
 * by the unique PK on (whisper_id, voter_id).
 */
export function WhisperNetworkPanel() {
  const [state, setState] = useState<WhispersResponse | null>(null);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/cult/oracle/whispers', { credentials: 'include' });
    if (!res.ok) {
      setState(null);
      return;
    }
    setState((await res.json()) as WhispersResponse);
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/oracle/whispers', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: WhispersResponse | null) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  const myVoteMap = new Map(state.myVotes.map((v) => [v.whisper_id, v.vote]));

  async function submit() {
    if (body.trim().length < 12) {
      setError('body_length');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cult/oracle/whispers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'submit_failed');
        return;
      }
      setBody('');
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(whisperId: string, choice: 'echo' | 'silence') {
    setVoting(whisperId);
    setError(null);
    try {
      const res = await fetch(`/api/cult/oracle/whispers/${whisperId}/vote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vote: choice }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'vote_failed');
        return;
      }
      await refresh();
    } finally {
      setVoting(null);
    }
  }

  const bodyLen = body.trim().length;
  const canSubmit = bodyLen >= 12 && bodyLen <= 1200 && !submitting;

  return (
    <article
      className="oracle-subchamber oracle-subchamber--whisper"
      aria-label="Whisper Network — anonymous intel"
    >
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">Whisper Network</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0]">
          {state.pending.length} live · {ECHO_REQUIRED} to echo · {SILENCE_REQUIRED} to silence
        </span>
      </header>
      <h3 className="oracle-subchamber__title">Anonymous intel</h3>
      <p className="oracle-subchamber__tagline">
        Surface a signal. The cult decides if it carries forward or fades.
      </p>

      <div className="mt-4 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0]">
          New whisper
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1200}
          rows={3}
          placeholder="Twelve characters or more. You stay anonymous to the cult."
          className="rounded-md border border-white/10 bg-[#0b1022] px-3 py-2 text-[12px] text-[#E6ECFF] outline-none focus:border-[#00C8FF]/60"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#7F8AA8]">{bodyLen} / 1200</span>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="nl-button inline-flex items-center justify-center px-4 py-2 text-[11px] uppercase tracking-[0.18em] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : 'Whisper'}
          </button>
        </div>
        {error ? (
          <p className="text-[11px] text-[#FF1744]" role="alert">
            {error === 'body_length'
              ? 'Twelve to twelve-hundred characters.'
              : error === 'self_vote_forbidden'
                ? 'You cannot vote on your own whisper.'
                : error === 'already_voted'
                  ? 'You already voted on this whisper.'
                  : error === 'whisper_resolved'
                    ? 'This whisper has already been resolved.'
                    : 'Action failed. Try again.'}
          </p>
        ) : null}
      </div>

      {state.pending.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {state.pending.map((w) => {
            const mine = myVoteMap.get(w.id);
            return (
              <li
                key={w.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-[13px] text-[#E6ECFF] whitespace-pre-wrap">{w.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[#7F8AA8]">
                    {timeAgo(w.created_at)} · {w.echo_count}/{ECHO_REQUIRED} echo ·{' '}
                    {w.silence_count}/{SILENCE_REQUIRED} silence
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => vote(w.id, 'echo')}
                      disabled={voting === w.id || !!mine}
                      className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.18em] disabled:opacity-50 ${
                        mine === 'echo'
                          ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/10'
                          : 'border-white/10 text-[#10B981] hover:bg-[#10B981]/10'
                      }`}
                    >
                      Echo
                    </button>
                    <button
                      type="button"
                      onClick={() => vote(w.id, 'silence')}
                      disabled={voting === w.id || !!mine}
                      className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.18em] disabled:opacity-50 ${
                        mine === 'silence'
                          ? 'border-[#FF1744] text-[#FF1744] bg-[#FF1744]/10'
                          : 'border-white/10 text-[#FF1744] hover:bg-[#FF1744]/10'
                      }`}
                    >
                      Silence
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-[12px] text-[#7F8AA8]">No live whispers. Send the first.</p>
      )}

      {state.resolved.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-[#7F8AA8]">
            Recently resolved ({state.resolved.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {state.resolved.map((w) => (
              <li
                key={w.id}
                className={`rounded-md border px-3 py-2 ${
                  w.status === 'echoed'
                    ? 'border-[#10B981]/30 bg-[#10B981]/[0.04]'
                    : 'border-[#FF1744]/20 bg-[#FF1744]/[0.03] opacity-70'
                }`}
              >
                <p className="text-[12px] text-[#D5DEFF] line-clamp-2">{w.body}</p>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-[#7F8AA8]">
                  {w.status} · {w.echo_count} echo · {w.silence_count} silence ·{' '}
                  {w.resolved_at ? timeAgo(w.resolved_at) : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="oracle-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
