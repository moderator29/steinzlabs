'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Vote = {
  choice: 'yes' | 'no' | 'abstain';
  weight: number;
  is_chosen: boolean;
  created_at: string;
};

const COLOR: Record<Vote['choice'], { fill: string; glow: string }> = {
  yes:     { fill: '#10B981', glow: 'rgba(16,185,129,0.55)' },
  no:      { fill: '#FF1744', glow: 'rgba(255,23,68,0.55)' },
  abstain: { fill: '#B4C0E0', glow: 'rgba(180,192,224,0.45)' },
};

// Sqrt-scaled diameter so a whale's vote doesn't visually bury everyone else.
// Min 8px so a single weight-1 cultist still reads; max 28px caps the bar.
function orbSize(weight: number): number {
  const w = Math.max(0, weight);
  return Math.min(28, Math.max(8, Math.round(8 + Math.sqrt(w) * 4)));
}

export function VoteOrbs({ proposalId }: { proposalId: string }) {
  const [votes, setVotes] = useState<Vote[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/cult/proposals/${proposalId}/votes`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setVotes((j.votes ?? []) as Vote[]);
      } catch {
        /* swallow — empty state renders */
      }
    };
    load();

    // Realtime: refresh this proposal's orbs the instant a vote lands.
    const channel = supabase
      .channel(`cult-orbs-${proposalId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'cult_proposal_votes', filter: `proposal_id=eq.${proposalId}` },
          load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [proposalId]);

  if (!votes || votes.length === 0) {
    return (
      <div className="vault-vote-orbs vault-vote-orbs--empty" role="img" aria-label="No votes yet">
        <span className="text-[11px] text-[#B4C0E0]/60">No votes cast yet</span>
      </div>
    );
  }

  // Sorted: yes left, abstain center, no right — reads at a glance.
  const ordered = [
    ...votes.filter(v => v.choice === 'yes'),
    ...votes.filter(v => v.choice === 'abstain'),
    ...votes.filter(v => v.choice === 'no'),
  ];

  return (
    <div
      className="vault-vote-orbs"
      role="img"
      aria-label={`${votes.length} votes cast`}
    >
      {ordered.map((v, i) => {
        const size = orbSize(v.weight);
        const c = COLOR[v.choice];
        return (
          <span
            key={`${v.choice}-${v.created_at}-${i}`}
            className="vault-vote-orb"
            title={`${v.choice} · weight ${v.weight}${v.is_chosen ? ' · Chosen' : ''}`}
            style={{
              width: size,
              height: size,
              background: `radial-gradient(circle at 30% 30%, ${c.fill}, ${c.fill}99 60%, ${c.fill}33 100%)`,
              boxShadow: `0 0 ${Math.max(8, size * 0.6)}px ${c.glow}${v.is_chosen ? ', 0 0 0 1.5px #FFD700' : ''}`,
            }}
          />
        );
      })}
    </div>
  );
}
