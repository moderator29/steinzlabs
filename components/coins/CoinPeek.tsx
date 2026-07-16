'use client';

/**
 * CoinPeek (recs 4 + 14). Tap a coin anywhere it renders a card (the Wire, a
 * Group message) to peek its live price, a small sparkline and market data in a
 * floating sheet, and buy it right there without leaving the page. Real data
 * only: mini stats from the coin API, the sparkline from real 1D candles, and
 * the buy reuses the non-custodial TradeCard. Renders nothing meaningful until
 * data loads; an honest state when the coin cannot be resolved.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Zap } from 'lucide-react';
import { CoinLogo, PriceDelta } from './atoms';
import { TradeCard } from './TradeCard';
import { coinPrice, compactUsd } from '@/lib/coins/format';
import type { Coin } from '@/lib/coins/types';

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const up = points[points.length - 1] >= points[0];
  const w = 220;
  const h = 44;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / span) * h}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-11">
      <polyline fill="none" stroke={up ? '#10B981' : '#F43F5E'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={d} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function CoinPeek({ chain, address, onClose }: { chain: string; address: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [coin, setCoin] = useState<Coin | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [spark, setSpark] = useState<number[] | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}`, { cache: 'no-store' });
        if (!r.ok) { if (alive) setNotFound(true); return; }
        const j = await r.json();
        if (alive) setCoin(j.coin ?? null);
      } catch { if (alive) setNotFound(true); }
    })();
    (async () => {
      try {
        const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/chart?tf=1D`, { cache: 'no-store' });
        const j = await r.json();
        const closes = Array.isArray(j.candles) ? j.candles.map((c: { close?: number }) => Number(c.close)).filter((n: number) => Number.isFinite(n)) : [];
        if (alive) setSpark(closes);
      } catch { if (alive) setSpark([]); }
    })();
    return () => { alive = false; };
  }, [chain, address]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Coin peek">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative w-full sm:max-w-sm nl-glass rounded-t-3xl sm:rounded-3xl p-4 max-h-[88vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-8 h-8 rounded-lg inline-flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06]">
          <X className="w-4 h-4" />
        </button>

        {notFound ? (
          <div className="py-10 text-center text-white/50 text-sm">This coin is not available to preview.</div>
        ) : !coin ? (
          <div className="py-12 flex items-center justify-center text-white/40"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            <div className="flex items-center gap-3 pr-8">
              <CoinLogo logoUrl={coin.logoUrl} symbol={coin.symbol} chain={coin.chain} size={44} verified={coin.verified} />
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-bold text-white truncate">{coin.symbol || coin.name}</div>
                <div className="text-[12px] text-white/45 truncate">{compactUsd(coin.marketCapUsd)} MC</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[17px] font-bold text-white tabular-nums">{coinPrice(coin.priceUsd)}</div>
                <PriceDelta value={coin.change24h} className="text-[12px] font-semibold" />
              </div>
            </div>

            <div className="mt-3 mb-1">
              {spark === null ? <div className="h-11 rounded-lg bg-white/[0.03] animate-pulse" /> : <Sparkline points={spark} />}
            </div>

            {!buyOpen ? (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBuyOpen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[14px] font-bold text-white transition-transform active:scale-[0.99]"
                  style={{ background: 'linear-gradient(135deg,#14c48a,#0e9f6e)', boxShadow: '0 10px 28px -10px rgba(16,185,129,.7)' }}
                >
                  <Zap className="w-4 h-4" /> Buy {coin.symbol}
                </button>
                <Link
                  href={`/dashboard/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}`}
                  className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#7FB2FF] bg-[#0066FF]/10 border border-[#0066FF]/25 hover:text-white transition-colors"
                >
                  Open
                </Link>
              </div>
            ) : (
              <div className="mt-3">
                <TradeCard coin={coin} livePrice={coin.priceUsd} liveMcap={coin.marketCapUsd} />
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}

/** A tiny controller: wraps children in a button that opens the CoinPeek. */
export function PeekableCoin({ chain, address, children, className }: { chain: string; address: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children}</button>
      <AnimatePresence>{open ? <CoinPeek chain={chain} address={address} onClose={() => setOpen(false)} /> : null}</AnimatePresence>
    </>
  );
}
