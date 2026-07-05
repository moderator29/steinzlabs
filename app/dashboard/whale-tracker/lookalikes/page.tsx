'use client';

// Whale Genome — Look-Alike Wallets. Enter any whale address (or arrive with
// ?address=) and see the wallets that behave most like it, scored on real
// metrics (win rate, hold time, trade count, volume, whale score). No fabricated
// similarity — every number comes from the whale_lookalikes RPC over our data.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Dna, Search, BadgeCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import BackButton from '@/components/ui/BackButton';
import { WhaleAvatar } from '@/components/whales/WhaleAvatar';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { whaleLookalikesHowItWorks } from '@/lib/howItWorks/content/whale-lookalikes';

interface Whale {
  address: string; chain: string | null; label: string | null; archetype: string | null; verified: boolean;
  winRate: number | null; whaleScore: number | null; avgHoldHours: number | null;
  trades30d: number; volume7dUsd: number; similarity: number | null;
}
interface Result { found: boolean; target: Whale; lookalikes: Whale[] }

function short(a: string) { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(n: number) { const a = Math.abs(n); if (a >= 1e9) return `$${(a / 1e9).toFixed(1)}B`; if (a >= 1e6) return `$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${(a / 1e3).toFixed(0)}K`; return `$${Math.round(a)}`; }
function fmtHold(h: number | null) { if (h == null || h <= 0) return '—'; return h >= 24 ? `${Math.round(h / 24)}d` : `${Math.round(h)}h`; }

export default function WhaleLookalikesPage() {
  const [input, setInput] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (addr: string) => {
    const a = addr.trim();
    if (!a) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/whale-tracker/lookalikes?address=${encodeURIComponent(a)}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Lookup failed');
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('address');
      if (q) { setInput(q); run(q); }
    } catch { /* ignore */ }
  }, [run]);

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/whale-tracker" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Dna className="w-4 h-4 text-[#00C8FF]" /> Whale Look-Alikes</span>
        <HowItWorksButton content={whaleLookalikesHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Wallets with the same DNA</h1>
        <p className="text-slate-400 text-sm mt-1">Enter a whale and find the wallets that trade just like it — matched on real behavior, not follows.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); run(input); }} className="nl-glass rounded-2xl p-2 flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-slate-500 ms-2 shrink-0" />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Whale address (0x… or Solana)…"
          className="flex-1 bg-transparent px-1 py-2.5 text-sm focus:outline-none placeholder-slate-500" maxLength={80} />
        <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 rounded-xl nl-btn-neon text-sm font-semibold disabled:opacity-40">Match</button>
      </form>

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && data && !data.found && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">
          <span className="font-mono">{short(data.target.address)}</span> isn’t in the tracked whale set yet, so we can’t genome-match it. Try a wallet from the whale directory.
        </div>
      )}

      {!loading && data && data.found && (
        <>
          {/* Target */}
          <div className="nl-card rounded-2xl p-4 mb-3 flex items-center gap-3">
            <WhaleAvatar address={data.target.address} chain={data.target.chain} size={40} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate inline-flex items-center gap-1">
                {data.target.label || short(data.target.address)}
                {data.target.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00C8FF]" />}
              </div>
              <div className="text-[11px] text-slate-500">{data.target.archetype || 'whale'} · {data.target.chain?.toUpperCase() || '—'}</div>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              <div>Win {data.target.winRate != null ? `${data.target.winRate}%` : '—'}</div>
              <div>Hold {fmtHold(data.target.avgHoldHours)}</div>
            </div>
          </div>

          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2 ms-1">Closest behavioral matches</div>
          <div className="space-y-2">
            {data.lookalikes.map((w) => (
              <Link key={`${w.address}-${w.chain}`} href={`/dashboard/whale-tracker/lookalikes?address=${encodeURIComponent(w.address)}`}
                className="nl-card rounded-xl p-3 flex items-center gap-3 hover:border-[#0066FF]/40 transition-colors group">
                <WhaleAvatar address={w.address} chain={w.chain} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate inline-flex items-center gap-1">
                    {w.label || short(w.address)}
                    {w.verified && <BadgeCheck className="w-3 h-3 text-[#00C8FF]" />}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {w.archetype || 'whale'} · Win {w.winRate != null ? `${w.winRate}%` : '—'} · {w.trades30d} trades · {fmtUsd(w.volume7dUsd)} 7d
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#00C8FF]">{w.similarity != null ? `${w.similarity}%` : '—'}</div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">match</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-[#0066FF] transition-colors shrink-0" />
              </Link>
            ))}
            {data.lookalikes.length === 0 && (
              <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No close behavioral matches found in the tracked set.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
