'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SmartMoneyPanel } from '@/components/intelligence/SmartMoneyPanel';
import { HolderBreakdown } from '@/components/intelligence/HolderBreakdown';
import { Bubblemaps } from '@/components/visualization/Bubblemaps';
import { ShadowGuardianScan } from '@/components/security/ShadowGuardianScan';

export default function ViewProofPage() {
  const params = useParams();
  const router = useRouter();
  const tokenAddress = params.token as string;

  const [intelligence, setIntelligence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntelligence();
  }, [tokenAddress]);

  async function loadIntelligence() {
    try {
      setLoading(true);
      const response = await fetch(`/api/intelligence/holders/${tokenAddress}`);
      const data = await response.json();
      setIntelligence(data);
    } catch (error) {
      console.error('Failed to load intelligence:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-[#141824] rounded w-1/3"></div>
            <div className="h-64 bg-[#141824] rounded"></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="h-48 bg-[#141824] rounded"></div>
              <div className="h-48 bg-[#141824] rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Failed to Load Intelligence</h1>
          <p className="text-gray-400 mb-4">Unable to fetch token data</p>
          <button
            onClick={() => router.back()}
            className="bg-[#0A1EFF] hover:bg-[#0916CC] text-white px-4 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      {/* Header */}
      <div className="bg-[#141824] border-b border-[#1E2433] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft size={20} />
            Back to Feed
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)} Intelligence Report
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Powered by Arkham Intelligence
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-400">Safety Score</div>
                <div className="text-2xl font-bold text-green-500">
                  {intelligence.safetyAnalysis.overallScore.toFixed(1)}/10
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Market Data Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#141824] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Price</div>
            <div className="text-xl font-bold text-white font-mono">$0.0012</div>
            <div className="text-sm text-green-500">+12% 24h</div>
          </div>
          <div className="bg-[#141824] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Market Cap</div>
            <div className="text-xl font-bold text-white font-mono">$1.2M</div>
          </div>
          <div className="bg-[#141824] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Volume 24h</div>
            <div className="text-xl font-bold text-white font-mono">$450K</div>
            <div className="text-sm text-green-500">+45% 24h</div>
          </div>
          <div className="bg-[#141824] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Liquidity</div>
            <div className="text-xl font-bold text-white font-mono">$250K</div>
            <div className="text-sm text-green-500">🔒 Locked 180d</div>
          </div>
        </div>

        {/* Smart Money Intelligence */}
        <SmartMoneyPanel tokenAddress={tokenAddress} />

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Holder Breakdown */}
          <HolderBreakdown composition={intelligence.composition} />

          {/* Security Analysis */}
          <div className="bg-[#141824] rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4">
              🛡️ Shadow Guardian Analysis
            </h3>

            <ShadowGuardianScan tokenAddress={tokenAddress} />

            <div className="mt-4 space-y-2">
              {intelligence.safetyAnalysis.greenFlags.map((flag: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500">✓</span>
                  <span className="text-gray-300">{flag}</span>
                </div>
              ))}
              {intelligence.safetyAnalysis.warnings.map((warning: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-yellow-500">⚠</span>
                  <span className="text-gray-300">{warning}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bubblemaps Visualization */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">
            Holder Distribution &amp; Network
          </h3>
          <Bubblemaps
            nodes={intelligence.bubbleMapData.nodes}
            width={1200}
            height={600}
          />

          <div className="mt-4 bg-[#141824] rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Total Nodes</div>
                <div className="text-white font-medium">
                  {intelligence.bubbleMapData.metadata.totalNodes}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Verified Entities</div>
                <div className="text-green-500 font-medium">
                  {intelligence.bubbleMapData.metadata.verifiedNodes}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Scammers</div>
                <div className="text-red-500 font-medium">
                  {intelligence.bubbleMapData.metadata.scammerNodes}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Top 10 Concentration</div>
                <div className="text-white font-medium">
                  {intelligence.bubbleMapData.metadata.concentration.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Pattern Matching */}
        {intelligence.patternMatching.historicalOutcomes.totalMatches > 0 && (
          <div className="bg-[#141824] rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              📊 Historical Pattern Matching
            </h3>

            <p className="text-gray-300 mb-4">
              Similar tokens with this holder profile historically:
            </p>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#0A0E1A] rounded p-3">
                <div className="text-sm text-gray-400">Average Gain</div>
                <div className="text-2xl font-bold text-green-500">
                  +{intelligence.patternMatching.historicalOutcomes.avgGain}%
                </div>
              </div>
              <div className="bg-[#0A0E1A] rounded p-3">
                <div className="text-sm text-gray-400">Avg Hold Time</div>
                <div className="text-2xl font-bold text-white">
                  {intelligence.patternMatching.historicalOutcomes.avgHoldTime}d
                </div>
              </div>
              <div className="bg-[#0A0E1A] rounded p-3">
                <div className="text-sm text-gray-400">Success Rate</div>
                <div className="text-2xl font-bold text-green-500">
                  {intelligence.patternMatching.historicalOutcomes.successRate}%
                </div>
              </div>
              <div className="bg-[#0A0E1A] rounded p-3">
                <div className="text-sm text-gray-400">Total Matches</div>
                <div className="text-2xl font-bold text-white">
                  {intelligence.patternMatching.historicalOutcomes.totalMatches}
                </div>
              </div>
            </div>

            {/* AI Prediction */}
            <div className="bg-gradient-to-r from-[#0A1EFF]/20 to-purple-500/20 border border-[#0A1EFF] rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-2">🤖 AI Prediction</h4>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <div className="text-xs text-gray-400">Expected Gain</div>
                  <div className="text-lg font-bold text-[#0A1EFF]">
                    {intelligence.patternMatching.aiPrediction.expectedGain}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Timeframe</div>
                  <div className="text-lg font-bold text-white">
                    {intelligence.patternMatching.aiPrediction.timeframe}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Confidence</div>
                  <div className="text-lg font-bold text-green-500">
                    {intelligence.patternMatching.aiPrediction.confidence}%
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-300">
                {intelligence.patternMatching.aiPrediction.reasoning}
              </p>
            </div>
          </div>
        )}

        {/* Trading Actions */}
        <div className="flex gap-4">
          <button className="flex-1 bg-[#0A1EFF] hover:bg-[#0916CC] text-white font-medium py-4 px-6 rounded-lg transition-colors text-lg">
            Open Trading Terminal
          </button>
          <button className="flex-1 bg-[#141824] hover:bg-[#1E2433] border border-[#1E2433] text-white font-medium py-4 px-6 rounded-lg transition-colors text-lg">
            Copy Smart Money Trade
          </button>
        </div>
      </div>
    </div>
  );
}
