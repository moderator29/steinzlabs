'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, Bell, BellRing, Volume2, VolumeX, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fmtUSD, timeAgo } from './sniperShared';

// ─── Limit Orders ─────────────────────────────────────────────────────────

interface LimitOrder {
  id: string;
  chain: string;
  from_token_symbol: string | null;
  to_token_symbol: string | null;
  from_amount: number;
  trigger_price_usd: number;
  trigger_direction: 'above' | 'below';
  status: string;
  created_at: string;
  expires_at: string | null;
}

export function LimitOrdersTab() {
  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/limit-orders', { cache: 'no-store' });
      const j = await res.json();
      setOrders(Array.isArray(j?.orders) ? j.orders : []);
    } catch { /* keep */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cancel = async (id: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'cancelled' } : o)));
    await fetch(`/api/trading/limit-orders/${id}`, { method: 'DELETE' }).catch(() => {});
    load();
  };

  if (loading) return <div className="nl-glass rounded-xl p-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-400" /></div>;
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-white/10 p-12 text-center">
        <Clock className="w-10 h-10 mx-auto mb-3 text-white/25" />
        <h3 className="text-base font-bold mb-1">No limit orders</h3>
        <p className="text-white/50 text-sm">Open a token and set a limit, or create one from Swap. Orders execute non-custodially when your price triggers.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {orders.map((o) => {
        const active = o.status === 'active';
        return (
          <div key={o.id} className="nl-glass rounded-xl p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${o.trigger_direction === 'above' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              {o.trigger_direction === 'above' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{o.from_token_symbol ?? '—'} → {o.to_token_symbol ?? '—'} <span className="text-[10px] uppercase tracking-wider text-white/40">{o.chain}</span></div>
              <div className="text-[11px] text-white/50">{fmtUSD(o.from_amount)} when price {o.trigger_direction} ${o.trigger_price_usd} · {timeAgo(o.created_at)}</div>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shrink-0 ${active ? 'text-blue-300 bg-blue-500/15 border-blue-500/30' : o.status === 'filled' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' : 'text-white/50 bg-white/5 border-white/10'}`}>{o.status}</span>
            {active && <button onClick={() => cancel(o.id)} title="Cancel" className="p-1.5 rounded-lg text-white/50 hover:bg-red-500/20 hover:text-red-300 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Alerts ──────────────────────────────────────────────────────────────

interface PriceAlert {
  id: string;
  token_symbol: string;
  target_price: number;
  direction: 'above' | 'below';
  is_triggered: boolean;
  created_at: string;
}

const SOUND_KEY = 'naka_sniper_alert_sound';

export function AlertsTab() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    try { setSound(localStorage.getItem(SOUND_KEY) !== '0'); } catch { /* default on */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market/alerts', { cache: 'no-store' });
      const j = await res.json();
      setAlerts(Array.isArray(j?.alerts) ? j.alerts : []);
    } catch { /* keep */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleSound = () => {
    setSound((s) => {
      const next = !s;
      try { localStorage.setItem(SOUND_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const remove = async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/market/alerts?id=${id}`, { method: 'DELETE' }).catch(() => {});
  };

  if (loading) return <div className="nl-glass rounded-xl p-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-400" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/50 font-medium">{alerts.length} active {alerts.length === 1 ? 'alert' : 'alerts'}</span>
        <button onClick={toggleSound} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${sound ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.04] border-white/10 text-white/50'}`}>
          {sound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />} Sound {sound ? 'on' : 'off'}
        </button>
      </div>
      {alerts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-white/10 p-12 text-center">
          <Bell className="w-10 h-10 mx-auto mb-3 text-white/25" />
          <h3 className="text-base font-bold mb-1">No alerts set</h3>
          <p className="text-white/50 text-sm">Open a token and tap “Set Alert” to get pinged on price moves — in your notifications and (optionally) with a sound.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {alerts.map((a) => (
            <div key={a.id} className="nl-glass rounded-xl p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.direction === 'above' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                <BellRing className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{a.token_symbol}</div>
                <div className="text-[11px] text-white/50">Alert when price {a.direction} ${a.target_price} · {timeAgo(a.created_at)}</div>
              </div>
              <button onClick={() => remove(a.id)} title="Delete" className="p-1.5 rounded-lg text-white/50 hover:bg-red-500/20 hover:text-red-300 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Realtime alert-trigger listener — plays a sound + fires when one of the
 *  user's price alerts flips to triggered. Mounted once at terminal level. */
export function useAlertSound(userId: string | undefined) {
  useEffect(() => {
    if (!userId || !supabase) return;
    const channel = supabase
      .channel(`price-alerts-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'price_alerts', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { triggered?: boolean };
          if (!row?.triggered) return;
          let on = true;
          try { on = localStorage.getItem(SOUND_KEY) !== '0'; } catch { /* default on */ }
          if (!on) return;
          try {
            const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
            const ctx = new Ctx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880; osc.type = 'sine';
            gain.gain.setValueAtTime(0.001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.42);
          } catch { /* audio blocked until user gesture — silent */ }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);
}
