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
import { ArrowDownUp, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, Loader2, Copy, Check } from 'lucide-react';
import { TrustScoreBadge } from '@/components/trust/TrustScoreBadge';

export interface SwapCardData {
  fromToken: string;
  toToken: string;
  /** Optional contract addresses — when set, receiver shows a §7 Naka Trust Score. */
  fromTokenAddress?: string;
  toTokenAddress?: string;
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

type Stage = 'quoting' | 'ready' | 'signing' | 'done' | 'error' | 'insufficient';

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
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Balance probe — we hit /api/wallet-intelligence for the user's current
  // chain and look up the from-token balance. If it's under what they want
  // to swap (including a small gas buffer for natives), we flip the card
  // into the "insufficient" state and offer a copy-address CTA so they can
  // deposit before trying again. Non-fatal: if the probe fails, we just
  // let Sign & Swap do the check at execute time.
  useEffect(() => {
    if (!walletAddress) { setBalance(null); return; }
    let cancelled = false;
    const chain = swap.chain || 'ethereum';
    (async () => {
      try {
        const res = await fetch(
          `/api/wallet-intelligence?address=${encodeURIComponent(walletAddress)}&chain=${encodeURIComponent(chain)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = await res.json();
        const sym = swap.fromToken.toUpperCase();
        const native = parseFloat(data?.nativeBalance || '0');
        const holdings: Array<{ symbol?: string; balance?: string }> =
          Array.isArray(data?.holdings) ? data.holdings : [];
        const row = holdings.find((h) => (h.symbol || '').toUpperCase() === sym);
        const bal = row ? parseFloat(row.balance || '0') : native;
        if (cancelled) return;
        setBalance(Number.isFinite(bal) ? bal : 0);
      } catch {
        // Non-fatal — leave balance null; execute path will error cleanly.
      }
    })();
    return () => { cancelled = true; };
  }, [walletAddress, swap.chain, swap.fromToken]);

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
        // If we already have a balance and it's short, land on the
        // insufficient-balance state so the user gets the copy-address CTA
        // instead of a live "Sign & Swap" they can't execute.
        const wanted = parseFloat(swap.fromAmount) || 0;
        if (balance !== null && balance < wanted) {
          setStage('insufficient');
        } else {
          setStage('ready');
        }
      } catch {
        if (!cancelled) setStage('ready');
      }
    })();
    return () => { cancelled = true; };
  }, [swap, balance]);

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
        const msg = (data?.error || '').toString();
        // Treat chain / router "insufficient funds / balance" responses the
        // same way as a pre-flight balance miss: flip to the deposit CTA.
        if (/insufficient|not enough|balance/i.test(msg)) {
          setStage('insufficient');
        } else {
          setError(msg || 'Swap failed. Make sure your wallet has enough balance plus gas — deposit and try again.');
          setStage('error');
        }
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
        {/* Lana-style stage rail — previous step is solid green, active step
            has a shimmer gradient, pending step is dim. `insufficient` is a
            terminal state that parks the rail at step 2 (we got a quote but
            the balance isn't there to sign with). */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            {
              id: 'quote',
              label: 'Fetching quote',
              active: stage === 'quoting',
              done: stage === 'ready' || stage === 'signing' || stage === 'done' || stage === 'insufficient' || stage === 'error',
            },
            {
              id: 'sign',
              label: 'Sign & Swap',
              active: stage === 'ready' || stage === 'insufficient',
              done: stage === 'signing' || stage === 'done',
            },
            {
              id: 'confirm',
              label: 'Confirm in wallet',
              active: stage === 'signing',
              done: stage === 'done',
            },
          ].map((s) => (
            <div key={s.id} className="flex flex-col items-start gap-1.5">
              <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${
                    s.done
                      ? 'w-full bg-emerald-500'
                      : s.active
                        ? 'w-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]'
                        : 'w-0 bg-white/[0.06]'
                  }`}
                />
              </div>
              <span className={`text-[10px] ${
                s.done
                  ? 'text-emerald-400'
                  : s.active
                    ? 'text-white'
                    : 'text-gray-500'
              }`}>
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
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">You receive</div>
              {quote.toTokenAddress && quote.chain && (
                <TrustScoreBadge
                  chain={quote.chain}
                  address={quote.toTokenAddress}
                  size="sm"
                  showLabel={false}
                />
              )}
            </div>
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

      {/* No wallet at all — prompt to connect one on the platform. */}
      {!walletAddress && stage === 'ready' && (
        <div className="mx-4 mb-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-amber-300 leading-relaxed">
            Connect a wallet on the Wallet page to sign this swap.
          </span>
        </div>
      )}

      {/* Insufficient balance — show "deposit" path: copy-address CTA. */}
      {stage === 'insufficient' && walletAddress && (
        <div className="mx-4 mb-3 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-amber-300 leading-tight">
                Insufficient balance
              </div>
              <div className="text-[11px] text-amber-200/80 leading-relaxed mt-0.5">
                You need {quote.fromAmount} {quote.fromToken}
                {balance !== null ? <> — you have {balance.toFixed(6)} {quote.fromToken}</> : null}.
                Deposit into your wallet and try the swap again.
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(walletAddress);
                setCopied(true);
                setTimeout(() => setCopied(false), 2200);
              } catch {
                setCopied(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 text-[12px] font-semibold transition-colors"
          >
            {copied ? (
              <><Check size={13} /> Address copied — paste in your exchange/wallet to deposit</>
            ) : (
              <><Copy size={13} /> Copy wallet address to deposit</>
            )}
          </button>
          <div className="mt-2 text-[10px] font-mono text-amber-200/60 text-center break-all">
            {walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}
          </div>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-red-400 leading-relaxed">{error}</span>
        </div>
      )}

      {/* Action button — the ONLY thing that can trigger a signature. In the
          insufficient state the primary action flips to "Check balance again"
          so users who just deposited can re-probe without leaving the chat. */}
      <div className="px-4 pb-4">
        {stage === 'insufficient' ? (
          <button
            onClick={() => { setStage('quoting'); setBalance(null); }}
            className="w-full py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} /> Check balance again
          </button>
        ) : (
          <button
            onClick={handleSign}
            disabled={stage === 'quoting' || stage === 'signing' || isHighImpact}
            className="naka-button-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ paddingTop: 12, paddingBottom: 12 }}
          >
            {stage === 'quoting' && (<><Loader2 size={14} className="animate-spin" /> Fetching quote…</>)}
            {stage === 'ready' && (<><ArrowDownUp size={14} /> Confirm Swap</>)}
            {stage === 'signing' && (<><Loader2 size={14} className="animate-spin" /> Confirm in your wallet…</>)}
            {stage === 'error' && (<><ArrowDownUp size={14} /> Retry</>)}
          </button>
        )}
      </div>
    </div>
  );
}
