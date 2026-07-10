'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Gift, Loader2, Wallet } from 'lucide-react';
import {
  GIFT_CHAINS,
  getGiftChain,
  resolveGiftSender,
  readNativeBalance,
  maxSendableNative,
  sendNativeGift,
  type GiftChain,
  type ResolvedGiftSender,
} from '@/lib/wallet/giftSend';
import type { GiftSuccessData } from '@/components/wire/GiftSuccessCard';

interface Recipient {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface GiftSheetProps {
  recipient: Recipient;
  postId?: string | null;
  onClose: () => void;
  onSuccess: (data: GiftSuccessData) => void;
}

const QUICK_AMOUNTS = ['0.01', '0.05', '0.1'];

function shortAddr(a: string): string {
  return a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

const SOURCE_LABEL: Record<ResolvedGiftSender['source'], string> = {
  builtin: 'Naka wallet',
  external_evm: 'Connected wallet',
  external_solana: 'Phantom',
};

export function GiftSheet({ recipient, postId, onClose, onSuccess }: GiftSheetProps) {
  const [chain, setChain] = useState<GiftChain>(GIFT_CHAINS[0]);
  const [sender, setSender] = useState<ResolvedGiftSender | null>(null);
  const [senderLoading, setSenderLoading] = useState(true);
  const [balance, setBalance] = useState<string>('0');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
  const [recipientLoading, setRecipientLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [nativeUsd, setNativeUsd] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pwError, setPwError] = useState('');

  // Resolve which wallet pays + its balance whenever the chain changes.
  useEffect(() => {
    let cancelled = false;
    setSenderLoading(true);
    setBalance('0');
    setError('');
    (async () => {
      const s = await resolveGiftSender(chain);
      if (cancelled) return;
      setSender(s);
      setSenderLoading(false);
      if (s) {
        setBalanceLoading(true);
        try {
          const b = await readNativeBalance(chain, s.address);
          if (!cancelled) setBalance(b);
        } catch {
          if (!cancelled) setBalance('0');
        } finally {
          if (!cancelled) setBalanceLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [chain]);

  // Resolve the recipient's receive address for this chain (server-side).
  useEffect(() => {
    let cancelled = false;
    setRecipientLoading(true);
    setRecipientAddress(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/wire/gift/resolve?recipientId=${encodeURIComponent(recipient.id)}&chain=${chain.id}`,
          { credentials: 'include' },
        );
        const data = res.ok ? ((await res.json()) as { address: string | null }) : { address: null };
        if (!cancelled) setRecipientAddress(data.address);
      } catch {
        if (!cancelled) setRecipientAddress(null);
      } finally {
        if (!cancelled) setRecipientLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chain.id, recipient.id]);

  // Native asset USD price → real amount_usd quote (never fabricated).
  useEffect(() => {
    let cancelled = false;
    setNativeUsd(null);
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${chain.nativeCgId}&vs_currencies=usd`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.[chain.nativeCgId]?.usd) setNativeUsd(d[chain.nativeCgId].usd); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chain.nativeCgId]);

  const amtNum = parseFloat(amount) || 0;
  const balNum = parseFloat(balance) || 0;
  const overBalance = amtNum > balNum;
  const usdValue = nativeUsd != null && amtNum > 0 ? amtNum * nativeUsd : null;
  const noReceiveWallet = !recipientLoading && !recipientAddress;
  const canSend =
    !!sender &&
    !!recipientAddress &&
    amtNum > 0 &&
    !overBalance &&
    !sending &&
    (!sender.needsPassword || password.length > 0);

  const setMax = useCallback(async () => {
    if (!sender) return;
    try {
      const max = await maxSendableNative(chain, sender.address);
      setAmount(max);
    } catch {
      setAmount(balance);
    }
  }, [chain, sender, balance]);

  const handleSend = async () => {
    if (!sender || !recipientAddress) return;
    setError(''); setPwError(''); setSending(true);
    try {
      const result = await sendNativeGift({
        chain,
        to: recipientAddress,
        amount,
        password: sender.needsPassword ? password : undefined,
      });

      // Record the gift (best-effort — the on-chain transfer already happened).
      const amountUsd = usdValue != null ? Number(usdValue.toFixed(2)) : null;
      try {
        await fetch('/api/wire/gift/record', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientId: recipient.id,
            postId: postId ?? null,
            chain: chain.id,
            tokenSymbol: chain.symbol,
            tokenAddress: null,
            amount,
            amountUsd,
            txHash: result.txHash,
            senderAddress: result.senderAddress,
            recipientAddress,
          }),
        });
      } catch (e) {
        console.warn('[GiftSheet] gift recorded on-chain but ledger write failed:', e);
      }

      onSuccess({
        recipient: {
          username: recipient.username,
          display_name: recipient.display_name,
          avatar_url: recipient.avatar_url,
        },
        amount,
        tokenSymbol: chain.symbol,
        chainId: chain.id,
        txHash: result.txHash,
        amountUsd,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gift failed. Please try again.';
      if (/password/i.test(msg)) setPwError(msg);
      else if (/reject|denied|user rejected/i.test(msg)) setError('You rejected the transaction in your wallet.');
      else setError(msg.slice(0, 200));
    } finally {
      setSending(false);
    }
  };

  const fieldStyle = { boxShadow: '0 0 0 1px rgba(0,102,255,.22)' } as const;
  const primaryStyle = {
    background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)',
    boxShadow: '0 0 18px rgba(0,102,255,.5), inset 0 1px 0 rgba(255,255,255,.2)',
  } as const;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg nl-glass rounded-t-3xl px-4 pt-4 pb-6 text-white max-h-[90dvh] overflow-y-auto"
        style={{ boxShadow: '0 -4px 40px rgba(0,102,255,.25), 0 0 0 1px rgba(0,102,255,.3)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {recipient.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={recipient.avatar_url} alt={recipient.username} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-white/10">
                {(recipient.display_name || recipient.username || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 font-heading font-bold">
                <Gift className="w-4 h-4 text-[#8FA3FF]" /> Gift @{recipient.username}
              </div>
              <p className="text-[11px] text-slate-400">A real on-chain transfer from your wallet</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chain selector */}
        <div className="mb-4">
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">Network</label>
          <div className="grid grid-cols-4 gap-2">
            {GIFT_CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => { setChain(c); setAmount(''); }}
                className={`py-2 rounded-xl border-2 text-center transition ${chain.id === c.id ? 'border-blue-400/60 bg-blue-500/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
              >
                <div className={`text-xs font-semibold ${chain.id === c.id ? 'text-blue-100' : 'text-white/80'}`}>{c.symbol}</div>
                <div className="text-[10px] text-white/45">{c.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sender wallet + balance */}
        <div className="nl-glass rounded-2xl p-3 mb-3 flex items-center justify-between" style={fieldStyle}>
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="w-4 h-4 text-[#8FA3FF] shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">{sender ? SOURCE_LABEL[sender.source] : 'Your wallet'}</div>
              <div className="text-xs font-mono truncate">
                {senderLoading ? 'Detecting…' : sender ? shortAddr(sender.address) : 'No wallet connected'}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-slate-400">Balance</div>
            <div className="text-sm font-semibold font-mono">
              {balanceLoading ? '…' : `${balNum.toFixed(4)} ${chain.symbol}`}
            </div>
          </div>
        </div>

        {!senderLoading && !sender && (
          <p className="text-[12px] text-[#F59E0B] bg-[#F59E0B]/5 border border-[#F59E0B]/15 rounded-xl p-3 mb-3">
            No wallet found for {chain.name}. Open your Naka wallet (or connect an external wallet) and try again.
          </p>
        )}

        {/* Amount */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-slate-400 font-medium">Amount ({chain.symbol}) — native only</label>
            <button type="button" onClick={setMax} className="text-[10px] font-bold text-[#0066FF] hover:text-[#3B4EFF]">MAX</button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.001"
            placeholder="0.05"
            className="w-full nl-glass rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none"
            style={fieldStyle}
          />
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q)}
                  className="nl-glass px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-200"
                  style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.2)' }}
                >
                  {q}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500">
              {usdValue != null ? `≈ $${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''}
            </span>
          </div>
          {overBalance && (
            <p className="text-[11px] font-semibold text-[#EF4444] mt-1.5">
              Insufficient {chain.symbol}: you have {balNum.toFixed(4)}
            </p>
          )}
        </div>

        {/* Recipient address */}
        <div className="nl-glass rounded-2xl p-3 mb-3" style={fieldStyle}>
          <div className="text-[11px] text-slate-400 mb-0.5">Recipient receives at</div>
          {recipientLoading ? (
            <div className="text-xs text-slate-500">Resolving…</div>
          ) : recipientAddress ? (
            <div className="text-xs font-mono text-slate-200">{shortAddr(recipientAddress)}</div>
          ) : (
            <div className="text-xs text-[#F59E0B]">
              @{recipient.username} has not set a receive wallet on {chain.name} yet.
            </div>
          )}
        </div>

        {/* Password (built-in wallet, locked) */}
        {sender?.needsPassword && (
          <div className="mb-3">
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">Wallet Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              placeholder="Unlock your Naka wallet to sign"
              className="w-full nl-glass rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              style={fieldStyle}
            />
            {pwError && <p className="text-[11px] font-semibold text-[#EF4444] mt-1.5">{pwError}</p>}
          </div>
        )}

        {error && (
          <p className="text-xs text-[#EF4444] bg-[#EF4444]/5 p-3 rounded-xl border border-[#EF4444]/10 mb-3">{error}</p>
        )}

        <button
          onClick={handleSend}
          disabled={!canSend}
          style={canSend ? primaryStyle : undefined}
          className="w-full py-3.5 rounded-2xl font-bold text-sm disabled:opacity-40 disabled:bg-white/[0.05] flex items-center justify-center gap-2"
        >
          {sending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
          ) : noReceiveWallet ? (
            'No receive wallet on this chain'
          ) : (
            <><Gift className="w-4 h-4" /> Send Gift</>
          )}
        </button>
        <p className="text-[10px] text-slate-500 text-center mt-2">
          Non-custodial: funds move directly from your wallet to @{recipient.username}. We never hold them.
        </p>
      </div>
    </div>
  );
}

export default GiftSheet;
