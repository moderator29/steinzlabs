'use client';
import { useCallback, useEffect, useState } from 'react';
import { ProposalCard, type Proposal } from './ProposalCard';
import { Loader2, Plus } from 'lucide-react';
import { CreateProposalModal } from './CreateProposalModal';

export function ConclaveClient() {
  const [tab, setTab] = useState<'active' | 'passed' | 'failed' | 'all'>('active');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cult/proposals?status=${tab}`, { cache: 'no-store' });
      const j = await res.json();
      setProposals(j.proposals ?? []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // Light polling every 10s while the tab is visible — Supabase Realtime
  // wiring is the next pass; polling keeps the bar fresh meanwhile.
  useEffect(() => {
    const onVis = () => { if (!document.hidden) load(); };
    const id = setInterval(() => { if (!document.hidden) load(); }, 10_000);
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  const TABS: { id: typeof tab; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'passed', label: 'Passed' },
    { id: 'failed', label: 'Failed' },
    { id: 'all',    label: 'All' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition ${
                tab === t.id ? 'bg-white/[0.08] text-white' : 'text-[#B4C0E0] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl border border-[#0066FF]/40 bg-gradient-to-br from-[#0066FF] to-[#1230B3] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_20px_rgba(0,102,255,0.4)] hover:shadow-[0_8px_28px_rgba(0,102,255,0.55)] transition"
        >
          <Plus size={14} /> Author a Decree
        </button>
      </header>

      {loading && proposals.length === 0 && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-[#0066FF]" size={36} />
        </div>
      )}

      {!loading && proposals.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <div className="text-4xl opacity-30 mb-3">⚖</div>
          <h3 className="cinematic-heading text-lg mb-1">The Conclave is silent</h3>
          <p className="text-[14px] text-[#B4C0E0]">No proposals in this view yet. Author the first Decree.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} onVoted={load} />
        ))}
      </div>

      {showCreate && (
        <CreateProposalModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}
