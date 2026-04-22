'use client';

// Naka-branded 3-step swap card (inspired by Lana AI's multi-swap flow):
//   Step 1 — Fetching quote (skeleton, loads live rate / minimum received)
//   Step 2 — Quote ready, user taps "Sign & Swap" to request signature
//   Step 3 — "Confirm in your wallet…" while the extension / mobile wallet
//             prompts the user. On success we flip to a "Swap executed" card
//             with an explorer link.
//
// The card never moves funds. Execution only happens after Sign & Swap, at
// which point the wallet (Phantom / MetaMask / built-in Naka) holds final
// authority over the signature.

import { useEffect, useState } from 'react';
import { ArrowDownUp, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

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

type Stage = 'quoting' | 'ready' | 'signing' | 'done' | 'error';

const LOGO: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  BONK: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
  WIF: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg',
  JUP: 'https://assets.coingecko.com/coins/images/34188/small/jup.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
};

function TokenGlyph({ symbol }: { symbol: string }) {
  const src = LOGO[symbol.toUpperCase()];
  if (!src) {
    return (
      <div className="w-8 h-8 rounded-full bg-[#141824] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={src} alt={symbol} className="w-8 h-8 rounded-full bg-[#141824]" />;
}

export function SwapCard({ swap, walletAddress }: Props) {
  const [stage, setStage] = useState<Stage>('quoting');
  const [quote, setQuote] = useState<SwapCardData>(swap);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — fetch a live quote the moment the card mounts. We probe the
  // platform's /api/swap/price endpoint (which maps symbol → canonical
  // address and returns rate + minimum received). If it 404s we keep the
  // placeholder numbers and let the user sign anyway — execute will fail
  // cleanly with a real error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          chain: swap.chain,
          from: swap.fromToken,
          to: swap.toToken,
          amount: swap.fromAmount,
        });
        const res = await fetch(`/api/swap/price?${params.toString()}`).catch(() => null);
        if (!res || !res.ok) {
          // No live quote — show the AI's placeholder and let user proceed.
          if (!cancelled) setStage('ready');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const next: SwapCardData = {
          ...swap,
          toAmount: data?.toAmount ? String(data.toAmount) : swap.toAmount,
          rate: data?.rate ? String(data.rate) : swap.rate,
          priceImpact: typeof data?.priceImpact === 'number' ? data.priceImpact : swap.priceImpact,
          platformFee: data?.platformFee ? String(data.platformFee) : swap.platformFee,
          quoteData: data?.quoteData || swap.quoteData,
        };
        setQuote(next);
        setStage('ready');
      } catch {
        if (!cancelled) setStage('ready');
      }
    })();
    return () => { cancelled = true; };
  }, [swap]);

  const impactColor =
    quote.priceImpact < 1 ? 'text-emerald-400' :
    quote.priceImpact < 5 ? 'text-amber-400' :
    'text-red-400';
  const isHighImpact = quote.priceImpact > 30;

  const handleSign = async () => {
    if (!walletAddress) {
      setError('Connect a wallet to execute this swap. Deposit first if your balance is insufficient.');
      return;
    }
    if (isHighImpact) {
      setError('Price impact too high (>30%). Swap blocked for your protection.');
      return;
    }
    setStage('signing');
    setError(null);
    try {
      const res = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: quote.chain,
          fromToken: quote.fromToken,
          toToken: quote.toToken,
          fromAmount: quote.fromAmount,
          walletAddress,
          quoteData: quote.quoteData,
        }),
      });
      const data = await res.json().catch(() => ({} as { error?: string; txHash?: string }));
      if (data?.txHash) {
        setTxHash(data.txHash);
        setStage('done');
      } else {
        setError(
          data?.error ||
          'Swap failed. Make sure your wallet has enough balance plus gas — deposit and try again.',
        );
        setStage('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed. Please try again.');
      setStage('error');
    }
  };

  const explorerUrl = quote.chain === 'solana'
    ? `https://solscan.io/tx/${txHash}`
    : `https://etherscan.io/tx/${txHash}`;

  // ── Stage 3 (terminal) — executed ──────────────────────────────────────
  if (stage === 'done' && txHash) {
    return (
      <div className="bg-[#0A0F1A] border border-emerald-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={16} className="text-emerald-400" />
          <span className="text-emerald-400 font-semibold text-sm">Swap executed</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {quote.fromAmount} {quote.fromToken} → {quote.toAmount} {quote.toToken}
        </p>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#0A1EFF] hover:underline"
        >
          View on explorer <ExternalLink size={10} />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0F1A] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Stage progress rail */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-gray-500">
          <ArrowDownUp size={11} />
          <span>Swap Preview</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1">
          {[
            { id: 'quote', label: 'Fetching quote', active: stage === 'quoting', done: stage !== 'quoting' },
            { id: 'sign', label: 'Sign & Swap', active: stage === 'ready', done: stage === 'signing' || stage === 'done' },
            { id: 'confirm', label: 'Confirm in wallet', active: stage === 'signing', done: stage === 'done' },
          ].map((s) => (
            <div key={s.id} className="flex flex-col items-start gap-1">
              <div className={`h-1 w-full rounded-full transition-all ${
                s.done ? 'bg-emerald-500' : s.active ? 'bg-[#0A1EFF]' : 'bg-white/[0.06]'
              }`} />
              <span className={`text-[10px] ${s.active ? 'text-white' : s.done ? 'text-emerald-400' : 'text-gray-500'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* From / To */}
      <div className="px-4 pb-4 space-y-2">
        <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
          <TokenGlyph symbol={quote.fromToken} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">You pay</div>
            <div className="text-base font-bold text-white font-mono leading-tight">
              {quote.fromAmount} {quote.fromToken}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-[#141824] border border-white/[0.06] flex items-center justify-center">
            <ArrowDownUp size={12} className="text-gray-400" />
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
          <TokenGlyph symbol={quote.toToken} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">You receive</div>
            <div className="text-base font-bold text-white font-mono leading-tight">
              {stage === 'quoting' ? (
                <span className="inline-flex items-center gap-1.5 text-gray-500">
                  <RefreshCw size={12} className="animate-spin" /> fetching…
                </span>
              ) : (
                <>~{quote.toAmount} {quote.toToken}</>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spec row */}
      <div className="px-4 pb-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Rate</span>
          <span className="text-gray-300 font-mono">{stage === 'quoting' ? '—' : quote.rate}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Price Impact</span>
          <span className={`font-semibold ${impactColor}`}>
            {stage === 'quoting' ? '—' : `${quote.priceImpact.toFixed(2)}%`}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Platform Fee</span>
          <span className="text-gray-300">{quote.platformFee}</span>
        </div>
      </div>

      {/* Inline warnings (kept short; the AI text above already explained) */}
      {!walletAddress && stage === 'ready' && (
        <div className="mx-4 mb-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-amber-300 leading-relaxed">
            Connect a wallet on the Wallet page to sign. Insufficient balance? Deposit first.
          </span>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-red-400 leading-relaxed">{error}</span>
        </div>
      )}

      {/* Action button — the ONLY thing that can trigger a signature */}
      <div className="px-4 pb-4">
        <button
          onClick={handleSign}
          disabled={stage === 'quoting' || stage === 'signing' || isHighImpact}
          className="w-full py-3 rounded-xl bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
        >
          {stage === 'quoting' && (<><Loader2 size={14} className="animate-spin" /> Fetching quote…</>)}
          {stage === 'ready' && (<><ArrowDownUp size={14} /> Sign &amp; Swap</>)}
          {stage === 'signing' && (<><Loader2 size={14} className="animate-spin" /> Confirm in your wallet…</>)}
          {stage === 'error' && (<><ArrowDownUp size={14} /> Retry</>)}
        </button>
      </div>
    </div>
  );
}
