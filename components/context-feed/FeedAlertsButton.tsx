'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Plus, Trash2, X } from 'lucide-react';

/**
 * FeedAlertsButton — manage per-user Context Feed alerts. Create an alert for a
 * slice of the feed (chain + kind + thresholds); the feed-alert-monitor cron
 * matches new events and delivers a real-time notification via the bell.
 * Glass blue-stride styling to match the platform.
 */

interface FeedAlert {
  id: string;
  label: string;
  chain: string | null;
  kind: string;
  min_volume_usd: number | null;
  min_price_change_pct: number | null;
  active: boolean;
}

const CHAINS = ['', 'ethereum', 'base', 'arbitrum', 'optimism', 'bsc', 'polygon', 'avalanche', 'solana'];
const KINDS = [
  { id: 'any', label: 'Any signal' },
  { id: 'new_coin', label: 'New coins' },
  { id: 'volume', label: 'Volume' },
  { id: 'trending', label: 'Trending' },
  { id: 'smart_money', label: 'Smart money' },
  { id: 'rug', label: 'Rug alerts' },
];

export function FeedAlertsButton() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<FeedAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // form
  const [chain, setChain] = useState('');
  const [kind, setKind] = useState('any');
  const [minVol, setMinVol] = useState('');
  const [minPct, setMinPct] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/context-feed/alerts', { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); setAlerts(j.alerts ?? []); }
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) void load(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const create = async () => {
    setSaving(true); setErr(null);
    try {
      const kindLabel = KINDS.find((k) => k.id === kind)?.label ?? 'Any';
      const label = `${kindLabel}${chain ? ` · ${chain}` : ''}${minVol ? ` · vol≥$${minVol}` : ''}`;
      const body: Record<string, unknown> = { label, kind };
      if (chain) body.chain = chain;
      if (minVol) body.min_volume_usd = Number(minVol);
      if (minPct) body.min_price_change_pct = Number(minPct);
      const r = await fetch('/api/context-feed/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) { const j = await r.json().catch(() => null); setErr(j?.error ?? 'Could not create alert'); return; }
      setMinVol(''); setMinPct('');
      await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await fetch(`/api/context-feed/alerts?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="nl-glass inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white hover:-translate-y-px transition"
        style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 12px rgba(0,102,255,.18)' }}
        title="Feed alerts"
      >
        <Bell className="w-3.5 h-3.5 text-blue-300" />
        Alerts
      </button>

      {open && (
        <div className="absolute z-50 mt-1 right-0 w-[300px] rounded-xl border border-[#0066FF]/30 bg-[#0b0f1a] shadow-xl shadow-black/50 p-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.3), 0 0 22px rgba(0,102,255,.2)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">Feed Alerts</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {/* Create form */}
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <select value={chain} onChange={(e) => setChain(e.target.value)} className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white">
                {CHAINS.map((c) => <option key={c || 'any'} value={c}>{c || 'Any chain'}</option>)}
              </select>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white">
                {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={minVol} onChange={(e) => setMinVol(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="Min vol $ (opt)" className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-slate-500" />
              <input value={minPct} onChange={(e) => setMinPct(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="Min 24h % (opt)" className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-slate-500" />
            </div>
            {err && <div className="text-[10px] text-red-400">{err}</div>}
            <button
              onClick={() => void create()}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 55%,#1233AE 100%)', boxShadow: '0 0 14px rgba(0,102,255,.45)' }}
            >
              <Plus className="w-3.5 h-3.5" />{saving ? 'Creating…' : 'Create alert'}
            </button>
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {loading ? (
              <div className="text-[11px] text-slate-500">Loading…</div>
            ) : alerts.length === 0 ? (
              <div className="text-[11px] text-slate-500 italic">No alerts yet. Create one above and matches arrive in your notifications.</div>
            ) : alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-[#0066FF]/15">
                <span className="flex-1 min-w-0 text-[11px] text-slate-200 truncate">{a.label}</span>
                <button onClick={() => void remove(a.id)} className="shrink-0 text-slate-500 hover:text-red-400" aria-label="Delete alert"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
