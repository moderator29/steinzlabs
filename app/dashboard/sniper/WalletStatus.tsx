'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, ChevronDown, Trash2 } from 'lucide-react';
import { shortAddr } from './sniperShared';

interface SessionKey {
  id: string;
  session_address: string;
  main_address: string;
  chain: string;
  max_per_trade_usd: number;
  daily_cap_usd: number;
  expires_at: string;
  revoked_at: string | null;
}

function isActive(k: SessionKey): boolean {
  if (k.revoked_at) return false;
  return new Date(k.expires_at).getTime() > Date.now();
}

/**
 * Non-custodial Trading Wallet status pill. Reads the user's signed
 * session-key authorizations (real, from /api/trading/session-key) and
 * surfaces whether the bot is armed to execute within caps. Click → setup
 * modal (when none active) or manage/revoke (when active).
 */
export function WalletStatus({ onConnect, refreshKey }: { onConnect: () => void; refreshKey: number }) {
  const [keys, setKeys] = useState<SessionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/session-key', { cache: 'no-store' });
      const j = await res.json();
      setKeys(Array.isArray(j?.session_keys) ? j.session_keys : []);
    } catch { /* keep prior */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const active = keys.filter(isActive);

  const revoke = async (id: string) => {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)));
    await fetch(`/api/trading/session-key?id=${id}`, { method: 'DELETE' }).catch(() => {});
    load();
  };

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/50">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Wallet
      </span>
    );
  }

  if (active.length === 0) {
    return (
      <button
        onClick={onConnect}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs font-bold hover:bg-amber-500/20 transition"
      >
        <ShieldAlert className="w-4 h-4" /> Connect Trading Wallet
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-xs font-bold hover:bg-emerald-500/20 transition"
      >
        <ShieldCheck className="w-4 h-4" />
        <span className="hidden sm:inline">Armed · {active.length} wallet{active.length > 1 ? 's' : ''}</span>
        <span className="sm:hidden">Armed</span>
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 nl-glass rounded-xl p-2 z-50">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Trading Wallets</span>
              <button onClick={() => { setOpen(false); onConnect(); }} className="text-[11px] font-bold text-blue-300 hover:text-blue-200">+ Add</button>
            </div>
            {active.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04]">
                <div className="min-w-0">
                  <div className="text-xs font-semibold capitalize flex items-center gap-1.5">
                    {k.chain} · {shortAddr(k.session_address)}
                  </div>
                  <div className="text-[10px] text-white/45">
                    ${k.max_per_trade_usd}/trade · ${k.daily_cap_usd}/day · expires {new Date(k.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <button onClick={() => revoke(k.id)} title="Revoke" className="p-1.5 rounded-lg text-white/50 hover:bg-red-500/20 hover:text-red-300 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
