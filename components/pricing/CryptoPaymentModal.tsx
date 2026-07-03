'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Copy, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  tier: 'mini' | 'pro' | 'max';
  onClose: () => void;
  onActivated: () => void;
}

const CHAINS = [
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'ethereum', label: 'Ethereum' },
];

interface Intent {
  paymentId: string;
  payTo: string;
  amount: number;
  token: string;
  tokenContract: string;
  chain: string;
  chainLabel: string;
  expiresAt: string;
}

export function CryptoPaymentModal({ tier, onClose, onActivated }: Props) {
  const [chain, setChain] = useState('base');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'confirmed'>('idle');
  const [copied, setCopied] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const create = async (selectedChain: string) => {
    setLoading(true);
    setError(null);
    setIntent(null);
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier, chain: selectedChain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.code === 'NOT_CONFIGURED'
          ? 'Payments are being set up — check back shortly.'
          : (data.error || 'Could not start payment'));
        return;
      }
      setIntent(data);
      setStatus('waiting');
    } catch {
      setError('Network error — try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { create(chain); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Poll payment status while waiting.
  useEffect(() => {
    if (status !== 'waiting' || !intent) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?id=${intent.paymentId}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'confirmed') {
          setStatus('confirmed');
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(onActivated, 1800);
        }
      } catch { /* keep polling */ }
    }, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, intent, onActivated]);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-[420px] nl-glass rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl"
        style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 24px rgba(0,102,255,.18)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Pay with USDC — {tier.toUpperCase()}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {status === 'confirmed' ? (
          <div className="py-10 flex flex-col items-center text-center gap-3">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
            <div className="text-white font-semibold">Payment confirmed</div>
            <div className="text-sm text-gray-400">Your {tier.toUpperCase()} plan is now active.</div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {CHAINS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setChain(c.id); create(c.id); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    chain === c.id
                      ? 'bg-[#0066FF]/15 text-blue-300 border-[#0066FF]/40'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {loading && (
              <div className="py-10 flex items-center justify-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Preparing payment…
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300">{error}</span>
              </div>
            )}

            {intent && !loading && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Send <span className="text-white font-semibold">exactly {intent.amount} USDC</span> on{' '}
                  <span className="text-white font-semibold">{intent.chainLabel}</span> to the address below. The
                  exact amount is how we match your payment — send it precisely.
                </p>

                <div className="rounded-xl bg-[#060A12] border border-white/[0.06] p-3">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Amount (USDC)</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-white text-lg">{intent.amount}</span>
                    <button onClick={() => copy(String(intent.amount), 'amt')} className="p-1.5 hover:bg-white/10 rounded-lg">
                      {copied === 'amt' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-[#060A12] border border-white/[0.06] p-3">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Send to ({intent.chainLabel})</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-white text-xs break-all">{intent.payTo}</span>
                    <button onClick={() => copy(intent.payTo, 'addr')} className="p-1.5 hover:bg-white/10 rounded-lg shrink-0">
                      {copied === 'addr' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0066FF]" />
                  Waiting for your transfer — this confirms automatically within a few minutes of sending.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
