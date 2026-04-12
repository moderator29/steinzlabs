'use client';

import { useState } from 'react';
import { ArrowDownUp, Zap, Shield } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { ShadowGuardianScan } from '@/components/security/ShadowGuardianScan';

export default function SwapPage() {
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [chain, setChain] = useState('solana');
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState('');

  const getQuote = async () => {
    if (!tokenIn || !tokenOut || !amount) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/trade/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn,
          tokenOut,
          amountIn: amount,
          chain,
          slippage: parseFloat(slippage),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get quote');
      setQuote(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const swap = (tokenA: string, tokenB: string) => {
    setTokenIn(tokenB);
    setTokenOut(tokenA);
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-lg mx-auto">
        <PageHeader
          title="Swap"
          description="Instant multi-chain token swaps powered by Jupiter & 1inch"
        />

        <div className="bg-[#141824] rounded-2xl p-6 border border-[#1E2433]">
          {/* Chain Selector */}
          <div className="flex gap-2 mb-6">
            {['solana', 'ethereum', 'base', 'bsc'].map((c) => (
              <button
                key={c}
                onClick={() => setChain(c)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  chain === c
                    ? 'bg-[#0A1EFF] text-white'
                    : 'bg-[#0A0E1A] text-gray-400 border border-[#1E2433] hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Token In */}
          <div className="bg-[#0A0E1A] rounded-xl p-4 mb-2 border border-[#1E2433]">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">You Pay</label>
            </div>
            <input
              type="text"
              value={tokenIn}
              onChange={(e) => setTokenIn(e.target.value)}
              placeholder="Token address or symbol"
              className="w-full bg-transparent text-white text-lg placeholder-gray-600 focus:outline-none"
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-white text-2xl font-bold placeholder-gray-600 focus:outline-none mt-2"
            />
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center my-2">
            <button
              onClick={() => swap(tokenIn, tokenOut)}
              className="bg-[#141824] border border-[#1E2433] hover:border-[#0A1EFF] p-2 rounded-lg transition-colors"
            >
              <ArrowDownUp size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Token Out */}
          <div className="bg-[#0A0E1A] rounded-xl p-4 mt-2 mb-4 border border-[#1E2433]">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">You Receive</label>
            </div>
            <input
              type="text"
              value={tokenOut}
              onChange={(e) => setTokenOut(e.target.value)}
              placeholder="Token address or symbol"
              className="w-full bg-transparent text-white text-lg placeholder-gray-600 focus:outline-none"
            />
            <div className="text-2xl font-bold text-gray-600 mt-2">
              {quote?.amountOut || '—'}
            </div>
          </div>

          {/* Slippage */}
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-sm text-gray-400">Slippage</span>
            <div className="flex gap-2">
              {['0.5', '1', '3'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    slippage === s
                      ? 'bg-[#0A1EFF] text-white'
                      : 'bg-[#0A0E1A] text-gray-400 border border-[#1E2433]'
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>

          {/* Quote Info */}
          {quote && !quote.blocked && (
            <div className="bg-[#0A0E1A] rounded-lg p-3 mb-4 border border-[#1E2433] text-sm space-y-1">
              {quote.priceImpact !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Price Impact</span>
                  <span className={quote.priceImpact > 3 ? 'text-red-400' : 'text-green-400'}>
                    {quote.priceImpact?.toFixed(2)}%
                  </span>
                </div>
              )}
              {quote.fee && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Platform Fee</span>
                  <span className="text-white">{quote.fee}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Shadow Guardian Scan */}
          {tokenOut && (
            <div className="mb-4">
              <ShadowGuardianScan
                tokenAddress={tokenOut}
                onComplete={(result) => setScanResult(result)}
              />
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={getQuote}
            disabled={loading || !tokenIn || !tokenOut || !amount}
            className="w-full bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Zap size={20} />
            {loading ? 'Getting Quote...' : quote ? 'Confirm Swap' : 'Get Quote'}
          </button>

          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500">
            <Shield size={12} />
            Protected by Shadow Guardian
          </div>
        </div>
      </div>
    </div>
  );
}
