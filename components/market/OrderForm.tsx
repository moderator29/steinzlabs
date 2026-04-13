'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader2, ShieldAlert } from 'lucide-react';
import { useSwapExecution } from '@/lib/hooks/useSwapExecution';

interface OrderFormProps {
  tokenSymbol: string;
  tokenAddress: string;
  chain: string;
  priceUsd: number;
  userAddress?: string;
}

type Side = 'buy' | 'sell';

const SLIPPAGE_OPTIONS: { label: string; bps: number }[] = [
  { label: '0.1%', bps: 10 },
  { label: '0.3%', bps: 30 },
  { label: '0.5%', bps: 50 },
  { label: '1%', bps: 100 },
];

// USDC/native token addresses per chain (simplified stables for input)
const NATIVE_INPUT: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  bsc: '0x55d398326f99059fF775485246999027B3197955',
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

function getMevColor(level?: string) {
  if (level === 'critical') return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' };
  if (level === 'high') return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' };
  if (level === 'medium') return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' };
  return { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' };
}

export function OrderForm({
  tokenSymbol,
  tokenAddress,
  chain,
  priceUsd,
  userAddress,
}: OrderFormProps) {
  const [side, setSide] = useState<Side>('buy');
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(30);
  const [quoteTimer, setQuoteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { quote, loading, executing, error, txHash, mevRisk, getQuote, executeSwap, reset } =
    useSwapExecution();

  const parsedAmount = parseFloat(amount) || 0;
  const usdValue = parsedAmount * priceUsd;

  const inputToken = side === 'buy' ? (NATIVE_INPUT[chain] ?? '') : tokenAddress;
  const outputToken = side === 'buy' ? tokenAddress : (NATIVE_INPUT[chain] ?? '');

  // Debounced quote fetch on amount change
  useEffect(() => {
    if (!userAddress || parsedAmount <= 0) return;

    if (quoteTimer) clearTimeout(quoteTimer);
    const t = setTimeout(() => {
      getQuote({
        chain,
        inputToken,
        outputToken,
        inputAmount: amount,
        inputDecimals: 6,
        userAddress,
        slippageBps,
      });
    }, 600);
    setQuoteTimer(t);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, slippageBps, side, userAddress]);

  const handleSubmit = async () => {
    if (!userAddress || parsedAmount <= 0) return;
    await executeSwap({
      chain,
      inputToken,
      outputToken,
      inputAmount: amount,
      inputDecimals: 6,
      userAddress,
      slippageBps,
    });
  };

  const handleAmountChange = (v: string) => {
    reset();
    setAmount(v.replace(/[^0-9.]/g, ''));
  };

  const mevColors = getMevColor(mevRisk?.level);

  if (!userAddress) {
    return (
      <div className="bg-[#111827] border border-[#1E2433] rounded-xl p-5 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <ShieldAlert size={28} className="text-gray-600" />
        <p className="text-gray-400 text-sm font-medium text-center">Connect a wallet to trade</p>
        <p className="text-gray-600 text-xs text-center">Connect your wallet to place buy or sell orders.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] border border-[#1E2433] rounded-xl p-5 space-y-4">
      {/* Buy / Sell Tabs */}
      <div className="flex rounded-lg overflow-hidden border border-[#1E2433]">
        {(['buy', 'sell'] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => { setSide(s); reset(); setAmount(''); }}
            className={`flex-1 py-2 text-sm font-semibold capitalize transition-colors ${
              side === s
                ? s === 'buy'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
                : 'bg-transparent text-gray-500 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Amount Input */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 font-medium">
          Amount ({side === 'buy' ? 'USD' : tokenSymbol.toUpperCase()})
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#0A1EFF]/50 transition-colors pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs font-medium">
            {side === 'buy' ? 'USD' : tokenSymbol.toUpperCase()}
          </span>
        </div>
        {parsedAmount > 0 && (
          <p className="text-xs text-gray-600 mt-1">
            {side === 'buy'
              ? `≈ ${(parsedAmount / priceUsd).toFixed(6)} ${tokenSymbol.toUpperCase()}`
              : `≈ $${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
      </div>

      {/* Slippage */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 font-medium">Slippage Tolerance</label>
        <div className="flex gap-1.5">
          {SLIPPAGE_OPTIONS.map((opt) => (
            <button
              key={opt.bps}
              onClick={() => setSlippageBps(opt.bps)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                slippageBps === opt.bps
                  ? 'bg-[#0A1EFF] border-[#0A1EFF] text-white'
                  : 'bg-transparent border-[#1E2433] text-gray-500 hover:text-white hover:border-[#2E3443]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* MEV Risk Badge */}
      {mevRisk && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border ${mevColors.bg} ${mevColors.border}`}>
          <AlertTriangle size={13} className={`${mevColors.text} mt-0.5 flex-shrink-0`} />
          <div>
            <span className={`text-xs font-semibold uppercase ${mevColors.text}`}>
              MEV Risk: {mevRisk.level}
            </span>
            {mevRisk.warning && (
              <p className="text-xs text-gray-500 mt-0.5">{mevRisk.warning}</p>
            )}
          </div>
        </div>
      )}

      {/* Quote Details */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 size={12} className="animate-spin" />
          Fetching quote...
        </div>
      )}

      {quote && !loading && (
        <div className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">You receive</span>
            <span className="text-white font-mono font-medium">{parseFloat(quote.amountOut).toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Price Impact</span>
            <span className={`font-mono font-medium ${quote.priceImpact > 2 ? 'text-red-400' : 'text-gray-300'}`}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Network Fee</span>
            <span className="text-gray-300 font-mono">${quote.feeUSD.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Route</span>
            <span className="text-gray-400">{quote.route}</span>
          </div>
          <div className="pt-1.5 border-t border-[#1E2433] flex justify-between text-xs">
            <span className="text-gray-500 font-medium">Total Cost</span>
            <span className="text-white font-mono font-semibold">
              ${(usdValue + quote.feeUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
          <AlertTriangle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* TX Hash Success */}
      {txHash && (
        <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2.5">
          <CheckCircle size={13} className="text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-green-400 font-medium">Transaction submitted</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">{txHash}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={executing || loading || parsedAmount <= 0}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
          side === 'buy'
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-red-600 hover:bg-red-500 text-white'
        }`}
      >
        {executing ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Executing...
          </>
        ) : (
          `${side === 'buy' ? 'Buy' : 'Sell'} ${tokenSymbol.toUpperCase()}`
        )}
      </button>
    </div>
  );
}
