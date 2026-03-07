'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, RotateCcw, PieChart, ArrowUpRight, ArrowDownRight, Plus, ExternalLink, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';

interface Token {
  symbol: string;
  name: string;
  balance: string;
  price: number;
  valueUsd: number;
  change24h: number;
  contractAddress: string;
}

export default function PortfolioPage() {
  const router = useRouter();
  const { address: walletAddress, provider, isConnected, connectAuto, connecting } = useWallet();
  const [portfolio, setPortfolio] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalChange, setTotalChange] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);

  useEffect(() => {
    if (walletAddress) {
      fetchPortfolio(walletAddress);
    }
  }, [walletAddress]);

  const fetchPortfolio = async (address: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio?address=${address}`);
      const data = await res.json();
      if (data.portfolio) {
        setPortfolio(data.portfolio);
        setTotalValue(data.totalValue || 0);
        setTotalChange(data.totalChange || 0);
        setTokenCount(data.tokenCount || 0);
      }
    } catch (error) {
      console.error('Portfolio fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeColor = (change: number) => change >= 0 ? '#10B981' : '#EF4444';

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white pb-8">
      <div className="fixed top-0 w-full z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center px-4 h-14 gap-3">
          <button onClick={() => router.push('/dashboard')} className="hover:bg-white/10 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <PieChart className="w-5 h-5 text-[#00D4AA]" />
          <h1 className="font-heading font-bold">Portfolio</h1>
          {walletAddress && (
            <button
              onClick={() => fetchPortfolio(walletAddress)}
              className="ml-auto hover:bg-white/10 p-2 rounded-lg"
            >
              <RotateCcw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="pt-20 px-4 max-w-2xl mx-auto">
        {!walletAddress ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-[#00D4AA]/20 to-[#6366F1]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-[#00D4AA]" />
            </div>
            <h2 className="text-2xl font-heading font-bold mb-2">Track Your Portfolio</h2>
            <p className="text-gray-400 text-sm mb-6">Connect your wallet to see real-time portfolio tracking, P&L, and performance metrics.</p>
            <button
              onClick={connectAuto}
              disabled={connecting}
              className="bg-gradient-to-r from-[#00D4AA] to-[#6366F1] px-8 py-3 rounded-xl font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-[#00D4AA]/5 to-[#6366F1]/5">
              <div className="text-xs text-gray-400 mb-1">Total Portfolio Value</div>
              <div className="text-3xl font-heading font-bold mb-2">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2">
                {totalChange >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-[#EF4444]" />
                )}
                <span className="text-sm font-semibold" style={{ color: getChangeColor(totalChange) }}>
                  {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
                </span>
                <span className="text-xs text-gray-500">24h</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-3 border border-white/10 text-center">
                <div className="text-lg font-bold">{tokenCount}</div>
                <div className="text-[10px] text-gray-400">Assets</div>
              </div>
              <div className="glass rounded-xl p-3 border border-white/10 text-center">
                <div className="text-lg font-bold text-[#00D4AA]">
                  {portfolio.filter(t => t.change24h >= 0).length}
                </div>
                <div className="text-[10px] text-gray-400">Gainers</div>
              </div>
              <div className="glass rounded-xl p-3 border border-white/10 text-center">
                <div className="text-lg font-bold text-[#EF4444]">
                  {portfolio.filter(t => t.change24h < 0).length}
                </div>
                <div className="text-[10px] text-gray-400">Losers</div>
              </div>
            </div>

            {portfolio.length > 0 && totalValue > 0 && (
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <PieChart className="w-4 h-4 text-[#00D4AA]" />
                  <span className="font-bold text-sm">Allocation</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden mb-3">
                  {portfolio.filter(t => t.valueUsd > 0).map((token, i) => {
                    const pct = (token.valueUsd / totalValue) * 100;
                    const colors = ['#00D4AA', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899'];
                    return (
                      <div
                        key={i}
                        className="h-full"
                        style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length], minWidth: pct > 0 ? '2px' : '0' }}
                        title={`${token.symbol}: ${pct.toFixed(1)}%`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {portfolio.filter(t => t.valueUsd > 0).slice(0, 5).map((token, i) => {
                    const pct = (token.valueUsd / totalValue) * 100;
                    const colors = ['#00D4AA', '#6366F1', '#10B981', '#F59E0B', '#EF4444'];
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                        {token.symbol} {pct.toFixed(1)}%
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="glass rounded-xl border border-white/10">
              <div className="flex items-center gap-2 p-4 border-b border-white/5">
                <BarChart3 className="w-4 h-4 text-[#00D4AA]" />
                <span className="font-bold text-sm">Holdings</span>
                <span className="ml-auto text-xs text-gray-500">{portfolio.length} tokens</span>
              </div>
              <div className="divide-y divide-white/5">
                {portfolio.map((token, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="w-9 h-9 bg-gradient-to-br from-[#00D4AA]/20 to-[#6366F1]/20 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{token.symbol}</div>
                      <div className="text-[10px] text-gray-500 truncate">{token.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-semibold">
                        ${token.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[10px] text-gray-500">
                          {parseFloat(token.balance).toFixed(4)} {token.symbol}
                        </span>
                      </div>
                    </div>
                    <div className="w-16 text-right">
                      {token.change24h !== 0 && (
                        <div className="flex items-center justify-end gap-0.5">
                          {token.change24h >= 0 ? (
                            <TrendingUp className="w-3 h-3" style={{ color: getChangeColor(token.change24h) }} />
                          ) : (
                            <TrendingDown className="w-3 h-3" style={{ color: getChangeColor(token.change24h) }} />
                          )}
                          <span className="text-xs font-semibold" style={{ color: getChangeColor(token.change24h) }}>
                            {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href={provider === 'phantom' ? `https://solscan.io/account/${walletAddress}` : `https://etherscan.io/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 glass rounded-xl p-3 border border-white/10 text-center text-xs text-gray-400 hover:text-[#00D4AA] transition-colors flex items-center justify-center gap-2"
              >
                View on {provider === 'phantom' ? 'Solscan' : 'Etherscan'} <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => router.push('/dashboard/dna-analyzer')}
                className="flex-1 bg-gradient-to-r from-[#00D4AA] to-[#6366F1] rounded-xl p-3 text-center text-xs font-semibold flex items-center justify-center gap-2"
              >
                Analyze DNA <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="glass rounded-xl p-3 border border-white/10 text-center">
              <div className="text-[10px] text-gray-500 mb-1">Wallet</div>
              <div className="text-xs font-mono text-gray-400">{walletAddress}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
