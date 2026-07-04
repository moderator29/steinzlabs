'use client';

// MEV Radar — how much wallets are bleeding to MEV (sandwich attacks +
// frontrunning) over 30 days. A leaderboard of the biggest victims plus a
// per-wallet lookup. Real data from dune_mev_loss_aggregate. No retail platform
// shows per-wallet MEV loss — this makes an invisible tax visible.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Swords, Search, BadgeCheck, Crosshair, Sandwich } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { mevRadarHowItWorks } from '@/lib/howItWorks/content/mev-radar';

interface Victim {
  address: string; chain: string; lossUsd: number; sandwichCount: number; frontrunCount: number;
  label: string | null; archetype: string | null; verified: boolean;
}
interface BoardResult { mode: 'board'; chain: string; totalTrackedLoss: number; victims: Victim[]; generatedAt: string }
interface LookupResult { mode: 'lookup'; address: string; found: boolean; totalLoss?: number; totalSandwich?: number; totalFrontrun?: number; breakdown?: Victim[] }

function short(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${Math.round(abs)}`;
}

export default function MevRadarPage() {
  const [input, setInput] = useState('');
  const [board, setBoard] = useState<BoardResult | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true); setError(null); setLookup(null);
    try {
      const res = await fetch('/api/token-intel/mev-radar', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Radar unavailable');
      setBoard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  const doLookup = useCallback(async (addr: string) => {
    const a = addr.trim();
    if (!a) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/token-intel/mev-radar?address=${encodeURIComponent(a)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      setLookup(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Swords className="w-4 h-4 text-[#00C8FF]" /> MEV Radar</span>
        <HowItWorksButton content={mevRadarHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">The invisible tax on your trades</h1>
        <p className="text-slate-400 text-sm mt-1">How much wallets are bleeding to sandwich attacks and frontrunning — over 30 days.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); doLookup(input); }} className="nl-glass rounded-2xl p-2 flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-slate-500 ms-2 shrink-0" />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Check a wallet's MEV toll…"
          className="flex-1 bg-transparent px-1 py-2.5 text-sm focus:outline-none placeholder-slate-500" maxLength={80} />
        <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 rounded-xl nl-btn-neon text-sm font-semibold disabled:opacity-40">Check</button>
        {lookup && <button type="button" onClick={loadBoard} className="px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white">Board</button>}
      </form>

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {/* Lookup result */}
      {!loading && lookup && lookup.found === false && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">
          <span className="font-mono">{short(lookup.address)}</span> isn’t in the MEV dataset — either it hasn’t been indexed or it hasn’t been hit by measurable MEV in the last 30 days.
        </div>
      )}
      {!loading && lookup && lookup.found && (
        <div className="nl-card rounded-2xl p-5 mb-4 text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Lost to MEV · 30d · {short(lookup.address)}</div>
          <div className="text-3xl font-black text-[#FF1744]">{fmtUsd(lookup.totalLoss ?? 0)}</div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><Sandwich className="w-3.5 h-3.5" />{lookup.totalSandwich} sandwiches</span>
            <span className="inline-flex items-center gap-1"><Crosshair className="w-3.5 h-3.5" />{lookup.totalFrontrun} frontruns</span>
          </div>
        </div>
      )}

      {/* Board */}
      {!loading && board && !lookup && (
        <>
          <div className="nl-glass rounded-xl p-3 mb-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">Total tracked MEV loss (top 50)</span>
            <span className="text-sm font-bold text-[#FF1744]">{fmtUsd(board.totalTrackedLoss)}</span>
          </div>
          <div className="space-y-2">
            {board.victims.map((v, i) => (
              <div key={`${v.address}-${v.chain}`} className="nl-card rounded-xl p-3 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 w-5 text-center shrink-0">{i + 1}</span>
                <ChainLogo chain={v.chain} className="w-5 h-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate inline-flex items-center gap-1">
                    {v.label || short(v.address)}
                    {v.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00C8FF]" />}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-2">
                    <span className="inline-flex items-center gap-0.5"><Sandwich className="w-3 h-3" />{v.sandwichCount}</span>
                    <span className="inline-flex items-center gap-0.5"><Crosshair className="w-3 h-3" />{v.frontrunCount}</span>
                    {v.archetype && <span>· {v.archetype}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#FF1744]">{fmtUsd(v.lossUsd)}</div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">lost 30d</div>
                </div>
              </div>
            ))}
          </div>
          {board.victims.length > 0 && (
            <p className="text-[10px] text-slate-600 text-center mt-4">Dune MEV loss aggregate · updated {new Date(board.generatedAt).toLocaleTimeString()}</p>
          )}
        </>
      )}
    </div>
  );
}
