'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { SwapResult } from '@/lib/market/types';
import { formatPrice } from '@/lib/market/formatters';
import { TokenLogo } from './TokenLogo';
import { useWallet } from '@/lib/hooks/useWallet';

interface BuySellModalProps {
  tokenId: string;
  symbol: string;
  name: string;
  logo?: string;
  priceUSD: number;
  chain: string;
  tokenAddress?: string;
  userId?: string;
  onClose: () => void;
}

const QUICK_AMOUNTS = ['25', '50', '100', 'MAX'];

export function BuySellModal({ symbol, name, logo, priceUSD, chain, tokenAddress, userId, onClose }: BuySellModalProps) {
  const { address: walletAddr } = useWallet();
  const [mode, setMode] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState('');

  const connectedAddress = walletAddr || (typeof window !== 'undefined' ? localStorage.getItem('steinz_active_wallet_address') : null);

  // Fetch wallet balance on mount
  useEffect(() => {
    if (!connectedAddress) return;
    fetch(`/api/wallet-intelligence?address=${connectedAddress}`)
      .then(r => r.json())
      .then(data => {
        if (data.holdings) {
          const sellToken = mode === 'BUY' ? 'USDC' : symbol;
          const holding = data.holdings.find((h: { symbol?: string }) =>
            h.symbol?.toUpperCase() === sellToken.toUpperCase()
          );
          if (holding) setWalletBalance(parseFloat(holding.balance) || 0);
        }
      })
      .catch(() => {});
  }, [connectedAddress, mode, symbol]);

  const amountNum = parseFloat(amount) || 0;
  const tokenAmount = priceUSD > 0 ? amountNum / priceUSD : 0;
  const fee = amountNum * 0.004; // 0.4% platform fee

  const handleExecute = async () => {
    if (!amountNum) return;
    setBalanceError('');

    if (!connectedAddress) {
      setResult({ success: false, error: 'Connect a wallet first to trade.' });
      return;
    }

    // Balance check for buy mode (checking USDC balance)
    if (walletBalance !== null && mode === 'BUY' && amountNum > walletBalance) {
      setBalanceError(`Insufficient balance. You have ${walletBalance.toFixed(4)} ${mode === 'BUY' ? 'USDC' : symbol}.`);
      return;
    }

    setExecuting(true);
    try {
      const res = await fetch('/api/market/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain,
          tokenIn: mode === 'BUY' ? 'USDC' : (tokenAddress ?? symbol),
          tokenOut: mode === 'BUY' ? (tokenAddress ?? symbol) : 'USDC',
          amountIn: amount,
          amountInUSD: amountNum,
          slippage,
          walletAddress: connectedAddress,
          userId,
        }),
      });
      const data = await res.json() as SwapResult & { blocked?: boolean; blockReason?: string };
      if (data.blocked) {
        setResult({ success: false, blocked: true, blockReason: data.blockReason });
      } else if (data.error) {
        setResult({ success: false, error: data.error });
      } else {
        setResult({ success: true, txHash: data.txHash, amountOut: tokenAmount.toFixed(4) });
        // Dispatch balance refresh
        window.dispatchEvent(new Event('steinz:balance-changed'));
      }
    } catch (e: unknown) {
      setResult({ success: false, error: e instanceof Error ? e.message : 'Trade failed. Please try again.' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0D1117] border border-[#1E2433] rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TokenLogo src={logo} symbol={symbol} size={28} />
            <span className="text-white font-semibold">{name}</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        {result ? (
          <div className="text-center py-4">
            {result.success ? (
              <>
                <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                <p className="text-white font-semibold">{mode === 'BUY' ? 'Buy' : 'Sell'} Executed</p>
                <p className="text-gray-400 text-sm mt-1">{mode === 'BUY' ? `Bought ${result.amountOut} ${symbol}` : `Sold for $${amount}`}</p>
              </>
            ) : (
              <>
                <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
                <p className="text-white font-semibold">Trade Failed</p>
                <p className="text-gray-400 text-sm mt-1">{result.blockReason ?? result.error}</p>
              </>
            )}
            <button onClick={onClose} className="mt-4 w-full py-2.5 bg-[#141824] border border-[#1E2433] rounded-lg text-white text-sm">Close</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              {(['BUY', 'SELL'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    m === 'BUY' ? (mode === 'BUY' ? 'bg-[#0A1EFF] text-white' : 'bg-[#141824] text-gray-400 border border-[#1E2433]')
                               : (mode === 'SELL' ? 'bg-red-600 text-white' : 'bg-[#141824] text-gray-400 border border-[#1E2433]')
                  }`}>{m}</button>
              ))}
            </div>

            <div className="text-center mb-3">
              <span className="text-3xl font-bold text-white font-mono">${amountNum.toFixed(2)}</span>
            </div>

            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              className="w-full bg-[#141824] border border-[#1E2433] rounded-lg px-3 py-2.5 text-white font-mono text-sm mb-2 focus:outline-none focus:border-[#0A1EFF]" />

            <div className="flex gap-2 mb-4">
              {QUICK_AMOUNTS.map((v) => (
                <button key={v} onClick={() => setAmount(v === 'MAX' ? (walletBalance?.toString() || '0') : v)}
                  className="flex-1 text-xs py-1.5 bg-[#141824] border border-[#1E2433] rounded text-gray-400 hover:text-white hover:border-[#0A1EFF]/50 transition-colors">
                  {v === 'MAX' ? 'MAX' : `$${v}`}
                </button>
              ))}
            </div>

            {!connectedAddress && (
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
                <span className="text-xs text-yellow-400">Connect a wallet to trade</span>
              </div>
            )}

            {balanceError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <span className="text-xs text-red-400">{balanceError}</span>
              </div>
            )}

            {amountNum > 0 && (
              <div className="bg-[#141824] rounded-lg p-3 text-sm mb-4 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">You&apos;ll receive</span>
                  <span className="text-white font-mono">{tokenAmount.toFixed(4)} {symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Price</span>
                  <span className="text-white font-mono">{formatPrice(priceUSD)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fee (0.4%)</span>
                  <span className="text-white font-mono">${fee.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Slippage</span>
                  <span className="text-white">{slippage}%</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 text-xs mb-3">
              {[0.1, 0.5, 1.0, 2.0].map((s) => (
                <button key={s} onClick={() => setSlippage(s)}
                  className={`flex-1 py-1 rounded border transition-colors ${slippage === s ? 'border-[#0A1EFF] text-[#0A1EFF]' : 'border-[#1E2433] text-gray-500'}`}>
                  {s}%
                </button>
              ))}
            </div>

            <button onClick={handleExecute} disabled={!amountNum || executing}
              className={`w-full py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 ${
                mode === 'BUY' ? 'bg-[#0A1EFF] hover:bg-[#0916CC] text-white' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}>
              {executing ? 'Confirming...' : `${mode} ${symbol}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
