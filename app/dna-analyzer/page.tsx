'use client';

import { useState } from 'react';
import { Search, TrendingUp, AlertTriangle } from 'lucide-react';
import { VerifiedBadge } from '@/components/icons/VerifiedBadge';

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
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">DNA Analyzer</h1>
          <p className="text-gray-400">
            Verify any wallet with Arkham intelligence
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
                className="w-full bg-[#141824] border border-[#1E2433] rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF] font-mono"
              />
            </div>
            <button
              onClick={analyzeWallet}
              disabled={analyzing || !walletAddress}
              className="bg-[#0A1EFF] hover:bg-[#0916CC] disabled:bg-gray-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
            >
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Results - Verified Entity */}
        {result?.arkhamEntity?.verified && (
          <div className="bg-[#141824] rounded-lg p-6">
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
              <div className="bg-[#0A0E1A] rounded p-4">
                <div className="text-sm text-gray-400 mb-1">Win Rate</div>
                <div className="text-2xl font-bold text-green-500">89%</div>
                <div className="text-xs text-gray-500 mt-1">Top 1% globally</div>
              </div>
              <div className="bg-[#0A0E1A] rounded p-4">
                <div className="text-sm text-gray-400 mb-1">Avg Hold Time</div>
                <div className="text-2xl font-bold text-white">5.2d</div>
              </div>
              <div className="bg-[#0A0E1A] rounded p-4">
                <div className="text-sm text-gray-400 mb-1">Total Trades</div>
                <div className="text-2xl font-bold text-white">1,247</div>
              </div>
            </div>

            {/* Current Positions */}
            <div className="mb-6">
              <h3 className="text-white font-medium mb-3">Current Positions</h3>
              <div className="space-y-2">
                <div className="bg-[#0A0E1A] rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">ETH</div>
                      <div className="text-sm text-gray-400">$420M (18%)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-mono">HOLDING</div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#0A0E1A] rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">BONK</div>
                      <div className="text-sm text-gray-400">$2.4M</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={14} className="text-green-500" />
                        <div className="text-green-500 font-mono">ACCUMULATING</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button className="flex-1 bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-medium py-3 rounded-lg">
                Follow Entity
              </button>
              <button className="flex-1 bg-[#141824] hover:bg-[#1E2433] border border-[#1E2433] text-white font-medium py-3 rounded-lg">
                Copy Trades
              </button>
            </div>
          </div>
        )}

        {/* Results - Scammer */}
        {result?.labels?.includes('scammer') && (
          <div className="bg-red-500/10 border-2 border-red-500 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-500" size={32} />
              <div>
                <h2 className="text-xl font-bold text-red-500">
                  🚨 CRYPTO SCAMMER DETECTED
                </h2>
                <p className="text-gray-300">This wallet is flagged for malicious activity</p>
              </div>
            </div>

            <div className="bg-[#0A0E1A] rounded p-4 mb-4">
              <h3 className="text-white font-medium mb-3">Scam History</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Total Rug Pulls</div>
                  <div className="text-xl font-bold text-red-500">5</div>
                </div>
                <div>
                  <div className="text-gray-400">Total Stolen</div>
                  <div className="text-xl font-bold text-red-500">$3.2M</div>
                </div>
                <div>
                  <div className="text-gray-400">Victims</div>
                  <div className="text-xl font-bold text-red-500">4,123</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-red-500/20 rounded text-sm text-red-300">
              ⚠️ DO NOT INTERACT WITH THIS WALLET. Shadow Guardian will block all trades.
            </div>
          </div>
        )}

        {/* Results - Unknown Wallet */}
        {result && !result.arkhamEntity?.verified && !result.labels?.includes('scammer') && (
          <div className="bg-[#141824] rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Unknown Wallet</h2>
            <p className="text-gray-400 mb-4">
              This wallet is not verified by Arkham Intelligence.
            </p>

            <div className="bg-[#0A0E1A] rounded p-4">
              <div className="text-sm text-gray-400 mb-2">Reputation Score</div>
              <div className="text-2xl font-bold text-yellow-500">50/100</div>
              <div className="text-sm text-gray-500 mt-1">Neutral (Unknown)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
