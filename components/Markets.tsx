'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, SlidersHorizontal, X, TrendingUp, TrendingDown, Loader2, ChevronRight, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoinRow {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  rank: number;
}

// ─── Static data maps ─────────────────────────────────────────────────────────

const LOGOS: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  TRX: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  LTC: 'https://assets.coingecko.com/coins/images/2/small/litecoin.png',
  NEAR: 'https://assets.coingecko.com/coins/images/10365/small/near.jpg',
  APT: 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  OP: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  ATOM: 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  WIF: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg',
  BONK: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
  SUI: 'https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png',
  TON: 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
  JUP: 'https://assets.coingecko.com/coins/images/34188/small/jup.png',
  RAY: 'https://assets.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  INJ: 'https://assets.coingecko.com/coins/images/12882/small/Secondary_Symbol.png',
  SEI: 'https://assets.coingecko.com/coins/images/28205/small/Sei_Logo_-_Transparent.png',
  TIA: 'https://assets.coingecko.com/coins/images/31967/small/tia.jpg',
  BLUR: 'https://assets.coingecko.com/coins/images/28453/small/blur.png',
};

const NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', XRP: 'XRP', SOL: 'Solana',
  USDT: 'Tether', USDC: 'USD Coin', ADA: 'Cardano', DOGE: 'Dogecoin', TRX: 'TRON',
  TON: 'Toncoin', AVAX: 'Avalanche', MATIC: 'Polygon', LINK: 'Chainlink',
  DOT: 'Polkadot', SHIB: 'Shiba Inu', UNI: 'Uniswap', LTC: 'Litecoin',
  NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
  ATOM: 'Cosmos', PEPE: 'Pepe', WIF: 'dogwifhat', BONK: 'Bonk', SUI: 'Sui',
  JUP: 'Jupiter', RAY: 'Raydium', WBTC: 'Wrapped Bitcoin', INJ: 'Injective',
  SEI: 'Sei', TIA: 'Celestia', BLUR: 'Blur',
};

// Stablecoins to skip (not interesting to show)
const STABLES = new Set(['USDT','USDC','BUSD','DAI','FDUSD','TUSD','USDP','USDD']);

function fmtPrice(p: number) {
  if (!p) return '--';
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

function fmtMcap(n: number) {
  if (!n || n <= 0) return '';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtVol(n: number) {
  if (!n || n <= 0) return '';
  if (n >= 1e9) return `Vol $${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `Vol $${(n / 1e6).toFixed(1)}M`;
  return '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Markets() {
  const router = useRouter();
  const [coins, setCoins] = useState<CoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [totalMcap, setTotalMcap] = useState('');
  const [totalChange, setTotalChange] = useState({ val: 0, positive: true });
  const [refreshing, setRefreshing] = useState(false);

  const fetchCoins = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      // Fetch directly from Binance — public API, no key needed, works from browser
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      if (!res.ok) throw new Error(`Binance ${res.status}`);
      const tickers: any[] = await res.json();

      // Filter USDT pairs, skip stablecoins, sort by USD volume
      const rows: CoinRow[] = tickers
        .filter((t: any) => t.symbol.endsWith('USDT') && !STABLES.has(t.symbol.replace('USDT', '')))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 100)
        .map((t: any, i: number) => {
          const sym = t.symbol.replace('USDT', '');
          const vol = parseFloat(t.quoteVolume) || 0;
          return {
            id: sym.toLowerCase(),
            symbol: sym,
            name: NAMES[sym] || sym,
            image: LOGOS[sym] || `https://ui-avatars.com/api/?name=${encodeURIComponent(sym)}&background=0A1EFF&color=fff&size=64&bold=true&rounded=true`,
            price: parseFloat(t.lastPrice) || 0,
            change24h: parseFloat(t.priceChangePercent) || 0,
            volume24h: vol,
            marketCap: 0,
            rank: i + 1,
          };
        });

      setCoins(rows);

      // Compute weighted total market change
      const totalVol = rows.reduce((s, r) => s + r.volume24h, 0);
      const weightedChange = rows.reduce((s, r) => s + r.change24h * r.volume24h, 0);
      const avgChange = totalVol > 0 ? weightedChange / totalVol : 0;
      setTotalChange({ val: Math.abs(avgChange), positive: avgChange >= 0 });

      // Try to get global mcap from CoinGecko (optional, best-effort)
      try {
        const cgGlobal = await fetch('https://api.coingecko.com/api/v3/global');
        if (cgGlobal.ok) {
          const cgData = await cgGlobal.json();
          const mc = cgData.data?.total_market_cap?.usd || 0;
          if (mc > 0) {
            setTotalMcap(mc >= 1e12 ? `$${(mc / 1e12).toFixed(2)}T` : `$${(mc / 1e9).toFixed(1)}B`);
          }
        }
      } catch { /* non-critical */ }

    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCoins(); }, [fetchCoins]);

  const filtered = search.length >= 1
    ? coins.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.toLowerCase().includes(search.toLowerCase())
      )
    : coins;

  const handleCoinTap = (coin: CoinRow) => {
    router.push(`/dashboard/market?symbol=${coin.symbol}&name=${encodeURIComponent(coin.name)}`);
  };

  return (
    <div className="pb-4">
      {/* Stats row */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          {totalMcap && <div className="text-xs text-gray-500">Total: {totalMcap}</div>}
          {totalChange.val > 0 && (
            <div className={`text-xs font-semibold ${totalChange.positive ? 'text-[#0A1EFF]' : 'text-red-400'}`}>
              {totalChange.positive ? '+' : '-'}{totalChange.val.toFixed(2)}%
            </div>
          )}
        </div>
        <button
          onClick={() => fetchCoins(true)}
          className="text-gray-500 hover:text-white transition-colors p-1"
          style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or symbol..."
            className="w-full pl-9 pr-4 py-2.5 bg-[#111827] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className="flex items-center justify-center w-10 h-10 bg-[#111827] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white hover:border-[#0A1EFF]/30 transition-all flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Coin list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading markets...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-sm text-gray-500">Failed to load market data</span>
          <button
            onClick={() => fetchCoins()}
            className="text-xs text-[#0A1EFF] underline"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">
          {search ? `No results for "${search}"` : 'No coins found'}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-white/[0.06]">
          {filtered.map((coin, i) => {
            const isPositive = coin.change24h >= 0;
            return (
              <button
                key={`${coin.id}-${i}`}
                onClick={() => handleCoinTap(coin)}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#111827] hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors border-b border-white/[0.04] last:border-b-0 text-left"
              >
                {/* Rank */}
                <div className="w-6 text-right text-[11px] text-gray-600 flex-shrink-0 font-mono">
                  {coin.rank}
                </div>

                {/* Logo */}
                <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-[#0A1EFF]/10 flex items-center justify-center">
                  <img
                    src={coin.image}
                    alt={coin.symbol}
                    className="w-full h-full object-cover rounded-full"
                    onError={e => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${coin.symbol.slice(0,2)}&background=0A1EFF&color=fff&size=64&bold=true&rounded=true`;
                    }}
                  />
                </div>

                {/* Name + volume */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{coin.name}</div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {fmtVol(coin.volume24h) || coin.symbol}
                  </div>
                </div>

                {/* Price + change */}
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono font-semibold text-white">{fmtPrice(coin.price)}</div>
                  <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${isPositive ? 'text-[#0A1EFF]' : 'text-red-400'}`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isPositive ? '+' : ''}{coin.change24h.toFixed(2)}%
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-700 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Filter sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="relative w-full bg-[#111827] rounded-t-2xl p-6 z-10 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Blockchain', value: 'All Chains' },
                { label: 'Market Cap', value: 'All' },
                { label: 'Price Change', value: 'All' },
                { label: 'Timeframe', value: '24H' },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-sm text-gray-300">{f.label}</span>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{f.value}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowFilters(false)}
              className="w-full mt-6 py-3.5 font-bold rounded-xl transition-colors text-white"
              style={{ background: 'linear-gradient(135deg, #0A1EFF, #3d57ff)' }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
