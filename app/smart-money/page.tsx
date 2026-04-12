'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, Star, Plus, Eye } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useRouter } from 'next/navigation';

const TOP_ENTITIES = [
  { id: 'jump-trading', name: 'Jump Trading', type: 'Market Maker', winRate: 89, description: 'Leading HFT firm and market maker' },
  { id: 'wintermute', name: 'Wintermute', type: 'Market Maker', winRate: 84, description: 'Top crypto market maker' },
  { id: 'a16z-crypto', name: 'a16z Crypto', type: 'VC', winRate: 91, description: 'Top-tier crypto VC fund' },
  { id: 'paradigm', name: 'Paradigm', type: 'VC', winRate: 87, description: 'Crypto-focused investment firm' },
  { id: 'multicoin-capital', name: 'Multicoin Capital', type: 'VC', winRate: 82, description: 'Research-driven investment fund' },
  { id: 'alameda-research', name: 'Alameda Research', type: 'Whale', winRate: 78, description: 'Quantitative trading firm' },
];

export default function SmartMoneyPage() {
  const router = useRouter();
  const [followed, setFollowed] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'vc' | 'market_maker' | 'whale'>('all');
  const [loading, setLoading] = useState<string | null>(null);

  const filteredEntities = TOP_ENTITIES.filter((e) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'vc') return e.type === 'VC';
    if (activeFilter === 'market_maker') return e.type === 'Market Maker';
    if (activeFilter === 'whale') return e.type === 'Whale';
    return true;
  });

  const followEntity = async (entityId: string, entityName: string, entityType: string) => {
    setLoading(entityId);
    try {
      const wallet = localStorage.getItem('wallet_address') || '';
      const res = await fetch('/api/moneyRadar/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          entityName,
          entityType,
          userWallet: wallet,
        }),
      });
      if (res.ok) {
        setFollowed((prev) => [...prev, entityId]);
      }
    } catch (err) {
      console.error('Failed to follow entity:', err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Smart Money"
          description="Follow top institutions and copy their trades in real-time"
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#141824] rounded-lg p-4 border border-[#1E2433]">
            <div className="text-gray-400 text-sm">Entities Tracked</div>
            <div className="text-white text-2xl font-bold mt-1">127</div>
            <div className="text-green-500 text-xs mt-1">+12 this week</div>
          </div>
          <div className="bg-[#141824] rounded-lg p-4 border border-[#1E2433]">
            <div className="text-gray-400 text-sm">You Follow</div>
            <div className="text-white text-2xl font-bold mt-1">{followed.length}</div>
            <div className="text-gray-500 text-xs mt-1">Active monitors</div>
          </div>
          <div className="bg-[#141824] rounded-lg p-4 border border-[#1E2433]">
            <div className="text-gray-400 text-sm">Avg Win Rate</div>
            <div className="text-white text-2xl font-bold mt-1">85%</div>
            <div className="text-gray-500 text-xs mt-1">Top entities</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {([['all', 'All'], ['vc', 'VCs'], ['market_maker', 'Market Makers'], ['whale', 'Whales']] as [typeof activeFilter, string][]).map(([filter, label]) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === filter
                  ? 'bg-[#0A1EFF] text-white'
                  : 'bg-[#141824] text-gray-400 hover:text-white border border-[#1E2433]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Entity Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredEntities.map((entity) => (
            <div
              key={entity.id}
              className="bg-[#141824] rounded-lg p-5 border border-[#1E2433] hover:border-[#0A1EFF]/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0A1EFF]/20 rounded-lg flex items-center justify-center">
                    <Users size={20} className="text-[#0A1EFF]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">{entity.name}</h3>
                    <span className="text-xs text-gray-400">{entity.type}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-500 font-bold text-lg">{entity.winRate}%</div>
                  <div className="text-gray-500 text-xs">win rate</div>
                </div>
              </div>

              <p className="text-gray-400 text-sm mb-4">{entity.description}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/dna-analyzer?entity=${entity.id}`)}
                  className="flex-1 bg-[#0A0E1A] hover:bg-[#1E2433] text-gray-400 hover:text-white border border-[#1E2433] px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Eye size={14} />
                  View
                </button>
                <button
                  onClick={() => followEntity(entity.id, entity.name, entity.type)}
                  disabled={loading === entity.id || followed.includes(entity.id)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    followed.includes(entity.id)
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-[#0A1EFF] hover:bg-[#0916CC] text-white'
                  }`}
                >
                  {followed.includes(entity.id) ? (
                    <><Star size={14} className="fill-current" /> Following</>
                  ) : (
                    <><Plus size={14} /> Follow</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {followed.length > 0 && (
          <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-400">
              <TrendingUp size={18} />
              <span className="font-medium">Money Radar Active</span>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              You are now tracking {followed.length} entity/entities. You'll receive alerts when they make significant moves.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
