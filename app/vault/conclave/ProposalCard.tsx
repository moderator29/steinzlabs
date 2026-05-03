'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus, Loader2 } from 'lucide-react';

export interface Proposal {
  id: string;
  kind: 'decree' | 'whisper' | 'treasury';
  title: string;
  body: string;
  status: 'active' | 'passed' | 'failed' | 'executed' | 'cancelled';
  yes_weight: string | number;
  no_weight: string | number;
  abstain_weight: string | number;
  voter_count: number;
  ends_at: string;
}

const KIND_LABEL: Record<Proposal['kind'], string> = {
  decree: 'DECREE',
  whisper: 'WHISPER',
  treasury: 'TREASURY',
};

function timeRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return `${h}h ${m}m left`;
}

export function ProposalCard({ proposal, onVoted }: { proposal: Proposal; onVoted?: () => void }) {
  const [busy, setBusy] = useState<'yes' | 'no' | 'abstain' | null>(null);
  const yes = Number(proposal.yes_weight);
  const no = Number(proposal.no_weight);
  const abstain = Number(proposal.abstain_weight);
  const total = yes + no + abstain;
  const pctYes = total > 0 ? (yes / total) * 100 : 0;
  const pctNo  = total > 0 ? (no  / total) * 100 : 0;
  const isActive = proposal.status === 'active';
  const remaining = timeRemaining(proposal.ends_at);
  const closingSoon = isActive && new Date(proposal.ends_at).getTime() - Date.now() < 60 * 60 * 1000;

  const cast = async (choice: 'yes' | 'no' | 'abstain') => {
    if (!isActive || busy) return;
    setBusy(choice);
    try {
      const res = await fetch(`/api/cult/proposals/${proposal.id}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'vote failed');
      }
      onVoted?.();
    } catch {
      // Swallow — UI surfaces vote count refresh; toast can be added later.
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`vault-portal ${closingSoon ? 'vault-portal--urgent' : ''}`}
    >
      <header className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00C8FF]">
          ⚡ {KIND_LABEL[proposal.kind]}
        </span>
        <span className={`text-[12px] font-semibold ${closingSoon ? 'text-[#FF1744]' : 'text-[#B4C0E0]'}`}>
          {remaining}
        </span>
      </header>

      <div>
        <h3 className="vault-portal__name text-[18px] mb-2">{proposal.title}</h3>
        <p className="text-[14px] leading-relaxed text-[#D5DEFF] line-clamp-3">{proposal.body}</p>
      </div>

      <div className="space-y-2">
        <div className="vault-vote-bar" role="img"
             aria-label={`Yes ${pctYes.toFixed(0)}%, No ${pctNo.toFixed(0)}%`}>
          <span className="vault-vote-bar__yes" style={{ width: `${pctYes}%` }} />
          <span className="vault-vote-bar__no"  style={{ width: `${pctNo}%`  }} />
        </div>
        <div className="flex items-center justify-between text-[12px] font-semibold">
          <span className="text-[#10B981]">✓ {yes.toLocaleString()} yes</span>
          <span className="text-[#B4C0E0]">{proposal.voter_count} voters</span>
          <span className="text-[#FF1744]">✗ {no.toLocaleString()} no</span>
        </div>
      </div>

      {isActive && (
        <div className="grid grid-cols-3 gap-2 pt-2">
          <VoteButton onClick={() => cast('yes')} busy={busy === 'yes'} variant="yes">
            <Check size={14} /> Yes
          </VoteButton>
          <VoteButton onClick={() => cast('abstain')} busy={busy === 'abstain'} variant="abstain">
            <Minus size={14} /> Abstain
          </VoteButton>
          <VoteButton onClick={() => cast('no')} busy={busy === 'no'} variant="no">
            <X size={14} /> No
          </VoteButton>
        </div>
      )}
      {!isActive && (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-wider text-[#B4C0E0]">
          {proposal.status}
        </div>
      )}
    </motion.article>
  );
}

function VoteButton({ children, onClick, busy, variant }: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  variant: 'yes' | 'no' | 'abstain';
}) {
  const cls =
    variant === 'yes'
      ? 'border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/10'
      : variant === 'no'
      ? 'border-[#FF1744]/40 text-[#FF6E8A] hover:bg-[#FF1744]/10'
      : 'border-white/10 text-[#B4C0E0] hover:bg-white/[0.04]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition disabled:opacity-50 ${cls}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}
