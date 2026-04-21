'use client';

/**
 * Batch 9 — Portfolio + Trade History bottom panel on the coin detail
 * page. Matches checkprice desktop layout (bottom of their screenshot):
 *
 *   [ Portfolio | Trade History ]
 *   ASSET · BALANCE · AVG ENTRY · CURRENT PRICE · COST BASIS · UPNL · QUICK SELL
 *
 * Uses existing /api/trading/positions and /api/trading/order-history
 * endpoints. Defensive against shape variations (column getters fall
 * back to "—" when a field is missing).
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Tab = 'portfolio' | 'history';

export default function PortfolioHistoryPanel() {
  const [tab, setTab] = useState<Tab>('portfolio');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = tab === 'portfolio' ? '/api/trading/positions' : '/api/trading/order-history';
    fetch(url, { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        const arr = data.positions ?? data.history ?? data.orders ?? data.data ?? (Array.isArray(data) ? data : []);
        setRows(arr);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="border-t border-slate-800/50 bg-slate-950/40">
      <div className="flex items-center gap-4 px-4 pt-3 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab('portfolio')}
          className={`pb-2 border-b-2 ${tab === 'portfolio' ? 'border-emerald-400 text-white' : 'border-transparent text-slate-500 hover:text-white'}`}
        >
          Portfolio
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`pb-2 border-b-2 ${tab === 'history' ? 'border-emerald-400 text-white' : 'border-transparent text-slate-500 hover:text-white'}`}
        >
          Trade History
        </button>
      </div>

      <div className="px-4 py-3 overflow-x-auto">
        {loading ? (
          <div className="py-6 text-center text-[11px] text-slate-500 inline-flex items-center gap-2 w-full justify-center">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-slate-500">
            {tab === 'portfolio' ? 'No spot holdings' : 'No trade history yet'}
          </div>
        ) : tab === 'portfolio' ? (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                <th className="text-left pb-2">Asset</th>
                <th className="text-right pb-2">Balance</th>
                <th className="text-right pb-2">Avg Entry</th>
                <th className="text-right pb-2">Current Price</th>
                <th className="text-right pb-2">Cost Basis</th>
                <th className="text-right pb-2">UPNL</th>
                <th className="text-right pb-2">Quick Sell</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const upnl = Number(p.unrealized_pnl_usd ?? p.pnl_usd ?? 0);
                return (
                  <tr key={p.id ?? i} className="border-t border-slate-900/60 font-mono tabular-nums">
                    <td className="py-2 text-slate-200">{p.token_symbol ?? p.symbol ?? '—'}</td>
                    <td className="py-2 text-right">{p.balance ?? p.amount ?? '—'}</td>
                    <td className="py-2 text-right">{p.avg_entry_price_usd ? `$${Number(p.avg_entry_price_usd).toFixed(4)}` : '—'}</td>
                    <td className="py-2 text-right">{p.current_price_usd ? `$${Number(p.current_price_usd).toFixed(4)}` : '—'}</td>
                    <td className="py-2 text-right">{p.cost_basis_usd ? `$${Number(p.cost_basis_usd).toFixed(2)}` : '—'}</td>
                    <td className={`py-2 text-right ${upnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {upnl === 0 ? '—' : `${upnl >= 0 ? '+' : ''}$${upnl.toFixed(2)}`}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('market:quick-sell', { detail: { symbol: p.token_symbol ?? p.symbol } }))}
                        className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      >
                        Sell
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                <th className="text-left pb-2">When</th>
                <th className="text-left pb-2">Side</th>
                <th className="text-left pb-2">Pair</th>
                <th className="text-right pb-2">Amount USD</th>
                <th className="text-right pb-2">Status</th>
                <th className="text-right pb-2">Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o, i) => (
                <tr key={o.id ?? i} className="border-t border-slate-900/60 font-mono tabular-nums">
                  <td className="py-2 text-slate-400">{o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td>
                  <td className={`py-2 ${(o.side ?? '').toLowerCase() === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>{o.side ?? '—'}</td>
                  <td className="py-2 text-slate-200">{o.token_in ?? '—'} → {o.token_out ?? '—'}</td>
                  <td className="py-2 text-right">{o.amount_in_usd ? `$${Number(o.amount_in_usd).toLocaleString()}` : '—'}</td>
                  <td className="py-2 text-right text-slate-400">{o.status ?? '—'}</td>
                  <td className="py-2 text-right text-slate-500">{o.tx_hash ? `${o.tx_hash.slice(0, 10)}…` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
