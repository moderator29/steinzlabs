'use client';

// Alerts Center — one place to see and manage EVERY alert a user has, across
// the fragmented tables where they live (the whale/price/launch builder's
// `alerts` table PLUS the separate price, wallet, trend and composite alert
// systems). Read + toggle + delete only; it never creates an alert, so it can
// never cause a surprise notification. Real, user-scoped data.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Bell, BellOff, Trash2, DollarSign, Fish, TrendingUp, Layers, Plus, Zap } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { alertsCenterHowItWorks } from '@/lib/howItWorks/content/alerts-center';

type AlertType = 'price' | 'wallet' | 'trend' | 'composite' | 'general';
interface AlertRow {
  id: string; type: AlertType; canToggle: boolean; enabled: boolean;
  title: string; subtitle: string; status: string | null;
  lastTriggered: string | null; createdAt: string;
}
interface Counts { total: number; active: number; price: number; wallet: number; trend: number; composite: number; general: number }

const TYPE_META: Record<AlertType, { label: string; Icon: typeof DollarSign; color: string }> = {
  general: { label: 'Alerts', Icon: Zap, color: '#00C8FF' },
  price: { label: 'Price', Icon: DollarSign, color: '#FFD86B' },
  wallet: { label: 'Wallet', Icon: Fish, color: '#00C8FF' },
  trend: { label: 'Trend', Icon: TrendingUp, color: '#10B981' },
  composite: { label: 'Composite', Icon: Layers, color: '#8B5CF6' },
};

function fmtAgo(iso: string | null): string {
  if (!iso) return 'never';
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function AlertsCenterPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AlertType>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/alerts/center', { cache: 'no-store', credentials: 'include' });
      const data = await res.json();
      if (res.status === 401) throw new Error('Sign in to manage your alerts.');
      if (!res.ok) throw new Error(data.error || 'Failed to load alerts');
      setAlerts(data.alerts ?? []);
      setCounts(data.counts ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (a: AlertRow) => {
    setBusy(a.id);
    setAlerts((prev) => prev.map((x) => x.id === a.id && x.type === a.type ? { ...x, enabled: !x.enabled } : x));
    try {
      const res = await fetch('/api/alerts/center', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type: a.type, id: a.id, enabled: !a.enabled }),
      });
      if (!res.ok) throw new Error();
      setCounts((c) => c ? { ...c, active: c.active + (a.enabled ? -1 : 1) } : c);
    } catch {
      setAlerts((prev) => prev.map((x) => x.id === a.id && x.type === a.type ? { ...x, enabled: a.enabled } : x));
    } finally { setBusy(null); }
  };

  const remove = async (a: AlertRow) => {
    setBusy(a.id);
    const prev = alerts;
    setAlerts((p) => p.filter((x) => !(x.id === a.id && x.type === a.type)));
    try {
      const res = await fetch('/api/alerts/center', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type: a.type, id: a.id }),
      });
      if (!res.ok) throw new Error();
      setCounts((c) => c ? { ...c, total: c.total - 1, active: c.active - (a.enabled ? 1 : 0) } : c);
    } catch {
      setAlerts(prev);
    } finally { setBusy(null); }
  };

  const visible = filter === 'all' ? alerts : alerts.filter((a) => a.type === filter);

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Bell className="w-4 h-4 text-[#00C8FF]" /> Alerts Center</span>
        <HowItWorksButton content={alertsCenterHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">All your alerts, one place</h1>
        <p className="text-slate-400 text-sm mt-1">Every alert you’ve set, across the whole platform: see, pause, or remove them.</p>
      </div>

      {counts && (
        <div className="nl-glass rounded-xl p-3 mb-4 flex items-center justify-center gap-6 text-center text-xs">
          <div><div className="text-lg font-bold">{counts.total}</div><div className="text-slate-500">total</div></div>
          <div><div className="text-lg font-bold text-[#10B981]">{counts.active}</div><div className="text-slate-500">active</div></div>
          <div><div className="text-lg font-bold text-slate-400">{counts.total - counts.active}</div><div className="text-slate-500">paused</div></div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(['all', 'general', 'price', 'wallet', 'trend', 'composite'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filter === f ? 'bg-[#0066FF] text-white' : 'text-slate-400 bg-white/[0.04] border border-white/[0.08] hover:text-white'}`}>
            {f === 'all' ? 'All' : TYPE_META[f].label}{f !== 'all' && counts ? ` ${counts[f]}` : ''}
          </button>
        ))}
      </div>

      {error && (
        <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm mb-4">
          {error}{error.includes('Sign in') && <div className="mt-2"><Link href="/login" className="text-[#00C8FF] hover:underline">Sign in</Link></div>}
        </div>
      )}
      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && !error && visible.length === 0 && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">
          No {filter === 'all' ? '' : TYPE_META[filter].label.toLowerCase() + ' '}alerts yet.
          <div className="mt-2"><Link href="/dashboard/alerts" className="text-[#00C8FF] hover:underline text-xs">Create alerts in the builder →</Link></div>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((a) => {
          const m = TYPE_META[a.type];
          return (
            <div key={`${a.type}-${a.id}`} className={`nl-card rounded-xl p-3 flex items-center gap-3 ${!a.enabled ? 'opacity-60' : ''}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m.color}18` }}>
                <m.Icon className="w-4 h-4" style={{ color: m.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{a.title}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {a.subtitle}
                  {a.status === 'triggered' && <span className="text-[#FF1744]"> · triggered</span>}
                  {a.lastTriggered && <span> · last fired {fmtAgo(a.lastTriggered)}</span>}
                </div>
              </div>
              {a.canToggle ? (
                <button onClick={() => toggle(a)} disabled={busy === a.id} title={a.enabled ? 'Pause' : 'Resume'}
                  className={`p-1.5 rounded-lg transition-colors ${a.enabled ? 'text-[#10B981] hover:bg-[#10B981]/10' : 'text-slate-500 hover:bg-white/[0.06]'}`}>
                  {a.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              ) : (
                <span className="text-[9px] uppercase text-slate-600 px-1">{a.status}</span>
              )}
              <button onClick={() => remove(a)} disabled={busy === a.id} title="Delete" className="p-1.5 rounded-lg text-slate-500 hover:text-[#FF1744] hover:bg-[#FF1744]/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {!loading && !error && (
        <div className="mt-6 text-center">
          <Link href="/dashboard/alerts" className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white"><Plus className="w-3 h-3" /> Create new alert</Link>
        </div>
      )}
    </div>
  );
}
