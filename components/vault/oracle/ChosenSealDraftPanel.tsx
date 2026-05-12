'use client';

import { useEffect, useState } from 'react';

interface DraftRow {
  id: string;
  seal_date: string;
  title: string;
  body: string;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded';
  created_at: string;
}

interface DraftResponse {
  targetDate: string;
  isChosen: boolean;
  next: DraftRow | null;
  mine: DraftRow[];
}

/**
 * Chosen-only panel inside the Oracle chamber. Lets a Chosen member author
 * tomorrow's Daily Seal — the cron consumes the most recent pending draft
 * before falling back to Anthropic auto-generation.
 *
 * Renders nothing for non-Chosen members; the parent decides whether to
 * mount it at all, but we double-gate on `isChosen` from the round-trip so
 * a client-side mistake can never reveal the draft surface.
 */
export function ChosenSealDraftPanel() {
  const [state, setState] = useState<DraftResponse | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmittedId, setJustSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/oracle/daily-seal/draft', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DraftResponse | null) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [justSubmittedId]);

  if (!state || !state.isChosen) return null;

  const titleRemaining = 140 - title.trim().length;
  const bodyLen = body.trim().length;
  const bodyOk = bodyLen >= 60 && bodyLen <= 4000;
  const titleOk = title.trim().length >= 6 && title.trim().length <= 140;
  const canSubmit = titleOk && bodyOk && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cult/oracle/daily-seal/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { draft?: DraftRow; error?: string } | null;
      if (!res.ok || !json?.draft) {
        setError(json?.error ?? 'submit_failed');
        return;
      }
      setJustSubmittedId(json.draft.id);
      setTitle('');
      setBody('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      className="oracle-subchamber oracle-subchamber--chosen"
      aria-label="Chosen — author tomorrow's Daily Seal"
      style={{ outline: '1px solid rgba(255,216,107,0.55)', outlineOffset: '-1px' }}
    >
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#FFD86B]">Chosen path</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">
          Seal for {state.targetDate}
        </span>
      </header>
      <h3 className="oracle-subchamber__title">Author the next seal</h3>
      <p className="oracle-subchamber__tagline">
        Your words replace the Oracle&apos;s for one dawn. The cult reads what you write.
      </p>

      {state.next ? (
        <div
          className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
          style={{ borderColor: 'rgba(255,216,107,0.25)' }}
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#FFD86B]">
            Pending draft for tomorrow
          </p>
          <p className="mt-1 text-[13px] text-white font-medium">{state.next.title}</p>
          <p className="mt-1 text-[12px] text-[#B4C0E0] line-clamp-2">{state.next.body}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0]">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Six to one-forty characters"
            className="mt-1 w-full rounded-md border border-white/10 bg-[#0b1022] px-3 py-2 text-[13px] text-white outline-none focus:border-[#FFD86B]/60"
          />
          <span className="mt-1 block text-right text-[10px] text-[#7F8AA8]">
            {titleRemaining} left
          </span>
        </label>

        <label className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0]">
          Body
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            placeholder="Sixty to four-thousand characters"
            rows={6}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#0b1022] px-3 py-2 text-[13px] text-[#E6ECFF] outline-none focus:border-[#FFD86B]/60"
          />
          <span className="mt-1 block text-right text-[10px] text-[#7F8AA8]">{bodyLen} / 4000</span>
        </label>

        {error ? (
          <p className="text-[11px] text-[#FF1744]" role="alert">
            {error === 'chosen_only'
              ? 'Only the Chosen may author the seal.'
              : error === 'title_length' || error === 'body_length'
                ? 'Length out of range. Re-check both fields.'
                : error === 'seal_date_must_be_future'
                  ? 'Tomorrow has already been sealed.'
                  : 'Submission failed. Try again.'}
          </p>
        ) : null}

        {justSubmittedId ? (
          <p className="text-[11px] text-[#FFD86B]" role="status">
            Draft accepted into the queue. The cron will seal it at dawn.
          </p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="nl-button mt-1 inline-flex items-center justify-center px-4 py-2 text-[12px] uppercase tracking-[0.18em] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sealing…' : 'Submit draft'}
        </button>
      </div>

      <div className="oracle-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
