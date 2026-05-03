'use client';
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProposalModal({ onClose, onCreated }: Props) {
  const [kind, setKind] = useState<'decree' | 'whisper' | 'treasury'>('decree');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [durationHours, setDurationHours] = useState(72);
  const [stakeNaka, setStakeNaka] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (title.trim().length < 6) return setError('Title must be at least 6 characters.');
    if (body.trim().length < 30) return setError('Body must be at least 30 characters.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/cult/proposals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, title: title.trim(), body: body.trim(), durationHours, stakeNaka }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed to create');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="vault-portal w-full max-w-xl"
      >
        <header className="flex items-center justify-between">
          <h2 className="vault-portal__name text-[20px]">Author a Proposal</h2>
          <button type="button" onClick={onClose} className="text-[#B4C0E0] hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#B4C0E0] mb-2">Kind</label>
            <div className="flex gap-2">
              {(['decree', 'whisper', 'treasury'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold uppercase tracking-wider transition ${
                    kind === k
                      ? 'border-[#0066FF] bg-[#0066FF]/15 text-white'
                      : 'border-white/10 text-[#B4C0E0] hover:bg-white/[0.04]'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#B4C0E0] mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder='e.g. "Add TON chain to Sniper Bot"'
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-[#0066FF]/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#B4C0E0] mb-2">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={6}
              placeholder="What is the change, and why?"
              className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-[#0066FF]/60 focus:outline-none"
            />
            <div className="mt-1 text-right text-[11px] text-white/40">{body.length}/5000</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#B4C0E0] mb-2">Voting window</label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white focus:border-[#0066FF]/60 focus:outline-none"
              >
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#B4C0E0] mb-2">Stake $NAKA</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={stakeNaka}
                onChange={(e) => setStakeNaka(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white focus:border-[#0066FF]/60 focus:outline-none"
              />
            </div>
          </div>

          {error && <div className="rounded-lg border border-[#FF1744]/40 bg-[#FF1744]/10 px-3 py-2 text-[13px] text-[#FF6E8A]">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl border border-[#0066FF]/40 bg-gradient-to-br from-[#0066FF] to-[#1230B3] px-5 py-3 text-[14px] font-bold text-white shadow-[0_4px_20px_rgba(0,102,255,0.4)] hover:shadow-[0_8px_28px_rgba(0,102,255,0.55)] transition disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Submitting…</span>
            ) : (
              'Submit Proposal'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
