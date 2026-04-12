'use client';

import { useState } from 'react';
import { Activity, Search, ExternalLink, Shield } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

export default function WalletTracerPage() {
  const [wallet, setWallet] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [loading, setLoading] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'intel' | 'history' | 'approvals'>('intel');

  const traceWallet = async () => {
    if (!wallet.trim()) return;
    setLoading(true);
    setError('');
    setIntel(null);
    setHistory([]);
    setApprovals([]);

    try {
      const [intelRes, histRes, approvalsRes] = await Promise.all([
        fetch(`/api/arkham/address/${wallet}`),
        fetch(`/api/wallet/history?wallet=${wallet}&chain=${chain}&limit=50`),
        fetch(`/api/wallet/approvals?wallet=${wallet}&chain=${chain}`),
      ]);

      const [intelData, histData, approvalsData] = await Promise.all([
        intelRes.json(),
        histRes.json(),
        approvalsRes.json(),
      ]);

      setIntel(intelData);
      setHistory(histData.history || []);
      setApprovals(approvalsData.approvals || []);
    } catch (err: any) {
      setError(err.message || 'Failed to trace wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Wallet Tracer"
          description="Deep wallet intelligence powered by Arkham — identify entities, track history, and revoke approvals"
        />

        {/* Search Bar */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && traceWallet()}
              placeholder="Enter wallet address (0x... or Solana address)..."
              className="w-full bg-[#141824] border border-[#1E2433] rounded-lg pl-12 pr-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
            />
          </div>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="bg-[#141824] border border-[#1E2433] rounded-lg px-4 text-white focus:outline-none focus:border-[#0A1EFF]"
          >
            {['ethereum', 'solana', 'base', 'bsc', 'polygon', 'arbitrum'].map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <button
            onClick={traceWallet}
            disabled={loading || !wallet.trim()}
            className="bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-bold px-8 py-4 rounded-lg transition-colors"
          >
            {loading ? 'Tracing...' : 'Trace'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        {intel && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['intel', 'history', 'approvals'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 rounded-lg font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-[#0A1EFF] text-white'
                      : 'bg-[#141824] text-gray-400 hover:text-white border border-[#1E2433]'
                  }`}
                >
                  {tab === 'intel' ? 'Intelligence' : tab === 'history' ? `History (${history.length})` : `Approvals (${approvals.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'intel' && (
              <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold text-xl">
                      {intel.arkhamEntity?.name || 'Unknown Wallet'}
                    </h3>
                    <p className="text-gray-400 text-sm font-mono mt-1">{wallet}</p>
                  </div>
                  {intel.arkhamEntity?.verified && (
                    <span className="bg-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full border border-blue-500/30">
                      Verified Entity
                    </span>
                  )}
                </div>

                {intel.labels?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {intel.labels.map((label: string) => (
                      <span key={label} className={`text-xs px-3 py-1 rounded-full ${
                        label.includes('scammer') || label.includes('mixer')
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  {intel.transactionCount !== undefined && (
                    <div className="bg-[#0A0E1A] rounded-lg p-4">
                      <div className="text-gray-400 text-sm">Transactions</div>
                      <div className="text-white text-xl font-bold mt-1">{intel.transactionCount.toLocaleString()}</div>
                    </div>
                  )}
                  {intel.totalVolume && (
                    <div className="bg-[#0A0E1A] rounded-lg p-4">
                      <div className="text-gray-400 text-sm">Total Volume</div>
                      <div className="text-white text-xl font-bold mt-1">{intel.totalVolume}</div>
                    </div>
                  )}
                  {intel.scamHistory && (
                    <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
                      <div className="text-red-400 text-sm">Scam History</div>
                      <div className="text-red-400 text-xl font-bold mt-1">{intel.scamHistory.totalRugs} rugs</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="bg-[#141824] rounded-lg border border-[#1E2433] overflow-hidden">
                <div className="p-4 border-b border-[#1E2433]">
                  <h3 className="text-white font-bold">Transaction History</h3>
                </div>
                {history.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No transactions found</div>
                ) : (
                  <div className="divide-y divide-[#1E2433]">
                    {history.slice(0, 20).map((tx: any, i) => (
                      <div key={i} className="p-4 flex items-center justify-between hover:bg-[#1E2433]/50">
                        <div>
                          <div className="text-white text-sm font-mono">{tx.hash?.slice(0, 16)}...</div>
                          <div className="text-gray-400 text-xs mt-1">{tx.type || 'transfer'} • {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : ''}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white">{tx.valueUSD}</div>
                          <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-[#0A1EFF] text-xs flex items-center gap-1 justify-end mt-1">
                            <ExternalLink size={10} /> View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'approvals' && (
              <div className="bg-[#141824] rounded-lg border border-[#1E2433] overflow-hidden">
                <div className="p-4 border-b border-[#1E2433]">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Shield size={18} className="text-yellow-500" />
                    Token Approvals
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">Review and revoke token spending permissions</p>
                </div>
                {approvals.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No approvals found</div>
                ) : (
                  <div className="divide-y divide-[#1E2433]">
                    {approvals.map((approval: any, i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">{approval.tokenSymbol || 'Unknown Token'}</div>
                          <div className="text-gray-400 text-sm font-mono mt-1">{approval.spender?.slice(0, 20)}...</div>
                          <div className="text-gray-500 text-xs mt-1">{approval.allowance === 'unlimited' ? '♾️ Unlimited' : approval.allowance}</div>
                        </div>
                        <button
                          onClick={async () => {
                            await fetch('/api/wallet/approvals', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ approvalId: approval.id, userWallet: wallet }),
                            });
                          }}
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!intel && !loading && (
          <div className="text-center py-20 text-gray-500">
            <Activity size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">Enter a wallet address to start tracing</p>
            <p className="text-sm mt-2">Powered by Arkham Intelligence</p>
          </div>
        )}
      </div>
    </div>
  );
}
