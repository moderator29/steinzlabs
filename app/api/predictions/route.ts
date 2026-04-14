import 'server-only';
import { NextResponse } from 'next/server';
import { getTopTokens } from '@/lib/services/coingecko';
import { searchPairs, getTokenPairs } from '@/lib/services/dexscreener';
import type { DexPair } from '@/lib/services/dexscreener';

interface Prediction {
  id: string;
  category: 'market_cap' | 'price' | 'volume' | 'launch' | 'holder';
  question: string;
  tokenName: string;
  tokenSymbol: string;
  tokenIcon: string;
  chain: string;
  currentPrice: number;
  currentMcap: number;
  targetValue: number;
  targetLabel: string;
  progress: number;
  priceChange24h: number;
  volume24h: number;
  closeDate: string;
  totalPool: number;
  yesPool: number;
  noPool: number;
  yesPercent: number;
  noPercent: number;
  totalPredictors: number;
  status: 'active' | 'resolved';
  outcome?: 'yes' | 'no';
  chartSymbol: string;
  chartPairAddress?: string;
  chartChainId?: string;
  resolver: string;
  createdAt: string;
}

interface UserPrediction {
  predictionId: string;
  side: 'yes' | 'no';
  amount: number;
  timestamp: string;
}

let predictionsCache: Prediction[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 120000;

const userPredictions: Record<string, UserPrediction[]> = {};

function defaultPool(): { totalPool: number; yesPool: number; noPool: number; yesPercent: number; noPercent: number; totalPredictors: number } {
  return { totalPool: 0, yesPool: 0, noPool: 0, yesPercent: 50, noPercent: 50, totalPredictors: 0 };
}

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function clampProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

interface CoinGeckoCoin {
  id: string; name: string; symbol: string; current_price: number;
  market_cap: number; total_volume: number; image: string;
  market_cap_rank: number; high_24h: number; low_24h: number;
  ath: number; ath_change_percentage: number;
  price_change_percentage_24h: number;
}

interface PumpToken {
  mint: string; symbol: string; name: string;
  usd_market_cap: number; reply_count: number;
  creator: string; image_uri: string; created_timestamp: number | null;
}

async function fetchCoinGeckoCoins(): Promise<CoinGeckoCoin[]> {
  try {
    const coins = await getTopTokens(30);
    return coins as unknown as CoinGeckoCoin[];
  } catch {
    return [];
  }
}

async function fetchPumpFunTokens(): Promise<PumpToken[]> {
  try {
    const allPairs = await searchPairs('pump.fun').catch(() => []);
    const pairs = allPairs.filter(p => p.chainId === 'solana').slice(0, 5);
    return pairs.map(p => ({
      mint: p.baseToken?.address ?? '',
      symbol: p.baseToken?.symbol ?? '',
      name: p.baseToken?.name ?? '',
      usd_market_cap: p.fdv ?? 0,
      reply_count: 0,
      creator: '',
      image_uri: p.info?.imageUrl ?? '',
      created_timestamp: null,
    }));
  } catch {
    return [];
  }
}

function generateCoinGeckoPredictions(coins: CoinGeckoCoin[]): Prediction[] {
  const predictions: Prediction[] = [];
  const now = new Date().toISOString();

  for (const coin of coins) {
    const price = coin.current_price || 0;
    if (price < 2) continue;
    const mcap = coin.market_cap || 0;
    const change24h = coin.price_change_percentage_24h || 0;
    const vol = coin.total_volume || 0;
    const symbol = (coin.symbol || '').toUpperCase();
    const name = coin.name || 'Unknown';
    const icon = coin.image || '';
    const cgId = coin.id || '';

    if (change24h > 10) {
      const pool = defaultPool();
      predictions.push({
        id: `cg-gains-${cgId}`,
        category: 'price',
        question: `Will ${name} maintain its ${change24h.toFixed(1)}% gains for 7 days?`,
        tokenName: name,
        tokenSymbol: symbol,
        tokenIcon: icon,
        chain: 'ethereum',
        currentPrice: price,
        currentMcap: mcap,
        targetValue: price,
        targetLabel: `Stay above $${price.toFixed(2)}`,
        progress: 50,
        priceChange24h: change24h,
        volume24h: vol,
        closeDate: futureDate(7),
        ...pool,
        status: 'active',
        chartSymbol: cgId,
        resolver: 'CoinGecko Price Oracle',
        createdAt: now,
      });
    }

    if (vol > 1000000000) {
      const target = Math.round(mcap * 1.5);
      const pool = defaultPool();
      const daysOut = 14;
      predictions.push({
        id: `cg-mcap-${cgId}`,
        category: 'market_cap',
        question: `Will ${name} hit $${(target / 1e9).toFixed(1)}B market cap by ${new Date(Date.now() + daysOut * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}?`,
        tokenName: name,
        tokenSymbol: symbol,
        tokenIcon: icon,
        chain: 'ethereum',
        currentPrice: price,
        currentMcap: mcap,
        targetValue: target,
        targetLabel: `$${(target / 1e9).toFixed(1)}B MCap`,
        progress: clampProgress(mcap, target),
        priceChange24h: change24h,
        volume24h: vol,
        closeDate: futureDate(daysOut),
        ...pool,
        status: 'active',
        chartSymbol: cgId,
        resolver: 'CoinGecko Market Cap Oracle',
        createdAt: now,
      });
    }

    if (change24h < -5) {
      const recoverPrice = Math.round(price * 1.1 * 100) / 100;
      const pool = defaultPool();
      predictions.push({
        id: `cg-recover-${cgId}`,
        category: 'price',
        question: `Will ${name} recover above $${recoverPrice.toFixed(2)}?`,
        tokenName: name,
        tokenSymbol: symbol,
        tokenIcon: icon,
        chain: 'ethereum',
        currentPrice: price,
        currentMcap: mcap,
        targetValue: recoverPrice,
        targetLabel: `Above $${recoverPrice.toFixed(2)}`,
        progress: clampProgress(price, recoverPrice),
        priceChange24h: change24h,
        volume24h: vol,
        closeDate: futureDate(14),
        ...pool,
        status: 'active',
        chartSymbol: cgId,
        resolver: 'CoinGecko Price Oracle',
        createdAt: now,
      });
    }

    if (vol > 500000000) {
      const targetVol = Math.round(vol * 2);
      const pool = defaultPool();
      predictions.push({
        id: `cg-vol-${cgId}`,
        category: 'volume',
        question: `Will ${name} 24h volume exceed $${(targetVol / 1e9).toFixed(1)}B this week?`,
        tokenName: name,
        tokenSymbol: symbol,
        tokenIcon: icon,
        chain: 'ethereum',
        currentPrice: price,
        currentMcap: mcap,
        targetValue: targetVol,
        targetLabel: `$${(targetVol / 1e9).toFixed(1)}B Volume`,
        progress: clampProgress(vol, targetVol),
        priceChange24h: change24h,
        volume24h: vol,
        closeDate: futureDate(7),
        ...pool,
        status: 'active',
        chartSymbol: cgId,
        resolver: 'CoinGecko Volume Oracle',
        createdAt: now,
      });
    }
  }

  return predictions;
}

function generatePumpFunPredictions(tokens: PumpToken[]): Prediction[] {
  const predictions: Prediction[] = [];
  const now = new Date().toISOString();

  for (const token of tokens) {
    const mcap = token.usd_market_cap || 0;
    const symbol = (token.symbol || '???').toUpperCase();
    const name = token.name || 'Unknown';
    const icon = token.image_uri || '';
    const mint = token.mint || '';

    const pool1 = defaultPool();
    predictions.push({
      id: `pump-survive-${mint.slice(0, 16)}`,
      category: 'launch',
      question: `Will ${name} ($${symbol}) survive 7 days?`,
      tokenName: name,
      tokenSymbol: symbol,
      tokenIcon: icon,
      chain: 'solana',
      currentPrice: mcap,
      currentMcap: mcap,
      targetValue: 1000,
      targetLabel: 'Still trading after 7 days',
      progress: 15,
      priceChange24h: 0,
      volume24h: 0,
      closeDate: futureDate(7),
      ...pool1,
      status: 'active',
      chartSymbol: mint,
      chartChainId: 'solana',
      resolver: 'Pump.fun Activity Oracle',
      createdAt: now,
    });

    const pool2 = defaultPool();
    predictions.push({
      id: `pump-100k-${mint.slice(0, 16)}`,
      category: 'market_cap',
      question: `Will ${name} ($${symbol}) hit 100K market cap?`,
      tokenName: name,
      tokenSymbol: symbol,
      tokenIcon: icon,
      chain: 'solana',
      currentPrice: mcap,
      currentMcap: mcap,
      targetValue: 100000,
      targetLabel: '$100K Market Cap',
      progress: clampProgress(mcap, 100000),
      priceChange24h: 0,
      volume24h: 0,
      closeDate: futureDate(14),
      ...pool2,
      status: 'active',
      chartSymbol: mint,
      chartChainId: 'solana',
      resolver: 'Pump.fun Market Cap Oracle',
      createdAt: now,
    });
  }

  return predictions;
}

interface DexBoostToken { tokenAddress: string; chainId: string; icon?: string; }

async function fetchDexScreenerTopTokens(): Promise<DexBoostToken[]> {
  // token-boosts endpoint has no service-layer equivalent — server-side only
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    if (!res.ok) return [];
    const data = await res.json() as unknown;
    return Array.isArray(data) ? (data as DexBoostToken[]) : [];
  } catch {
    return [];
  }
}

async function fetchDexScreenerSearch(query: string) {
  try {
    return await searchPairs(query);
  } catch {
    return [];
  }
}

function mapDexChainId(chainId: string): string {
  const mapping: Record<string, string> = {
    'ethereum': 'ethereum',
    'solana': 'solana',
    'bsc': 'bsc',
    'polygon': 'polygon',
    'arbitrum': 'ethereum',
    'base': 'ethereum',
    'avalanche': 'ethereum',
    'optimism': 'ethereum',
  };
  return mapping[chainId] || 'ethereum';
}

async function generateDexPredictions(): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const now = new Date().toISOString();

  const [topTokens, raydiumPairs, pancakePairs, uniswapPairs] = await Promise.all([
    fetchDexScreenerTopTokens(),
    fetchDexScreenerSearch('raydium'),
    fetchDexScreenerSearch('pancakeswap'),
    fetchDexScreenerSearch('uniswap'),
  ]);

  const dexSearchResults: Array<{ pairs: DexPair[]; dexName: string; take: number }> = [
    { pairs: raydiumPairs, dexName: 'Raydium', take: 3 },
    { pairs: pancakePairs, dexName: 'PancakeSwap', take: 3 },
    { pairs: uniswapPairs, dexName: 'Uniswap', take: 3 },
  ];

  for (const token of topTokens.slice(0, 20)) {
    if (!token.tokenAddress || !token.chainId) continue;
    try {
      const pairs = await getTokenPairs(token.tokenAddress).catch(() => []);
      if (pairs.length === 0) continue;

      const pair = pairs[0];
      const price = parseFloat(pair.priceUsd || '0');
      if (price < 2) continue;

      const symbol = (pair.baseToken?.symbol || '').toUpperCase();
      const name = pair.baseToken?.name || 'Unknown';
      const change24h = pair.priceChange?.h24 || 0;
      const vol = parseFloat(pair.volume?.h24 || '0');
      const dexId = pair.dexId || 'unknown';
      const chainId = pair.chainId || token.chainId;
      const pairAddress = pair.pairAddress || '';

      if (change24h > 10) {
        const pool = defaultPool();
        predictions.push({
          id: `dex-gains-${pairAddress.slice(0, 16)}`,
          category: 'price',
          question: `Will ${name} on ${dexId} maintain ${change24h.toFixed(1)}% gains?`,
          tokenName: name,
          tokenSymbol: symbol,
          tokenIcon: token.icon || '',
          chain: mapDexChainId(chainId),
          currentPrice: price,
          currentMcap: Number(pair.marketCap) || 0,
          targetValue: price,
          targetLabel: `Stay above $${price.toFixed(2)}`,
          progress: 50,
          priceChange24h: change24h,
          volume24h: vol,
          closeDate: futureDate(7),
          ...pool,
          status: 'active',
          chartSymbol: symbol.toLowerCase(),
          chartPairAddress: pairAddress,
          chartChainId: chainId,
          resolver: `DexScreener ${dexId} Oracle`,
          createdAt: now,
        });
      }

      const targetPrice = Math.round(price * 1.3 * 100) / 100;
      const pool = defaultPool();
      predictions.push({
        id: `dex-target-${pairAddress.slice(0, 16)}`,
        category: 'price',
        question: `Will ${name} hit $${targetPrice.toFixed(2)} this week?`,
        tokenName: name,
        tokenSymbol: symbol,
        tokenIcon: token.icon || '',
        chain: mapDexChainId(chainId),
        currentPrice: price,
        currentMcap: Number(pair.marketCap) || 0,
        targetValue: targetPrice,
        targetLabel: `$${targetPrice.toFixed(2)}`,
        progress: clampProgress(price, targetPrice),
        priceChange24h: change24h,
        volume24h: vol,
        closeDate: futureDate(7),
        ...pool,
        status: 'active',
        chartSymbol: symbol.toLowerCase(),
        chartPairAddress: pairAddress,
        chartChainId: chainId,
        resolver: `DexScreener ${dexId} Oracle`,
        createdAt: now,
      });

      if (vol > 1000000) {
        const targetVol = Math.round(vol * 2);
        const volPool = defaultPool();
        predictions.push({
          id: `dex-vol-${pairAddress.slice(0, 16)}`,
          category: 'volume',
          question: `Will ${name} volume exceed $${(targetVol / 1e6).toFixed(1)}M this week?`,
          tokenName: name,
          tokenSymbol: symbol,
          tokenIcon: token.icon || '',
          chain: mapDexChainId(chainId),
          currentPrice: price,
          currentMcap: Number(pair.marketCap) || 0,
          targetValue: targetVol,
          targetLabel: `$${(targetVol / 1e6).toFixed(1)}M Volume`,
          progress: clampProgress(vol, targetVol),
          priceChange24h: change24h,
          volume24h: vol,
          closeDate: futureDate(7),
          ...volPool,
          status: 'active',
          chartSymbol: symbol.toLowerCase(),
          chartPairAddress: pairAddress,
          chartChainId: chainId,
          resolver: `DexScreener ${dexId} Oracle`,
          createdAt: now,
        });
      }
    } catch {
      continue;
    }
  }

  for (const { pairs, dexName, take } of dexSearchResults) {
    let count = 0;
    for (const pair of pairs) {
      if (count >= take) break;
      const price = parseFloat(pair.priceUsd || '0');
      if (price < 2) continue;

      const symbol = (pair.baseToken?.symbol || '').toUpperCase();
      const name = pair.baseToken?.name || 'Unknown';
      const change24h = pair.priceChange?.h24 || 0;
      const vol = parseFloat(pair.volume?.h24 || '0');
      const chainId = pair.chainId || 'ethereum';
      const pairAddress = pair.pairAddress || '';

      const targetPrice = Math.round(price * 1.3 * 100) / 100;
      const pool = defaultPool();
      predictions.push({
        id: `dex-${dexName.toLowerCase()}-${pairAddress.slice(0, 16)}`,
        category: 'price',
        question: `Will ${name} hit $${targetPrice.toFixed(2)} on ${dexName} this week?`,
        tokenName: name,
        tokenSymbol: symbol,
        tokenIcon: '',
        chain: mapDexChainId(chainId),
        currentPrice: price,
        currentMcap: Number(pair.marketCap) || 0,
        targetValue: targetPrice,
        targetLabel: `$${targetPrice.toFixed(2)}`,
        progress: clampProgress(price, targetPrice),
        priceChange24h: change24h,
        volume24h: vol,
        closeDate: futureDate(7),
        ...pool,
        status: 'active',
        chartSymbol: symbol.toLowerCase(),
        chartPairAddress: pairAddress,
        chartChainId: chainId,
        resolver: `DexScreener ${dexName} Oracle`,
        createdAt: now,
      });
      count++;
    }
  }

  return predictions;
}

function generateWellKnownPredictions(): Prediction[] {
  const now = new Date().toISOString();
  const wellKnown: Array<{
    id: string; name: string; symbol: string; icon: string; chain: string; cgId: string;
    price: number; mcap: number; target: number; targetLabel: string; question: string;
    category: Prediction['category']; days: number;
  }> = [
    {
      id: 'btc-100k', name: 'Bitcoin', symbol: 'BTC',
      icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
      chain: 'ethereum', cgId: 'bitcoin',
      price: 97000, mcap: 1900000000000, target: 100000,
      targetLabel: '$100,000', question: 'Will Bitcoin reach $100,000?',
      category: 'price', days: 30,
    },
    {
      id: 'eth-5k', name: 'Ethereum', symbol: 'ETH',
      icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
      chain: 'ethereum', cgId: 'ethereum',
      price: 3500, mcap: 420000000000, target: 5000,
      targetLabel: '$5,000', question: 'Will Ethereum reach $5,000?',
      category: 'price', days: 30,
    },
    {
      id: 'sol-200', name: 'Solana', symbol: 'SOL',
      icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
      chain: 'solana', cgId: 'solana',
      price: 180, mcap: 78000000000, target: 200,
      targetLabel: '$200', question: 'Will Solana reach $200?',
      category: 'price', days: 14,
    },
    {
      id: 'btc-2t', name: 'Bitcoin', symbol: 'BTC',
      icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
      chain: 'ethereum', cgId: 'bitcoin',
      price: 97000, mcap: 1900000000000, target: 2000000000000,
      targetLabel: '$2T Market Cap', question: 'Will Bitcoin market cap exceed $2 Trillion?',
      category: 'market_cap', days: 30,
    },
    {
      id: 'eth-flip', name: 'Ethereum', symbol: 'ETH',
      icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
      chain: 'ethereum', cgId: 'ethereum',
      price: 3500, mcap: 420000000000, target: 1000000000000,
      targetLabel: '$1T Market Cap', question: 'Will Ethereum reach $1 Trillion market cap?',
      category: 'market_cap', days: 60,
    },
    {
      id: 'sol-100b', name: 'Solana', symbol: 'SOL',
      icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
      chain: 'solana', cgId: 'solana',
      price: 180, mcap: 78000000000, target: 100000000000,
      targetLabel: '$100B Market Cap', question: 'Will Solana reach $100B market cap?',
      category: 'market_cap', days: 30,
    },
  ];

  return wellKnown.map(wk => {
    const pool = defaultPool();
    return {
      id: `wk-${wk.id}`,
      category: wk.category,
      question: wk.question,
      tokenName: wk.name,
      tokenSymbol: wk.symbol,
      tokenIcon: wk.icon,
      chain: wk.chain,
      currentPrice: wk.price,
      currentMcap: wk.mcap,
      targetValue: wk.target,
      targetLabel: wk.targetLabel,
      progress: clampProgress(wk.category === 'price' ? wk.price : wk.mcap, wk.target),
      priceChange24h: 0,
      volume24h: 0,
      closeDate: futureDate(wk.days),
      ...pool,
      status: 'active' as const,
      chartSymbol: wk.cgId,
      resolver: 'Market Price Oracle',
      createdAt: now,
    };
  });
}

function generateResolvedPredictions(): Prediction[] {
  const pastDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  const resolved: Array<{
    id: string; name: string; symbol: string; icon: string; chain: string; cgId: string;
    question: string; category: Prediction['category']; outcome: 'yes' | 'no';
    price: number; mcap: number; target: number; targetLabel: string; daysAgo: number;
  }> = [
    {
      id: 'resolved-btc-90k', name: 'Bitcoin', symbol: 'BTC',
      icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
      chain: 'ethereum', cgId: 'bitcoin',
      question: 'Will Bitcoin stay above $90,000 for 7 days?',
      category: 'price', outcome: 'yes',
      price: 97000, mcap: 1900000000000, target: 90000, targetLabel: 'Above $90,000', daysAgo: 3,
    },
    {
      id: 'resolved-eth-3k', name: 'Ethereum', symbol: 'ETH',
      icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
      chain: 'ethereum', cgId: 'ethereum',
      question: 'Will Ethereum hit $4,500 by end of February?',
      category: 'price', outcome: 'no',
      price: 3500, mcap: 420000000000, target: 4500, targetLabel: '$4,500', daysAgo: 1,
    },
    {
      id: 'resolved-sol-150', name: 'Solana', symbol: 'SOL',
      icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
      chain: 'solana', cgId: 'solana',
      question: 'Will Solana hold above $150 this month?',
      category: 'price', outcome: 'yes',
      price: 180, mcap: 78000000000, target: 150, targetLabel: 'Above $150', daysAgo: 5,
    },
    {
      id: 'resolved-bnb-700', name: 'BNB', symbol: 'BNB',
      icon: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
      chain: 'bsc', cgId: 'binancecoin',
      question: 'Will BNB reach $700 this week?',
      category: 'price', outcome: 'no',
      price: 620, mcap: 95000000000, target: 700, targetLabel: '$700', daysAgo: 2,
    },
  ];

  return resolved.map(r => {
    const pool = defaultPool();
    return {
      id: `res-${r.id}`,
      category: r.category,
      question: r.question,
      tokenName: r.name,
      tokenSymbol: r.symbol,
      tokenIcon: r.icon,
      chain: r.chain,
      currentPrice: r.price,
      currentMcap: r.mcap,
      targetValue: r.target,
      targetLabel: r.targetLabel,
      progress: r.outcome === 'yes' ? 100 : clampProgress(r.price, r.target),
      priceChange24h: 0,
      volume24h: 0,
      closeDate: pastDate(r.daysAgo),
      ...pool,
      status: 'resolved' as const,
      outcome: r.outcome,
      chartSymbol: r.cgId,
      resolver: 'Market Price Oracle',
      createdAt: pastDate(r.daysAgo + 7),
    };
  });
}

async function generatePredictions(): Promise<Prediction[]> {
  const [cgCoins, pumpTokens, dexPredictions] = await Promise.all([
    fetchCoinGeckoCoins(),
    fetchPumpFunTokens(),
    generateDexPredictions(),
  ]);

  const cgPredictions = generateCoinGeckoPredictions(cgCoins);
  const pumpPredictions = generatePumpFunPredictions(pumpTokens);
  const wellKnownPredictions = generateWellKnownPredictions();

  const resolvedPredictions = generateResolvedPredictions();
  const all = [...wellKnownPredictions, ...cgPredictions, ...dexPredictions, ...pumpPredictions, ...resolvedPredictions];

  const seen = new Set<string>();
  return all.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function filterPredictions(
  predictions: Prediction[],
  params: {
    tab: string; category: string; chain: string;
    sort: string; closing: string;
  }
): Prediction[] {
  let filtered = [...predictions];

  if (params.tab === 'active') {
    filtered = filtered.filter(p => p.status === 'active');
  } else if (params.tab === 'resolved') {
    filtered = filtered.filter(p => p.status === 'resolved');
  } else if (params.tab === 'high_volume') {
    filtered = filtered.filter(p => p.totalPool > 20000);
  }

  if (params.category && params.category !== 'all') {
    filtered = filtered.filter(p => p.category === params.category);
  }

  if (params.chain && params.chain !== 'all') {
    filtered = filtered.filter(p => p.chain === params.chain);
  }

  if (params.closing && params.closing !== 'all') {
    const now = Date.now();
    const limits: Record<string, number> = {
      '24h': 86400000,
      '7d': 7 * 86400000,
      '30d': 30 * 86400000,
    };
    const limit = limits[params.closing];
    if (limit) {
      filtered = filtered.filter(p => {
        const closeTime = new Date(p.closeDate).getTime();
        return closeTime - now <= limit && closeTime > now;
      });
    }
  }

  if (params.sort === 'pool') {
    filtered.sort((a, b) => b.totalPool - a.totalPool);
  } else if (params.sort === 'predictors') {
    filtered.sort((a, b) => b.totalPredictors - a.totalPredictors);
  } else if (params.sort === 'closing') {
    filtered.sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime());
  } else if (params.sort === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return filtered;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'all';
    const category = searchParams.get('category') || 'all';
    const chain = searchParams.get('chain') || 'all';
    const sort = searchParams.get('sort') || 'pool';
    const closing = searchParams.get('closing') || 'all';

    if (predictionsCache.length === 0 || Date.now() - cacheTimestamp > CACHE_TTL) {
      predictionsCache = await generatePredictions();
      cacheTimestamp = Date.now();
    }

    const filtered = filterPredictions(predictionsCache, { tab, category, chain, sort, closing });

    const activePredictions = predictionsCache.filter(p => p.status === 'active').length;
    const totalPoolVolume = Math.round(predictionsCache.reduce((sum, p) => sum + p.totalPool, 0) * 100) / 100;
    const resolvedCount = predictionsCache.filter(p => p.status === 'resolved').length;

    return NextResponse.json({
      predictions: filtered,
      stats: {
        activePredictions,
        totalPoolVolume,
        resolvedCount,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (error) {

    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { predictionId, side, amount } = await request.json();

    if (!predictionId || !side || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing or invalid fields: predictionId, side (yes|no), amount (>0)' }, { status: 400 });
    }

    if (side !== 'yes' && side !== 'no') {
      return NextResponse.json({ error: 'Side must be "yes" or "no"' }, { status: 400 });
    }

    if (predictionsCache.length === 0 || Date.now() - cacheTimestamp > CACHE_TTL) {
      predictionsCache = await generatePredictions();
      cacheTimestamp = Date.now();
    }

    const prediction = predictionsCache.find(p => p.id === predictionId);
    if (!prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }

    if (prediction.status !== 'active') {
      return NextResponse.json({ error: 'Prediction is no longer active' }, { status: 400 });
    }

    const platformFee = 0.03;
    const netAmount = amount * (1 - platformFee);

    if (side === 'yes') {
      prediction.yesPool += netAmount;
    } else {
      prediction.noPool += netAmount;
    }
    prediction.totalPool = prediction.yesPool + prediction.noPool;
    prediction.yesPercent = Math.round((prediction.yesPool / prediction.totalPool) * 100);
    prediction.noPercent = 100 - prediction.yesPercent;
    prediction.totalPredictors += 1;

    const userSidePool = side === 'yes' ? prediction.yesPool : prediction.noPool;
    const potentialPayout = (netAmount * prediction.totalPool) / userSidePool;
    const profit = potentialPayout - amount;

    const userPrediction: UserPrediction = {
      predictionId,
      side,
      amount,
      timestamp: new Date().toISOString(),
    };

    const userId = 'default';
    if (!userPredictions[userId]) {
      userPredictions[userId] = [];
    }
    userPredictions[userId].push(userPrediction);

    return NextResponse.json({
      prediction,
      userPrediction,
      payout: {
        potentialPayout: Math.round(potentialPayout * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        platformFee: Math.round(amount * platformFee * 100) / 100,
        netAmount: Math.round(netAmount * 100) / 100,
      },
    });
  } catch (error) {

    return NextResponse.json({ error: 'Failed to process prediction' }, { status: 500 });
  }
}
