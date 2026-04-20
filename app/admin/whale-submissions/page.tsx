'use client';

/**
 * Bug §2.14: admin review surface for user-submitted whales.
 *
 * Lists whale_submissions rows grouped by status (pending / approved /
 * rejected) with one-click approve + reject. Approve creates a whale row
 * and marks status=approved; reject just flips status.
 *
 * Admin-only — the underlying /api/admin/whale-submissions route rejects
 * anything without ADMIN_MIGRATION_SECRET or profiles.role='admin'.
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, X, ExternalLink, RefreshCw, FileText, Loader2 } from 'lucide-react';

type Status = 'pending' | 'approved' | 'rejected';

interface Submission {
  id: string;
  submitter_id: string | null;
  address: string;
  chain: string;
  proposed_label: string | null;
  proposed_entity_type: string | null;
  reason: string | null;
  evidence_urls: string[] | null;
  status: Status;
  reviewer_id: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
}

interface Counts { pending: number; approved: number; rejected: number }

function explorerFor(address: string, chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'solana' || c === 'sol') return `https://solscan.io/account/${address}`;
  if (c === 'base') return `https://basescan.org/address/${address}`;
  if (c === 'arbitrum' || c === 'arb') return `https://arbiscan.io/address/${address}`;
  if (c === 'optimism' || c === 'op') return `https://optimistic.etherscan.io/address/${address}`;
  if (c === 'polygon' || c === 'matic') return `https://polygonscan.com/address/${address}`;
  if (c === 'bsc' || c === 'bnb') return `https://bscscan.com/address/${address}`;
  return `https://etherscan.io/address/${address}`;
}

export default function WhaleSubmissionsAdminPage() {
  const [status, setStatus] = useState<Status>('pending');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/whale-submissions?status=${status}&limit=100`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSubmissions(data.submissions ?? []);
      setCounts(data.counts ?? { pending: 0, approved: 0, rejected: 0 });
    } catch (err: any) {
      setFlash(`Load failed: ${err?.message ?? 'unknown'}`);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActingId(id);
    setFlash(null);
    try {
      const res = await fetch('/api/admin/whale-submissions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, notes: notesById[id] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setFlash(action === 'approve' ? `Approved — whale added to directory` : 'Rejected');
      await load();
    } catch (err: any) {
      setFlash(`${action} failed: ${err?.message ?? 'unknown'}`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto text-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-[#0A1EFF]" />
        <h1 className="text-2xl font-bold">Whale Submissions</h1>
        <button
          onClick={load}
          className="ml-auto inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {flash && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm">{flash}</div>
      )}

      <div className="flex gap-2 mb-4">
        {(['pending', 'approved', 'rejected'] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              status === s
                ? 'bg-[#0A1EFF] border-[#0A1EFF] text-white'
                : 'bg-transparent border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)} ({counts[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : submissions.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No {status} submissions.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                      {s.chain}
                    </span>
                    {s.proposed_entity_type && (
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#0A1EFF]/20 text-[#6F7EFF]">
                        {s.proposed_entity_type}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-300 break-all">{s.address}</span>
                    <a
                      href={explorerFor(s.address, s.chain)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white"
                      title="Open in block explorer"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {s.proposed_label && (
                    <div className="text-sm text-white mt-1">{s.proposed_label}</div>
                  )}
                  {s.reason && (
                    <div className="text-xs text-slate-400 mt-1 italic">&ldquo;{s.reason}&rdquo;</div>
                  )}
                  {s.evidence_urls && s.evidence_urls.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.evidence_urls.map((u, i) => (
                        <a
                          key={i}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#6F7EFF] hover:underline truncate max-w-[220px]"
                        >
                          {u.replace(/^https?:\/\//, '').slice(0, 40)}{u.length > 50 ? '…' : ''}
                        </a>
                      ))}
                    </div>
                  )}
                  {s.reviewer_notes && (
                    <div className="text-xs text-slate-500 mt-2">
                      <span className="text-slate-400">Notes:</span> {s.reviewer_notes}
                    </div>
                  )}
                </div>
                {status === 'pending' && (
                  <div className="flex flex-col gap-2 shrink-0 w-36">
                    <input
                      type="text"
                      placeholder="Review notes…"
                      value={notesById[s.id] || ''}
                      onChange={(e) => setNotesById((m) => ({ ...m, [s.id]: e.target.value }))}
                      className="text-xs px-2 py-1 rounded-md bg-slate-950 border border-white/10 text-white placeholder-slate-600"
                    />
                    <button
                      onClick={() => act(s.id, 'approve')}
                      disabled={actingId === s.id}
                      className="inline-flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold"
                    >
                      {actingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => act(s.id, 'reject')}
                      disabled={actingId === s.id}
                      className="inline-flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white font-semibold"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
