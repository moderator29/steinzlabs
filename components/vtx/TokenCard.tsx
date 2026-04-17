'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Bell, BarChart3, Eye, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export interface TokenCardData {
  symbol: string;
  name: string;
  logo?: string;
  price: number;
  change24h: number;
  volume24h?: number;
  marketCap?: number;
  liquidity?: number;
  holders?: number;
  fdv?: number;
  contractAddress?: string;
  chain?: string;
  trustScore?: 'A' | 'B' | 'C' | 'D' | 'F';
}

function formatNum(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(p: number): string {
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.001) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

const TRUST_BADGE: Record<string, { label: string; color: string }> = {
  A: { label: 'A', color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  B: { label: 'B', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  C: { label: 'C', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  D: { label: 'D', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  F: { label: 'F', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
};

export function TokenCard({ token }: { token: TokenCardData }) {
  const router = useRouter();
  const [watching, setWatching] = useState(false);
  const [toast, setToast] = useState('');

  const isPositive = token.change24h >= 0;
  const trust = token.trustScore ? TRUST_BADGE[token.trustScore] : null;

  const handleWatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setWatching(true);
    try {
      await supabase.from('watchlist').insert({ token_id: token.contractAddress || token.symbol, symbol: token.symbol, chain: token.chain });
      setToast('Added to watchlist');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      console.error('[TokenCard] Watch failed:', err instanceof Error ? err.message : err);
    } finally {
      setWatching(false);
    }
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (token.contractAddress && token.chain) {
      router.push(`/dashboard/swap?token=${token.contractAddress}&chain=${token.chain}`);
    }
  };

  const handleAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (token.contractAddress) {
      router.push(`/intelligence?address=${token.contractAddress}`);
    }
  };

  return (
    <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 hover:border-[#0A1EFF]/30 transition-all cursor-pointer relative">
      {toast && (
        <div className="absolute top-2 right-2 bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-lg border border-green-500/30 z-10">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {token.logo ? (
            <img
              src={token.logo}
              alt={token.symbol}
              className="w-8 h-8 rounded-full bg-[#0D1117]"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${token.symbol}&background=0A1EFF&color=fff&size=64&bold=true`; }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#0A1EFF]/20 flex items-center justify-center text-xs font-bold text-[#0A1EFF]">
              {token.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold text-sm">{token.symbol}</span>
              {trust && (
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${trust.color}`}>
                  {trust.label}
                </span>
              )}
            </div>
            <span className="text-gray-500 text-xs">{token.name}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white font-bold text-sm font-mono">{formatPrice(token.price)}</div>
          <div className={`flex items-center gap-0.5 justify-end text-xs font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isPositive ? '+' : ''}{token.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {token.marketCap !== undefined && (
          <div className="bg-[#0D1117] rounded-lg px-2 py-1.5">
            <div className="text-[8px] text-gray-600 uppercase">MCap</div>
            <div className="text-[10px] font-semibold text-white">{formatNum(token.marketCap)}</div>
          </div>
        )}
        {token.volume24h !== undefined && (
          <div className="bg-[#0D1117] rounded-lg px-2 py-1.5">
            <div className="text-[8px] text-gray-600 uppercase">Volume</div>
            <div className="text-[10px] font-semibold text-white">{formatNum(token.volume24h)}</div>
          </div>
        )}
        {token.liquidity !== undefined && (
          <div className="bg-[#0D1117] rounded-lg px-2 py-1.5">
            <div className="text-[8px] text-gray-600 uppercase">Liquidity</div>
            <div className="text-[10px] font-semibold text-white">{formatNum(token.liquidity)}</div>
          </div>
        )}
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={handleBuy}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#0A1EFF]/10 hover:bg-[#0A1EFF]/20 text-[#0A1EFF] text-[10px] font-semibold rounded-lg transition-colors border border-[#0A1EFF]/20"
        >
          <ShoppingCart size={10} /> Buy
        </button>
        <button
          onClick={handleWatch}
          disabled={watching}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#1E2433] hover:bg-[#252d40] text-gray-300 text-[10px] font-semibold rounded-lg transition-colors"
        >
          <Eye size={10} /> Watch
        </button>
        <button
          onClick={handleAnalyze}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#1E2433] hover:bg-[#252d40] text-gray-300 text-[10px] font-semibold rounded-lg transition-colors"
        >
          <BarChart3 size={10} /> Analyze
        </button>
      </div>
    </div>
  );
}
