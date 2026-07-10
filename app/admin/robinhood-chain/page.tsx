'use client';

import { useState, useEffect, useCallback } from 'react';
import { Coins, RefreshCw, CheckCircle2 } from 'lucide-react';

interface RhGift {
  id: string;
  token_symbol: string | null;
  amount: number;
  amount_usd: number;
  tx_hash: string | null;
  status: string | null;
  created_at: string;
  sender: string | null;
  recipient: string | null;
}
interface RhData {
  chain: { id: string; label: string; short: string; chainId: number; color: string };
  stats: { gift_count: number; volume_usd: number };
  recent: RhGift[];
}

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}` };
}

function fmtUsd(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

export default function RobinhoodChainPage() {
  const [data, setData] = useState<RhData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/robinhood-chain', { headers: authHeader() });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('[admin/robinhood-chain] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasActivity = (data?.stats.gift_count ?? 0) > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Robinhood Chain</h1>
          <p className="text-xs text-gray-500 mt-0.5">Supported-chain status and gifting activity on Robinhood Chain</p>
        </div>
        <button onClick={load} disabled={loading} className="nl-button nl-button--ghost">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="nl-glass rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,200,5,0.12)' }}>
            <Coins className="w-5 h-5" style={{ color: '#00C805' }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Robinhood Chain</div>
            <div className="text-[11px] text-gray-500">Chain ID 4663 · HOOD · Arbitrum-Orbit L2</div>
          </div>
          <div className="ms-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />Supported
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="nl-glass rounded-2xl p-4">
          <div className="text-[11px] text-gray-400 mb-1">Gifts on Robinhood Chain</div>
          <div className="text-xl font-bold text-white tabular-nums">{(data?.stats.gift_count ?? 0).toLocaleString()}</div>
        </div>
        <div className="nl-glass rounded-2xl p-4">
          <div className="text-[11px] text-gray-400 mb-1">Volume (USD)</div>
          <div className="text-xl font-bold text-emerald-400 tabular-nums">{fmtUsd(data?.stats.volume_usd ?? 0)}</div>
        </div>
      </div>

      <div className="nl-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10"><h3 className="text-sm font-semibold text-white">Recent Activity</h3></div>
        {loading && !data ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <div className="w-4 h-4 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        ) : !hasActivity ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Coins className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-sm text-gray-400">No activity yet</p>
            <p className="text-xs text-gray-600 mt-1">Robinhood Chain is live and supported. Gifts will appear here once sent.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="border-b border-white/10"><tr>
                {['From', 'To', 'Token', 'USD', 'Status', 'Time'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-start text-gray-500 font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data!.recent.map((g) => (
                  <tr key={g.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-white">{g.sender ? `@${g.sender}` : '-'}</td>
                    <td className="px-4 py-2.5 text-white">{g.recipient ? `@${g.recipient}` : '-'}</td>
                    <td className="px-4 py-2.5 text-gray-300">{g.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {g.token_symbol ?? ''}</td>
                    <td className="px-4 py-2.5 text-emerald-400 tabular-nums">{fmtUsd(g.amount_usd)}</td>
                    <td className="px-4 py-2.5 text-gray-400 capitalize">{g.status ?? '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{new Date(g.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
