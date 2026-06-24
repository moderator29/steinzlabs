"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Loader2, X, ArrowRight, AlertTriangle } from "lucide-react";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

/**
 * In-wallet lite swap. Fetches a real quote from the platform's existing
 * /api/swap/quote (0x for EVM) or /api/swap/price (Jupiter for Solana) and
 * shows the trader output amount + price impact + venue. Confirm hands off
 * to the full /dashboard/swap page in a prefilled state so signing runs
 * through the proven relayer pipeline rather than re-implementing wallet
 * signing here.
 *
 * Replaces the "Coming Soon" stub the audit flagged. No mock numbers —
 * the quote box renders blank with a hint until the upstream returns.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  takerAddress?: string | null;
}

const USDC: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  eth: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

const USDC_DECIMALS = 6;

interface EvmQuote {
  buyAmount?: string;
  sellAmount?: string;
  estimatedPriceImpact?: string;
  route?: { fills?: Array<{ source?: string; proportionBps?: string }> };
  liquidityAvailable?: boolean;
}

interface SolQuote {
  outAmount?: string;
  inAmount?: string;
  priceImpactPct?: string;
  routePlan?: Array<{ swapInfo?: { label?: string } }>;
}

export function LiteSwapModal({ open, onClose, tokenAddress, tokenSymbol, chain, takerAddress }: Props) {
  const router = useRouter();
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const [amountUsd, setAmountUsd] = useState('25');
  const [slippageBps, setSlippageBps] = useState(100); // 1%
  const [quote, setQuote] = useState<EvmQuote | SolQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chainKey = chain.toLowerCase();
  const isSolana = chainKey === 'solana' || chainKey === 'sol';
  const sellToken = USDC[chainKey];

  const sellAmountRaw = useMemo(() => {
    const n = Number(amountUsd);
    if (!Number.isFinite(n) || n <= 0) return null;
    return BigInt(Math.floor(n * 10 ** USDC_DECIMALS)).toString();
  }, [amountUsd]);

  useEffect(() => {
    if (!open) return;
    if (!sellAmountRaw || !sellToken) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        if (isSolana) {
          const params = new URLSearchParams({
            inputMint: sellToken,
            outputMint: tokenAddress,
            amount: sellAmountRaw,
            slippageBps: String(slippageBps),
          });
          const res = await fetch(`/api/swap/price?${params}&chain=solana`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`Quote ${res.status}`);
          const data = (await res.json()) as SolQuote;
          if (!cancelled) setQuote(data);
        } else {
          const params = new URLSearchParams({
            chain,
            sellToken,
            buyToken: tokenAddress,
            sellAmount: sellAmountRaw,
            taker: takerAddress ?? '0x0000000000000000000000000000000000000000',
          });
          const res = await fetch(`/api/swap/quote?${params}`, { cache: 'no-store' });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error((j as { error?: string }).error ?? `Quote ${res.status}`);
          }
          const data = (await res.json()) as EvmQuote;
          if (!cancelled) setQuote(data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Quote failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, sellAmountRaw, sellToken, tokenAddress, chain, slippageBps, isSolana, takerAddress]);

  if (!open) return null;

  const outAmountStr = quote
    ? (isSolana
        ? formatTokenAmount((quote as SolQuote).outAmount, null)
        : formatTokenAmount((quote as EvmQuote).buyAmount, null))
    : null;
  const priceImpact = quote
    ? (isSolana
        ? Number((quote as SolQuote).priceImpactPct ?? 0)
        : Number((quote as EvmQuote).estimatedPriceImpact ?? 0))
    : null;
  const venue = quote
    ? (isSolana
        ? ((quote as SolQuote).routePlan?.[0]?.swapInfo?.label ?? 'Jupiter')
        : ((quote as EvmQuote).route?.fills?.[0]?.source ?? '0x'))
    : null;

  const handleConfirm = () => {
    const params = new URLSearchParams({
      sellToken: 'USDC',
      buyToken: tokenAddress,
      symbol: tokenSymbol,
      chain,
      amount: amountUsd,
    });
    router.push(`/dashboard/swap?${params.toString()}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lite-swap-title"
    >
      <div ref={trapRef} className="bg-[#0D1117] border border-slate-800 rounded-2xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[#0066FF]" aria-hidden />
            <h3 id="lite-swap-title" className="text-base font-bold">Swap USDC → {tokenSymbol}</h3>
          </div>
          <button onClick={onClose} aria-label="Close swap modal" className="p-1 rounded-md hover:bg-white/10">
            <X className="w-4 h-4 text-slate-300" aria-hidden />
          </button>
        </div>

        <label className="block text-[10px] uppercase tracking-wider text-slate-300 mb-1">You pay</label>
        <div className="flex items-center gap-2 rounded-lg bg-slate-900/70 border border-slate-800 px-3 py-2 mb-3">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value)}
            className="flex-1 bg-transparent text-base font-mono text-white focus:outline-none"
            aria-label="USDC amount"
          />
          <span className="text-xs text-slate-300">USDC</span>
        </div>

        <div className="flex items-center justify-center my-1 text-slate-300">
          <ArrowRight className="w-4 h-4" aria-hidden />
        </div>

        <label className="block text-[10px] uppercase tracking-wider text-slate-300 mb-1">You receive</label>
        <div className="rounded-lg bg-slate-900/70 border border-slate-800 px-3 py-2 mb-3 min-h-[42px] flex items-center justify-between">
          <span className="text-base font-mono text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" aria-hidden /> : (outAmountStr ?? '—')}
          </span>
          <span className="text-xs text-slate-300">{tokenSymbol}</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
          <span>Slippage tolerance</span>
          <div className="flex items-center gap-1">
            {[50, 100, 300].map((bps) => (
              <button
                key={bps}
                onClick={() => setSlippageBps(bps)}
                aria-pressed={slippageBps === bps}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${slippageBps === bps ? 'bg-[#0066FF] text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
              >
                {bps / 100}%
              </button>
            ))}
          </div>
        </div>

        {priceImpact !== null && Math.abs(priceImpact) > 0 && (
          <div className={`flex items-center gap-1 text-[11px] mb-2 ${Math.abs(priceImpact) > 3 ? 'text-amber-300' : 'text-slate-300'}`}>
            {Math.abs(priceImpact) > 3 && <AlertTriangle className="w-3 h-3" aria-hidden />}
            Price impact {priceImpact.toFixed(2)}% · routed via {venue}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-200 mb-2">{error}</div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!quote || loading || !!error}
          className="w-full py-2.5 rounded-lg bg-[#0066FF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold text-white flex items-center justify-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Repeat className="w-3.5 h-3.5" aria-hidden />}
          Open in swap to sign
        </button>
        <p className="mt-2 text-[10px] text-slate-300 text-center">
          Signing runs through the full swap page — your wallet stays non-custodial.
        </p>
      </div>
    </div>
  );
}

function formatTokenAmount(raw: string | undefined, decimals: number | null): string | null {
  if (!raw) return null;
  // We don't know the decimals of the target token here — show the raw value
  // formatted as a big number. The full /dashboard/swap page does proper
  // decimal accounting before signing.
  try {
    const n = Number(BigInt(raw));
    if (decimals && decimals > 0) return (n / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 6 });
    return n.toLocaleString();
  } catch {
    return raw;
  }
}
