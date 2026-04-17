'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Crosshair, ExternalLink, Loader2, Filter, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/common/PageHeader';
import { formatTimeAgo, formatUSD } from '@/lib/formatters';

type TxType = 'all' | 'swap' | 'snipe';
type TxStatus = 'pending' | 'confirmed' | 'failed';

interface Transaction {
  id: string;
  type: 'swap' | 'snipe';
  fromToken?: string;
  toToken?: string;
  tokenSymbol?: string;
  amountUsd?: number;
  fromAmount?: string;
  toAmount?: string;
  chain: string;
  status: TxStatus;
  txHash?: string;
  createdAt: string;
}

const EXPLORER_BASE: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  bsc: 'https://bscscan.com/tx/',
  solana: 'https://solscan.io/tx/',
};

const STATUS_STYLES: Record<TxStatus, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  confirmed: 'text-green-400 bg-green-400/10 border-green-400/20',
  failed: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function TransactionsPage() {
  const router = useRouter();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TxType>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTxs([]);
        return;
      }

      const [swapRes, sniperRes] = await Promise.all([
        supabase.from('swap_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('sniper_executions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      ]);

      const allTxs: Transaction[] = [];

      if (swapRes.data) {
        for (const s of swapRes.data) {
          allTxs.push({
            id: `swap-${s.id}`,
            type: 'swap',
            fromToken: s.from_token,
            toToken: s.to_token,
            fromAmount: s.from_amount,
            toAmount: s.to_amount,
            amountUsd: s.amount_usd,
            chain: s.chain || 'ethereum',
            status: (s.status || 'confirmed') as TxStatus,
            txHash: s.tx_hash,
            createdAt: s.created_at,
          });
        }
      }

      if (sniperRes.data) {
        for (const e of sniperRes.data) {
          allTxs.push({
            id: `snipe-${e.id}`,
            type: 'snipe',
            tokenSymbol: e.token_symbol,
            amountUsd: e.amount_usd,
            chain: e.chain || 'ethereum',
            status: (e.status || 'pending') as TxStatus,
            txHash: e.tx_hash,
            createdAt: e.created_at,
          });
        }
      }

      allTxs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTxs(allTxs);
    } catch (err) {
      console.error('[transactions] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter);

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader title="Transactions" description="Your swap and snipe history across all chains" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 bg-[#141824] border border-[#1E2433] rounded-lg p-1">
            {(['all', 'swap', 'snipe'] as TxType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                  filter === f ? 'bg-[#0A1EFF] text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'swap' ? 'Swaps' : 'Snipes'}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white border border-[#1E2433] rounded-lg px-3 py-1.5 hover:border-[#2E3443] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && txs.length === 0 ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="w-5 h-5 text-[#0A1EFF] animate-spin" />
            <span className="text-sm text-gray-500">Loading transactions...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-12 text-center">
            <Filter className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No transactions yet</p>
            <p className="text-xs text-gray-600 mt-1">Your swap and snipe history will appear here</p>
          </div>
        ) : (
          <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden divide-y divide-[#1E2433]">
            {filtered.map(tx => (
              <div key={tx.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[#1E2433]/30 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.type === 'swap' ? 'bg-[#0A1EFF]/10' : 'bg-[#F59E0B]/10'}`}>
                  {tx.type === 'swap' ? (
                    <ArrowLeftRight className="w-5 h-5 text-[#0A1EFF]" />
                  ) : (
                    <Crosshair className="w-5 h-5 text-[#F59E0B]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {tx.type === 'swap' ? `${tx.fromToken} → ${tx.toToken}` : `Sniped ${tx.tokenSymbol}`}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border capitalize ${STATUS_STYLES[tx.status]}`}>
                      {tx.status}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase">{tx.chain}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {tx.amountUsd ? formatUSD(tx.amountUsd) : (tx.fromAmount && tx.toAmount ? `${tx.fromAmount} → ${tx.toAmount}` : '')}
                    <span className="text-gray-600 mx-2">·</span>
                    {formatTimeAgo(new Date(tx.createdAt).getTime())}
                  </div>
                </div>
                {tx.txHash && EXPLORER_BASE[tx.chain] && (
                  <a
                    href={`${EXPLORER_BASE[tx.chain]}${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0A1EFF] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
