'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { VerifiedBadge } from '@/components/icons/VerifiedBadge';

interface PortfolioHolding {
  symbol: string;
  address: string;
  balance: string;
  valueUSD: string;
  pnl: number;
  safetyScore: number;
  entityOverlap: string[];
  scammerPresent: boolean;
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortfolio();
  }, []);

  async function loadPortfolio() {
    try {
      setLoading(true);
      // Load holdings from API
      // For demo purposes
      const demoHoldings: PortfolioHolding[] = [
        {
          symbol: 'ETH',
          address: '0x...',
          balance: '10.5',
          valueUSD: '$25,000',
          pnl: 12.5,
          safetyScore: 9.8,
          entityOverlap: ['Jump Trading', 'Wintermute', 'a16z'],
          scammerPresent: false,
        },
        {
          symbol: 'BONK',
          address: '0x...',
          balance: '50000',
          valueUSD: '$15,000',
          pnl: 62.3,
          safetyScore: 8.5,
          entityOverlap: ['Jump Trading', 'Wintermute'],
          scammerPresent: false,
        },
        {
          symbol: 'OLDTOKEN',
          address: '0x...',
          balance: '100',
          valueUSD: '$5,000',
          pnl: -12.1,
          safetyScore: 6.2,
          entityOverlap: [],
          scammerPresent: false,
        },
      ];
      setHoldings(demoHoldings);
    } catch (error) {
      console.error('Failed to load portfolio:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[#141824] rounded w-1/4"></div>
            <div className="h-32 bg-[#141824] rounded"></div>
            <div className="h-64 bg-[#141824] rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const totalValue = holdings.reduce((sum, h) =>
    sum + parseFloat(h.valueUSD.replace(/[$,]/g, '')), 0
  );

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Portfolio</h1>
          <p className="text-gray-400">
            Your holdings with Arkham intelligence
          </p>
        </div>

        {/* Total Value */}
        <div className="bg-[#141824] rounded-lg p-6 mb-6">
          <div className="text-sm text-gray-400 mb-1">Total Portfolio Value</div>
          <div className="text-4xl font-bold text-white font-mono mb-2">
            ${totalValue.toLocaleString()}
          </div>
          <div className="text-lg text-green-500">+12.4% (All Time)</div>
        </div>

        {/* Holdings Table */}
        <div className="bg-[#141824] rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 gap-4 p-4 bg-[#0A0E1A] text-sm text-gray-400 font-medium">
            <div>Asset</div>
            <div>Balance</div>
            <div>Value</div>
            <div>P&amp;L</div>
            <div>Safety</div>
            <div>Smart Money Overlap</div>
            <div>Actions</div>
          </div>

          <div className="divide-y divide-[#1E2433]">
            {holdings.map((holding) => (
              <div
                key={holding.address}
                className="grid grid-cols-7 gap-4 p-4 hover:bg-[#0A0E1A] transition-colors"
              >
                {/* Asset */}
                <div>
                  <div className="text-white font-medium">{holding.symbol}</div>
                  <div className="text-xs text-gray-500">
                    {holding.address.slice(0, 6)}...{holding.address.slice(-4)}
                  </div>
                </div>

                {/* Balance */}
                <div className="text-white font-mono">{holding.balance}</div>

                {/* Value */}
                <div className="text-white font-mono">{holding.valueUSD}</div>

                {/* P&L */}
                <div className={holding.pnl > 0 ? 'text-green-500' : 'text-red-500'}>
                  {holding.pnl > 0 ? '+' : ''}{holding.pnl.toFixed(1)}%
                </div>

                {/* Safety */}
                <div>
                  <div className={`font-mono ${
                    holding.safetyScore >= 7 ? 'text-green-500' :
                    holding.safetyScore >= 4 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {holding.safetyScore.toFixed(1)}/10
                  </div>
                  {holding.scammerPresent && (
                    <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                      <AlertTriangle size={12} />
                      Scammer detected
                    </div>
                  )}
                </div>

                {/* Smart Money Overlap */}
                <div>
                  {holding.entityOverlap.length > 0 ? (
                    <div className="space-y-1">
                      {holding.entityOverlap.slice(0, 2).map((entity) => (
                        <div key={entity} className="flex items-center gap-1 text-xs">
                          <VerifiedBadge size={12} />
                          <span className="text-green-500">{entity}</span>
                        </div>
                      ))}
                      {holding.entityOverlap.length > 2 && (
                        <div className="text-xs text-gray-400">
                          +{holding.entityOverlap.length - 2} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No overlap</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button className="bg-[#0A1EFF] hover:bg-[#0916CC] text-white text-xs px-3 py-1 rounded">
                    Trade
                  </button>
                  <button className="bg-[#1E2433] hover:bg-[#2A3343] text-white text-xs px-3 py-1 rounded">
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Money Insights */}
        <div className="mt-6 bg-[#141824] rounded-lg p-6">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="text-[#0A1EFF]" size={20} />
            Smart Money Insights
          </h3>

          <div className="space-y-3">
            <div className="bg-[#0A0E1A] rounded p-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-500 mt-1" size={20} />
                <div className="flex-1">
                  <div className="text-white text-sm">
                    2 tokens match Jump Trading&apos;s holdings
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    You hold ETH and BONK, same as Jump Trading
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0A0E1A] rounded p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-yellow-500 mt-1" size={20} />
                <div className="flex-1">
                  <div className="text-white text-sm">
                    Jump Trading sold OLDTOKEN 2 days ago (+67%)
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Consider following smart money exit
                  </div>
                </div>
                <button className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded">
                  Sell
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
