'use client';

/**
 * Batch 7 / checkprice-style — Inline Buy/Sell form. Lives in the
 * right rail of the coin detail page on desktop, and in a collapsible
 * sheet on mobile. Replaces the old modal flow.
 *
 * Mirrors checkprice layout: BUY / SELL pill tabs at top, USD amount
 * input, 0/25/50/75/MAX quick buttons, slippage + routing "Auto" labels,
 * big primary action button, Available-to-Trade balance, Deposit +
 * Withdraw text links.
 */

import { useState } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { formatPrice } from '@/lib/market/formatters';

const QUICK = [0, 25, 50, 75, 100];

interface Props {
  symbol: string;
  chain: string;
  tokenAddress: string;
  priceUSD: number;
  userId?: string;
}

export default function InlineBuySellForm({ symbol, chain, tokenAddress, priceUSD, userId }: Props) {
  const { address: walletAddr, balance } = useWallet();
  const [mode, setMode] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [executing, setExecuting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const available = mode === 'BUY' ? balance.totalUsd : (balance.tokens[symbol.toUpperCase()] ?? 0) * priceUSD;
  const amountNum = parseFloat(amount) || 0;
  const estTokens = priceUSD > 0 ? amountNum / priceUSD : 0;

  const onQuick = (pct: number) => {
    if (pct === 0) { setAmount(''); return; }
    setAmount(((available * pct) / 100).toFixed(2));
  };

  const submit = async () => {
    if (!walletAddr) { setStatus({ kind: 'err', msg: 'Connect a wallet first' }); return; }
    if (amountNum <= 0) return;
    if (amountNum > available) { setStatus({ kind: 'err', msg: 'Insufficient balance' }); return; }
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
          slippage: 0.5,
          walletAddress: walletAddr,
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus({ kind: 'ok', msg: `${mode === 'BUY' ? 'Bought' : 'Sold'} ${estTokens.toFixed(4)} ${symbol}` });
      window.dispatchEvent(new Event('steinz:balance-changed'));
      setAmount('');
    } catch (e: any) {
      setStatus({ kind: 'err', msg: e?.message || 'Trade failed' });
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

      {/* Slippage / Routing labels */}
      <div className="space-y-1.5 mb-3 text-[11px]">
        <div className="flex justify-between text-slate-400">
          <span>Slippage</span><span className="text-slate-200">Auto</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Routing</span><span className="text-slate-200">Auto</span>
        </div>
      </div>

      {/* Primary action */}
      <button
        type="button"
        onClick={submit}
        disabled={executing || !amount || amountNum <= 0}
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
          <span>Available to {mode.toLowerCase()}</span>
          <span className="text-slate-200 font-mono">{formatPrice(available)}</span>
        </div>
        <div className="flex justify-between">
          <a href="/dashboard/wallet-page?action=receive" className="text-[#6F7EFF] hover:text-white">Deposit</a>
          <a href="/dashboard/wallet-page?action=send" className="text-slate-400 hover:text-white">Withdraw</a>
        </div>
      </div>
    </div>
  );
}
