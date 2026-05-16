'use client';

/**
 * Batch 7 / checkprice-style — Inline Buy/Sell form. Lives in the
 * right rail of the coin detail page on desktop, and in a collapsible
 * sheet on mobile.
 *
 * Audit branch fix/market-trading-panel-correctness:
 *   - "Available to buy" was reading balance.totalUsd (the user's ENTIRE
 *     portfolio across every chain). Press MAX → swap fails on-chain →
 *     user loses gas. Now reads chain-scoped stablecoin (USDC + USDT)
 *     balance only, so MAX matches what 0x can actually execute.
 *   - Slippage was hardcoded to 0.5% with NO UI to change it. Now a
 *     pill row with 0.1 / 0.5 / 1 / 3 / Custom presets, persisted per
 *     chain in localStorage so a Solana 1% setting doesn't bleed into
 *     Ethereum.
 *   - Chain-mismatch guard: if the connected wallet is sitting on
 *     Ethereum but the URL is /market/base/..., the form was firing
 *     swaps on the wrong chain. Now surfaces a banner + disables the
 *     execute button until the wallet matches.
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { formatPrice } from '@/lib/market/formatters';
import { Settings, AlertTriangle } from 'lucide-react';
import FirstTradeRiskModal, { hasAcknowledgedTradeRisk } from '@/components/legal/FirstTradeRiskModal';

const QUICK = [0, 25, 50, 75, 100];
const SLIPPAGE_PRESETS = ['0.1', '0.5', '1', '3'];

interface Props {
  symbol: string;
  chain: string;
  tokenAddress: string;
  priceUSD: number;
  userId?: string;
}

function readSlippage(chain: string): string {
  if (typeof window === 'undefined') return '0.5';
  try {
    const v = localStorage.getItem(`steinz_slippage_${chain}`);
    return v && /^\d+(\.\d+)?$/.test(v) ? v : '0.5';
  } catch {
    return '0.5';
  }
}

function writeSlippage(chain: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`steinz_slippage_${chain}`, value);
  } catch {
    /* storage disabled — non-fatal */
  }
}

function readMevProtect(chain: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`steinz_mev_protect_${chain}`) === '1';
  } catch {
    return false;
  }
}

function writeMevProtect(chain: string, on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`steinz_mev_protect_${chain}`, on ? '1' : '0');
  } catch {
    /* storage disabled — non-fatal */
  }
}

export default function InlineBuySellForm({ symbol, chain, tokenAddress, priceUSD, userId }: Props) {
  const { address: walletAddr, balance, provider, walletPlatformChain } = useWallet();
  const [mode, setMode] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [executing, setExecuting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [slippage, setSlippage] = useState<string>(() => readSlippage(chain));
  const [showSlippageInput, setShowSlippageInput] = useState(false);
  const [mevProtect, setMevProtect] = useState<boolean>(() => readMevProtect(chain));

  // Audit M4 #2 — three-tier chain mismatch guard. The platform was
  // letting users sign trades on the wrong network silently:
  //   1. Cross-family — Phantom user on /market/ethereum/... or
  //      MetaMask user on /market/solana/.... Cross-family signs
  //      either fail noisily or, worse, sign garbage.
  //   2. Within-EVM — wallet on Ethereum but page on Base. The
  //      transaction broadcasts on the wallet's chain regardless of
  //      what URL the user is looking at, so they swap on the wrong
  //      DEX. This is the silent loss-of-funds vector M4 flagged.
  //   3. Match — green. Trade can proceed.
  // Industry parity: Uniswap blocks the swap button and shows a
  // "Switch network" CTA inline.
  const isPageSolana = chain === 'solana';
  const crossFamilyMismatch = !!walletAddr && (
    (provider === 'phantom' && !isPageSolana) ||
    (provider === 'metamask' && isPageSolana)
  );
  const withinEvmMismatch = !!walletAddr
    && !crossFamilyMismatch
    && !isPageSolana
    && walletPlatformChain !== null
    && walletPlatformChain !== chain;
  const chainMismatch = crossFamilyMismatch || withinEvmMismatch;

  // Quick-Sell from PortfolioHistoryPanel emits this event — if the
  // symbol matches, flip to SELL mode and pre-fill with full position.
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { symbol?: string } | undefined;
      if (detail?.symbol && detail.symbol.toUpperCase() === symbol.toUpperCase()) {
        setMode('SELL');
      }
    };
    window.addEventListener('market:quick-sell', handler);
    return () => window.removeEventListener('market:quick-sell', handler);
  }, [symbol]);

  // Re-read slippage when chain changes — Solana setting shouldn't
  // bleed into Ethereum.
  useEffect(() => {
    setSlippage(readSlippage(chain));
    setMevProtect(readMevProtect(chain));
  }, [chain]);

  const onMevToggle = (next: boolean) => {
    setMevProtect(next);
    writeMevProtect(chain, next);
  };

  // Chain-scoped stablecoin available for BUY. We only count USDC + USDT
  // because those are what the 0x router actually fills against. Native
  // gas (ETH/BNB/MATIC/AVAX) is intentionally excluded — you can't pay
  // for a token AND its gas with the same wei. Industry parity with
  // Uniswap/MEVX which both quote against the active stablecoin.
  // SELL mode reads the balance of the token being sold.
  const chainStablecoinUsd = (balance.tokens['USDC'] ?? 0) + (balance.tokens['USDT'] ?? 0);
  const tokenHeld = balance.tokens[symbol.toUpperCase()] ?? 0;
  const available = mode === 'BUY' ? chainStablecoinUsd : tokenHeld * priceUSD;
  const amountNum = parseFloat(amount) || 0;
  const estTokens = priceUSD > 0 ? amountNum / priceUSD : 0;

  const mismatchTarget = isPageSolana ? 'a Solana wallet (Phantom)' : 'an EVM wallet (MetaMask / Reown)';

  const onQuick = (pct: number) => {
    if (pct === 0) { setAmount(''); return; }
    setAmount(((available * pct) / 100).toFixed(2));
  };

  const onSlippagePreset = (v: string) => {
    setSlippage(v);
    writeSlippage(chain, v);
    setShowSlippageInput(false);
  };

  const onSlippageCustom = (v: string) => {
    if (v && /^\d+(\.\d+)?$/.test(v)) {
      setSlippage(v);
      writeSlippage(chain, v);
    }
  };

  // Compliance MVB — gate the FIRST trade on an explicit risk
  // acknowledgment. Subsequent trades skip the modal because the
  // acknowledgment is persisted client-side.
  // See components/legal/FirstTradeRiskModal.tsx.
  const [showRiskModal, setShowRiskModal] = useState(false);

  const submit = async () => {
    if (!walletAddr) { setStatus({ kind: 'err', msg: 'Connect a wallet first' }); return; }
    if (chainMismatch) {
      setStatus({ kind: 'err', msg: `Switch your wallet to ${chain} to execute this trade.` });
      return;
    }
    if (amountNum <= 0) return;
    if (amountNum > available) { setStatus({ kind: 'err', msg: 'Insufficient balance on this chain' }); return; }
    const slipNum = parseFloat(slippage);
    if (!Number.isFinite(slipNum) || slipNum <= 0 || slipNum > 50) {
      setStatus({ kind: 'err', msg: 'Slippage must be between 0 and 50%' });
      return;
    }
    if (!hasAcknowledgedTradeRisk()) {
      setShowRiskModal(true);
      return;
    }
    await execute(slipNum);
  };

  const execute = async (slipNum: number) => {
    setExecuting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/market/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain,
          tokenIn: mode === 'BUY' ? 'USDC' : tokenAddress,
          tokenOut: mode === 'BUY' ? tokenAddress : 'USDC',
          amountIn: amount,
          amountInUSD: amountNum,
          slippage: slipNum,
          mevProtect,
          walletAddress: walletAddr,
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus({ kind: 'ok', msg: `${mode === 'BUY' ? 'Bought' : 'Sold'} ${estTokens.toFixed(4)} ${symbol}` });
      window.dispatchEvent(new Event('steinz:balance-changed'));
      setAmount('');
    } catch (e: unknown) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Trade failed' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-xs">
      {/* Buy/Sell tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/60 rounded-lg mb-3">
        <button
          type="button"
          onClick={() => { setMode('BUY'); setStatus(null); }}
          className={`py-1.5 rounded-md font-semibold transition-colors ${mode === 'BUY' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => { setMode('SELL'); setStatus(null); }}
          className={`py-1.5 rounded-md font-semibold transition-colors ${mode === 'SELL' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Sell
        </button>
      </div>

      {/* Chain-family mismatch banner — Industry parity with Uniswap
          which surfaces "Switch network" before letting the user sign.
          Cross-family signs (EVM tx on Phantom / SOL tx on MetaMask)
          are silent-fail vectors so we hard-block them here. */}
      {chainMismatch && (
        <div className="flex items-start gap-2 mb-3 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            Connected via <span className="font-semibold">{provider}</span>; this page is{' '}
            <span className="font-semibold uppercase">{chain}</span>. Connect {mismatchTarget} to trade.
          </span>
        </div>
      )}

      {/* Amount */}
      <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2 mb-2">
        <div className="flex items-baseline gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent outline-none text-lg font-mono tabular-nums"
          />
          <span className="text-[10px] uppercase text-slate-500 font-semibold">USD</span>
        </div>
        {amountNum > 0 && priceUSD > 0 && (
          <div className="text-[10px] text-slate-500 mt-1">≈ {estTokens.toFixed(6)} {symbol}</div>
        )}
      </div>

      {/* Quick amount buttons */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {QUICK.map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => onQuick(pct)}
            className="py-1.5 rounded bg-slate-900/60 hover:bg-slate-800 text-[10px] text-slate-300 font-semibold"
          >
            {pct === 100 ? 'MAX' : `${pct}%`}
          </button>
        ))}
      </div>

      {/* Slippage row — clickable presets + custom input. Replaces the
          static "Auto" label that gave the user no control. */}
      <div className="mb-3 text-[11px]">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="inline-flex items-center gap-1">
            <Settings size={11} /> Slippage tolerance
          </span>
          <span className="text-slate-200 font-mono">{slippage}%</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {SLIPPAGE_PRESETS.map((preset) => {
            const active = slippage === preset && !showSlippageInput;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onSlippagePreset(preset)}
                className={`py-1 rounded text-[10px] font-semibold transition-colors ${
                  active
                    ? 'bg-[#0A1EFF]/20 text-[#8FA3FF] border border-[#0A1EFF]/40'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-transparent'
                }`}
                aria-pressed={active}
              >
                {preset}%
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowSlippageInput((v) => !v)}
            className={`py-1 rounded text-[10px] font-semibold transition-colors ${
              showSlippageInput
                ? 'bg-[#0A1EFF]/20 text-[#8FA3FF] border border-[#0A1EFF]/40'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-transparent'
            }`}
          >
            Custom
          </button>
        </div>
        {showSlippageInput && (
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            max="50"
            step="0.1"
            defaultValue={slippage}
            onBlur={(e) => onSlippageCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="Custom %"
            className="mt-1.5 w-full px-2 py-1 rounded bg-slate-900/60 border border-slate-800 text-[11px] focus:outline-none focus:border-[#0A1EFF]/50"
            autoFocus
          />
        )}
      </div>

      {/* MEV protect toggle — Industry parity with MEVX / Uniswap's
          "Use private RPC" switch. Routes the tx through Flashbots /
          Jito (per chain) so sandwich/frontrun bots can't see it in
          the public mempool. Server-side trade-execute route reads
          mevProtect and routes accordingly. Persisted per chain. */}
      <div className="mb-3 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">MEV protection</span>
        <button
          type="button"
          role="switch"
          aria-checked={mevProtect}
          onClick={() => onMevToggle(!mevProtect)}
          className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${
            mevProtect
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <span
            aria-hidden
            className={`inline-block w-2 h-2 rounded-full ${mevProtect ? 'bg-emerald-400' : 'bg-slate-600'}`}
          />
          {mevProtect ? 'On (private mempool)' : 'Off'}
        </button>
      </div>

      {/* Routing label — actual route preview lives on the swap page;
          this stays a simple "Auto via 0x" label since the inline form
          doesn't show the multi-hop breakdown. */}
      <div className="flex justify-between text-[11px] text-slate-400 mb-3">
        <span>Routing</span><span className="text-slate-200">Auto via 0x</span>
      </div>

      {/* Primary action */}
      <button
        type="button"
        onClick={submit}
        disabled={executing || !amount || amountNum <= 0 || chainMismatch}
        className={`w-full py-2.5 rounded-lg font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          mode === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-500 hover:bg-red-400'
        }`}
      >
        {executing ? 'Executing…' : `${mode === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`}
      </button>

      {status && (
        <div className={`mt-2 text-[11px] text-center ${status.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
          {status.msg}
        </div>
      )}

      {/* Balance + deposit/withdraw links */}
      <div className="mt-3 pt-3 border-t border-slate-800/70 text-[11px]">
        <div className="flex justify-between text-slate-400 mb-2">
          <span>
            Available to {mode.toLowerCase()}
            {mode === 'BUY' && (
              <span className="text-[9px] uppercase ml-1 text-slate-600">on {chain}</span>
            )}
          </span>
          <span className="text-slate-200 font-mono">{formatPrice(available)}</span>
        </div>
        {/*
          Bug §4 — Deposit + Withdraw used to hard-code
          /dashboard/wallet-page?action=receive (no chain context). Clicking
          Deposit on a BTC, ETH, or any non-Solana token would always land
          the user on the Solana receive screen because the wallet page
          defaults activeChain to SOLANA_CHAIN. We now propagate the
          token's chain (and symbol for the warning copy) so the wallet
          opens directly on the correct chain.
        */}
        <div className="flex justify-between">
          <a
            href={`/dashboard/wallet-page?action=receive&chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(symbol)}`}
            className="text-[#6F7EFF] hover:text-white"
          >
            Deposit
          </a>
          <a
            href={`/dashboard/wallet-page?action=send&chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(symbol)}`}
            className="text-slate-400 hover:text-white"
          >
            Withdraw
          </a>
        </div>
      </div>

      <FirstTradeRiskModal
        open={showRiskModal}
        onCancel={() => setShowRiskModal(false)}
        onConfirm={() => {
          setShowRiskModal(false);
          // hasAcknowledgedTradeRisk() is now true; submit() will pass
          // straight through to execute() on the immediate retry.
          const slipNum = parseFloat(slippage);
          if (Number.isFinite(slipNum) && slipNum > 0) void execute(slipNum);
        }}
      />
    </div>
  );
}
