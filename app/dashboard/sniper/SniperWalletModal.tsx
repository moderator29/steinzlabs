'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import { getAccount } from '@wagmi/core';
import { Loader2, ShieldCheck, X, KeyRound, Wallet } from 'lucide-react';
import { wagmiAdapter, getAppKit } from '@/lib/wallet/appkit';
import { CHAIN_CONFIGS, SNIPER_CHAINS, type SniperChain } from '@/lib/sniper/chains';
import { ChainLogo } from '@/components/common/ChainLogo';

/**
 * Non-custodial Trading Wallet setup (Sniper).
 *
 * The bot NEVER holds your funds or your main private key. We:
 *  1. Generate a fresh, throwaway "session" keypair in your browser. The
 *     session private key is stored ONLY in this browser's local storage and
 *     never leaves the device.
 *  2. Ask your main wallet to sign an EIP-712 authorization that grants the
 *     session key a hard-capped, time-boxed spend allowance (max per trade +
 *     daily cap + expiry).
 *  3. Store only the session's PUBLIC address + your signed authorization
 *     server-side. The relayer can execute snipes within those caps and you
 *     can revoke at any time — your funds stay in your wallet.
 *
 * Mirrors the existing /api/trading/session-key contract (EIP-712 domain
 * "NakaLabs Session Key").
 */

// EVM-only for non-custodial automated execution.
const EVM_CHAINS = SNIPER_CHAINS.filter((c) => c !== 'solana' && c !== 'ton') as SniperChain[];

const DOMAIN = { name: 'NakaLabs Session Key', version: '1' };
const TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
  ],
  Authorization: [
    { name: 'sessionAddress', type: 'address' },
    { name: 'chain', type: 'string' },
    { name: 'maxPerTradeUsd', type: 'uint256' },
    { name: 'dailyCapUsd', type: 'uint256' },
    { name: 'allowedTokens', type: 'string' },
    { name: 'expiresAt', type: 'uint256' },
  ],
};

interface Eip1193 { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

async function getEvmProvider(): Promise<{ provider: Eip1193; address: string } | null> {
  try {
    const cfg = wagmiAdapter?.wagmiConfig;
    if (cfg) {
      const acct = getAccount(cfg);
      if (acct.isConnected && acct.address && acct.connector?.getProvider) {
        const p = (await acct.connector.getProvider()) as Eip1193 | undefined;
        if (p && typeof p.request === 'function') return { provider: p, address: acct.address };
      }
    }
  } catch { /* fall through */ }
  const win = typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eip1193 }) : null;
  if (win?.ethereum) {
    try {
      const accounts = (await win.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      if (accounts?.[0]) return { provider: win.ethereum, address: accounts[0] };
    } catch { /* no-op */ }
  }
  return null;
}

function sessionPkKey(userId: string, chain: string) {
  return `naka_sniper_session_pk_${userId}_${chain}`;
}

export function SniperWalletModal({ userId, onClose, onConnected }: {
  userId: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [chain, setChain] = useState<SniperChain>('ethereum');
  const [maxPerTrade, setMaxPerTrade] = useState(50);
  const [dailyCap, setDailyCap] = useState(250);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorize = async () => {
    setBusy(true);
    setError(null);
    try {
      let resolved = await getEvmProvider();
      if (!resolved) {
        // No wallet connected — open the connect modal and WAIT for the user to
        // approve in their wallet (Trust Wallet / WalletConnect), then continue
        // to signing automatically instead of making them tap Authorize again.
        getAppKit()?.open();
        setError('Approve the connection in your wallet…');
        for (let i = 0; i < 120 && !resolved; i++) {
          await new Promise((r) => setTimeout(r, 500));
          resolved = await getEvmProvider();
        }
        if (!resolved) {
          setError('Wallet not connected yet. Tap Authorize to try again.');
          setBusy(false);
          return;
        }
        setError(null);
      }
      const { provider, address: mainAddress } = resolved;

      // 1. Fresh ephemeral session key — privkey stays in this browser only.
      const session = ethers.Wallet.createRandom();
      const expiresAt = Math.floor(Date.now() / 1000) + hours * 3600;
      const message = {
        sessionAddress: session.address,
        chain,
        maxPerTradeUsd: String(Math.round(maxPerTrade)),
        dailyCapUsd: String(Math.round(dailyCap)),
        allowedTokens: '',
        expiresAt: String(expiresAt),
      };
      const typedData = { types: TYPES, primaryType: 'Authorization', domain: DOMAIN, message };

      // 2. Main wallet signs the capped, time-boxed authorization.
      const signature = (await provider.request({
        method: 'eth_signTypedData_v4',
        params: [mainAddress, JSON.stringify(typedData)],
      })) as string;

      // 3. Persist session privkey locally (never sent), then register the
      //    public authorization server-side.
      try { localStorage.setItem(sessionPkKey(userId, chain), session.privateKey); } catch { /* storage blocked */ }

      const res = await fetch('/api/trading/session-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_address: session.address,
          main_address: mainAddress,
          chain,
          max_per_trade_usd: Math.round(maxPerTrade),
          daily_cap_usd: Math.round(dailyCap),
          hours,
          auth_signature: signature,
          auth_payload: message,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Authorization failed');

      onConnected();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed');
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="nl-glass w-full max-w-lg rounded-2xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0066FF]/15 border border-[#0066FF]/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Non-Custodial Trading Wallet</h2>
              <p className="text-[11px] text-emerald-300/90 font-semibold uppercase tracking-wider">Your keys · your funds · revocable</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-white/60 leading-relaxed mb-4">
          The bot never holds your funds or your main key. We set spend caps (max per trade + daily limit) and the sniper
          pre-stages matched trades within those limits. You approve each fill in-app — you always sign your own trades,
          and you can revoke anytime. Hands-off auto-signing arrives with the on-chain relayer upgrade.
        </p>

        {/* Chain */}
        <label className="block text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Chain</label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {EVM_CHAINS.map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                chain === c ? 'bg-[#0066FF]/20 border-[#0066FF]/50 text-blue-200' : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <ChainLogo chain={c} size={14} />{CHAIN_CONFIGS[c].name}
            </button>
          ))}
        </div>

        {/* Caps */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <CapInput label="Max per trade (USD)" value={maxPerTrade} onChange={setMaxPerTrade} min={1} max={500} />
          <CapInput label="Daily cap (USD)" value={dailyCap} onChange={setDailyCap} min={1} max={5000} />
        </div>
        <label className="block text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Authorization window</label>
        <div className="flex gap-1.5 mb-4">
          {[6, 24, 72, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                hours === h ? 'bg-[#0066FF]/20 border-[#0066FF]/50 text-blue-200' : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
              }`}
            >{h < 24 ? `${h}h` : `${h / 24}d`}</button>
          ))}
        </div>

        {error && <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

        <button
          onClick={authorize}
          disabled={busy}
          className="nl-btn-neon w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {busy ? 'Awaiting signature…' : 'Authorize Trading Wallet'}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-white/35">
          <Wallet className="w-3 h-3" /> Session key stays in this browser — never uploaded.
        </p>
      </div>
    </div>,
    document.body,
  );
}

function CapInput({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#0066FF]/50"
      />
    </div>
  );
}
