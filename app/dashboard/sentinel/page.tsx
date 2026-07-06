'use client';

import { useEffect, useState } from 'react';
import { Loader2, Radar, Plus, Trash2, Coins, Wallet, AlertTriangle } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface Snapshot {
  kind?: 'token' | 'wallet';
  symbol?: string | null;
  priceUsd?: number | null;
  liquidityUsd?: number | null;
  convergenceWallets?: number;
  lastMoveCount?: number;
}
interface Sentinel {
  id: string;
  target_type: 'token' | 'wallet';
  target: string;
  chain: string;
  label: string;
  active: boolean;
  last_checked_at: string | null;
  last_snapshot: Snapshot | null;
  created_at: string;
}

const CHAINS = ['ethereum', 'solana', 'base', 'bsc', 'arbitrum', 'polygon'];

function short(a: string): string { return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function SentinelPage() {
  const [list, setList] = useState<Sentinel[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetType, setTargetType] = useState<'token' | 'wallet'>('token');
  const [chain, setChain] = useState('ethereum');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/sentinels', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { sentinels: [] }))
      .then((d) => setList(d.sentinels ?? []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const t = target.trim();
    if (t.length < 8) { setErr('Enter a valid address.'); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sentinels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, chain, target: t, label: label.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'Could not create sentinel.'); return; }
      setTarget(''); setLabel('');
      load();
    } catch { setErr('Network error.'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    await fetch(`/api/sentinels?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setList((l) => l.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton />
        <h1 className="text-lg font-bold flex items-center gap-2"><Radar className="w-5 h-5 text-[#0066FF]" /> VTX Sentinel</h1>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Autonomous watches. Point a sentinel at a token or wallet and it decides for itself what&rsquo;s material — a big price or liquidity move, smart money converging, a large cohort trade — and only pings you when something <span className="text-white">real</span> changes. No thresholds to guess.
      </p>

      <div className="nl-glass rounded-xl p-4 mb-4 space-y-3">
        <div className="flex gap-1.5">
          {(['token', 'wallet'] as const).map((tt) => (
            <button key={tt} onClick={() => setTargetType(tt)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${targetType === tt ? 'bg-[#0066FF]/20 text-[#8FA3FF] border border-[#0066FF]/40' : 'bg-white/[0.04] text-slate-400 border border-white/10'}`}>
              {tt === 'token' ? <Coins className="w-3.5 h-3.5" /> : <Wallet className="w-3.5 h-3.5" />} {tt}
            </button>
          ))}
          <select value={chain} onChange={(e) => setChain(e.target.value)} className="ml-auto bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs capitalize focus:outline-none">
            {CHAINS.map((c) => <option key={c} value={c} className="bg-[#0A0E27]">{c}</option>)}
          </select>
        </div>
        <input value={target} onChange={(e) => setTarget(e.target.value)}
          placeholder={targetType === 'token' ? 'Token contract address' : 'Wallet address'}
          className="w-full bg-[#0A0E27] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF]/40 placeholder-gray-600" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)"
          className="w-full bg-[#0A0E27] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0066FF]/40 placeholder-gray-600" />
        {err && <div className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {err}</div>}
        <button onClick={create} disabled={busy} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0066FF] text-sm font-semibold disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Deploy sentinel</>}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
      ) : list.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">No sentinels yet. Deploy one above.</p>
      ) : (
        <div className="space-y-2">
          {list.map((s) => {
            const snap = s.last_snapshot;
            let summary = 'Baseline recorded — watching for change.';
            if (snap?.kind === 'token') {
              const parts: string[] = [];
              if (snap.priceUsd) parts.push(`$${snap.priceUsd.toPrecision(3)}`);
              if (snap.liquidityUsd) parts.push(`${(snap.liquidityUsd / 1000).toFixed(0)}K liq`);
              if (snap.convergenceWallets) parts.push(`${snap.convergenceWallets} converging`);
              if (parts.length) summary = parts.join(' · ');
            } else if (snap?.kind === 'wallet') {
              summary = `${snap.lastMoveCount ?? 0} recent moves tracked`;
            }
            return (
              <div key={s.id} className="nl-glass rounded-xl p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {s.target_type === 'token' ? <Coins className="w-3.5 h-3.5 text-[#8FA3FF]" /> : <Wallet className="w-3.5 h-3.5 text-[#8FA3FF]" />}
                    <span className="truncate">{s.label || short(s.target)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{s.chain} · {summary}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">Checked {ago(s.last_checked_at)}</div>
                </div>
                <button onClick={() => remove(s.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-[#EF4444] shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-slate-600 mt-4 text-center">Sentinels are evaluated automatically every ~30 minutes against live data. Alerts arrive in your notifications.</p>
    </div>
  );
}
