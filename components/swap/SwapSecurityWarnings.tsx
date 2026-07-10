'use client';

import { AlertTriangle, ShieldCheck, ShieldAlert, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface SwapSecurityBlockerInput {
  /** GoPlus / Naka security summary for the destination token. */
  data: {
    isHoneypot: boolean;
    buyTax: number;    // decimal (0.05 = 5%)
    sellTax: number;   // decimal
    safetyLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
    cannotSellAll?: boolean;
    transferPausable?: boolean;
    isBlacklisted?: boolean;
  } | null;
  loading?: boolean;
  /** Current effective price impact in % (e.g. 2.4). */
  priceImpact: number;
  /** Slippage tolerance the user set, in % (e.g. 1, 5, 50). */
  slippagePct: number;
  /** Destination token contract address — deep-links the "View full report"
   *  CTA into /dashboard/security/wallet-analysis with the token prefilled. */
  tokenAddress?: string;
}

/**
 * Industry-standard pre-confirm security panel for the swap review modal.
 * Mirrors what Trojan / Maestro / Banana Gun expose before sign:
 *   - Honeypot → BLOCK
 *   - Buy or sell tax > 30% → BLOCK
 *   - Blacklisted / transfer-pausable → BLOCK
 *   - Cannot-sell-all → WARN (sell will revert)
 *   - Tax 10-30% → WARN
 *   - Slippage outside the 0.1% – 5% safe range → WARN
 *
 * `blocking` is exposed to the parent so the Confirm button can read a
 * single source of truth for the disabled state.
 */
export function shouldBlockSwap(input: SwapSecurityBlockerInput): {
  blocking: boolean;
  reason: string | null;
} {
  const { data, priceImpact } = input;
  if (priceImpact >= 15) return { blocking: true, reason: 'Price impact ≥ 15%: likely honeypot or drained pool.' };
  if (!data) return { blocking: false, reason: null };
  if (data.isHoneypot) return { blocking: true, reason: 'Honeypot detected: this token cannot be sold.' };
  if (data.buyTax >= 0.30) return { blocking: true, reason: `Buy tax of ${(data.buyTax * 100).toFixed(1)}% would consume most of your input.` };
  if (data.sellTax >= 0.30) return { blocking: true, reason: `Sell tax of ${(data.sellTax * 100).toFixed(1)}% would consume most of your exit.` };
  if (data.isBlacklisted) return { blocking: true, reason: 'Your address (or the token) is blacklisted by the contract.' };
  if (data.transferPausable) return { blocking: true, reason: 'Contract owner can pause transfers. Funds could be trapped.' };
  return { blocking: false, reason: null };
}

export function SwapSecurityWarnings(props: SwapSecurityBlockerInput) {
  const { data, loading, slippagePct, tokenAddress } = props;
  const { blocking, reason } = shouldBlockSwap(props);

  const detailsHref = tokenAddress
    ? `/dashboard/security/wallet-analysis?address=${encodeURIComponent(tokenAddress)}`
    : '/dashboard/security/wallet-analysis';

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border border-white/10 bg-white/[0.03] text-[11px] text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running security checks…
      </div>
    );
  }

  const items: Array<{ tone: 'block' | 'warn' | 'pass'; label: string }> = [];

  if (blocking && reason) {
    items.push({ tone: 'block', label: reason });
  }

  if (data) {
    // Tax in warn zone (10-30%)
    if (!blocking && data.sellTax >= 0.10 && data.sellTax < 0.30) {
      items.push({ tone: 'warn', label: `Elevated sell tax (${(data.sellTax * 100).toFixed(1)}%), you'll receive less on exit than the quoted minimum.` });
    }
    if (!blocking && data.buyTax >= 0.10 && data.buyTax < 0.30) {
      items.push({ tone: 'warn', label: `Elevated buy tax (${(data.buyTax * 100).toFixed(1)}%), your input will be partially eaten by the contract.` });
    }
    if (!blocking && data.cannotSellAll) {
      items.push({ tone: 'warn', label: 'Contract restricts selling 100% of your balance in a single transaction.' });
    }
  }

  // Slippage outside the safe range.
  if (slippagePct < 0.1) {
    items.push({ tone: 'warn', label: `Slippage tolerance ${slippagePct}% is very tight: your transaction will likely fail when the price moves.` });
  } else if (slippagePct > 10) {
    items.push({ tone: 'warn', label: `Slippage tolerance ${slippagePct}% is very loose: MEV bots can sandwich your trade and pocket the difference.` });
  }

  if (items.length === 0 && data && data.safetyLevel === 'SAFE') {
    return (
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border border-emerald-500/20 bg-emerald-500/[0.04] text-[11px] text-emerald-300">
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Security checks passed.
        <span className="ms-auto text-emerald-500/70">Buy {((data.buyTax ?? 0) * 100).toFixed(1)}% · Sell {((data.sellTax ?? 0) * 100).toFixed(1)}%</span>
        <Link href={detailsHref} className="text-emerald-200 hover:text-white inline-flex items-center gap-1 ms-2" title="Open the full Security Center report">
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const tone = item.tone;
        const Icon = tone === 'block' ? ShieldAlert : AlertTriangle;
        const bg = tone === 'block' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300';
        const iconColor = tone === 'block' ? 'text-red-400' : 'text-amber-400';
        return (
          <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border ${bg}`}>
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
            <div className="text-[11px] leading-snug">{item.label}</div>
          </div>
        );
      })}
      <Link
        href={detailsHref}
        className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white"
      >
        <ExternalLink className="w-3 h-3" aria-hidden="true" />
        View full security details
      </Link>
    </div>
  );
}
