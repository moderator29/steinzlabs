'use client';

/**
 * A profile's coins: total value plus the coins they hold on Naka (from settled
 * trades, valued at live prices). Public by default; the owner sees an inline
 * visibility toggle and their live wallet total. Real data only, honest empty
 * states. Hidden profiles render nothing to visitors.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Coins as CoinsIcon, Eye, EyeOff, Share2 } from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';
import { CoinLogo, PriceDelta } from './atoms';
import { compactUsd } from '@/lib/coins/format';
import { MiniChart, MINI_CHART_BRAND } from '@/components/analytics/MiniChart';

interface Holding { chain: string; tokenAddress: string; tokenKey: string; symbol: string; logoUrl: string | null; usdValue: number | null; change24h: number | null }

export function ProfileCoins({ username, isOwner = false }: { username: string; isOwner?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [showHoldings, setShowHoldings] = useState(true);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [coinsValueUsd, setCoinsValueUsd] = useState(0);
  const [flow, setFlow] = useState<number[]>([]);
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { balance } = useWallet();

  const load = async () => {
    try {
      const r = await fetch(`/api/coins/portfolio/${encodeURIComponent(username)}`, { cache: 'no-store' });
      const j = await r.json();
      setShowBalance(j.showBalance !== false);
      setShowHoldings(j.showHoldings !== false);
      setHoldings(Array.isArray(j.holdings) ? j.holdings : []);
      setCoinsValueUsd(Number(j.coinsValueUsd) || 0);
    } catch { /* keep defaults */ } finally { setLoaded(true); }
  };

  // Cost-basis flow sparkline: net invested valued at today's price over 30d.
  const loadFlow = async () => {
    try {
      const r = await fetch(`/api/coins/portfolio/${encodeURIComponent(username)}/history`, { cache: 'no-store' });
      const j = await r.json();
      const pts = Array.isArray(j.points) ? j.points.map((p: { valueUsd: number }) => Number(p.valueUsd) || 0) : [];
      setFlow(pts);
    } catch { setFlow([]); }
  };
  useEffect(() => { void load(); void loadFlow(); }, [username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the branded position-card PNG for a holding and trigger a download.
  const sharePosition = async (h: Holding) => {
    const key = `${h.chain}:${h.tokenKey}`;
    setSharingKey(key);
    try {
      const url = `/api/coins/position-card?chain=${encodeURIComponent(h.chain)}&address=${encodeURIComponent(h.tokenAddress)}&user=${encodeURIComponent(username)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `naka-${(h.symbol || 'position').toLowerCase()}-position.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch { /* ignore, honest no-op on failure */ } finally { setSharingKey(null); }
  };

  const toggleVisibility = async (next: boolean) => {
    setShowBalance(next); setShowHoldings(next); setSaving(true);
    try {
      await fetch('/api/social/profile/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ show_wallet_balance: next, show_holdings: next }) });
    } catch { setShowBalance(!next); setShowHoldings(!next); } finally { setSaving(false); }
  };

  if (!loaded) return <div className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />;
  // Visitors see nothing when the owner has hidden their coins.
  if (!isOwner && !showBalance && !showHoldings) return null;

  const headlineValue = isOwner ? (balance?.totalUsd ?? coinsValueUsd) : coinsValueUsd;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="nl-glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/80"><CoinsIcon className="w-4 h-4 text-[#7FB2FF]" /> Coins</div>
        {isOwner ? (
          <button type="button" onClick={() => toggleVisibility(!showBalance)} disabled={saving} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/60 hover:text-white">
            {showBalance ? <><Eye className="w-3.5 h-3.5" /> Public</> : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>}
          </button>
        ) : null}
      </div>

      {(isOwner || showBalance) ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] text-white/45">{isOwner ? 'Wallet value' : 'Coins value'}</div>
            <div className="text-2xl font-bold text-white tabular-nums">{compactUsd(headlineValue)}</div>
          </div>
          {flow.length >= 2 ? (
            <div className="w-full sm:w-32 shrink-0">
              <MiniChart data={flow} height={40} color={MINI_CHART_BRAND} ariaLabel="Coins cost-basis flow, last 30 days" />
              <div className="mt-0.5 text-[10px] text-white/40 leading-tight">Coins flow · net invested at today's price · 30d</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showHoldings ? (
        holdings.length === 0 ? (
          <div className="text-[13px] text-white/45">{isOwner ? 'No coins yet. Buy your first from the Coins tab.' : 'No coins held on Naka yet.'}</div>
        ) : (
          <div className="space-y-1.5">
            {holdings.slice(0, 8).map((h) => (
              <div key={`${h.chain}:${h.tokenKey}`} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-white/[0.04]">
                <Link href={`/dashboard/coins/${h.chain}/${encodeURIComponent(h.tokenAddress)}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                  <CoinLogo logoUrl={h.logoUrl} symbol={h.symbol} chain={h.chain} size={32} />
                  <div className="min-w-0 flex-1 text-[14px] font-semibold text-white truncate">{h.symbol}</div>
                  <div className="text-right">
                    <div className="text-[14px] font-semibold text-white tabular-nums">{compactUsd(h.usdValue)}</div>
                    <PriceDelta value={h.change24h} className="text-[11px]" />
                  </div>
                </Link>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => void sharePosition(h)}
                    disabled={sharingKey === `${h.chain}:${h.tokenKey}`}
                    aria-label={`Share ${h.symbol} position`}
                    title="Share position"
                    className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-[#7FB2FF] hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : isOwner ? <div className="text-[12px] text-white/40">Your holdings are hidden from visitors.</div> : null}
    </motion.div>
  );
}
