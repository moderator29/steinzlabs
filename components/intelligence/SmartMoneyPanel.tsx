'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Pause } from 'lucide-react';
import { VerifiedBadge } from '@/components/icons/VerifiedBadge';

interface SmartMoneyEntity {
  id: string;
  name: string;
  type: string;
  position: string;
  percentage: number;
  behavior: 'ACCUMULATING' | 'HOLDING' | 'DISTRIBUTING';
  winRate: number;
  avgHoldTime: number;
  currentPnL: string;
  pnlPercentage: number;
}

interface SmartMoneyPanelProps {
  tokenAddress: string;
  chain?: string;
}

export function SmartMoneyPanel({ tokenAddress, chain }: SmartMoneyPanelProps) {
  const [entities, setEntities] = useState<SmartMoneyEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSmartMoney();
  }, [tokenAddress]);

  async function loadSmartMoney() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/intelligence/holders/${tokenAddress}?chain=${chain || 'ethereum'}`
      );
      const data = await response.json();

      if (data.smartMoneyPresence?.entities) {
        setEntities(data.smartMoneyPresence.entities);
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[#141824] rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-[#1E2433] rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-[#1E2433] rounded"></div>
            <div className="h-20 bg-[#1E2433] rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="bg-[#141824] rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          Smart Money Intelligence
        </h3>
        <p className="text-sm text-gray-500">
          No verified institutions detected in top holders
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#141824] rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-[#0A1EFF]" />
        Smart Money Intelligence (Live)
      </h3>

      <div className="space-y-3">
        {entities.map((entity) => (
          <div
            key={entity.id}
            className="bg-[#0A0E1A] rounded-lg p-3 border border-[#1E2433] hover:border-[#0A1EFF] transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <VerifiedBadge size={14} />
                <span className="text-sm font-medium text-white">
                  {entity.name}
                </span>
                <span className="text-xs text-gray-500">
                  {entity.type}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {entity.behavior === 'ACCUMULATING' && (
                  <TrendingUp size={14} className="text-green-500" />
                )}
                {entity.behavior === 'HOLDING' && (
                  <Pause size={14} className="text-yellow-500" />
                )}
                {entity.behavior === 'DISTRIBUTING' && (
                  <TrendingDown size={14} className="text-red-500" />
                )}
                <span className="text-xs text-gray-400">
                  {entity.behavior}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-gray-500">Position</div>
                <div className="text-white font-mono">${entity.position}</div>
              </div>
              <div>
                <div className="text-gray-500">% Supply</div>
                <div className="text-white font-mono">{entity.percentage.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-gray-500">Win Rate</div>
                <div className="text-green-500 font-mono">{entity.winRate}%</div>
              </div>
              <div>
                <div className="text-gray-500">P&L</div>
                <div className={entity.pnlPercentage > 0 ? 'text-green-500' : 'text-red-500'}>
                  {entity.pnlPercentage > 0 ? '+' : ''}{entity.pnlPercentage}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[#1E2433]">
        <div className="text-xs text-gray-500">
          Total Smart Money: {entities.length} verified entities •{' '}
          {entities.reduce((sum, e) => sum + e.percentage, 0).toFixed(1)}% of supply
        </div>
      </div>
    </div>
  );
}
