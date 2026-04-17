'use client';

import { useState } from 'react';
import { ArrowRight, AlertTriangle, Loader2, ExternalLink, CheckCircle } from 'lucide-react';

export interface SwapCardData {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  priceImpact: number;
  platformFee: string;
  chain: string;
  quoteData?: Record<string, unknown>;
}

interface Props {
  swap: SwapCardData;
  walletAddress?: string;
}

function getPriceImpactColor(impact: number): string {
  if (impact < 1) return 'text-green-400';
  if (impact < 5) return 'text-yellow-400';
  if (impact < 15) return 'text-orange-400';
  return 'text-red-400';
}

function getPriceImpactBg(impact: number): string {
  if (impact < 1) return 'bg-green-400/10 border-green-400/20';
  if (impact < 5) return 'bg-yellow-400/10 border-yellow-400/20';
  if (impact < 15) return 'bg-orange-400/10 border-orange-400/20';
  return 'bg-red-400/10 border-red-400/20';
}

export function SwapCard({ swap, walletAddress }: Props) {
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const isHighImpact = swap.priceImpact > 30;
  const impactColor = getPriceImpactColor(swap.priceImpact);
  const impactBg = getPriceImpactBg(swap.priceImpact);

  const handleExecute = async () => {
    if (isHighImpact) {
      setError('Price impact too high (>30%). Swap blocked for your protection.');
      return;
    }
    if (!walletAddress) {
      setError('Connect a wallet to execute this swap.');
      return;
    }

    setExecuting(true);
    setError(null);
    try {
      const res = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: swap.chain,
          fromToken: swap.fromToken,
          toToken: swap.toToken,
          fromAmount: swap.fromAmount,
          walletAddress,
          quoteData: swap.quoteData,
        }),
      });
      const data = await res.json() as { txHash?: string; error?: string };
      if (data.error) {
        setError(data.error);
      } else if (data.txHash) {
        setTxHash(data.txHash);
        setConfirmed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed. Please try again.');
      console.error('[SwapCard] Execute error:', err instanceof Error ? err.message : err);
    } finally {
      setExecuting(false);
    }
  };

  const explorerUrl = swap.chain === 'solana'
    ? `https://solscan.io/tx/${txHash}`
    : `https://etherscan.io/tx/${txHash}`;

  if (confirmed && txHash) {
    return (
      <div className="bg-[#141824] border border-green-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={16} className="text-green-400" />
          <span className="text-green-400 font-semibold text-sm">Swap Executed</span>
        </div>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#0A1EFF] hover:underline"
        >
          View on Explorer <ExternalLink size={10} />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Swap Preview</div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-[#0D1117] rounded-lg px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">From</div>
          <div className="text-white font-bold text-sm">{swap.fromAmount}</div>
          <div className="text-gray-400 text-xs">{swap.fromToken}</div>
        </div>
        <ArrowRight size={16} className="text-[#0A1EFF] shrink-0" />
        <div className="flex-1 bg-[#0D1117] rounded-lg px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">To</div>
          <div className="text-white font-bold text-sm">{swap.toAmount}</div>
          <div className="text-gray-400 text-xs">{swap.toToken}</div>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Rate</span>
          <span className="text-gray-300 font-mono">{swap.rate}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Price Impact</span>
          <span className={`font-semibold ${impactColor}`}>{swap.priceImpact.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Platform Fee</span>
          <span className="text-gray-300">{swap.platformFee}</span>
        </div>
      </div>

      {swap.priceImpact >= 5 && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border mb-3 ${impactBg}`}>
          <AlertTriangle size={12} className={impactColor} />
          <span className={`text-xs ${impactColor}`}>
            {isHighImpact ? 'Price impact too high. Swap blocked.' : `High price impact: ${swap.priceImpact.toFixed(1)}%`}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle size={12} className="text-red-400" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={executing || isHighImpact}
        className="w-full py-2.5 bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {executing ? <><Loader2 size={14} className="animate-spin" /> Executing...</> : 'Execute Swap'}
      </button>
    </div>
  );
}
