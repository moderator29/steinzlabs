'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Crosshair, ExternalLink, Loader2, Filter, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { transactionsHowItWorks } from '@/lib/howItWorks/content/transactions';
import { formatTimeAgo, formatUSD } from '@/lib/formatters';
import { useNavState } from '@/lib/nav/useNavState';

type TxType = 'all' | 'swap' | 'snipe';
type TxStatus = 'pending' | 'confirmed' | 'failed';

// Mirrors the /api/transactions unified shape. USD / fee fields are null when
// the underlying source has no real value — rendered as "—", never fake $0.
interface Transaction {
  id: string;
  type: 'swap' | 'snipe';
  fromToken?: string | null;
  toToken?: string | null;
  tokenSymbol?: string | null;
  fromLogo?: string | null;
  toLogo?: string | null;
  fromAmount?: string | null;
  toAmount?: string | null;
  amountUsd?: number | null;
  feeUsd?: number | null;
  gasFeeUsd?: number | null;
  chain: string;
  status: TxStatus;
  txHash?: string | null;
  explorerUrl?: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<TxStatus, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  confirmed: 'text-green-400 bg-green-400/10 border-green-400/20',
  failed: 'text-red-400 bg-red-400/10 border-red-400/20',
};

function fmtAmount(a?: string | null): string | null {
  if (a == null) return null;
  const n = Number(a);
  if (!Number.isFinite(n)) return a;
  if (n === 0) return '0';
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TxType>('all');

  // PDF S3 — preserve filter across transactions → tx detail → back.
  useNavState(
    'transactions',
    () => ({ filter }),
    (s) => {
      if (s.filter === 'all' || s.filter === 'swap' || s.filter === 'snipe') setFilter(s.filter);
    },
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/transactions', { signal: AbortSignal.timeout(20_000) });
      if (res.status === 401) {
        // Not signed in — no history to show (honest empty state, not an error).
        setTxs([]);
        return;
      }
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as { transactions?: Transaction[] };
      setTxs(data.transactions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Transactions"
          description="Your swap and snipe history across all chains"
          showBack
          backTo="/dashboard"
          actions={<HowItWorksButton content={transactionsHowItWorks} className="ms-auto shrink-0" />}
        />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 nl-card rounded-lg p-1">
            {(['all', 'swap', 'snipe'] as TxType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                  filter === f ? 'nl-btn-neon' : 'text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'swap' ? 'Swaps' : 'Snipes'}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="nl-button--ghost flex items-center gap-2 text-xs rounded-lg px-3 py-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        {loading && txs.length === 0 ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="w-5 h-5 text-[#0066FF] animate-spin" />
            <span className="text-sm text-gray-500">Loading transactions...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="nl-glass rounded-xl p-12 text-center" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
            <Filter className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No transactions yet</p>
            <p className="text-xs text-gray-600 mt-1">Your swap and snipe history will appear here</p>
          </div>
        ) : (
          <div className="nl-glass rounded-xl overflow-hidden divide-y divide-[#1E2433]" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
            {filtered.map(tx => {
              const fromAmt = fmtAmount(tx.fromAmount);
              const toAmt = fmtAmount(tx.toAmount);
              return (
                <div key={tx.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[#1E2433]/30 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.type === 'swap' ? 'bg-[#0066FF]/10' : 'bg-[#F59E0B]/10'}`}>
                    {tx.type === 'swap' ? (
                      <ArrowLeftRight className="w-5 h-5 text-[#0066FF]" />
                    ) : (
                      <Crosshair className="w-5 h-5 text-[#F59E0B]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">
                        {tx.type === 'swap'
                          ? `${tx.fromToken ?? '?'} → ${tx.toToken ?? '?'}`
                          : `Sniped ${tx.tokenSymbol ?? ''}`}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border capitalize ${STATUS_STYLES[tx.status]}`}>
                        {tx.status}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase">{tx.chain}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center flex-wrap gap-x-2">
                      {/* Real USD trade value when the ledger has it; otherwise the
                          raw token amounts. Never a fabricated $0. */}
                      {tx.amountUsd != null && tx.amountUsd > 0 ? (
                        <span className="font-mono text-gray-300">{formatUSD(tx.amountUsd)}</span>
                      ) : tx.type === 'swap' && (fromAmt || toAmt) ? (
                        <span className="font-mono">{fromAmt ?? '?'} → {toAmt ?? '?'}</span>
                      ) : null}
                      {tx.feeUsd != null && tx.feeUsd > 0 && (
                        <>
                          <span className="text-gray-600">·</span>
                          <span className="text-gray-500">fee {formatUSD(tx.feeUsd)}</span>
                        </>
                      )}
                      <span className="text-gray-600">·</span>
                      <span>{formatTimeAgo(new Date(tx.createdAt).getTime())}</span>
                    </div>
                  </div>
                  {tx.explorerUrl && (
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0066FF] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
