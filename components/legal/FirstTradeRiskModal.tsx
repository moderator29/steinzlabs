'use client';

/**
 * One-time risk acknowledgment shown before a user's first on-chain
 * trade. Industry-standard disclosure on every retail trading product
 * (Robinhood, Coinbase, Phantom). Required-checkbox-then-confirm flow
 * so the acknowledgment is an explicit affirmative action, not a tap-
 * through.
 *
 * The acknowledgment is persisted client-side. For a stronger audit
 * trail (compliance / dispute response) move this to
 * `users.first_trade_acknowledged` with an `acknowledged_at` timestamp
 * once the user-preferences API is extended.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

const STORAGE_KEY = 'naka_first_trade_acknowledged';

export function hasAcknowledgedTradeRisk(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function recordTradeRiskAck() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
    localStorage.setItem(`${STORAGE_KEY}_at`, new Date().toISOString());
  } catch {
    /* storage disabled — non-fatal; user gets the modal again next try */
  }
}

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function FirstTradeRiskModal({ open, onConfirm, onCancel }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  // A11Y4: focus trap + Escape closes (treat as cancel).
  const trapRef = useFocusTrap<HTMLDivElement>(open, onCancel);

  // Reset the checkbox each time the modal re-opens so a returning
  // user must re-affirm the read (browsers retain controlled-input
  // state across mounts in some flows).
  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-trade-risk-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div ref={trapRef} className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0E1A] shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 text-slate-400 hover:text-white p-1"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 id="first-trade-risk-title" className="text-base font-semibold text-white">
              Before your first trade
            </h2>
          </div>
          <ul className="space-y-2 text-[12.5px] leading-relaxed text-slate-200">
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">•</span>
              <span>
                Crypto trades are <span className="font-semibold">irreversible</span>. Once
                signed, no one — including Naka Labs — can claw the funds back.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">•</span>
              <span>
                You can <span className="font-semibold">lose 100%</span> of any position.
                Tokens can be honeypots, rugs, or simply collapse in price.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">•</span>
              <span>
                Naka Labs is <span className="font-semibold">non-custodial</span>. Your
                wallet, your keys, your responsibility — we route the swap, you sign it.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">•</span>
              <span>
                Trust scores, security panels, and AI insights are <span className="font-semibold">tools, not guarantees</span>.
                Always verify the contract address yourself.
              </span>
            </li>
          </ul>

          <label className="mt-4 flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#0066FF] focus:ring-[#0066FF]"
            />
            <span className="text-[12px] text-slate-300 leading-relaxed">
              I understand the risks and confirm I am only trading capital I can afford
              to lose. I have read the{' '}
              <Link href="/terms" className="text-[#8FA3FF] hover:underline" target="_blank">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-[#8FA3FF] hover:underline" target="_blank">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-3 py-2 rounded-lg border border-white/10 hover:border-white/30 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!confirmed}
              onClick={() => {
                recordTradeRiskAck();
                onConfirm();
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-[#0066FF] to-[#7C3AED] text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.02] transition-transform"
            >
              I understand — continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
