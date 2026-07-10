'use client';

// Whale DNA — a wallet's behavioral fingerprint (archetype, win rate, hold,
// score, top tokens) plus "wallets that trade like this one" — nearest
// neighbours in the curated whale directory by behaviour + token overlap.
// Find one alpha wallet and it surfaces its whole cohort. Real data only.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Dna, Target, Trophy, Clock, Layers, ArrowRight, BadgeCheck } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { whaleDisplayName } from '@/lib/whales/naming';
import { whaleDnaHowItWorks } from '@/lib/howItWorks/content/whale-dna';

interface SimilarWhale {
  address: string; label: string | null; nakaNumber: number | null; chain: string; archetype: string | null;
  winRate: number | null; whaleScore: number | null; verified: boolean; logoUrl: string | null;
  similarity: number; sharedTokens: string[];
}
interface Genome {
  address: string; label: string | null; nakaNumber: number | null; chain: string; entityType: string | null;
  archetype: string | null; verified: boolean; logoUrl: string | null;
  winRate: number | null; whaleScore: number | null; pnl30dUsd: number | null;
  portfolioUsd: number | null; volume7dUsd: number | null; trades30d: number | null;
  avgHoldHours: number | null; topTokens: string[];
}
interface DnaResult { found: boolean; whale?: Genome; similar?: SimilarWhale[]; address?: string }
interface PickWhale { address: string; name: string; winRate: number | null }

function short(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(n: number | null): string {
  if (n == null) return '—';
  const s = n < 0 ? '-' : ''; const abs = Math.abs(n);
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(abs)}`;
}
function fmtHold(h: number | null): string {
  if (h == null || h <= 0) return '—';
  return h >= 24 ? `${Math.round(h / 24)}d` : `${Math.round(h)}h`;
}

function Stat({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white/[0.03] rounded-xl p-3 text-center">
      <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1 inline-flex items-center gap-1 justify-center">{icon}{label}</div>
      <div className={`text-sm font-bold ${accent ? 'text-[#00C8FF]' : 'text-white'}`}>{value}</div>
    </div>
  );
}

export default function WhaleDnaPage() {
  const [input, setInput] = useState('');
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<DnaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<PickWhale[]>([]);

  const run = useCallback(async (addr: string) => {
    const a = addr.trim();
    if (!a) return;
    setLoading(true); setError(null); setResult(null); setAddress(a);
    try {
      const res = await fetch(`/api/whale-tracker/dna?address=${encodeURIComponent(a)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'DNA lookup failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('address');
      if (q && q.trim()) { setInput(q); run(q); }
    } catch { /* ignore */ }
    fetch('/api/smart-money', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { wallets: [] }))
      .then((d: { wallets?: Array<{ address: string; name: string; winRate: number | null }> }) => {
        setPicks((d.wallets ?? []).slice(0, 10).map((w) => ({ address: w.address, name: w.name, winRate: w.winRate })));
      })
      .catch(() => { /* optional */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const w = result?.whale;

  return (
    <div className="min-h-screen text-white max-w-4xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/whale-tracker" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Dna className="w-4 h-4 text-[#00C8FF]" /> Whale DNA</span>
        <HowItWorksButton content={whaleDnaHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-5">
        <h1 className="text-2xl font-bold">Decode a wallet to find its whole cohort</h1>
        <p className="text-slate-400 text-sm mt-1">A wallet’s behavioral fingerprint, plus the wallets that trade just like it.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); run(input); }} className="nl-glass rounded-2xl p-2 flex items-center gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a wallet address…"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none placeholder-slate-500"
          maxLength={120}
        />
        <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 rounded-xl nl-btn-neon text-sm font-semibold disabled:opacity-40">Decode</button>
      </form>

      {picks.length > 0 && !result && !loading && (
        <div className="flex flex-wrap gap-1.5 justify-center mb-6">
          {picks.slice(0, 8).map((p) => (
            <button key={p.address} onClick={() => { setInput(p.address); run(p.address); }}
              className="px-2.5 py-1 rounded-full text-[11px] text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:border-[#0066FF]/40 hover:text-white transition-colors">
              {p.name}{p.winRate != null ? ` · ${p.winRate}%` : ''}
            </button>
          ))}
        </div>
      )}

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && result && result.found === false && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">
          <span className="font-mono">{short(address)}</span> isn’t in the tracked whale directory yet, so there’s no DNA to decode.{' '}
          <Link href="/dashboard/whale-tracker/directory" className="text-[#00C8FF] hover:underline">Browse tracked whales</Link>.
        </div>
      )}

      {!loading && w && (
        <>
          {/* Genome card */}
          <div className="nl-card rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <ChainLogo chain={w.chain} className="w-6 h-6" />
              <div className="min-w-0">
                <div className="text-base font-bold truncate inline-flex items-center gap-1.5">
                  {whaleDisplayName({ label: w.label, nakaNumber: w.nakaNumber, address: w.address, chain: w.chain })}
                  {w.verified && <BadgeCheck className="w-4 h-4 text-[#00C8FF]" />}
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{short(w.address)}</div>
              </div>
              {w.archetype && <span className="ms-auto text-[11px] px-2.5 py-1 rounded-full bg-[#0066FF]/10 border border-[#0066FF]/30 text-[#00C8FF]">{w.archetype}</span>}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <Stat icon={<Target className="w-3 h-3" />} label="Win rate" value={w.winRate == null ? '—' : `${w.winRate}%`} accent />
              <Stat icon={<Trophy className="w-3 h-3" />} label="Score" value={w.whaleScore == null ? '—' : String(w.whaleScore)} />
              <Stat label="PnL 30d" value={fmtUsd(w.pnl30dUsd)} />
              <Stat label="Volume 7d" value={fmtUsd(w.volume7dUsd)} />
              <Stat label="Trades" value={w.trades30d == null ? '—' : w.trades30d.toLocaleString()} />
              <Stat icon={<Clock className="w-3 h-3" />} label="Avg hold" value={fmtHold(w.avgHoldHours)} />
            </div>
            {w.topTokens.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Signature tokens</div>
                <div className="flex flex-wrap gap-1">
                  {w.topTokens.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300">{t}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* Similar wallets */}
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-[#00C8FF]" />
            <span className="text-sm font-semibold">Trades like this wallet</span>
            <span className="text-[11px] text-slate-500">nearest behavioral neighbours</span>
          </div>
          {(result.similar ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No close behavioral matches found in the tracked directory.</p>
          ) : (
            <div className="grid gap-2">
              {(result.similar ?? []).map((s) => (
                <Link key={s.address} href={`/dashboard/whale-tracker/dna?address=${s.address}`}
                  className="nl-glass rounded-xl p-3 flex items-center gap-3 hover:border-[#0066FF]/40 transition-colors group">
                  <div className="relative shrink-0">
                    <ChainLogo chain={s.chain} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate inline-flex items-center gap-1">
                      {whaleDisplayName({ label: s.label, nakaNumber: s.nakaNumber, address: s.address, chain: s.chain })}
                      {s.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00C8FF]" />}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      {s.archetype && <span>{s.archetype}</span>}
                      {s.winRate != null && <span>· {s.winRate}% win</span>}
                      {s.sharedTokens.length > 0 && <span className="text-[#00C8FF]">· shares {s.sharedTokens.slice(0, 3).join(', ')}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#00C8FF]">{s.similarity}%</div>
                    <div className="text-[9px] text-slate-500 uppercase">match</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-[#00C8FF] transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
