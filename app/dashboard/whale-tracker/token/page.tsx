'use client';

// Token Whale Lens — paste a token (symbol or address) and see which tracked
// whales are in it, their net position, and when they entered. The natural
// drill-down from Smart Money Flows and the Convergence Radar. Real data from
// whale_activity + whale reputation.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, TrendingUp, TrendingDown, Users, BadgeCheck } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { tokenLensHowItWorks } from '@/lib/howItWorks/content/token-lens';

interface Position {
  address: string; label: string | null; archetype: string | null;
  winRate: number | null; whaleScore: number | null; chain: string | null; verified: boolean;
  buyUsd: number; sellUsd: number; netUsd: number; txs: number;
  firstSeen: string; lastSeen: string; side: 'accumulating' | 'distributing';
}
interface Summary { whales: number; totalBuy: number; totalSell: number; net: number; accumulating: number; distributing: number }
interface LensResult { query: string; window: string; found: boolean; summary: Summary | null; positions: Position[] }

function short(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(n: number): string {
  const s = n < 0 ? '-' : ''; const abs = Math.abs(n);
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(abs)}`;
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return '—'; }
}

const WINDOWS = ['24h', '7d', '30d'];

export default function TokenLensPage() {
  const [input, setInput] = useState('');
  const [win, setWin] = useState('7d');
  const [result, setResult] = useState<LensResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (q: string, window: string) => {
    const query = q.trim();
    if (!query) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/whale-tracker/token?q=${encodeURIComponent(query)}&window=${window}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lens unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q && q.trim()) { setInput(q); run(q, win); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run on window change if we already have a query.
  useEffect(() => {
    if (result?.query) run(result.query, win);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win]);

  const s = result?.summary;

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/whale-tracker" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Search className="w-4 h-4 text-[#00C8FF]" /> Token Whale Lens</span>
        <HowItWorksButton content={tokenLensHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Is smart money in this token?</h1>
        <p className="text-slate-400 text-sm mt-1">Paste a token — see which tracked whales hold it, their net position, and when they entered.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); run(input, win); }} className="nl-glass rounded-2xl p-2 flex items-center gap-2 mb-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Token symbol or contract address… (e.g. AAVE)"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none placeholder-slate-500" maxLength={120} />
        <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 rounded-xl nl-btn-neon text-sm font-semibold disabled:opacity-40">Scan</button>
      </form>

      {result?.found && (
        <div className="flex gap-1 nl-glass rounded-lg p-1 w-fit mx-auto mb-4">
          {WINDOWS.map((w) => (
            <button key={w} onClick={() => setWin(w)} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${win === w ? 'bg-[#0066FF] text-white' : 'text-slate-400 hover:text-white'}`}>{w}</button>
          ))}
        </div>
      )}

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && result && !result.found && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No tracked whales traded <span className="font-mono">{result.query}</span> in this window. Try a longer window or a different token.</div>
      )}

      {!loading && s && (
        <>
          {/* Summary */}
          <div className="nl-card rounded-2xl p-4 mb-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1 inline-flex items-center gap-1 justify-center"><Users className="w-3 h-3" />Whales</div>
              <div className="text-lg font-bold">{s.whales}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Net flow</div>
              <div className={`text-lg font-bold ${s.net >= 0 ? 'text-[#10B981]' : 'text-[#FF1744]'}`}>{fmtUsd(s.net)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Acc / Dist</div>
              <div className="text-lg font-bold"><span className="text-[#10B981]">{s.accumulating}</span> <span className="text-slate-600">/</span> <span className="text-[#FF1744]">{s.distributing}</span></div>
            </div>
          </div>

          {/* Positions */}
          <div className="space-y-2">
            {result!.positions.map((p) => {
              const acc = p.side === 'accumulating';
              return (
                <div key={p.address} className="nl-glass rounded-xl p-3 flex items-center gap-3">
                  {p.chain && <ChainLogo chain={p.chain} className="w-5 h-5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate inline-flex items-center gap-1">
                      {p.label || short(p.address)}
                      {p.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00C8FF]" />}
                    </div>
                    <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-2">
                      {p.archetype && <span>{p.archetype}</span>}
                      {p.winRate != null && <span>· {p.winRate}% win</span>}
                      <span>· entered {fmtDate(p.firstSeen)}</span>
                      <span>· {p.txs} txs</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold inline-flex items-center gap-1 ${acc ? 'text-[#10B981]' : 'text-[#FF1744]'}`}>
                      {acc ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {fmtUsd(p.netUsd)}
                    </div>
                    <div className="text-[9px] text-slate-500">{fmtUsd(p.buyUsd)} in · {fmtUsd(p.sellUsd)} out</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
