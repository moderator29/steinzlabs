'use client';

import { ArrowLeft, Globe, Zap, Shield, TrendingUp, TrendingDown, Loader2, RefreshCw, ExternalLink, Wifi, WifiOff, ChevronRight, Search, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface Exchange {
  name: string;
  id: string;
  baseUrl: string;
  type: 'cex' | 'dex';
  chains: string[];
  features: string[];
}

interface Ticker {
  symbol: string;
  pair: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface ExchangeStatus {
  exchange: string;
  id: string;
  status: string;
  latency: number | null;
}

const EXCHANGE_COLORS: Record<string, string> = {
  binance: '#F0B90B',
  coinbase: '#0052FF',
  kraken: '#5741D9',
  okx: '#FFFFFF',
  bybit: '#F7A600',
  jupiter: '#52D5B7',
  uniswap: '#FF007A',
  '1inch': '#1B314F',
  raydium: '#4F67E4',
  pancakeswap: '#D1884F',
};

export default function ExchangesPage() {
  const router = useRouter();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [statuses, setStatuses] = useState<ExchangeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickerLoading, setTickerLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'cex' | 'dex'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [exRes, tickerRes, statusRes] = await Promise.all([
          fetch('/api/exchange?action=list'),
          fetch('/api/exchange?action=tickers'),
          fetch('/api/exchange?action=status'),
        ]);
        const exData = await exRes.json();
        const tickerData = await tickerRes.json();
        const statusData = await statusRes.json();

        setExchanges(exData.exchanges || []);
        setTickers(tickerData.tickers || []);
        setStatuses(statusData.statuses || []);
      } catch {}
      setLoading(false);
      setTickerLoading(false);
    }
    load();
  }, []);

  const refreshTickers = async () => {
    setTickerLoading(true);
    try {
      const res = await fetch('/api/exchange?action=tickers');
      const data = await res.json();
      setTickers(data.tickers || []);
    } catch {}
    setTickerLoading(false);
  };

  const filteredExchanges = exchanges.filter(e => {
    if (activeTab !== 'all' && e.type !== activeTab) return false;
    if (searchQuery) {
      return e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const getStatus = (id: string) => statuses.find(s => s.id === id);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Globe className="w-5 h-5 text-[#0A1EFF]" />
          <h1 className="text-sm font-heading font-bold">Exchange Integrations</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { label: 'Total Exchanges', value: exchanges.length.toString(), icon: Globe, color: '#0A1EFF' },
            { label: 'CEX Connected', value: exchanges.filter(e => e.type === 'cex').length.toString(), icon: Shield, color: '#10B981' },
            { label: 'DEX Protocols', value: exchanges.filter(e => e.type === 'dex').length.toString(), icon: Zap, color: '#7C3AED' },
            { label: 'Live Pairs', value: tickers.length.toString(), icon: ArrowUpDown, color: '#F59E0B' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#111827] rounded-xl p-3 border border-white/[0.04]">
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className="w-3 h-3" style={{ color: stat.color }} />
                <span className="text-[9px] text-gray-500">{stat.label}</span>
              </div>
              <div className="text-lg font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#111827] rounded-xl border border-white/[0.04] overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#0A1EFF]" />
              <span className="text-xs font-semibold">Live Market Data</span>
            </div>
            <button onClick={refreshTickers} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${tickerLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-0 min-w-max">
              {tickers.length === 0 && !tickerLoading ? (
                <div className="p-4 text-xs text-gray-500">No market data available</div>
              ) : tickerLoading && tickers.length === 0 ? (
                <div className="p-4 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-[#0A1EFF] animate-spin" />
                  <span className="text-xs text-gray-500">Loading market data...</span>
                </div>
              ) : (
                tickers.map(t => (
                  <div key={t.pair} className="px-4 py-3 border-r border-white/[0.04] last:border-0 min-w-[140px]">
                    <div className="text-[10px] text-gray-500 mb-0.5">{t.symbol}/USDT</div>
                    <div className="text-sm font-bold">${t.price < 1 ? t.price.toFixed(4) : t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className={`text-[10px] font-semibold flex items-center gap-0.5 ${t.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.change24h >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-[#111827] border border-white/[0.06] rounded-xl px-3 py-2 focus-within:border-[#0A1EFF]/40 transition-colors">
            <Search className="w-3.5 h-3.5 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exchanges..."
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder-gray-600"
            />
          </div>
          <div className="flex rounded-lg bg-[#111827] border border-white/[0.06] p-0.5">
            {(['all', 'cex', 'dex'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                  activeTab === tab ? 'bg-[#0A1EFF] text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-[#0A1EFF] mx-auto mb-3 animate-spin" />
            <span className="text-xs text-gray-500">Loading exchanges...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredExchanges.map(exchange => {
              const color = EXCHANGE_COLORS[exchange.id] || '#6B7280';
              const status = getStatus(exchange.id);
              return (
                <button
                  key={exchange.id}
                  onClick={() => setSelectedExchange(selectedExchange?.id === exchange.id ? null : exchange)}
                  className={`text-left bg-[#111827]/80 rounded-xl p-4 border transition-all hover:border-white/10 ${
                    selectedExchange?.id === exchange.id ? 'border-[#0A1EFF]/40 bg-[#0A1EFF]/5' : 'border-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm" style={{ backgroundColor: `${color}20`, color }}>
                        {exchange.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{exchange.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase">{exchange.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {status ? (
                        <div className="flex items-center gap-1">
                          {status.status === 'online' ? (
                            <Wifi className="w-3 h-3 text-green-400" />
                          ) : status.status === 'offline' ? (
                            <WifiOff className="w-3 h-3 text-red-400" />
                          ) : (
                            <Wifi className="w-3 h-3 text-yellow-400" />
                          )}
                          {status.latency && <span className="text-[9px] text-gray-500">{status.latency}ms</span>}
                        </div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-600" />
                      )}
                      <ChevronRight className={`w-3.5 h-3.5 text-gray-600 transition-transform ${selectedExchange?.id === exchange.id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {exchange.chains.map(c => (
                      <span key={c} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-medium">{c}</span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {exchange.features.map(f => (
                      <span key={f} className="text-[8px] px-1.5 py-0.5 rounded font-medium capitalize" style={{ backgroundColor: `${color}10`, color }}>
                        {f}
                      </span>
                    ))}
                  </div>

                  {selectedExchange?.id === exchange.id && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-500">API Base</span>
                        <span className="text-gray-400 font-mono">{exchange.baseUrl}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-500">Type</span>
                        <span className="text-gray-400 uppercase">{exchange.type === 'cex' ? 'Centralized' : 'Decentralized'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-500">Supported Chains</span>
                        <span className="text-gray-400">{exchange.chains.join(', ')}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push('/dashboard/swap'); }}
                          className="flex-1 py-2 rounded-lg text-[10px] font-semibold bg-[#0A1EFF]/20 text-[#0A1EFF] hover:bg-[#0A1EFF]/30 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Zap className="w-3 h-3" />
                          Trade
                        </button>
                        <a
                          href={exchange.baseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 py-2 rounded-lg text-[10px] font-semibold bg-white/5 text-gray-400 hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          API Docs
                        </a>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
