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
 *
 * Audit M4 #7 — was rendering ALL user positions and ALL user trades
 * regardless of which token detail page they were on, so a user
 * looking at BTC saw their ETH and SOL positions too. Now optionally
 * scopes both tabs to the current token via the symbol/address props,
 * with a "Show all" toggle for users who want the global view back.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Tab = 'portfolio' | 'history';

interface Props {
  /** Current token's uppercase symbol — when set, panel filters to this asset by default. */
  scopeSymbol?: string;
  /** Current token's contract address — secondary match key when symbol is ambiguous. */
  scopeAddress?: string;
}

export default function PortfolioHistoryPanel({ scopeSymbol, scopeAddress }: Props = {}) {
  const [tab, setTab] = useState<Tab>('portfolio');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  // Scoped-by-default when we know which token to filter on. The
  // toggle lets a user fall back to the cross-token view.
  const [scopeFilter, setScopeFilter] = useState<boolean>(!!scopeSymbol);

  useEffect(() => {
    setLoading(true);
    const url = tab === 'portfolio' ? '/api/trading/positions' : '/api/trading/order-history';
    fetch(url, { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        const arr = (data.positions ?? data.history ?? data.orders ?? data.data ?? (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
        setRows(arr);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const visibleRows = useMemo(() => {
    if (!scopeFilter || !scopeSymbol) return rows;
    const upper = scopeSymbol.toUpperCase();
    const addr = scopeAddress?.toLowerCase();
    return rows.filter((r) => {
      const sym = String(r.token_symbol ?? r.symbol ?? r.token_in ?? r.token_out ?? '').toUpperCase();
      if (sym === upper) return true;
      if (addr) {
        const inAddr = String(r.token_in_address ?? r.token_in ?? '').toLowerCase();
        const outAddr = String(r.token_out_address ?? r.token_out ?? '').toLowerCase();
        if (inAddr === addr || outAddr === addr) return true;
      }
      return false;
    });
  }, [rows, scopeFilter, scopeSymbol, scopeAddress]);

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
        {scopeSymbol && (
          <button
            type="button"
            onClick={() => setScopeFilter((v) => !v)}
            className="ms-auto pb-2 text-[10px] uppercase tracking-wide text-slate-400 hover:text-white"
            title={scopeFilter ? `Showing only ${scopeSymbol}. Click for all assets.` : 'Showing all assets. Click to filter to this token.'}
          >
            {scopeFilter ? `Filter · ${scopeSymbol}` : 'Filter · All assets'}
          </button>
        )}
      </div>

      <div className="px-4 py-3 overflow-x-auto">
        {loading ? (
          <div className="py-6 text-center text-[11px] text-slate-500 inline-flex items-center gap-2 w-full justify-center">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-slate-500">
            {tab === 'portfolio' ? 'No spot holdings' : 'No trade history yet'}
          </div>
        ) : tab === 'portfolio' ? (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                <th className="text-start pb-2">Asset</th>
                <th className="text-end pb-2">Balance</th>
                <th className="text-end pb-2">Avg Entry</th>
                <th className="text-end pb-2">Current Price</th>
                <th className="text-end pb-2">Cost Basis</th>
                <th className="text-end pb-2">UPNL</th>
                <th className="text-end pb-2">Quick Sell</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => {
                // Defensive cast — /api/trading/positions returns one
                // shape today but we want to tolerate future field
                // additions without breaking. CLAUDE.md no-any rule
                // exception, justified by the dynamic JSON shape.
                const p = row as Record<string, string | number | null | undefined>;
                const upnl = Number(p.unrealized_pnl_usd ?? p.pnl_usd ?? 0);
                const sym = (p.token_symbol ?? p.symbol ?? '—') as string;
                return (
                  <tr key={String(p.id ?? i)} className="border-t border-slate-900/60 font-mono tabular-nums">
                    <td className="py-2 text-slate-200">{sym}</td>
                    <td className="py-2 text-end">{p.balance ?? p.amount ?? '—'}</td>
                    <td className="py-2 text-end">{p.avg_entry_price_usd ? `$${Number(p.avg_entry_price_usd).toFixed(4)}` : '—'}</td>
                    <td className="py-2 text-end">{p.current_price_usd ? `$${Number(p.current_price_usd).toFixed(4)}` : '—'}</td>
                    <td className="py-2 text-end">{p.cost_basis_usd ? `$${Number(p.cost_basis_usd).toFixed(2)}` : '—'}</td>
                    <td className={`py-2 text-end ${upnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {upnl === 0 ? '—' : `${upnl >= 0 ? '+' : ''}$${upnl.toFixed(2)}`}
                    </td>
                    <td className="py-2 text-end">
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('market:quick-sell', { detail: { symbol: sym } }))}
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
                <th className="text-start pb-2">When</th>
                <th className="text-start pb-2">Side</th>
                <th className="text-start pb-2">Pair</th>
                <th className="text-end pb-2">Amount USD</th>
                <th className="text-end pb-2">Status</th>
                <th className="text-end pb-2">Tx</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => {
                const o = row as Record<string, string | number | null | undefined>;
                const side = String(o.side ?? '');
                const txHash = String(o.tx_hash ?? '');
                return (
                  <tr key={String(o.id ?? i)} className="border-t border-slate-900/60 font-mono tabular-nums">
                    <td className="py-2 text-slate-400">{o.created_at ? new Date(String(o.created_at)).toLocaleString() : '—'}</td>
                    <td className={`py-2 ${side.toLowerCase() === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>{side || '—'}</td>
                    <td className="py-2 text-slate-200">{o.token_in ?? '—'} → {o.token_out ?? '—'}</td>
                    <td className="py-2 text-end">{o.amount_in_usd ? `$${Number(o.amount_in_usd).toLocaleString()}` : '—'}</td>
                    <td className="py-2 text-end text-slate-400">{o.status ?? '—'}</td>
                    <td className="py-2 text-end text-slate-500">{txHash ? `${txHash.slice(0, 10)}…` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
