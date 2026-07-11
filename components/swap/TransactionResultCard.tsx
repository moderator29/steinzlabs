'use client';

/**
 * TransactionResultCard — the branded, shareable receipt shown after a swap
 * settles (or fails). It is driven purely by the trade's result state, so it
 * works identically for every wallet mode (built-in Naka wallet, injected
 * extension, WalletConnect mobile, gasless). The visual card is captured to a
 * PNG via html2canvas so a user can screenshot OR share it natively; the
 * action row is deliberately OUTSIDE the captured node so buttons never end up
 * in the image.
 *
 * Honesty: everything shown is real trade data passed in by the swap page. The
 * failure state never pretends a swap worked, and it says plainly that the
 * balance did not change.
 */

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, AlertTriangle, ExternalLink, Share2, Download, RotateCcw, Copy } from 'lucide-react';
import { tokenLogoCandidates } from '@/lib/wallet/tokenLogoCandidates';

export interface TransactionResultData {
  status: 'confirmed' | 'failed';
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromUsd?: number | null;
  toUsd?: number | null;
  fromLogo?: string | null;
  toLogo?: string | null;
  chainLabel: string;
  chainColor: string;
  txHash?: string;
  explorerUrl?: string;
  errorMessage?: string | null;
}

function ResultLogo({ logo, symbol }: { logo?: string | null; symbol: string }) {
  const [idx, setIdx] = useState(0);
  const candidates = tokenLogoCandidates({ primary: logo ?? null });
  const current = candidates[idx];
  if (!current) {
    return (
      <div className="w-10 h-10 rounded-full bg-[#0066FF]/20 flex items-center justify-center text-[13px] font-bold text-white shrink-0">
        {symbol.slice(0, 2)}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={current} alt={symbol} className="w-10 h-10 rounded-full object-cover shrink-0" onError={() => setIdx((i) => i + 1)} />;
}

function fmtUsd(n?: number | null): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function TransactionResultCard({ data, onClose, onRetry }: {
  data: TransactionResultData;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | 'share' | 'save'>(null);
  const [copied, setCopied] = useState(false);
  const ok = data.status === 'confirmed';

  const shareText = ok
    ? `I just swapped ${data.fromAmount} ${data.fromToken} for ${data.toAmount} ${data.toToken} on Naka Labs.`
    : `Swap of ${data.fromAmount} ${data.fromToken} did not go through on Naka Labs.`;

  // Render the card node to a PNG blob (transparent-safe, high-DPI).
  const toBlob = useCallback(async (): Promise<Blob | null> => {
    const node = captureRef.current;
    if (!node) return null;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(node, { backgroundColor: '#05070E', scale: 2, useCORS: true, logging: false });
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
  }, []);

  const handleSave = useCallback(async () => {
    setBusy('save');
    try {
      const blob = await toBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `naka-swap-${(data.txHash || 'receipt').slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* capture can fail on some browsers; the explorer link + copy remain */
    } finally {
      setBusy(null);
    }
  }, [toBlob, data.txHash]);

  const handleShare = useCallback(async () => {
    setBusy('share');
    try {
      const blob = await toBlob();
      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      const file = blob ? new File([blob], 'naka-swap.png', { type: 'image/png' }) : null;
      const shareData: ShareData = { title: 'Naka Labs swap', text: shareText, ...(data.explorerUrl ? { url: data.explorerUrl } : {}) };
      if (file && nav.canShare?.({ files: [file] })) {
        await nav.share({ ...shareData, files: [file] } as ShareData);
      } else if (nav.share) {
        await nav.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareText}${data.explorerUrl ? ` ${data.explorerUrl}` : ''}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled the share sheet, or clipboard denied — non-fatal */
    } finally {
      setBusy(null);
    }
  }, [toBlob, shareText, data.explorerUrl]);

  const shortHash = data.txHash ? `${data.txHash.slice(0, 8)}…${data.txHash.slice(-6)}` : '';

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-[420px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Captured node: the shareable receipt itself. */}
        <div
          ref={captureRef}
          className="relative overflow-hidden rounded-t-3xl sm:rounded-3xl p-6"
          style={{
            background: 'radial-gradient(120% 80% at 50% -10%, rgba(0,102,255,.22) 0%, transparent 55%), linear-gradient(165deg, #0a1120 0%, #070b16 60%, #05070e 100%)',
            boxShadow: '0 0 0 1px rgba(0,102,255,.35), 0 0 40px rgba(0,102,255,.18)',
          }}
        >
          {/* aurora accent */}
          <div className={`absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-[70px] ${ok ? 'bg-[#10B981]/25' : 'bg-red-500/20'}`} />

          <div className="relative flex flex-col items-center text-center">
            {/* status burst */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${ok ? 'bg-[#10B981]/15' : 'bg-red-500/15'}`}
              style={{ boxShadow: ok ? '0 0 0 1px rgba(16,185,129,.4), 0 0 22px rgba(16,185,129,.3)' : '0 0 0 1px rgba(239,68,68,.4), 0 0 22px rgba(239,68,68,.25)' }}
            >
              {ok ? <Check className="w-8 h-8 text-[#10B981]" strokeWidth={3} /> : <AlertTriangle className="w-8 h-8 text-red-400" />}
            </motion.div>

            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {ok ? 'Swap Successful' : 'Swap Did Not Go Through'}
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
              {ok
                ? 'Your trade settled on-chain. Balances update in a moment.'
                : (data.errorMessage || 'The transaction failed. No funds moved and your balance is unchanged.')}
            </p>

            {/* from -> to */}
            <div className="w-full mt-5 rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,.03)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' }}>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <ResultLogo logo={data.fromLogo} symbol={data.fromToken} />
                <div className="text-start min-w-0">
                  <div className="text-sm font-bold text-white truncate">{data.fromAmount} {data.fromToken}</div>
                  {fmtUsd(data.fromUsd) && <div className="text-[11px] text-gray-500">{fmtUsd(data.fromUsd)}</div>}
                </div>
              </div>
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#0066FF]/15 flex items-center justify-center" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.35)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end">
                <div className="text-end min-w-0">
                  <div className={`text-sm font-bold truncate ${ok ? 'text-[#10B981]' : 'text-white'}`}>{data.toAmount} {data.toToken}</div>
                  {fmtUsd(data.toUsd) && <div className="text-[11px] text-gray-500">{fmtUsd(data.toUsd)}</div>}
                </div>
                <ResultLogo logo={data.toLogo} symbol={data.toToken} />
              </div>
            </div>

            {/* meta row */}
            <div className="w-full mt-3 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-gray-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.chainColor }} />
                {data.chainLabel}
              </span>
              {shortHash && <span className="font-mono text-gray-500">{shortHash}</span>}
            </div>

            {/* brand footer — keeps screenshots on-brand */}
            <div className="w-full mt-5 pt-4 flex items-center justify-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <span className="text-[13px] font-extrabold tracking-tight" style={{ background: 'linear-gradient(90deg,#0066FF,#1E90FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Naka Labs</span>
              <span className="text-[10px] text-gray-600">nakalabs.xyz</span>
            </div>
          </div>
        </div>

        {/* Action row — NOT captured. */}
        <div className="bg-[#05070e] sm:rounded-b-3xl p-4 pt-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.18)' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              disabled={busy !== null}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0066FF] text-white text-sm font-bold hover:bg-[#0066FF]/90 active:scale-[.98] transition disabled:opacity-60"
            >
              {copied ? <><Copy className="w-4 h-4" /> Copied</> : <><Share2 className="w-4 h-4" /> {busy === 'share' ? 'Sharing…' : 'Share'}</>}
            </button>
            <button
              onClick={handleSave}
              disabled={busy !== null}
              aria-label="Save receipt image"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 text-gray-200 text-sm font-semibold hover:bg-white/10 active:scale-[.98] transition disabled:opacity-60"
            >
              <Download className="w-4 h-4" /> {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {!ok && onRetry && (
              <button onClick={onRetry} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 text-gray-200 text-sm font-semibold hover:bg-white/10 transition">
                <RotateCcw className="w-4 h-4" /> Try again
              </button>
            )}
            {data.explorerUrl && (
              <a
                href={data.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 text-blue-300 text-sm font-semibold hover:bg-white/10 transition"
              >
                Explorer <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={onClose} aria-label="Close" className="py-2.5 px-4 rounded-xl bg-white/5 text-gray-400 text-sm font-semibold hover:bg-white/10 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
