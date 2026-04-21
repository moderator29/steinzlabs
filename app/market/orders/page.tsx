'use client';

/**
 * §5.4 — Market orders hub. One page, 5 tabs, one per order-type backend:
 *
 *   - Limit Orders    → /api/trading/limit-orders
 *   - Positions       → /api/trading/positions
 *   - Order History   → /api/trading/order-history
 *   - Stop/TP         → /api/trading/stop-loss
 *   - DCA Bots        → /api/trading/dca-bots
 *
 * Each tab shows a simple table. Empty state links to the coin-detail
 * page so users can place an order. No new backend work — everything
 * already exists; this is pure surface.
 */

import { useState, useEffect } from 'react';
import { Clock, Target, Activity, Bot, History, Loader2, type LucideIcon } from 'lucide-react';

type Tab = 'limit' | 'positions' | 'history' | 'stop' | 'dca';

const TABS: { id: Tab; label: string; icon: LucideIcon; endpoint: string }[] = [
  { id: 'limit',     label: 'Limit Orders',   icon: Clock,    endpoint: '/api/trading/limit-orders' },
  { id: 'positions', label: 'Positions',      icon: Activity, endpoint: '/api/trading/positions' },
  { id: 'history',   label: 'Order History',  icon: History,  endpoint: '/api/trading/order-history' },
  { id: 'stop',      label: 'Stop / TP',      icon: Target,   endpoint: '/api/trading/stop-loss' },
  { id: 'dca',       label: 'DCA Bots',       icon: Bot,      endpoint: '/api/trading/dca-bots' },
];

export default function MarketOrdersPage() {
  const [tab, setTab] = useState<Tab>('limit');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const active = TABS.find((t) => t.id === tab);
    if (!active) return;
    setLoading(true);
    setError(null);
    fetch(active.endpoint, { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        // Each backend returns under a different key — normalize to an array.
        const arr = data.orders ?? data.positions ?? data.history ?? data.rules ?? data.bots ?? data.data ?? (Array.isArray(data) ? data : []);
        setRows(arr);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-1">Orders</h1>
      <p className="text-xs text-slate-500 mb-5">Track your open orders, active positions, and automated trades across all chains.</p>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800/50 mb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active ? 'border-[#0A1EFF] text-white' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 inline-flex items-center gap-2 w-full justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="py-8 px-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          Failed to load: {error}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <Table tab={tab} rows={rows} />
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const copy: Record<Tab, { title: string; body: string }> = {
    limit:     { title: 'No limit orders',   body: 'Open a coin and place a limit order to buy or sell at a target price.' },
    positions: { title: 'No open positions', body: 'Your currently-held tokens with live PnL show here once you buy.' },
    history:   { title: 'No order history',  body: 'Completed trades appear here — both manual and automated.' },
    stop:      { title: 'No stop/TP rules',  body: 'Protect positions with a stop-loss or lock in profits with a take-profit.' },
    dca:       { title: 'No DCA bots',       body: 'Dollar-cost-average into any token on a recurring schedule.' },
  };
  const c = copy[tab];
  return (
    <div className="py-16 px-6 rounded-xl border border-slate-800/70 bg-slate-900/30 text-center">
      <p className="font-semibold text-slate-200 mb-1">{c.title}</p>
      <p className="text-xs text-slate-500 max-w-md mx-auto">{c.body}</p>
    </div>
  );
}

function Table({ tab, rows }: { tab: Tab; rows: any[] }) {
  // Pick a small set of columns per tab that make sense for each data shape.
  // Backends vary — be defensive; a missing key renders as "—".
  const cols: Record<Tab, Array<{ label: string; pick: (r: any) => string }>> = {
    limit: [
      { label: 'Pair',   pick: (r) => `${r.token_in ?? r.sell_symbol ?? '—'} → ${r.token_out ?? r.buy_symbol ?? '—'}` },
      { label: 'Side',   pick: (r) => r.side ?? r.direction ?? '—' },
      { label: 'Price',  pick: (r) => r.limit_price ? `$${Number(r.limit_price).toFixed(4)}` : '—' },
      { label: 'Amount', pick: (r) => r.amount_in_usd ? `$${Number(r.amount_in_usd).toLocaleString()}` : '—' },
      { label: 'Status', pick: (r) => r.status ?? '—' },
      { label: 'Created', pick: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    ],
    positions: [
      { label: 'Token',  pick: (r) => r.token_symbol ?? r.symbol ?? '—' },
      { label: 'Chain',  pick: (r) => (r.chain ?? '—').toUpperCase() },
      { label: 'Amount', pick: (r) => r.balance ?? r.amount ?? '—' },
      { label: 'Entry',  pick: (r) => r.avg_entry_price_usd ? `$${Number(r.avg_entry_price_usd).toFixed(4)}` : '—' },
      { label: 'Current', pick: (r) => r.current_price_usd ? `$${Number(r.current_price_usd).toFixed(4)}` : '—' },
      { label: 'PnL',    pick: (r) => {
        const v = r.pnl_usd ?? r.unrealized_pnl_usd;
        if (v == null) return '—';
        return `${Number(v) >= 0 ? '+' : ''}$${Number(v).toFixed(2)}`;
      } },
    ],
    history: [
      { label: 'Pair',   pick: (r) => `${r.token_in ?? '—'} → ${r.token_out ?? '—'}` },
      { label: 'Side',   pick: (r) => r.side ?? '—' },
      { label: 'Amount', pick: (r) => r.amount_in_usd ? `$${Number(r.amount_in_usd).toLocaleString()}` : '—' },
      { label: 'Tx',     pick: (r) => r.tx_hash ? `${r.tx_hash.slice(0, 10)}…` : '—' },
      { label: 'Status', pick: (r) => r.status ?? '—' },
      { label: 'When',   pick: (r) => r.created_at ? new Date(r.created_at).toLocaleString() : '—' },
    ],
    stop: [
      { label: 'Token',    pick: (r) => r.token_symbol ?? '—' },
      { label: 'Type',     pick: (r) => r.rule_type ?? r.type ?? '—' },
      { label: 'Trigger',  pick: (r) => r.trigger_price_usd ? `$${Number(r.trigger_price_usd).toFixed(4)}` : '—' },
      { label: 'Amount',   pick: (r) => r.amount_pct ? `${r.amount_pct}%` : '—' },
      { label: 'Active',   pick: (r) => (r.active ?? r.is_active) ? 'Yes' : 'No' },
    ],
    dca: [
      { label: 'Bot',       pick: (r) => r.name ?? r.token_symbol ?? '—' },
      { label: 'Interval',  pick: (r) => r.interval ?? r.frequency ?? '—' },
      { label: 'Amount',    pick: (r) => r.amount_per_run_usd ? `$${Number(r.amount_per_run_usd).toFixed(2)}` : '—' },
      { label: 'Runs',      pick: (r) => r.runs_completed ?? '—' },
      { label: 'Status',    pick: (r) => r.status ?? (r.active ? 'active' : 'paused') },
    ],
  };

  const activeCols = cols[tab];

  return (
    <div className="rounded-xl border border-slate-800/70 overflow-hidden overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/60 border-b border-slate-800">
          <tr>
            {activeCols.map((c) => (
              <th key={c.label} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-b border-slate-900/50 hover:bg-slate-900/30">
              {activeCols.map((c) => (
                <td key={c.label} className="px-3 py-2 text-slate-200 font-mono whitespace-nowrap">
                  {c.pick(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
