'use client';

import { useEffect, useState, useCallback } from 'react';
import { Gift, Check, Trophy } from 'lucide-react';

interface Offering {
  id: string;
  title: string;
  description: string | null;
  kind: 'raffle' | 'airdrop' | 'reward';
  status: 'open' | 'drawn' | 'closed';
  reward_label: string | null;
  closes_at: string | null;
  created_at: string;
  entries: number;
  entered: boolean;
  won: boolean;
}

export function OfferingPanel() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cult/offering', { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const json = (await res.json()) as { offerings: Offering[] };
      setOfferings(json.offerings);
      setError(null);
    } catch {
      setError('Could not reach the Offering.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const enter = useCallback(async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch('/api/cult/offering', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offeringId: id }),
      });
      if (!res.ok && res.status !== 201) throw new Error('enter');
      await load();
    } catch {
      setError('Could not enter. Try again.');
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (loading) return <p className="py-10 text-center text-sm text-[#8C9AC0]">Reading the Offering…</p>;
  if (offerings.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#070A16]/80 p-10 text-center">
        <Gift className="mx-auto mb-3 text-[#FFD86B]" size={28} />
        <p className="text-sm text-[#8C9AC0]">No offerings open right now. The treasury moves on its own cadence — watch this chamber.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-center text-[12px] text-[#FF9DB0]">{error}</p>}
      {offerings.map((o) => (
        <article key={o.id} className="rounded-2xl border border-white/10 bg-[#070A16]/80 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full border border-[#3D5AFE]/40 bg-[#3D5AFE]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9FB8FF]">
                  {o.kind}
                </span>
                {o.status !== 'open' && (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8C9AC0]">
                    {o.status}
                  </span>
                )}
              </div>
              <h3 className="text-[17px] font-bold text-white">{o.title}</h3>
              {o.reward_label && <p className="mt-0.5 text-[13px] font-semibold text-[#FFD86B]">{o.reward_label}</p>}
              {o.description && <p className="mt-1.5 text-[13px] leading-relaxed text-[#B4C0E0]">{o.description}</p>}
              <p className="mt-2 text-[11px] text-[#6B779C]">{o.entries} {o.entries === 1 ? 'entry' : 'entries'}</p>
            </div>

            <div className="shrink-0">
              {o.won ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFD86B]/45 bg-[#FFD86B]/12 px-4 py-2.5 text-[13px] font-bold text-[#FFD86B]">
                  <Trophy size={15} /> You won
                </span>
              ) : o.entered ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D5AFE]/45 bg-[#3D5AFE]/12 px-4 py-2.5 text-[13px] font-bold text-[#9FB8FF]">
                  <Check size={15} /> Entered
                </span>
              ) : o.status === 'open' ? (
                <button
                  type="button"
                  onClick={() => enter(o.id)}
                  disabled={busy === o.id}
                  className="rounded-xl bg-gradient-to-br from-[#3D5AFE] to-[#E11D48] px-5 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy === o.id ? 'Entering…' : 'Enter'}
                </button>
              ) : (
                <span className="text-[12px] text-[#6B779C]">Closed</span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
