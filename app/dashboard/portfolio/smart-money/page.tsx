'use client';

// Portfolio → Smart Money Overlap. Cross-references YOUR holdings against
// tracked-whale activity: which of your tokens smart money is accumulating vs
// distributing over 30 days. A personalized conviction check. Real data via the
// portfolio_whale_signal RPC; only token symbols are sent, never your address.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus, Users, Wallet } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { portfolioOverlapHowItWorks } from '@/lib/howItWorks/content/portfolio-overlap';
import { useNakaWallet } from '@/lib/hooks/useNakaWallet';

type Stance = 'accumulating' | 'distributing' | 'neutral';
interface Signal { netUsd: number; buyUsd: number; sellUsd: number; whales: number; stance: Stance }
interface Holding { symbol: string; valueUsd: number }

function fmtUsd(n: number): string {
  const s = n < 0 ? '-' : ''; const abs = Math.abs(n);
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(1)}K`;
  return `${s}$${Math.round(abs)}`;
}

const STANCE_META: Record<Stance, { label: string; color: string; Icon: typeof TrendingUp }> = {
  accumulating: { label: 'Smart money accumulating', color: '#10B981', Icon: TrendingUp },
  distributing: { label: 'Smart money distributing', color: '#FF1744', Icon: TrendingDown },
  neutral: { label: 'Smart money flat', color: '#FFD86B', Icon: Minus },
};

export default function PortfolioOverlapPage() {
  const naka = useNakaWallet();
  const address = naka.address as string | undefined;

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [signals, setSignals] = useState<Record<string, Signal>>({});
  const [summary, setSummary] = useState<{ tracked: number; accumulating: number; distributing: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (addr: string) => {
    setLoading(true); setError(null);
    try {
      // 1) Load holdings.
      const iRes = await fetch(`/api/wallet-intelligence?address=${addr}`, { cache: 'no-store' });
      const iData = await iRes.json();
      const raw: Array<{ symbol?: string; valueUsd?: number; value_usd?: number }> =
        iData.holdings ?? iData.portfolio ?? [];
      const hs: Holding[] = raw
        .filter((h) => h.symbol)
        .map((h) => ({ symbol: (h.symbol as string).toUpperCase(), valueUsd: Number(h.valueUsd ?? h.value_usd ?? 0) }));
      setHoldings(hs);
      if (hs.length === 0) { setSignals({}); setSummary(null); return; }

      // 2) Cross-reference against whale activity (symbols only).
      const oRes = await fetch('/api/portfolio/smart-money-overlap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: hs.map((h) => h.symbol) }),
      });
      const oData = await oRes.json();
      if (!oRes.ok) throw new Error(oData.error || 'Overlap failed');
      setSignals(oData.signals ?? {});
      setSummary(oData.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('address');
      const addr = q?.trim() || address;
      if (addr) run(addr);
    } catch { /* ignore */ }
  }, [address, run]);

  // Order holdings: distributing first (warnings), then accumulating, then rest.
  const ordered = useMemo(() => {
    const rank = (s?: Stance) => (s === 'distributing' ? 0 : s === 'accumulating' ? 1 : s === 'neutral' ? 2 : 3);
    return [...holdings].sort((a, b) => rank(signals[a.symbol]?.stance) - rank(signals[b.symbol]?.stance) || b.valueUsd - a.valueUsd);
  }, [holdings, signals]);

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard/portfolio" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Wallet className="w-4 h-4 text-[#00C8FF]" /> Smart Money Overlap</span>
        <HowItWorksButton content={portfolioOverlapHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Is smart money with you?</h1>
        <p className="text-slate-400 text-sm mt-1">Your holdings, cross-referenced against what tracked whales are buying and selling.</p>
      </div>

      {!address && !loading && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">Connect your Naka wallet to check your holdings against smart money.</div>
      )}

      {error && <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">{error}</div>}
      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && summary && (
        <div className="nl-glass rounded-xl p-3 mb-4 flex items-center justify-center gap-6 text-center text-xs">
          <div><div className="text-lg font-bold text-[#10B981]">{summary.accumulating}</div><div className="text-slate-500">accumulating</div></div>
          <div><div className="text-lg font-bold text-[#FF1744]">{summary.distributing}</div><div className="text-slate-500">distributing</div></div>
          <div><div className="text-lg font-bold text-slate-400">{holdings.length - summary.tracked}</div><div className="text-slate-500">not tracked</div></div>
        </div>
      )}

      {!loading && !error && holdings.length === 0 && address && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">No holdings found to cross-reference yet.</div>
      )}

      <div className="space-y-2">
        {ordered.map((h) => {
          const sig = signals[h.symbol];
          const meta = sig ? STANCE_META[sig.stance] : null;
          const StanceIcon = meta?.Icon ?? Minus;
          return (
            <div key={h.symbol} className="nl-card rounded-xl p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{h.symbol}</span>
                  {h.valueUsd > 0 && <span className="text-[10px] text-slate-500">{fmtUsd(h.valueUsd)} held</span>}
                </div>
                {sig && meta ? (
                  <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px]" style={{ color: meta.color }}>
                    <StanceIcon className="w-3.5 h-3.5" />
                    <span className="font-semibold">{meta.label}</span>
                    <span className="inline-flex items-center gap-0.5 text-slate-500"><Users className="w-2.5 h-2.5" />{sig.whales}</span>
                  </div>
                ) : (
                  <div className="mt-0.5 text-[11px] text-slate-600">Not in the tracked whale set</div>
                )}
              </div>
              {sig && meta && (
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold" style={{ color: meta.color }}>{sig.netUsd >= 0 ? '+' : ''}{fmtUsd(sig.netUsd)}</div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">whale net 30d</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
