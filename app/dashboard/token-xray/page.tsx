'use client';

// Token X-Ray — one screen that fuses every smart-money signal for a token:
// convergence, tracked-whale positions, Dune smart-money flow, wash-trade
// authenticity, and buyer wallet-age — then a plain verdict. The capstone that
// ties the whole intelligence suite together. Real data only.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ScanSearch, Radar, Fish, Waves, ShieldCheck, Sprout, CheckCircle2, AlertTriangle, BadgeCheck } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { tokenXrayHowItWorks } from '@/lib/howItWorks/content/token-xray';

type Verdict = 'strong' | 'mixed' | 'caution' | 'thin';
interface TopWhale { address: string; label: string | null; archetype: string | null; winRate: number | null; netUsd: number; firstSeen: string }
interface XrayResult {
  query: string; found: boolean;
  token?: { address: string; chain: string; symbol: string | null };
  verdict?: Verdict; positives?: string[]; negatives?: string[];
  signals?: {
    convergence: { walletCount: number; totalValueUsd: number | null; active: boolean; detectedAt: string } | null;
    whales: { count: number; netUsd: number; top: TopWhale[] };
    duneFlow: { netInflowUsd: number | null; uniqueWallets: number | null } | null;
    wash: { score: number | null; grade: string; flaggedPairs: number | null } | null;
    buyerAge: { freshPct: number | null; seasonedPct: number | null; totalBuyers: number | null } | null;
  };
  generatedAt?: string;
}

function short(a: string): string { return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function fmtUsd(n: number | null): string {
  if (n == null) return '—';
  const s = n < 0 ? '-' : ''; const abs = Math.abs(n);
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(abs)}`;
}

const VERDICT_META: Record<Verdict, { label: string; color: string }> = {
  strong: { label: 'Strong smart-money signal', color: '#10B981' },
  mixed: { label: 'Mixed signals', color: '#FFD86B' },
  caution: { label: 'Caution — red flags present', color: '#FF1744' },
  thin: { label: 'Thin coverage — little data', color: '#64748b' },
};

function Panel({ icon, title, children, href }: { icon: React.ReactNode; title: string; children: React.ReactNode; href?: string }) {
  const inner = (
    <div className="nl-card rounded-2xl p-4 h-full">
      <div className="flex items-center gap-2 mb-2 text-slate-300">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{title}</span></div>
      {children}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link> : inner;
}

export default function TokenXrayPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<XrayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/token-intel/xray?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'X-Ray unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q && q.trim()) { setInput(q); run(q); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sig = result?.signals;
  const v = result?.verdict ? VERDICT_META[result.verdict] : null;

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><ScanSearch className="w-4 h-4 text-[#00C8FF]" /> Token X-Ray</span>
        <HowItWorksButton content={tokenXrayHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Every smart-money signal, one screen</h1>
        <p className="text-slate-400 text-sm mt-1">Paste a token — convergence, whales, flow, wash-trade, buyer age, and a plain verdict.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); run(input); }} className="nl-glass rounded-2xl p-2 flex items-center gap-2 mb-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Token symbol or contract address…"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none placeholder-slate-500" maxLength={120} />
        <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 rounded-xl nl-btn-neon text-sm font-semibold disabled:opacity-40">X-Ray</button>
      </form>

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && result && !result.found && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No on-chain coverage for <span className="font-mono">{result.query}</span> yet. Try a contract address, or a token tracked whales have traded.</div>
      )}

      {!loading && result?.found && sig && v && (
        <>
          {/* Verdict */}
          <div className="nl-card rounded-2xl p-5 mb-4" style={{ boxShadow: `0 0 0 1px ${v.color}30, 0 0 24px ${v.color}18` }}>
            <div className="flex items-center gap-2 mb-1">
              <ChainLogo chain={result.token!.chain} className="w-5 h-5" />
              <span className="text-lg font-bold">{result.token!.symbol || short(result.token!.address)}</span>
              <span className="ms-auto text-sm font-bold" style={{ color: v.color }}>{v.label}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                {(result.positives ?? []).map((p) => (
                  <div key={p} className="flex items-center gap-1.5 text-[12px] text-[#10B981] mb-1"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{p}</div>
                ))}
                {(result.positives ?? []).length === 0 && <div className="text-[11px] text-slate-600">No positive signals</div>}
              </div>
              <div>
                {(result.negatives ?? []).map((n) => (
                  <div key={n} className="flex items-center gap-1.5 text-[12px] text-[#FF1744] mb-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{n}</div>
                ))}
                {(result.negatives ?? []).length === 0 && <div className="text-[11px] text-slate-600">No red flags</div>}
              </div>
            </div>
          </div>

          {/* Signal panels */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Panel icon={<Radar className="w-4 h-4 text-[#00C8FF]" />} title="Convergence">
              {sig.convergence ? (
                <div>
                  <div className="text-xl font-bold">{sig.convergence.walletCount} <span className="text-sm font-medium text-slate-400">wallets</span></div>
                  <div className="text-[11px] text-slate-500">{fmtUsd(sig.convergence.totalValueUsd)} combined · {sig.convergence.active ? 'active' : 'stale'}</div>
                </div>
              ) : <div className="text-sm text-slate-600">No active convergence</div>}
            </Panel>

            <Panel icon={<Fish className="w-4 h-4 text-[#00C8FF]" />} title="Tracked whales" href={`/dashboard/whale-tracker/token?q=${encodeURIComponent(result.token!.address)}`}>
              {sig.whales.count > 0 ? (
                <div>
                  <div className={`text-xl font-bold ${sig.whales.netUsd >= 0 ? 'text-[#10B981]' : 'text-[#FF1744]'}`}>{fmtUsd(sig.whales.netUsd)}</div>
                  <div className="text-[11px] text-slate-500">{sig.whales.count} whales · net {sig.whales.netUsd >= 0 ? 'in' : 'out'} (30d)</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {sig.whales.top.slice(0, 3).map((w) => (
                      <span key={w.address} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 inline-flex items-center gap-0.5">
                        {w.label || short(w.address)}{w.winRate != null ? ` ${w.winRate}%` : ''}{w.label ? <BadgeCheck className="w-2.5 h-2.5 text-[#00C8FF]" /> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : <div className="text-sm text-slate-600">No tracked whales in it</div>}
            </Panel>

            <Panel icon={<Waves className="w-4 h-4 text-[#00C8FF]" />} title="Dune smart flow (24h)">
              {sig.duneFlow ? (
                <div>
                  <div className={`text-xl font-bold ${(sig.duneFlow.netInflowUsd ?? 0) >= 0 ? 'text-[#10B981]' : 'text-[#FF1744]'}`}>{fmtUsd(sig.duneFlow.netInflowUsd)}</div>
                  <div className="text-[11px] text-slate-500">{sig.duneFlow.uniqueWallets ?? '—'} unique wallets</div>
                </div>
              ) : <div className="text-sm text-slate-600">Not in Dune flow set</div>}
            </Panel>

            <Panel icon={<ShieldCheck className="w-4 h-4 text-[#00C8FF]" />} title="Volume authenticity" href="/dashboard/wash-radar">
              {sig.wash && sig.wash.score != null ? (
                <div>
                  <div className="text-xl font-bold" style={{ color: sig.wash.grade === 'clean' ? '#10B981' : sig.wash.grade === 'caution' ? '#FFD86B' : '#FF1744' }}>{sig.wash.score}/100</div>
                  <div className="text-[11px] text-slate-500 capitalize">{sig.wash.grade === 'clean' ? 'Real volume' : sig.wash.grade === 'caution' ? 'Some wash' : 'Wash risk'}{sig.wash.flaggedPairs ? ` · ${sig.wash.flaggedPairs} flagged pairs` : ''}</div>
                </div>
              ) : <div className="text-sm text-slate-600">Unrated</div>}
            </Panel>

            <Panel icon={<Sprout className="w-4 h-4 text-[#00C8FF]" />} title="Buyer wallet age" href="/dashboard/fresh-money">
              {sig.buyerAge && sig.buyerAge.freshPct != null ? (
                <div>
                  <div className="text-xl font-bold" style={{ color: sig.buyerAge.freshPct >= 50 ? '#FF1744' : sig.buyerAge.freshPct >= 20 ? '#FFD86B' : '#10B981' }}>{Math.round(sig.buyerAge.freshPct)}%</div>
                  <div className="text-[11px] text-slate-500">new wallets · {sig.buyerAge.totalBuyers?.toLocaleString() ?? '—'} buyers</div>
                </div>
              ) : <div className="text-sm text-slate-600">No buyer-age data</div>}
            </Panel>
          </div>

          {result.generatedAt && <p className="text-[10px] text-slate-600 text-center mt-4">Fused from real on-chain + Dune signals · {new Date(result.generatedAt).toLocaleTimeString()}</p>}
        </>
      )}
    </div>
  );
}
