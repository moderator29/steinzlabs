'use client';

import { useState } from 'react';
import { TrendingUp, AlertTriangle, Clock, ArrowUpDown } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

export default function TradingPage() {
  const [activeTab, setActiveTab] = useState<'market' | 'limit' | 'dca'>('market');
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [amount, setAmount] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState('');

  const getQuote = async () => {
    if (!tokenIn || !tokenOut || !amount) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/trade/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenIn, tokenOut, amountIn: amount, chain: 'solana' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get quote');
      setQuote(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createLimitOrder = async () => {
    if (!tokenIn || !tokenOut || !amount || !targetPrice) return;
    setLoading(true);
    setError('');
    try {
      const wallet = localStorage.getItem('wallet_address') || '';
      const res = await fetch('/api/trading/limit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: tokenOut,
          tokenSymbol: tokenOut.slice(0, 6),
          chain: 'solana',
          side: 'BUY',
          targetPrice: parseFloat(targetPrice),
          amount: parseFloat(amount),
          amountUSD: parseFloat(amount),
          expiresInHours: 24,
          userWallet: wallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      setQuote(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] p-6">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Trading"
          description="Advanced multi-chain trading with limit orders, stop loss, and DCA bots"
        />

        {/* Trade Type Tabs */}
        <div className="flex gap-2 mb-6">
          {(['market', 'limit', 'dca'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-[#0A1EFF] text-white'
                  : 'bg-[#141824] text-gray-400 hover:text-white border border-[#1E2433]'
              }`}
            >
              {tab === 'dca' ? 'DCA Bot' : `${tab.charAt(0).toUpperCase() + tab.slice(1)} Order`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Trade Form */}
          <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <ArrowUpDown size={20} className="text-[#0A1EFF]" />
              {activeTab === 'market' ? 'Market Swap' : activeTab === 'limit' ? 'Limit Order' : 'DCA Bot'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Token In (Address)</label>
                <input
                  type="text"
                  value={tokenIn}
                  onChange={(e) => setTokenIn(e.target.value)}
                  placeholder="Enter token address..."
                  className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Token Out (Address)</label>
                <input
                  type="text"
                  value={tokenOut}
                  onChange={(e) => setTokenOut(e.target.value)}
                  placeholder="Enter token address..."
                  className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                />
              </div>

              {activeTab === 'limit' && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Target Price (USD)</label>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                  />
                </div>
              )}

              {activeTab === 'market' && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Slippage (%)</label>
                  <input
                    type="number"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    placeholder="1"
                    className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]"
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={activeTab === 'limit' ? createLimitOrder : getQuote}
                disabled={loading}
                className="w-full bg-[#0A1EFF] hover:bg-[#0916CC] disabled:opacity-50 text-white font-bold py-4 rounded-lg transition-colors"
              >
                {loading ? 'Loading...' : activeTab === 'market' ? 'Get Quote' : activeTab === 'limit' ? 'Create Limit Order' : 'Configure DCA'}
              </button>
            </div>
          </div>

          {/* Quote / Order Result */}
          <div className="bg-[#141824] rounded-lg p-6 border border-[#1E2433]">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-green-500" />
              {quote ? 'Order Details' : 'Awaiting Quote'}
            </h2>

            {!quote ? (
              <div className="text-center py-12 text-gray-500">
                <Clock size={48} className="mx-auto mb-4 opacity-50" />
                <p>Fill in trade details and get a quote</p>
                <p className="text-sm mt-2">Shadow Guardian will scan for risks before executing</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quote.amountOut && (
                  <div className="flex justify-between py-2 border-b border-[#1E2433]">
                    <span className="text-gray-400">You Receive</span>
                    <span className="text-white font-mono">{quote.amountOut}</span>
                  </div>
                )}
                {quote.priceImpact !== undefined && (
                  <div className="flex justify-between py-2 border-b border-[#1E2433]">
                    <span className="text-gray-400">Price Impact</span>
                    <span className={quote.priceImpact > 3 ? 'text-red-400' : 'text-green-400'}>
                      {quote.priceImpact?.toFixed(2)}%
                    </span>
                  </div>
                )}
                {quote.riskScore !== undefined && (
                  <div className="flex justify-between py-2 border-b border-[#1E2433]">
                    <span className="text-gray-400">Risk Score</span>
                    <span className={quote.riskScore > 50 ? 'text-red-400' : 'text-green-400'}>
                      {quote.riskScore}/100
                    </span>
                  </div>
                )}
                {quote.order && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
                    Limit order created successfully
                  </div>
                )}
                {quote.blocked && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{quote.blockReason}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
