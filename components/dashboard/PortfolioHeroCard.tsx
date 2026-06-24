'use client';

import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import Link from 'next/link';

/**
 * OV1: above-fold portfolio summary on /dashboard. Fetches /api/portfolio
 * (existing endpoint), renders total balance + 24h % change. Silent
 * fail when the user has no connected wallets — the card hides itself
 * so we don't show a $0 hero to fresh users.
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
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/portfolio');
        if (!res.ok) return;
        const j = await res.json() as PortfolioResponse;
        if (!cancelled) setData(j);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading portfolio…
      </div>
    );
  }
  if (!data || (data.wallets?.length ?? 0) === 0) {
    return null; // hide for fresh users
  }

  const total = Number(data.totalBalanceUsd ?? 0);
  const change = Number(data.totalChange24hPct ?? 0);
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
