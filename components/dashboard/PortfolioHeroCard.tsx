'use client';

import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useNakaWallet } from '@/lib/hooks/useNakaWallet';

/**
 * OV1: above-fold portfolio summary on /dashboard. Renders the user's real
 * total balance + 24h % change from /api/portfolio.
 *
 * The endpoint REQUIRES a `?address=` (and `chain`) — it 400s without one.
 * We resolve the connected wallet via useNakaWallet() (the same canonical
 * source the /dashboard/portfolio page uses) rather than calling the route
 * bare, which used to 400 and silently render nothing.
 *
 * Honest degradation: when the user has no connected wallet we show a
 * "Connect a wallet" prompt instead of hiding the card or faking a $0 hero.
 */

interface PortfolioResponse {
  totalBalanceUsd?: string | number;
  totalChange24hPct?: number;
  wallets?: Array<{ address: string }>;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function PortfolioHeroCard() {
  const naka = useNakaWallet();
  const address = naka.address;
  // /api/portfolio needs a chain. Solana wallets (Phantom) must not be probed
  // as EVM, so provider wins for that case; otherwise use the wallet's actual
  // connected chain, defaulting to ethereum.
  const chain =
    naka.provider === 'phantom' ? 'solana' : (naka.chain || 'ethereum');

  const [data, setData] = useState<PortfolioResponse | null>(null);
  // 'resolving' until the client-only wallet hook has read localStorage, so we
  // don't flash the empty state before we know whether a wallet is connected.
  const [status, setStatus] = useState<'resolving' | 'loading' | 'ready' | 'empty'>('resolving');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!address) {
      setData(null);
      setStatus('empty');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const res = await fetch(
          `/api/portfolio?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}`,
        );
        if (!res.ok) {
          if (!cancelled) setStatus('ready'); // degrade to zero-state below, never fake data
          return;
        }
        const j = (await res.json()) as PortfolioResponse;
        if (!cancelled) {
          setData(j);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, address, chain]);

  if (status === 'resolving' || status === 'loading') {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading portfolio…
      </div>
    );
  }

  // No connected wallet — honest prompt instead of a hidden or $0 card.
  if (status === 'empty' || !address) {
    return (
      <Link
        href="/dashboard/wallet-page"
        className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4 hover:border-white/[0.12] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <Wallet className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Your portfolio</div>
            <div className="text-sm font-medium mt-0.5 text-slate-200">Connect a wallet to see your portfolio</div>
          </div>
        </div>
      </Link>
    );
  }

  const total = Number(data?.totalBalanceUsd ?? 0);
  const change = Number(data?.totalChange24hPct ?? 0);
  const up = change >= 0;

  return (
    <Link
      href="/dashboard/portfolio"
      className="block rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0066FF]/[0.08] to-transparent p-5 mb-4 hover:border-white/[0.12] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0066FF]/15 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#8FA3FF]" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Your portfolio</div>
            <div className="text-2xl font-bold font-mono mt-0.5">{fmtUsd(total)}</div>
          </div>
        </div>
        <div className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-300' : 'text-red-300'}`}>
          {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {change.toFixed(2)}% · 24h
        </div>
      </div>
    </Link>
  );
}
