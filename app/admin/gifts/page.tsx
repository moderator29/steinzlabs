'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gift, RefreshCw, ExternalLink } from 'lucide-react';

interface ChainRow { chain: string; count: number; volume: number }
interface StatusRow { status: string; count: number }
interface RecentGift {
  id: string;
  chain: string | null;
  token_symbol: string | null;
  amount: number;
  amount_usd: number;
  tx_hash: string | null;
  status: string | null;
  created_at: string;
  sender: string | null;
  recipient: string | null;
}
interface GiftData {
  stats: { total_gifts: number; total_usd: number };
  byChain: ChainRow[];
  byStatus: StatusRow[];
  recent: RecentGift[];
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

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'Ethereum', base: 'Base', bsc: 'BNB Chain', solana: 'Solana',
  robinhood: 'Robinhood Chain', arbitrum: 'Arbitrum', optimism: 'Optimism',
  polygon: 'Polygon', avalanche: 'Avalanche',
};

function txExplorer(chain: string | null, hash: string): string | null {
  switch ((chain ?? '').toLowerCase()) {
    case 'solana': return `https://solscan.io/tx/${hash}`;
    case 'ethereum': return `https://etherscan.io/tx/${hash}`;
    case 'bsc': return `https://bscscan.com/tx/${hash}`;
    case 'base': return `https://basescan.org/tx/${hash}`;
    case 'arbitrum': return `https://arbiscan.io/tx/${hash}`;
    case 'optimism': return `https://optimistic.etherscan.io/tx/${hash}`;
    case 'polygon': return `https://polygonscan.com/tx/${hash}`;
    case 'avalanche': return `https://snowtrace.io/tx/${hash}`;
    default: return null;
  }
}

function statusColor(s: string | null): string {
  switch ((s ?? '').toLowerCase()) {
    case 'confirmed': case 'completed': case 'success': return 'text-emerald-400';
    case 'pending': return 'text-amber-400';
    case 'failed': case 'error': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

export default function GiftsPage() {
  const [data, setData] = useState<GiftData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gifts', { headers: authHeader() });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('[admin/gifts] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isEmpty = !loading && (data?.stats.total_gifts ?? 0) === 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Gifts</h1>
          <p className="text-xs text-gray-500 mt-0.5">On-chain tipping across the Wire feed, by chain and status</p>
        </div>
        <button onClick={load} disabled={loading} className="nl-button nl-button--ghost">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="nl-glass rounded-2xl p-4">
          <div className="text-[11px] text-gray-400 mb-1">Total Gifts</div>
          <div className="text-xl font-bold text-white tabular-nums">{(data?.stats.total_gifts ?? 0).toLocaleString()}</div>
        </div>
        <div className="nl-glass rounded-2xl p-4">
          <div className="text-[11px] text-gray-400 mb-1">Total Gifted (USD)</div>
          <div className="text-xl font-bold text-emerald-400 tabular-nums">{fmtUsd(data?.stats.total_usd ?? 0)}</div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Loading gifts...</span>
        </div>
      ) : isEmpty ? (
        <div className="nl-glass rounded-2xl flex flex-col items-center justify-center py-12 text-center">
          <Gift className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-sm text-gray-400">No gifts sent yet</p>
          <p className="text-xs text-gray-600 mt-1">Gifting stats populate as users tip posts on the Wire feed</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="nl-glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10"><h3 className="text-sm font-semibold text-white">Volume by Chain</h3></div>
              <table className="w-full text-xs">
                <thead className="border-b border-white/10"><tr>
                  {['Chain', 'Gifts', 'Volume'].map((h) => <th key={h} className="px-4 py-2.5 text-start text-gray-500 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {data!.byChain.map((c) => (
                    <tr key={c.chain} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2.5 text-white font-medium">{CHAIN_LABEL[c.chain] ?? c.chain}</td>
                      <td className="px-4 py-2.5 text-gray-300 tabular-nums">{c.count.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-emerald-400 tabular-nums">{fmtUsd(c.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="nl-glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10"><h3 className="text-sm font-semibold text-white">Status Breakdown</h3></div>
              <table className="w-full text-xs">
                <thead className="border-b border-white/10"><tr>
                  {['Status', 'Count'].map((h) => <th key={h} className="px-4 py-2.5 text-start text-gray-500 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {data!.byStatus.map((s) => (
                    <tr key={s.status} className="border-b border-white/5 last:border-0">
                      <td className={`px-4 py-2.5 font-medium capitalize ${statusColor(s.status)}`}>{s.status}</td>
                      <td className="px-4 py-2.5 text-gray-300 tabular-nums">{s.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="nl-glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10"><h3 className="text-sm font-semibold text-white">Recent Gifts</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead className="border-b border-white/10"><tr>
                  {['From', 'To', 'Token', 'USD', 'Chain', 'Status', 'Tx', 'Time'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start text-gray-500 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data!.recent.map((g) => {
                    const url = g.tx_hash ? txExplorer(g.chain, g.tx_hash) : null;
                    return (
                      <tr key={g.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors last:border-0">
                        <td className="px-4 py-2.5 text-white">{g.sender ? `@${g.sender}` : '-'}</td>
                        <td className="px-4 py-2.5 text-white">{g.recipient ? `@${g.recipient}` : '-'}</td>
                        <td className="px-4 py-2.5 text-gray-300">{g.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {g.token_symbol ?? ''}</td>
                        <td className="px-4 py-2.5 text-emerald-400 tabular-nums">{fmtUsd(g.amount_usd)}</td>
                        <td className="px-4 py-2.5 text-gray-400">{CHAIN_LABEL[g.chain ?? ''] ?? g.chain ?? '-'}</td>
                        <td className={`px-4 py-2.5 capitalize ${statusColor(g.status)}`}>{g.status ?? '-'}</td>
                        <td className="px-4 py-2.5">
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#0066FF] inline-flex items-center gap-1 font-mono">
                              {g.tx_hash!.slice(0, 6)}...<ExternalLink className="w-3 h-3" />
                            </a>
                          ) : g.tx_hash ? (
                            <span className="text-gray-500 font-mono">{g.tx_hash.slice(0, 6)}...</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{new Date(g.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
