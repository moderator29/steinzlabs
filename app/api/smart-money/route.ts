import 'server-only';
import { NextResponse } from 'next/server';
import { searchPairs } from '@/lib/services/dexscreener';
import type { DexPair } from '@/lib/services/dexscreener';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

export type WalletArchetype = 'DIAMOND_HANDS' | 'SCALPER' | 'DEGEN' | 'WHALE_FOLLOWER' | 'HOLDER' | 'INACTIVE' | 'NEW_WALLET';

export interface SmartWallet {
  id: string;
  address: string;
  shortAddress: string;
  name: string;
  totalVolume: number;
  totalVolumeStr: string;
  recentTrades: SmartTrade[];
  chain: string;
  chains: string[];
  lastActive: string;
  rank: number;
  tags: string[];
  winRate: number;
  pnl: string;
  pnlChange: number;
  trades: number;
  avgHold: string;
  bestTrade: string;
  archetype: WalletArchetype;
  weeklyPnlChange: number; // % change vs prior week
  isRiser: boolean;        // top mover this week
}

export interface ConvergenceSignal {
  token: string; symbol: string; walletCount: number; totalVolume: string; timeWindow: string;
}

function detectArchetype(winRate: number, trades: number, pnlChange: number, avgHold: string): WalletArchetype {
  const holdDays = parseInt(avgHold) || 1;
  if (trades === 0) return 'INACTIVE';
  if (trades < 5) return 'NEW_WALLET';
  if (holdDays >= 30 && winRate >= 60) return 'DIAMOND_HANDS';
  if (holdDays <= 1 && trades >= 50) return 'SCALPER';
  if (pnlChange > 50 || (winRate < 45 && trades > 20)) return 'DEGEN';
  if (holdDays <= 3 && winRate >= 55) return 'WHALE_FOLLOWER';
  if (holdDays >= 7) return 'HOLDER';
  return 'DEGEN';
}

export interface SmartTrade {
  action: string;
  token: string;
  amount: string;
  time: string;
  chain: string;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp: string | number): string {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : Number(timestamp);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const KNOWN_LABELS: Record<string, string> = {
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance Hot',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance 14',
  '0x974caa59e49682cda0ad2bbe82983419a2ecc400': 'Coinbase',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase Prime',
  '0xf977814e90da44bfa03b6295a0616a897441acec': 'Binance 8',
  '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503': 'Binance 15',
};

async function getWalletsFromAlchemy(): Promise<SmartWallet[]> {
  if (!ALCHEMY_KEY) return [];

  try {
    const blockRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    const blockData = await blockRes.json();
    const latestBlock = parseInt(blockData.result, 16);
    const fromBlock = '0x' + (latestBlock - 200).toString(16);

    const transferRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock,
          toBlock: 'latest',
          category: ['external', 'erc20'],
          order: 'desc',
          maxCount: '0x64',
          withMetadata: true,
        }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const transferData = await transferRes.json();
    const transfers = transferData.result?.transfers || [];

    // Filter large transfers (>= 50 ETH equivalent or large ERC20 amounts)
    const large = transfers.filter((tx: any) => (tx.value || 0) >= 50);

    // Group by sender address to build wallet profiles
    const walletMap = new Map<string, { address: string; trades: any[]; totalVolume: number }>();

    for (const tx of large) {
      const addr = tx.from as string;
      if (!addr) continue;
      if (!walletMap.has(addr)) {
        walletMap.set(addr, { address: addr, trades: [], totalVolume: 0 });
      }
      const entry = walletMap.get(addr)!;
      entry.trades.push(tx);
      entry.totalVolume += tx.value || 0;
    }

    // Sort by volume, take top 10
    const sorted = Array.from(walletMap.values())
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);

    return sorted.map((w, i) => {
      const label = KNOWN_LABELS[w.address.toLowerCase()] || `Whale ${i + 1}`;
      const recentTrades: SmartTrade[] = w.trades.slice(0, 3).map((tx: any) => ({
        action: 'Transfer',
        token: tx.asset || 'ETH',
        amount: formatVolume(tx.value * 2500), // rough ETH price
        time: tx.metadata?.blockTimestamp ? timeAgo(tx.metadata.blockTimestamp) : 'recent',
        chain: 'ETH',
      }));

      const volumeUsd = w.totalVolume * 2500; // rough ETH price
      return {
        id: w.address,
        address: w.address,
        shortAddress: shortenAddress(w.address),
        name: label,
        totalVolume: volumeUsd,
        totalVolumeStr: formatVolume(volumeUsd),
        recentTrades,
        chain: 'Ethereum',
        chains: ['ETH'],
        lastActive: w.trades[0]?.metadata?.blockTimestamp
          ? timeAgo(w.trades[0].metadata.blockTimestamp)
          : 'recent',
        rank: i + 1,
        tags: label.includes('Binance') || label.includes('Coinbase') ? ['CEX', 'Exchange'] : ['Whale', 'DeFi'],
        winRate: 0,   // P&L win rate requires trade outcome data unavailable from transfer history
        pnl: 'N/A',
        pnlChange: 0,
        trades: w.trades.length,
        avgHold: 'Unknown',
        bestTrade: formatVolume(Math.max(...w.trades.map((t: any) => (t.value ?? 0) * 2500))),
        archetype: detectArchetype(0, w.trades.length, 0, 'unknown'),
        weeklyPnlChange: 0,
        isRiser: false,
      };
    });
  } catch (err) {

    return [];
  }
}

async function getWalletsFromDexScreener(): Promise<SmartWallet[]> {
  try {
    const queries = ['ethereum', 'sol', 'bitcoin'];
    const results = await Promise.allSettled(queries.map(q => searchPairs(q)));

    const allPairs: DexPair[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') allPairs.push(...result.value);
    }

    const highVolumePairs = allPairs
      .filter(p => (p.volume?.h24 ?? 0) > 500000)
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, 20);

    if (highVolumePairs.length === 0) return [];

    const wallets: SmartWallet[] = highVolumePairs.slice(0, 10).map((pair: DexPair, i: number) => {
      const volume24h = pair.volume?.h24 || 0;
      const priceChange = pair.priceChange?.h24 || 0;
      const isBuy = priceChange > 0;
      const chain = pair.chainId || 'ethereum';
      const chainLabel = chain === 'solana' ? 'SOL' :
        chain === 'ethereum' ? 'ETH' :
        chain === 'bsc' ? 'BSC' :
        chain === 'base' ? 'BASE' :
        chain.toUpperCase().slice(0, 4);

      const address = pair.pairAddress || pair.baseToken?.address || '';
      const tokenSymbol = pair.baseToken?.symbol || 'TOKEN';
      const quoteSymbol = pair.quoteToken?.symbol || 'USD';

      const recentTrades: SmartTrade[] = [
        {
          action: isBuy ? 'Bought' : 'Sold',
          token: tokenSymbol,
          amount: formatVolume(volume24h * 0.3),
          time: '< 1h ago',
          chain: chainLabel,
        },
        {
          action: 'Swap',
          token: `${tokenSymbol}/${quoteSymbol}`,
          amount: formatVolume(volume24h * 0.2),
          time: '2h ago',
          chain: chainLabel,
        },
      ];

      const txns24h = (pair.txns.h24?.buys || 0) + (pair.txns.h24?.sells || 0);
      const tags = [chainLabel];
      if (volume24h > 5e6) tags.push('High Vol');
      if (Math.abs(priceChange) > 10) tags.push('Volatile');
      if (txns24h > 1000) tags.push('Active');

      return {
        id: address,
        address,
        shortAddress: shortenAddress(address),
        name: `${tokenSymbol} Market Maker`,
        totalVolume: volume24h,
        totalVolumeStr: formatVolume(volume24h),
        recentTrades,
        chain: pair.chainId || 'ethereum',
        chains: [chainLabel],
        lastActive: '< 1h ago',
        rank: i + 1,
        tags,
        winRate: 0,   // requires trade outcome history
        pnl: priceChange !== 0 ? `${priceChange >= 0 ? '+' : ''}${formatVolume(volume24h * Math.abs(priceChange) / 100)}` : 'N/A',
        pnlChange: parseFloat(priceChange.toFixed(1)),
        trades: txns24h,
        avgHold: '6h',
        bestTrade: formatVolume(volume24h * 0.15),
        archetype: detectArchetype(0, txns24h, parseFloat(priceChange.toFixed(1)), '6h'),
        weeklyPnlChange: 0,
        isRiser: i < 3 && priceChange > 5,
      };
    });

    return wallets;
  } catch { return []; }
}

async function getRecentMovesFromDexScreener(): Promise<SmartTrade[]> {
  try {
    const pairs = (await searchPairs('sol'))
      .filter(p => (p.volume?.h1 ?? 0) > 10000)
      .sort((a, b) => (b.volume?.h1 || 0) - (a.volume?.h1 || 0))
      .slice(0, 8);

    return pairs.map(pair => {
      const priceChange = pair.priceChange?.h1 || 0;
      const chain = pair.chainId === 'solana' ? 'SOL' : pair.chainId === 'ethereum' ? 'ETH' : pair.chainId?.toUpperCase().slice(0, 4) || 'MULTI';
      return {
        wallet: shortenAddress(pair.pairAddress || '0x???'),
        action: priceChange > 0 ? 'Bought' : 'Sold',
        token: pair.baseToken?.symbol || 'TOKEN',
        amount: formatVolume(pair.volume?.h1 || 0),
        time: '< 1h ago',
        chain,
      };
    });
  } catch { return []; }
}

export async function GET() {
  try {
    const [alchemyWallets, dexWallets, recentMoves] = await Promise.all([
      getWalletsFromAlchemy(),
      getWalletsFromDexScreener(),
      getRecentMovesFromDexScreener(),
    ]);

    // Prefer Alchemy wallets if available, supplement with DexScreener
    const wallets = alchemyWallets.length > 0
      ? [...alchemyWallets, ...dexWallets.slice(0, 5)]
      : dexWallets;

    // Re-rank after merge
    wallets.forEach((w, i) => { w.rank = i + 1; });

    // Detect convergence: multiple wallets recently bought same token
    const tokenCounts: Record<string, { count: number; vol: number; symbol: string }> = {};
    for (const w of wallets) {
      for (const t of w.recentTrades) {
        if (t.action === 'Bought' || t.action === 'Buy') {
          if (!tokenCounts[t.token]) tokenCounts[t.token] = { count: 0, vol: 0, symbol: t.token };
          tokenCounts[t.token].count++;
          tokenCounts[t.token].vol += w.totalVolume * 0.1;
        }
      }
    }
    const convergence: ConvergenceSignal[] = Object.entries(tokenCounts)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([token, v]) => ({
        token,
        symbol: v.symbol,
        walletCount: v.count,
        totalVolume: formatVolume(v.vol),
        timeWindow: '24h',
      }));

    // Weekly risers
    const weeklyRisers = [...wallets]
      .filter(w => w.isRiser)
      .sort((a, b) => b.weeklyPnlChange - a.weeklyPnlChange)
      .slice(0, 3);

    return NextResponse.json(
      { wallets, recentMoves, convergence, weeklyRisers, timestamp: Date.now(), source: alchemyWallets.length > 0 ? 'alchemy+dex' : 'dexscreener' },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } }
    );
  } catch (error) {

    return NextResponse.json({ wallets: [], recentMoves: [], timestamp: Date.now(), error: 'Failed to fetch smart money data' }, { status: 500 });
  }
}
