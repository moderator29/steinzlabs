'use client';

/**
 * One-tap DCA panel for a coin. A user sets up a plan: buy $X of this coin every
 * day (or week) for N reminders. On each due date the coin-dca cron pings them
 * with a one-tap prefilled buy deep link and they sign each buy themselves.
 *
 * Non-custodial, always: Naka never holds keys and there is no session key, so a
 * plan CANNOT auto-sign. It only ever reminds. The copy here is honest about
 * that. Real data only: plans come from the owner-scoped dca route, never
 * invented.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Loader2, Trash2, ShieldCheck } from 'lucide-react';
import type { Coin } from '@/lib/coins/types';
import { compactUsd } from '@/lib/coins/format';

interface DcaPlan {
  id: string;
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  usd_per_buy: number;
  interval_hours: number;
  remaining_count: number;
  next_run_at: string;
  active: boolean;
  created_at: string;
}

const INTERVALS: Array<{ hours: number; label: string }> = [
  { hours: 24, label: 'Daily' },
  { hours: 168, label: 'Weekly' },
];

const CHIP_ACTIVE = 'bg-[#0066FF]/18 border-[#0066FF]/60 text-white shadow-[0_0_18px_-4px_rgba(0,102,255,.8)]';
const CHIP_IDLE = 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white';

function nextDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function intervalLabel(hours: number): string {
  if (hours === 24) return 'daily';
  if (hours === 168) return 'weekly';
  if (hours % 24 === 0) return `every ${hours / 24}d`;
  return `every ${hours}h`;
}

export function DcaPanel({ coin, signedIn }: { coin: Coin; signedIn: boolean }) {
  const [amount, setAmount] = useState('');
  const [intervalHours, setIntervalHours] = useState(24);
  const [count, setCount] = useState('7');
  const [plans, setPlans] = useState<DcaPlan[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [arming, setArming] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}/dca`;

  const load = useCallback(async () => {
    try {
      const r = await fetch(base, { cache: 'no-store' });
      if (!r.ok) { setPlans([]); return; }
      const j = await r.json();
      setPlans(Array.isArray(j.plans) ? j.plans : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (!signedIn) { setLoading(false); return; }
    void load();
  }, [signedIn, load]);

  const arm = async () => {
    setError(null);
    const amt = Number(amount);
    const cnt = Number(count);
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter a dollar amount above 0.'); return; }
    if (!Number.isInteger(cnt) || cnt < 1 || cnt > 90) { setError('Enter a count between 1 and 90.'); return; }

    setArming(true);
    try {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdPerBuy: amt, intervalHours, count: cnt }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(typeof j.error === 'string' ? j.error : 'Could not set up plan.'); return; }
      if (j.plan) setPlans((prev) => [j.plan as DcaPlan, ...prev]);
      setAmount('');
    } catch {
      setError('Could not set up plan.');
    } finally {
      setArming(false);
    }
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    try {
      const r = await fetch(`${base}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (r.ok) setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      /* keep the row on failure */
    } finally {
      setRemovingId(null);
    }
  };

  const activeList = plans.filter((p) => p.active);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="nl-glass rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-4 h-4 text-[#7FB2FF]" />
        <h3 className="text-[15px] font-semibold text-white">One-tap DCA</h3>
      </div>
      <p className="text-[12px] text-white/50 mb-4">
        Buy {coin.symbol || 'this coin'} on a schedule. We remind you to sign each buy in one tap.
      </p>

      {!signedIn ? (
        <div className="text-center py-2">
          <p className="text-[13px] text-white/60 mb-3">Sign in to set up a DCA plan on this coin.</p>
          <Link
            href="/dashboard?tab=wallet"
            className="inline-flex rounded-xl px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}
          >
            Sign in
          </Link>
        </div>
      ) : (
        <>
          {/* Amount per buy (USD) */}
          <label className="block text-[11px] font-medium text-white/45 mb-1">
            Amount per buy (USD)
          </label>
          <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/10 px-3 mb-3 focus-within:border-[#0066FF]/50">
            <span className="text-white/40 text-[14px]">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-11 bg-transparent px-2 text-white outline-none tabular-nums"
            />
          </div>

          {/* Interval */}
          <label className="block text-[11px] font-medium text-white/45 mb-1">Interval</label>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {INTERVALS.map((iv) => (
              <button
                key={iv.hours}
                type="button"
                onClick={() => setIntervalHours(iv.hours)}
                className={`py-2 rounded-lg text-[13px] font-semibold border transition-colors ${intervalHours === iv.hours ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {iv.label}
              </button>
            ))}
          </div>

          {/* Number of buys */}
          <label className="block text-[11px] font-medium text-white/45 mb-1">
            Number of buys (1 to 90)
          </label>
          <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/10 px-3 mb-3 focus-within:border-[#0066FF]/50">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="90"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="7"
              className="w-full h-11 bg-transparent px-2 text-white outline-none tabular-nums"
            />
          </div>

          {error ? <div className="text-[12px] text-rose-400 mb-2">{error}</div> : null}

          <button
            type="button"
            onClick={arm}
            disabled={arming}
            className="w-full rounded-xl py-3 text-[14px] font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-45 transition-transform active:scale-[0.99] shadow-[0_12px_32px_-12px_rgba(0,102,255,.9)]"
            style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}
          >
            {arming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
            {arming ? 'Setting up' : 'Arm DCA plan'}
          </button>

          {/* Honest non-custodial note */}
          <div className="flex items-start gap-2 mt-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[11px] leading-relaxed text-white/55">
              We remind you to sign each buy. Non-custodial, funds never move without you.
            </p>
          </div>

          {/* Active plans */}
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-2">Active plans</div>
            {loading ? (
              <div className="flex items-center gap-2 text-[12px] text-white/40 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your plans
              </div>
            ) : activeList.length === 0 ? (
              <p className="text-[12px] text-white/40 py-2">No active DCA plans yet.</p>
            ) : (
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {activeList.map((p) => (
                    <motion.li
                      key={p.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] text-white truncate">
                          <span className="font-semibold tabular-nums">{compactUsd(p.usd_per_buy)}</span> {intervalLabel(p.interval_hours)}
                        </div>
                        <div className="text-[11px] text-white/45 tabular-nums">
                          {p.remaining_count} left · next {nextDateLabel(p.next_run_at)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        disabled={removingId === p.id}
                        aria-label="Remove DCA plan"
                        className="shrink-0 p-2 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                      >
                        {removingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
