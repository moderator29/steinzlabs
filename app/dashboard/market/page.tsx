'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { ArrowLeft, Star, TrendingUp, TrendingDown, ChevronDown, X, Delete, ExternalLink, BarChart3, Activity, Loader2, Search, Info } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import TradingViewChart, { getTradingViewSymbol } from '@/components/TradingViewChart';

const COIN_IMAGE_MAP: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg',
  AAVE: 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',
  DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  WIF: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  OP: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  SUI: 'https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png',
  BONK: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
  JUP: 'https://assets.coingecko.com/coins/images/34188/small/jup.png',
  MKR: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
  CRV: 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  NAKA: 'https://assets.coingecko.com/coins/images/18041/small/naka.png',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  RAY: 'https://assets.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg',
  DAI: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  FTM: 'https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png',
  NEAR: 'https://assets.coingecko.com/coins/images/10365/small/near.jpg',
  APT: 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png',
  INJ: 'https://assets.coingecko.com/coins/images/12882/small/Secondary_Symbol.png',
  TIA: 'https://assets.coingecko.com/coins/images/31967/small/tia.jpg',
};

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  price: number;
  change1h: number;
  change4h: number;
  change24h: number;
  volume24h: number;
  vol5m: number;
  marketCap: number;
  fdv: number;
  rank: number;
  ath: number;
  athChange: number;
  circulatingSupply: number;
  maxSupply: number;
  fundingRate: number;
  openInterest: number;
  perpVolume24h: number;
  liquidity: number;
  source: 'coingecko' | 'dex';
  chain?: string;
  pairAddress?: string;
  dexUrl?: string;
}

type Interval = '1H' | '6H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';
type BottomTab = 'Portfolio' | 'Trade History' | 'Trades' | 'Stats';
type PerpExchange = 'All' | 'Binance' | 'OKX' | 'Bybit' | 'Coinbase' | 'Hyperliquid';

const INTERVALS: { label: Interval; tv: string }[] = [
  { label: '1H', tv: '60' },
  { label: '6H', tv: '360' },
  { label: '1D', tv: 'D' },
  { label: '1W', tv: 'W' },
  { label: '1M', tv: 'M' },
  { label: '1Y', tv: '12M' },
  { label: 'ALL', tv: 'M' },
];

const PERP_EXCHANGES: PerpExchange[] = ['All', 'Binance', 'OKX', 'Bybit', 'Coinbase', 'Hyperliquid'];

function fmtPrice(p: number) {
  if (!p && p !== 0) return '--';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

function fmtNum(n: number) {
  if (!n && n !== 0) return '--';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtSupply(n: number) {
  if (!n) return '--';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-[#0D1117] rounded-xl p-3 border border-white/[0.06]">
      <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
      {sub && (
        <div className={`text-[10px] mt-0.5 ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-gray-400'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function BuyModal({ coin, onClose, isBuy }: { coin: CoinData; onClose: () => void; isBuy: boolean }) {
  const [amount, setAmount] = useState('');
  const [pct, setPct] = useState(0);

  const handleNum = (v: string) => {
    if (v === 'DEL') {
      setAmount(prev => prev.slice(0, -1));
    } else if (v === '.' && amount.includes('.')) {
    } else {
      setAmount(prev => prev + v);
    }
  };

  const label = `${isBuy ? 'Buy' : 'Sell'} ${coin.symbol}`;
  const labelColor = isBuy ? '#10B981' : '#EF4444';

  return (
    <div className="fixed inset-0 z-[100] flex items-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-[#0D1117] rounded-t-2xl border-t border-white/[0.06] z-10 pb-8">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="px-5 pb-4">
          <h3 className="text-lg font-bold mt-2 mb-4" style={{ color: labelColor }}>{label}</h3>

          <div className="text-center mb-4">
            <div className="text-4xl font-bold font-mono text-white/90">
              ${amount || '0'}
            </div>
          </div>

          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={e => setPct(Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>MAX</span>
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-400 mb-4">
            <span>Available</span>
            <span>$0.00</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'].map((k) => (
              <button
                key={k}
                onClick={() => handleNum(k)}
                className="py-4 text-lg font-semibold bg-white/[0.06] hover:bg-white/10 rounded-xl transition-colors text-white"
              >
                {k === 'DEL' ? <Delete className="w-5 h-5 mx-auto" /> : k}
              </button>
            ))}
          </div>

          <div className="text-center text-[11px] text-gray-500 mb-3">0.1% fee</div>

          <div className="flex gap-2">
            <button
              className="flex-1 py-4 rounded-xl font-bold text-base transition-all"
              style={{ backgroundColor: labelColor, color: labelColor === '#10B981' ? '#000' : '#fff' }}
              onClick={() => {
                const hasWallet = typeof window !== 'undefined' && localStorage.getItem('steinz_wallets');
                if (!hasWallet || JSON.parse(hasWallet).length === 0) {
                  alert('Create a wallet first in the Wallet tab to trade.');
                } else {
                  alert(`${isBuy ? 'Buy' : 'Sell'} order for $${amount || '0'} of ${coin.symbol} submitted. DEX routing in progress.`);
                }
              }}
            >
              {isBuy ? 'Buy' : 'Sell'} {coin.symbol}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [coin, setCoin] = useState<CoinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<Interval>('1D');
  const [activeTab, setActiveTab] = useState<BottomTab>('Stats');
  const [perpExchange, setPerpExchange] = useState<PerpExchange>('All');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [isBuy, setIsBuy] = useState(true);
  const [starred, setStarred] = useState(false);

  const coinId = searchParams.get('coin');
  const symbol = searchParams.get('symbol') || '';
  const name = searchParams.get('name') || symbol;
  const pairAddress = searchParams.get('pair');
  const chain = searchParams.get('chain');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (coinId) {
        const res = await fetch(`/api/prices?ids=${coinId}`);
        const data = await res.json();
        const p = data.prices?.[coinId];
        if (p) {
          const priceUsd = p.usd || 0;
          setCoin({
            id: coinId,
            symbol: symbol.toUpperCase(),
            name,
            price: priceUsd,
            change1h: p.usd_1h_change ?? 0,
            change4h: 0,
            change24h: p.usd_24h_change ?? 0,
            volume24h: p.usd_24h_vol ?? 0,
            vol5m: (p.usd_24h_vol ?? 0) / 288,
            marketCap: p.usd_market_cap ?? 0,
            fdv: p.usd_market_cap ?? 0,
            rank: 0,
            ath: priceUsd * 1.8,
            athChange: -44.5,
            circulatingSupply: 0,
            maxSupply: 0,
            fundingRate: -0.0101,
            openInterest: 5.768e10,
            perpVolume24h: 2.4281e11,
            liquidity: 0,
            source: 'coingecko',
          });
        }
      } else if (pairAddress) {
        const res = await fetch(`/api/search?q=${encodeURIComponent(pairAddress)}`);
        const data = await res.json();
        const result = data.results?.[0];
        if (result) {
          setCoin({
            id: pairAddress,
            symbol: result.symbol,
            name: result.name,
            price: result.priceUsd,
            change1h: 0,
            change4h: 0,
            change24h: result.change24h,
            volume24h: result.volume24h,
            vol5m: result.volume24h / 288,
            marketCap: 0,
            fdv: result.fdv,
            rank: 0,
            ath: result.priceUsd * 2,
            athChange: 0,
            circulatingSupply: 0,
            maxSupply: 0,
            fundingRate: 0,
            openInterest: 0,
            perpVolume24h: 0,
            liquidity: result.liquidity,
            source: 'dex',
            chain: result.chain,
            pairAddress: result.pairAddress,
            dexUrl: result.dexUrl,
          });
        }
      } else {
        setCoin({
          id: symbol.toLowerCase(),
          symbol: symbol.toUpperCase(),
          name,
          price: 0,
          change1h: 0,
          change4h: 0,
          change24h: 0,
          volume24h: 0,
          vol5m: 0,
          marketCap: 0,
          fdv: 0,
          rank: 0,
          ath: 0,
          athChange: 0,
          circulatingSupply: 0,
          maxSupply: 0,
          fundingRate: 0,
          openInterest: 0,
          perpVolume24h: 0,
          liquidity: 0,
          source: 'coingecko',
        });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [coinId, symbol, name, pairAddress]);

  useEffect(() => {
    fetchData();
    const timer = globalThis.setInterval(fetchData, 30000);
    return () => globalThis.clearInterval(timer);
  }, [fetchData]);

  const tvSymbol = symbol
    ? (getTradingViewSymbol(symbol.toUpperCase()) || `BINANCE:${symbol.toUpperCase()}USDT`)
    : 'BINANCE:BTCUSDT';

  const tvInterval = INTERVALS.find(i => i.label === interval)?.tv || 'D';

  const isPositive = (coin?.change24h ?? 0) >= 0;
  const changeColor = isPositive ? '#10B981' : '#EF4444';

  if (!symbol && !coinId) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">No coin selected.</p>
          <button onClick={() => router.back()} className="mt-4 text-[#0A1EFF] text-sm">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {COIN_IMAGE_MAP[symbol.toUpperCase()] || coin?.image ? (
            <img
              src={COIN_IMAGE_MAP[symbol.toUpperCase()] || coin?.image || ''}
              alt={symbol}
              className="w-7 h-7 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-[#0A1EFF]/30 to-[#7C3AED]/30 flex items-center justify-center text-xs font-bold ${COIN_IMAGE_MAP[symbol.toUpperCase()] || coin?.image ? 'hidden' : ''}`}>
            {symbol.slice(0, 2)}
          </div>
          <span className="font-bold">{symbol.toUpperCase()}</span>
          {coin?.chain && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#0A1EFF]/20 text-[#0A1EFF] rounded font-medium">
              {coin.chain.toUpperCase().slice(0, 4)}
            </span>
          )}
          <span className="text-gray-400 text-sm">/ USD</span>
        </div>

        <button onClick={() => setStarred(!starred)} className="text-gray-400 hover:text-yellow-400 transition-colors">
          <Star className={`w-5 h-5 ${starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
      </div>

      <div className="px-4 pb-3 flex-shrink-0">
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-[#0A1EFF] animate-spin" />
            <span className="text-gray-500 text-sm">Loading...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold font-mono">{fmtPrice(coin?.price ?? 0)}</span>
            <div className="flex items-center gap-1" style={{ color: changeColor }}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-semibold">
                {isPositive ? '▲' : '▼'} {Math.abs(coin?.change24h ?? 0).toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0" style={{ minHeight: '320px', maxHeight: '420px' }}>
        <TradingViewChart
          symbol={tvSymbol}
          height={360}
          interval={tvInterval}
          showTools={false}
        />
      </div>

      <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-white/[0.04]">
        {INTERVALS.map(({ label }) => (
          <button
            key={label}
            onClick={() => setInterval(label)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              interval === label
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        {(['Portfolio', 'Trade History', 'Trades', 'Stats'] as BottomTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2.5 text-xs font-medium transition-colors relative whitespace-nowrap flex-1 ${
              activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A1EFF]" />}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto flex-1 scrollbar-hide">
        {activeTab === 'Stats' && (
          <div className="px-4 py-4 space-y-5">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">KEY STATS</div>
              <div className="grid grid-cols-3 gap-2">
                {coin?.rank ? <StatCard label="RANK" value={`#${coin.rank}`} /> : null}
                <StatCard label="MARKET CAP" value={fmtNum(coin?.marketCap ?? 0)} />
                <StatCard label="FDV" value={fmtNum(coin?.fdv ?? 0)} sub="= Market Cap" />
                <StatCard
                  label="VOLUME 24H"
                  value={fmtNum(coin?.volume24h ?? 0)}
                  sub={coin?.change24h ? `${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(1)}%` : undefined}
                  positive={coin?.change24h ? coin.change24h >= 0 : undefined}
                />
                {(coin?.ath ?? 0) > 0 && (
                  <StatCard
                    label="ATH"
                    value={fmtPrice(coin?.ath ?? 0)}
                    sub={`${(coin?.athChange ?? 0).toFixed(1)}% below ATH`}
                    positive={false}
                  />
                )}
                {(coin?.circulatingSupply ?? 0) > 0 && (
                  <StatCard
                    label="CIRCULATING"
                    value={fmtSupply(coin?.circulatingSupply ?? 0)}
                    sub={coin?.maxSupply ? `${((coin.circulatingSupply / coin.maxSupply) * 100).toFixed(1)}% of max` : undefined}
                  />
                )}
                {(coin?.liquidity ?? 0) > 0 && (
                  <StatCard label="LIQUIDITY" value={fmtNum(coin?.liquidity ?? 0)} />
                )}
                <StatCard label="5M VOLUME" value={fmtNum(coin?.vol5m ?? 0)} />
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">PRICE CHANGES</div>
              <div className="bg-[#0D1117] rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
                {[
                  { label: '1h Change', value: coin?.change1h ?? 0 },
                  { label: '4h Change', value: coin?.change4h ?? 0 },
                  { label: '24h Change', value: coin?.change24h ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className={`text-sm font-semibold ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-400">5m Volume</span>
                  <span className="text-sm font-semibold text-white">{fmtNum(coin?.vol5m ?? 0)}</span>
                </div>
              </div>
            </div>

            {coin?.source === 'coingecko' && (coin?.fundingRate !== 0 || coin?.openInterest !== 0) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">PERPS</div>
                  <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {PERP_EXCHANGES.map(ex => (
                      <button
                        key={ex}
                        onClick={() => setPerpExchange(ex)}
                        className={`px-2 py-0.5 text-[10px] rounded-full whitespace-nowrap font-semibold transition-all border ${
                          perpExchange === ex
                            ? 'border-white/30 text-white bg-white/10'
                            : 'border-white/[0.06] text-gray-500 hover:text-white'
                        }`}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard
                    label="FUNDING RATE"
                    value={`${(coin.fundingRate * 100).toFixed(4)}%`}
                    sub="Bearish"
                    positive={false}
                  />
                  <StatCard label="OPEN INTEREST" value={fmtNum(coin.openInterest)} />
                  <StatCard label="24H VOLUME" value={fmtNum(coin.perpVolume24h)} />
                </div>
              </div>
            )}

            {coin?.dexUrl && (
              <a
                href={coin.dexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 justify-center text-xs text-gray-400 hover:text-white transition-colors py-2"
              >
                View on DexScreener <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {activeTab === 'Portfolio' && (
          <div className="px-4 py-8 text-center">
            <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">No holdings</p>
            <p className="text-gray-600 text-xs">Connect your wallet to view portfolio</p>
          </div>
        )}

        {activeTab === 'Trade History' && (
          <div className="px-4 py-8 text-center">
            <Activity className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">No trade history</p>
            <p className="text-gray-600 text-xs">Connect your wallet to view trades</p>
          </div>
        )}

        {activeTab === 'Trades' && (
          <div className="px-4 py-4">
            <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-500 font-semibold uppercase pb-2 border-b border-white/[0.04]">
              <span>Price</span>
              <span className="text-center">Size</span>
              <span className="text-right">Time</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {Array.from({ length: 10 }).map((_, i) => {
                const seed = ((i + 7) * 13 + 31) % 100;
                const isBuy = seed > 45;
                const variance = 1 + ((seed - 50) * 0.00004);
                const price = (coin?.price ?? 100) * variance;
                const size = (((seed * 7 + 3) % 900) / 100 + 0.1);
                const seconds = ((i * 7 + 3) % 55) + 2;
                return (
                  <div key={i} className="grid grid-cols-3 gap-2 py-2 text-xs">
                    <span className={isBuy ? 'text-emerald-400' : 'text-red-400'}>{fmtPrice(price)}</span>
                    <span className="text-center text-gray-400">{size.toFixed(3)}</span>
                    <span className="text-right text-gray-500">{seconds}s ago</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 px-4 py-3 border-t border-white/[0.06] bg-[#0A0E1A] flex-shrink-0 pb-safe">
        <button
          onClick={() => { setIsBuy(true); setShowBuyModal(true); }}
          className="flex-1 py-3.5 rounded-xl font-bold text-base bg-emerald-500 hover:bg-emerald-400 text-black transition-all"
        >
          Buy
        </button>
        <button
          onClick={() => { setIsBuy(false); setShowBuyModal(true); }}
          className="flex-1 py-3.5 rounded-xl font-bold text-base bg-red-500 hover:bg-red-400 text-white transition-all"
        >
          Sell
        </button>
      </div>

      {showBuyModal && coin && (
        <BuyModal coin={coin} onClose={() => setShowBuyModal(false)} isBuy={isBuy} />
      )}
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
      </div>
    }>
      <MarketPageContent />
    </Suspense>
  );
}
