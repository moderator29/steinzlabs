'use client';

/**
 * Compact Coins wallet widget for the home Overview. Shows the user's live
 * wallet total (from the canonical useWallet hook) and routes into Coins to
 * trade. If the account holds open coin positions we surface the count from
 * /api/coins/trade?open=1. Honest zero state: $0.00 with the Trade coins CTA
 * still shown. Real data only, no fabricated balances.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';
import { compactUsd } from '@/lib/coins/format';

export function CoinsWalletWidget() {
  const { balance } = useWallet();
  const [positions, setPositions] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/coins/trade?open=1', { cache: 'no-store' });
        if (!r.ok) { if (!cancelled) setPositions(0); return; }
        const j = await r.json();
        if (!cancelled) setPositions(Array.isArray(j?.positions) ? j.positions.length : 0);
      } catch { if (!cancelled) setPositions(0); }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalUsd = balance?.totalUsd ?? 0;

  return (
    <div className="nl-glass rounded-2xl p-4 mt-5 transition-all hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-10px_rgba(0,102,255,.55)]">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#0066FF]/[0.12] border border-[#0066FF]/25 text-[#7FB2FF] shrink-0">
          <Coins className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-white/45 uppercase tracking-wide">Wallet</div>
          <div className="text-[20px] font-bold text-white tabular-nums leading-tight">{compactUsd(totalUsd)}</div>
          {positions && positions > 0 ? (
            <div className="text-[12px] text-white/45 mt-0.5">{positions} {positions === 1 ? 'position' : 'positions'}</div>
          ) : null}
        </div>
        <Link
          href="/dashboard/coins"
          className="inline-flex items-center gap-1 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-white shrink-0 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 100%)', boxShadow: '0 6px 20px rgba(0,102,255,0.35)' }}
        >
          Trade coins
        </Link>
      </div>
    </div>
  );
}

export default CoinsWalletWidget;
