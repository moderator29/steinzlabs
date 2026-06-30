'use client';

/**
 * Background (AA) sniping setup card (#41). Lets a user with the built-in Naka
 * wallet authorize a capped, expiring ZeroDev session key so the sniper cron
 * can auto-buy while their tab is closed — without the server ever holding the
 * main wallet key. After approval it shows the kernel address to fund.
 *
 * Renders nothing unless a built-in Naka wallet exists locally. If the backend
 * isn't configured (no ZeroDev RPC / vault secret), the Enable call returns 503
 * and we show an honest "not available" message.
 */

import { useState } from 'react';
import { Zap, Loader2, Check, AlertTriangle, Copy } from 'lucide-react';
import { enableBackgroundSniping } from '@/lib/wallet/sessionKeyClient';

const AA_CHAINS = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche'] as const;

function activeNakaWallet(): { address: string; encryptedKey: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const wallets = JSON.parse(localStorage.getItem('steinz_wallets') || '[]') as Array<{ address?: string; encryptedKey?: string }>;
    const active = localStorage.getItem('steinz_active_wallet_address') || wallets[0]?.address || '';
    const w = wallets.find((x) => x.address && x.address.toLowerCase() === active.toLowerCase()) || wallets[0];
    return w?.address && w.encryptedKey ? { address: w.address, encryptedKey: w.encryptedKey } : null;
  } catch {
    return null;
  }
}

export function BackgroundSnipingCard() {
  const [wallet] = useState(activeNakaWallet);
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState<string>('base');
  const [maxPerTrade, setMaxPerTrade] = useState('50');
  const [dailyCap, setDailyCap] = useState('200');
  const [hours, setHours] = useState('24');
  const [maxTrades, setMaxTrades] = useState('20');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ kernelAddress: string; validUntil: number } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!wallet) return null;

  const submit = async () => {
    const maxPt = parseFloat(maxPerTrade);
    const daily = parseFloat(dailyCap);
    if (!(maxPt > 0) || !(daily > 0)) { setError('Enter positive per-trade and daily caps.'); return; }
    if (daily < maxPt) { setError('Daily cap must be ≥ per-trade cap.'); return; }
    if (!password) { setError('Enter your wallet password to authorize.'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await enableBackgroundSniping({
        chain,
        mainAddress: wallet.address,
        encryptedKey: wallet.encryptedKey,
        password,
        maxPerTradeUsd: maxPt,
        dailyCapUsd: daily,
        maxTradesPerDay: parseInt(maxTrades, 10) || 20,
        hours: parseInt(hours, 10) || 24,
      });
      setResult({ kernelAddress: res.kernelAddress, validUntil: res.validUntil });
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable background sniping.');
    } finally {
      setBusy(false);
    }
  };

  const copyKernel = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.kernelAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  };

  return (
    <div className="nl-glass rounded-2xl p-4 mb-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.25)' }}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Background sniping (set &amp; forget)</p>
            <p className="text-[11px] text-slate-400">Auto-buy while Naka is closed — capped, expiring, revocable.</p>
          </div>
        </div>
        <span className="text-xs text-slate-400">{open ? 'Hide' : 'Set up'}</span>
      </button>

      {open && !result && (
        <div className="mt-4 space-y-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Your main wallet stays in your control — it only signs a one-time approval for a
            limited session key (max per trade, daily cap, expiry). The server can then
            auto-buy from a smart account you fund, never your main wallet.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-slate-400">
              Chain
              <select value={chain} onChange={(e) => setChain(e.target.value)} className="mt-1 w-full bg-[#111827] border border-white/10 rounded-lg px-2 py-2 text-sm text-white capitalize">
                {AA_CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-slate-400">
              Expires (hours)
              <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" className="mt-1 w-full bg-[#111827] border border-white/10 rounded-lg px-2 py-2 text-sm" />
            </label>
            <label className="text-[11px] text-slate-400">
              Max / trade (USD)
              <input value={maxPerTrade} onChange={(e) => setMaxPerTrade(e.target.value)} inputMode="decimal" className="mt-1 w-full bg-[#111827] border border-white/10 rounded-lg px-2 py-2 text-sm" />
            </label>
            <label className="text-[11px] text-slate-400">
              Daily cap (USD)
              <input value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} inputMode="decimal" className="mt-1 w-full bg-[#111827] border border-white/10 rounded-lg px-2 py-2 text-sm" />
            </label>
            <label className="text-[11px] text-slate-400 col-span-2">
              Max trades / day
              <input value={maxTrades} onChange={(e) => setMaxTrades(e.target.value)} inputMode="numeric" className="mt-1 w-full bg-[#111827] border border-white/10 rounded-lg px-2 py-2 text-sm" />
            </label>
            <label className="text-[11px] text-slate-400 col-span-2">
              Wallet password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full bg-[#111827] border border-white/10 rounded-lg px-2 py-2 text-sm" />
            </label>
          </div>
          {error && (
            <p className="text-[11px] text-[#EF4444] bg-[#EF4444]/5 px-3 py-2 rounded-lg border border-[#EF4444]/15 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
            </p>
          )}
          <button onClick={() => void submit()} disabled={busy} className="w-full py-2.5 bg-[#0066FF] hover:bg-[#0818CC] rounded-xl text-sm font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Authorizing…</>) : 'Enable background sniping'}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] text-[#10B981] flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Background sniping enabled until {new Date(result.validUntil * 1000).toLocaleString()}.</p>
          <p className="text-[11px] text-slate-300">Fund this smart account with USDC (your snipe budget) + a little native gas:</p>
          <button onClick={() => void copyKernel()} className="w-full text-left font-mono text-[11px] text-[#8FA3FF] bg-[#111827] border border-white/10 rounded-lg px-3 py-2 inline-flex items-center justify-between gap-2">
            <span className="break-all">{result.kernelAddress}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
          </button>
        </div>
      )}
    </div>
  );
}
