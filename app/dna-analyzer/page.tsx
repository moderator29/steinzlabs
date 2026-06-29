'use client';

import { useState } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { VerifiedBadge } from '@/components/icons/VerifiedBadge';
import { AuroraBackground } from '@/components/brand/AuroraBackground';

export default function DNAAnalyzerPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function analyzeWallet() {
    if (!walletAddress) return;

    try {
      setAnalyzing(true);
      const response = await fetch(`/api/arkham/address/${walletAddress}`);
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <AuroraBackground fullHeight>
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">DNA Analyzer</h1>
          <p className="text-gray-400">
            Verify any wallet with Naka Intelligence entity lookup
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeWallet()}
                placeholder="Enter wallet address..."
                className="w-full nl-card rounded-lg ps-10 pe-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#0066FF] font-mono"
              />
            </div>
            <button
              onClick={analyzeWallet}
              disabled={analyzing || !walletAddress}
              className="nl-btn-neon disabled:opacity-50 font-medium px-6 py-3 rounded-lg"
            >
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Results - Verified Entity */}
        {result?.arkhamEntity?.verified && (
          <div className="nl-glass rounded-lg p-6" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
            <div className="flex items-start gap-4 mb-6">
              {result.arkhamEntity.logo && (
                <img
                  src={result.arkhamEntity.logo}
                  alt=""
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-white">
                    {result.arkhamEntity.name}
                  </h2>
                  <VerifiedBadge size={24} />
                </div>
                <div className="text-gray-400">{result.arkhamEntity.type}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="nl-card rounded p-4">
                <div className="text-sm text-gray-400 mb-1">Total Transactions</div>
                <div className="text-2xl font-bold text-white">
                  {typeof result.transactionCount === 'number' ? result.transactionCount.toLocaleString() : '—'}
                </div>
              </div>
              <div className="nl-card rounded p-4">
                <div className="text-sm text-gray-400 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-white">{result.totalVolume ?? '—'}</div>
              </div>
              <div className="nl-card rounded p-4">
                <div className="text-sm text-gray-400 mb-1">Chain</div>
                <div className="text-2xl font-bold text-white uppercase">{result.chain ?? '—'}</div>
              </div>
            </div>

            {/* Activity window */}
            <div className="mb-2">
              <h3 className="text-white font-medium mb-3">Activity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="nl-card rounded p-3">
                  <div className="text-sm text-gray-400 mb-1">First Seen</div>
                  <div className="text-white font-mono text-sm">{result.firstSeen ?? '—'}</div>
                </div>
                <div className="nl-card rounded p-3">
                  <div className="text-sm text-gray-400 mb-1">Last Seen</div>
                  <div className="text-white font-mono text-sm">{result.lastSeen ?? '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results - Scammer */}
        {result?.labels?.includes('scammer') && (
          <div className="nl-glass nl-glass--crimson border-2 border-red-500 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-500" size={32} />
              <div>
                <h2 className="text-xl font-bold text-red-500">
                  CRYPTO SCAMMER DETECTED
                </h2>
                <p className="text-gray-300">This wallet is flagged for malicious activity</p>
              </div>
            </div>

            {result.scamHistory ? (
              <div className="nl-card rounded p-4 mb-4">
                <h3 className="text-white font-medium mb-3">Scam History</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Total Rug Pulls</div>
                    <div className="text-xl font-bold text-red-500">{result.scamHistory.totalRugs ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Total Stolen</div>
                    <div className="text-xl font-bold text-red-500">{result.scamHistory.totalStolen ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Victims</div>
                    <div className="text-xl font-bold text-red-500">
                      {typeof result.scamHistory.victims === 'number' ? result.scamHistory.victims.toLocaleString() : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="nl-card rounded p-4 mb-4 text-sm text-gray-400">
                Detailed scam history is unavailable for this wallet.
              </div>
            )}

            <div className="p-4 bg-red-500/20 rounded text-sm text-red-300">
              WARNING: DO NOT INTERACT WITH THIS WALLET. Shadow Guardian will block all trades.
            </div>
          </div>
        )}

        {/* Results - Unknown Wallet */}
        {result && !result.arkhamEntity?.verified && !result.labels?.includes('scammer') && (
          <div className="nl-glass rounded-lg p-6" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
            <h2 className="text-xl font-bold text-white mb-4">Unknown Wallet</h2>
            <p className="text-gray-400 mb-4">
              This wallet has no verified entity label on record.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="nl-card rounded p-4">
                <div className="text-sm text-gray-400 mb-1">Total Transactions</div>
                <div className="text-2xl font-bold text-white">
                  {typeof result.transactionCount === 'number' ? result.transactionCount.toLocaleString() : '—'}
                </div>
              </div>
              <div className="nl-card rounded p-4">
                <div className="text-sm text-gray-400 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-white">{result.totalVolume ?? '—'}</div>
              </div>
            </div>

            {Array.isArray(result.labels) && result.labels.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.labels.map((label: string) => (
                  <span key={label} className="nl-card rounded-full px-3 py-1 text-xs text-gray-300">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </AuroraBackground>
  );
}
