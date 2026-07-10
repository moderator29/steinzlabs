'use client';

// Guided bridge card shown on the Swap page when the user selects Robinhood
// Chain — a brand-new Arbitrum Orbit L2 (chain id 4663) with native ETH but no
// DEX aggregator coverage yet. Instead of a broken/coming-soon panel, we tell
// the honest story: "no DEX here — move your ETH to Base/Ethereum and trade
// there", show the user's real Robinhood ETH balance, and hand off to the
// OFFICIAL bridge. Non-custodial throughout: read-only balance + external
// links, no signing, no fabricated contracts. See lib/bridge/robinhood.ts.

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Clock,
  ExternalLink,
  Info,
  Wallet,
  Zap,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { CHAIN_META } from '@/lib/chains/chainMeta';
import {
  ROBINHOOD_BRIDGE,
  ROBINHOOD_FAST_BRIDGES,
  SWAP_DESTINATIONS,
  CANONICAL_WITHDRAWAL_CHALLENGE_DAYS,
  getRobinhoodEthBalance,
  getGuidedBridgeSteps,
} from '@/lib/bridge/robinhood';

const RH = CHAIN_META.robinhood;

export default function RobinhoodBridgeCard({
  address,
  onSwapOnChain,
  onOpenWallet,
}: {
  /** connected wallet address, or null when no wallet is connected */
  address: string | null;
  /** switch the Swap page to a DEX-supported chain and start trading there */
  onSwapOnChain: (chainId: string) => void;
  /** open the in-app wallet (holds / receives Robinhood ETH) */
  onOpenWallet: () => void;
}) {
  const [ethBalance, setEthBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [destination, setDestination] = useState(SWAP_DESTINATIONS[0]);

  // Real on-chain read of the user's Robinhood ETH — never a placeholder. On
  // any RPC/CORS failure we simply omit the number and keep the guided flow.
  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setEthBalance(null);
      return;
    }
    setBalanceLoading(true);
    getRobinhoodEthBalance(address)
      .then((b) => {
        if (!cancelled) setEthBalance(b ? b.eth : null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const steps = getGuidedBridgeSteps(destination.label);

  return (
    <div
      className="nl-glass rounded-2xl p-5 sm:p-6 shadow-2xl"
      style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 26px rgba(0,102,255,.18), 0 18px 50px rgba(0,0,0,.45)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center"
          style={{ backgroundColor: RH.color + '1A', border: `1px solid ${RH.color}55` }}
        >
          <ArrowUpRight className="w-5 h-5" style={{ color: RH.color }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white leading-tight">
            {RH.label} has no DEX yet
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed mt-1">
            Bridge your ETH to Base or Ethereum to trade — swaps route through the
            live aggregator there. Your ETH stays yours the whole way.
          </p>
        </div>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between rounded-xl bg-[#060A12] border border-white/[0.06] px-4 py-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: RH.color }}
          />
          <span className="text-xs text-gray-400 font-medium truncate">
            Your {RH.label} balance
          </span>
        </div>
        <span className="text-sm font-bold text-white tabular-nums">
          {!address ? (
            '—'
          ) : balanceLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" aria-hidden="true" />
          ) : ethBalance !== null ? (
            `${ethBalance.toFixed(ethBalance >= 1 ? 4 : 6)} ETH`
          ) : (
            'Unavailable'
          )}
        </span>
      </div>

      {/* Destination picker */}
      <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-2">
        Trade on
      </p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {SWAP_DESTINATIONS.map((d) => {
          const active = d.chainId === destination.chainId;
          const meta = CHAIN_META[d.chainId];
          return (
            <button
              key={d.chainId}
              type="button"
              onClick={() => setDestination(d)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 border text-left transition-all ${
                active
                  ? 'bg-[#0066FF]/15 border-[#0066FF]/50'
                  : 'bg-[#060A12] border-white/[0.06] hover:border-white/20'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: meta?.color ?? '#0066FF' }}
                />
                <span className="text-sm font-semibold text-white">{d.label}</span>
              </span>
              <span className="text-[10px] text-gray-500 leading-tight">{d.note}</span>
            </button>
          );
        })}
      </div>

      {/* Honest timing callout */}
      <div className="flex items-start gap-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-3 py-2.5 mb-4">
        <Clock className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-[11px] text-[#F59E0B]/90 leading-relaxed">
          The canonical withdrawal to Ethereum settles after a{' '}
          <span className="font-bold">{CANONICAL_WITHDRAWAL_CHALLENGE_DAYS}-day</span>{' '}
          challenge period (an Arbitrum fraud-proof rule — not instant). Fast
          third-party bridges below settle in minutes for a fee.
        </p>
      </div>

      {/* Steps */}
      <ol className="space-y-3 mb-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span className="w-5 h-5 shrink-0 rounded-full bg-[#0066FF]/15 border border-[#0066FF]/40 text-[10px] font-bold text-[#0066FF] flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">{s.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Primary CTA — official canonical bridge */}
      <a
        href={ROBINHOOD_BRIDGE.canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="nl-button w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
      >
        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
        Open official bridge
        <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
      </a>

      {/* Fast-bridge alternatives */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3.5 h-3.5 text-[#0066FF]" aria-hidden="true" />
          <span className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
            Faster (third-party)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROBINHOOD_FAST_BRIDGES.map((b) => (
            <a
              key={b.name}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${b.name} — ${b.eta}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#060A12] border border-white/[0.06] text-xs font-semibold text-gray-300 hover:border-[#0066FF]/40 hover:text-white transition-all"
            >
              {b.name}
              <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      {/* Post-bridge one-tap: switch the Swap chain and trade */}
      <div className="mt-5 pt-4 border-t border-white/[0.06]">
        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
          Already bridged your ETH?
        </p>
        <button
          type="button"
          onClick={() => onSwapOnChain(destination.chainId)}
          className="nl-button--ghost w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
        >
          Swap on {destination.label}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Secondary: wallet + docs */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenWallet}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
          Open Wallet
        </button>
        <a
          href={ROBINHOOD_BRIDGE.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          How bridging works
          <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
