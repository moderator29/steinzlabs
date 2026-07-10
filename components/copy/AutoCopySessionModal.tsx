'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import { getAccount } from '@wagmi/core';
import { Loader2, ShieldCheck, X, KeyRound, Copy, Trash2, Check } from 'lucide-react';
import { wagmiAdapter, getAppKit } from '@/lib/wallet/appkit';

/**
 * Enable 24/7 non-custodial Auto-Copy via a delegated session key.
 *
 * Mirrors the Sniper session-key flow (EIP-712 "NakaLabs Session Key") but for
 * copy-trading: a fresh session EOA is generated in-browser, the main wallet
 * signs a hard-capped, time-boxed authorization, and — for headless execution —
 * the session key is sent over TLS and stored ENCRYPTED at rest so the relayer
 * can mirror trades within your caps even while the app is closed. You fund the
 * session address with only the USDC budget you want automated, and can revoke
 * any time. Your MAIN wallet key never leaves the browser.
 */

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

const EVM_CHAINS = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc'] as const;
type EvmChain = typeof EVM_CHAINS[number];

const USDC_BY_CHAIN: Record<EvmChain, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
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

interface SessionKey {
  id: string;
  session_address: string;
  chain: string;
  max_per_trade_usd: number;
  daily_cap_usd: number;
  expires_at: string;
  revoked_at: string | null;
}

export function AutoCopySessionModal({ onClose }: { onClose: () => void }) {
  const [chain, setChain] = useState<EvmChain>('base');
  const [maxPerTrade, setMaxPerTrade] = useState(50);
  const [dailyCap, setDailyCap] = useState(250);
  const [hours, setHours] = useState(72);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ address: string; chain: EvmChain } | null>(null);
  const [keys, setKeys] = useState<SessionKey[]>([]);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/session-key', { cache: 'no-store' });
      if (res.ok) { const j = await res.json(); setKeys((j.session_keys ?? []) as SessionKey[]); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const authorize = async () => {
    setBusy(true);
    setError(null);
    try {
      let resolved = await getEvmProvider();
      if (!resolved) {
        getAppKit()?.open();
        setError('Approve the connection in your wallet…');
        for (let i = 0; i < 120 && !resolved; i++) {
          await new Promise((r) => setTimeout(r, 500));
          resolved = await getEvmProvider();
        }
        if (!resolved) { setError('Wallet not connected yet. Tap Enable to try again.'); setBusy(false); return; }
        setError(null);
      }
      const { provider, address: mainAddress } = resolved;

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

      const signature = (await provider.request({
        method: 'eth_signTypedData_v4',
        params: [mainAddress, JSON.stringify(typedData)],
      })) as string;

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
          // 24/7 mode — server stores this ENCRYPTED so the relayer can execute
          // within the signed caps while the app is closed.
          session_private_key: session.privateKey,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Authorization failed');

      setCreated({ address: session.address, chain });
      await loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authorization failed');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      const res = await fetch(`/api/trading/session-key?id=${id}`, { method: 'DELETE' });
      if (res.ok) await loadKeys();
    } catch { /* silent */ }
  };

  const copyAddr = async (addr: string) => {
    try { await navigator.clipboard.writeText(addr); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };

  const activeKeys = keys.filter((k) => !k.revoked_at && new Date(k.expires_at).getTime() > Date.now());

  const body = (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-md nl-glass rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#8FA3FF]" />
          <h2 className="font-bold">24/7 Auto-Copy</h2>
          <button onClick={onClose} aria-label="Close" className="ms-auto p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!created ? (
            <>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[#0066FF]/10 border border-[#0066FF]/25">
                <ShieldCheck className="w-4 h-4 text-[#8FA3FF] shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Mirrors trades 24/7, even with the app closed, within the caps you sign below.
                  A scoped session key (never your main wallet) executes the swaps; fund it with only
                  the budget you want automated and revoke anytime.
                </p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Chain</label>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {EVM_CHAINS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChain(c)}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold capitalize border transition-colors ${
                        chain === c ? 'bg-[#0066FF]/15 text-[#8FA3FF] border-[#0066FF]/40' : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>

              <NumberRow label="Max per trade (USD)" value={maxPerTrade} setValue={setMaxPerTrade} step={10} />
              <NumberRow label="Daily cap (USD)" value={dailyCap} setValue={setDailyCap} step={50} />
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500">Authorization window</label>
                  <span className="text-xs font-mono">{hours}h</span>
                </div>
                <input type="range" min={1} max={168} step={1} value={hours} onChange={(e) => setHours(parseInt(e.target.value, 10))} className="w-full accent-[#0066FF] mt-1" />
                <p className="text-[10px] text-slate-500 mt-1">Auto-copy stops when this expires. Re-authorize to extend (max 7 days).</p>
              </div>

              {error && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>}

              <button onClick={authorize} disabled={busy} className="nl-btn-neon w-full !py-3 !text-sm font-bold">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Awaiting signature…</> : 'Sign & Enable 24/7 Auto-Copy'}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-200 leading-relaxed">
                  Authorized. Final step: fund the session wallet with USDC on <span className="capitalize font-semibold">{created.chain}</span>.
                  Auto-copy buys spend from this balance; it can never exceed what you deposit.
                </p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Send USDC to</label>
                <button onClick={() => copyAddr(created.address)} className="mt-1 w-full nl-glass rounded-lg px-3 py-2 flex items-center gap-2 text-start">
                  <span className="font-mono text-[11px] text-slate-200 truncate flex-1">{created.address}</span>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
                <p className="text-[10px] text-slate-500 mt-1 font-mono break-all">USDC ({created.chain}): {USDC_BY_CHAIN[created.chain]}</p>
              </div>
              <button onClick={onClose} className="nl-btn-neon w-full !py-3 !text-sm font-bold">Done</button>
            </>
          )}

          {activeKeys.length > 0 && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Active session keys</div>
              {activeKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-2 text-[11px]">
                  <span className="capitalize text-slate-400">{k.chain}</span>
                  <span className="font-mono text-slate-300 truncate flex-1">{k.session_address.slice(0, 8)}…{k.session_address.slice(-4)}</span>
                  <span className="text-slate-500">${Number(k.daily_cap_usd).toLocaleString()}/d</span>
                  <button onClick={() => revoke(k.id)} title="Revoke" className="p-1 rounded text-rose-400 hover:bg-rose-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(body, document.body);
}

function NumberRow({ label, value, setValue, step }: { label: string; value: number; setValue: (n: number) => void; step: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        min={0}
        onChange={(e) => setValue(parseInt(e.target.value || '0', 10) || 0)}
        className="nl-glass w-28 rounded-lg px-2 py-1 text-xs font-mono text-end outline-none focus:border-[#0066FF]/50"
      />
    </div>
  );
}
