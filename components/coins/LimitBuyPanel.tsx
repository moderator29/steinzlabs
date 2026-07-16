'use client';

/**
 * Limit buy panel for a coin. A user arms a buy intent (price / market cap,
 * above / below) with a USD amount to spend. When the trigger hits, the
 * coin-intent-monitor cron pings the user to sign the buy in one tap.
 *
 * Non-custodial, always: Naka never holds keys and there is no session key, so
 * an armed intent CANNOT execute on its own. It only ever notifies. The copy
 * here is honest about that. Real data only: intents come from the owner-scoped
 * intents route, never invented.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Loader2, Trash2, ShieldCheck } from 'lucide-react';
import type { Coin } from '@/lib/coins/types';
import { coinPrice, compactUsd } from '@/lib/coins/format';

type TriggerKind = 'price_below' | 'price_above' | 'mcap_below' | 'mcap_above';

interface Intent {
  id: string;
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  trigger_kind: TriggerKind;
  threshold: number;
  amount_usd: number;
  active: boolean;
  created_at: string;
  triggered_at: string | null;
}

const METRICS: Array<{ key: 'price' | 'mcap'; label: string }> = [
  { key: 'price', label: 'Price' },
  { key: 'mcap', label: 'Market cap' },
];
const DIRS: Array<{ key: 'below' | 'above'; label: string }> = [
  { key: 'below', label: 'Falls to' },
  { key: 'above', label: 'Rises to' },
];

const CHIP_ACTIVE = 'bg-[#0066FF]/18 border-[#0066FF]/60 text-white shadow-[0_0_18px_-4px_rgba(0,102,255,.8)]';
const CHIP_IDLE = 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white';

function kindLabel(kind: TriggerKind): { metric: string; dir: string; isPrice: boolean } {
  const isPrice = kind === 'price_below' || kind === 'price_above';
  const above = kind === 'price_above' || kind === 'mcap_above';
  return { metric: isPrice ? 'Price' : 'Market cap', dir: above ? 'rises to' : 'falls to', isPrice };
}

export function LimitBuyPanel({ coin, signedIn }: { coin: Coin; signedIn: boolean }) {
  const [metric, setMetric] = useState<'price' | 'mcap'>('price');
  const [dir, setDir] = useState<'below' | 'above'>('below');
  const [threshold, setThreshold] = useState('');
  const [amount, setAmount] = useState('');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [arming, setArming] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/coins/${coin.chain}/${encodeURIComponent(coin.tokenAddress)}/intents`;

  const load = useCallback(async () => {
    try {
      const r = await fetch(base, { cache: 'no-store' });
      if (!r.ok) { setIntents([]); return; }
      const j = await r.json();
      setIntents(Array.isArray(j.intents) ? j.intents : []);
    } catch {
      setIntents([]);
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
    const thr = Number(threshold);
    const amt = Number(amount);
    if (!Number.isFinite(thr) || thr <= 0) { setError('Enter a threshold above 0.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter a dollar amount above 0.'); return; }

    setArming(true);
    try {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_kind: `${metric}_${dir}` as TriggerKind, threshold: thr, amount_usd: amt }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(typeof j.error === 'string' ? j.error : 'Could not arm intent.'); return; }
      if (j.intent) setIntents((prev) => [j.intent as Intent, ...prev]);
      setThreshold('');
      setAmount('');
    } catch {
      setError('Could not arm intent.');
    } finally {
      setArming(false);
    }
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    try {
      const r = await fetch(`${base}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (r.ok) setIntents((prev) => prev.filter((i) => i.id !== id));
    } catch {
      /* keep the row on failure */
    } finally {
      setRemovingId(null);
    }
  };

  const armedList = intents.filter((i) => i.active);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="nl-glass rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-[#7FB2FF]" />
        <h3 className="text-[15px] font-semibold text-white">Limit buy</h3>
      </div>
      <p className="text-[12px] text-white/50 mb-4">
        Arm a buy for {coin.symbol || 'this coin'} and we ping you to sign the instant it triggers.
      </p>

      {!signedIn ? (
        <div className="text-center py-2">
          <p className="text-[13px] text-white/60 mb-3">Sign in to arm a limit buy on this coin.</p>
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
          {/* Metric */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`py-2 rounded-lg text-[13px] font-semibold border transition-colors ${metric === m.key ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Direction */}
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {DIRS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDir(d.key)}
                className={`py-2 rounded-lg text-[13px] font-semibold border transition-colors ${dir === d.key ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Threshold */}
          <label className="block text-[11px] font-medium text-white/45 mb-1">
            {metric === 'price' ? 'Trigger price (USD)' : 'Trigger market cap (USD)'}
          </label>
          <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/10 px-3 mb-3 focus-within:border-[#0066FF]/50">
            <span className="text-white/40 text-[14px]">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="0.00"
              className="w-full h-11 bg-transparent px-2 text-white outline-none tabular-nums"
            />
          </div>

          {/* Amount to spend (USD) */}
          <label className="block text-[11px] font-medium text-white/45 mb-1">
            Amount to buy (USD)
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

          {error ? <div className="text-[12px] text-rose-400 mb-2">{error}</div> : null}

          <button
            type="button"
            onClick={arm}
            disabled={arming}
            className="w-full rounded-xl py-3 text-[14px] font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-45 transition-transform active:scale-[0.99] shadow-[0_12px_32px_-12px_rgba(0,102,255,.9)]"
            style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF)' }}
          >
            {arming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {arming ? 'Arming' : 'Arm limit buy'}
          </button>

          {/* Honest non-custodial note */}
          <div className="flex items-start gap-2 mt-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[11px] leading-relaxed text-white/55">
              We ping you to sign the instant it hits. Non-custodial: your funds never move without you.
            </p>
          </div>

          {/* Armed intents */}
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-2">Armed</div>
            {loading ? (
              <div className="flex items-center gap-2 text-[12px] text-white/40 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your intents
              </div>
            ) : armedList.length === 0 ? (
              <p className="text-[12px] text-white/40 py-2">No armed limit buys yet.</p>
            ) : (
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {armedList.map((i) => {
                    const { metric: m, dir: d, isPrice } = kindLabel(i.trigger_kind);
                    const shown = isPrice ? coinPrice(i.threshold) : compactUsd(i.threshold);
                    return (
                      <motion.li
                        key={i.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] text-white truncate">
                            {m} {d} <span className="font-semibold tabular-nums">{shown}</span>
                          </div>
                          <div className="text-[11px] text-white/45 tabular-nums">
                            Buy {compactUsd(i.amount_usd)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(i.id)}
                          disabled={removingId === i.id}
                          aria-label="Remove limit buy"
                          className="shrink-0 p-2 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                        >
                          {removingId === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
