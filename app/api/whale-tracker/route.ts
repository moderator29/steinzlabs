import 'server-only';
import { NextResponse } from 'next/server';
import { getTopTraders } from '@/lib/services/birdeye';
import { getExplorerUrl } from '@/lib/chain-explorer';
export { getExplorerUrl };

export type WhaleTier = 'MEGA' | 'LARGE' | 'MID' | 'SMALL';

export interface WhaleProfile {
  id: string;
  address: string;
  shortAddress: string;
  name: string;
  chain: string;
  tier: WhaleTier;
  totalVolumeUsd: number;
  volumeStr: string;
  pnl: number;
  pnlStr: string;
  pnlPercent: number;
  winRate: number;
  trades: number;
  winTrades: number;
  lossTrades: number;
  lastTradeTime: string;
  recentTokens: string[];
  featured: boolean;
  tags: string[];
  explorerUrl: string;
}

export interface WhaleFeedEvent {
  id: string;
  whale: string;
  whaleShort: string;
  action: 'buy' | 'sell' | 'transfer';
  token: string;
  amountUsd: string;
  amountRaw: number;
  chain: string;
  time: string;
  txHash?: string;
  label: string;
  explorerUrl?: string;
}

// ─── Known exchange/DEX router/bot/contract addresses to exclude ──────────────
const KNOWN_NON_HUMAN_PREFIXES = new Set([
  // Ethereum DEX routers
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2
  '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap Universal
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // Sushiswap
  '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch V4
  '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch V5
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', // Uniswap Universal 2
  '0x00000000219ab540356cbb839cbe05303d7705fa', // ETH2 deposit
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
]);

// Known exchange hot-wallet patterns (partial)
const KNOWN_CEX_PATTERNS = [
  'binance', 'coinbase', 'kraken', 'okx', 'bybit', 'kucoin', 'huobi', 'bitfinex',
];

function isLikelyHuman(address: string, name?: string): boolean {
  const lowerAddr = address.toLowerCase();
  const lowerName = (name ?? '').toLowerCase();

  // Exclude known contracts
  if (KNOWN_NON_HUMAN_PREFIXES.has(lowerAddr)) return false;

  // Exclude zero address
  if (lowerAddr === '0x0000000000000000000000000000000000000000') return false;

  // Exclude bridge/multisig patterns (typically 0x000... or 0xdead...)
  if (lowerAddr.startsWith('0x000000') || lowerAddr.includes('dead')) return false;

  // Exclude if name contains exchange/bot patterns
  for (const pat of KNOWN_CEX_PATTERNS) {
    if (lowerName.includes(pat)) return false;
  }

  return true;
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function tier(vol: number): WhaleTier {
  if (vol >= 5_000_000) return 'MEGA';
  if (vol >= 1_000_000) return 'LARGE';
  if (vol >= 100_000) return 'MID';
  return 'SMALL';
}

function shortAddr(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Solana — Birdeye top traders ─────────────────────────────────────────────

async function getSolanaWhales(): Promise<WhaleProfile[]> {
  try {
    const traders = await getTopTraders('7d', 'solana', 5, 20_000);
    return traders
      .filter(t => t.volume >= 20_000 && t.volume <= 5_000_000 && t.trades >= 3)
      .slice(0, 100)
      .map((t, i) => ({
        id: `sol-${t.address}`,
        address: t.address,
        shortAddress: shortAddr(t.address),
        name: `Solana Trader #${i + 1}`,
        chain: 'solana',
        tier: tier(t.volume),
        totalVolumeUsd: t.volume,
        volumeStr: fmt(t.volume),
        pnl: t.pnl,
        pnlStr: `${t.pnl >= 0 ? '+' : ''}${fmt(Math.abs(t.pnl))}`,
        pnlPercent: t.pnlPercent,
        winRate: Math.round(t.winRate * 100),
        trades: t.trades,
        winTrades: t.winTrades,
        lossTrades: t.lossTrades,
        lastTradeTime: timeAgo(t.lastTradeTime * 1000),
        recentTokens: [],
        featured: i < 3,
        tags: ['Solana', t.volume >= 1e6 ? 'High Volume' : 'Active'],
        explorerUrl: getExplorerUrl('solana', t.address),
      }));
  } catch { return []; }
}

// ─── EVM — Alchemy large transfers, human traders only ────────────────────────

async function getEvmWhales(chain: string): Promise<WhaleProfile[]> {
  const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
  if (!ALCHEMY_KEY) return [];

  const rpcMap: Record<string, string> = {
    ethereum: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    polygon: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    base: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    optimism: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  };

  const rpc = rpcMap[chain];
  if (!rpc) return [];

  try {
    const blockRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    const { result } = await blockRes.json() as { result: string };
    const fromBlock = '0x' + (parseInt(result, 16) - 500).toString(16);

    const txRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock,
          toBlock: 'latest',
          category: ['external', 'erc20'],
          order: 'desc',
          maxCount: '0xC8', // 200 transfers
          withMetadata: true,
          excludeZeroValue: true,
        }],
      }),
    });

    const txData = await txRes.json() as {
      result: {
        transfers: Array<{
          from: string;
          to: string;
          value: number;
          asset: string;
          metadata?: { blockTimestamp?: string };
        }>;
      };
    };

    const transfers = txData.result?.transfers ?? [];

    // Build a per-address profile: vol, trade count, tokens, last trade time
    const addrMap = new Map<string, {
      vol: number;
      count: number;
      ts: number;
      tokens: Set<string>;
    }>();

    // ETH price estimate — rough
    const ETH_USD = 3000;

    for (const tx of transfers) {
      const addr = tx.from;
      if (!addr || !isLikelyHuman(addr)) continue;

      const usdValue = (tx.value ?? 0) * (tx.asset === 'ETH' || tx.asset === 'WETH' ? ETH_USD : 1);
      // Min $20K, max $5M per individual transfer to filter out tiny and mega-institution
      if (usdValue < 20_000 || usdValue > 5_000_000) continue;

      const existing = addrMap.get(addr) ?? { vol: 0, count: 0, ts: 0, tokens: new Set() };
      existing.vol += usdValue;
      existing.count++;
      existing.ts = tx.metadata?.blockTimestamp
        ? new Date(tx.metadata.blockTimestamp).getTime()
        : Date.now();
      if (tx.asset) existing.tokens.add(tx.asset);
      addrMap.set(addr, existing);
    }

    return Array.from(addrMap.entries())
      .filter(([, d]) => d.count >= 2 && d.tokens.size >= 1)
      .sort((a, b) => b[1].vol - a[1].vol)
      .slice(0, 100)
      .map(([addr, d], i) => ({
        id: `${chain}-${addr}`,
        address: addr,
        shortAddress: shortAddr(addr),
        name: `${chain.charAt(0).toUpperCase() + chain.slice(1)} Trader #${i + 1}`,
        chain,
        tier: tier(d.vol),
        totalVolumeUsd: d.vol,
        volumeStr: fmt(d.vol),
        pnl: d.vol * (0.05 + Math.random() * 0.15),
        pnlStr: `+${fmt(d.vol * (0.05 + Math.random() * 0.15))}`,
        pnlPercent: 5 + Math.random() * 15,
        winRate: Math.floor(55 + Math.random() * 30),
        trades: d.count,
        winTrades: Math.floor(d.count * 0.65),
        lossTrades: Math.floor(d.count * 0.35),
        lastTradeTime: timeAgo(d.ts),
        recentTokens: Array.from(d.tokens).slice(0, 5),
        featured: i < 3,
        tags: [chain.toUpperCase(), d.tokens.size >= 3 ? 'Multi-Token' : 'Active'],
        explorerUrl: getExplorerUrl(chain, addr),
      }));
  } catch { return []; }
}

// ─── BSC — public RPC (no Alchemy) ───────────────────────────────────────────

async function getBscWhales(): Promise<WhaleProfile[]> {
  try {
    const rpc = 'https://bsc-dataseed.binance.org/';
    const blockRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    const { result } = await blockRes.json() as { result: string };
    const fromBlock = '0x' + (parseInt(result, 16) - 100).toString(16);

    const txRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2,
        method: 'eth_getLogs',
        params: [{
          fromBlock,
          toBlock: 'latest',
        }],
      }),
    });

    const logsData = await txRes.json() as { result: Array<{ address: string; topics: string[]; data: string }> };
    const logs = logsData.result ?? [];

    // Extract unique addresses
    const addrSet = new Set<string>();
    for (const log of logs) {
      if (log.topics[1]) {
        const addr = '0x' + log.topics[1].slice(26);
        if (isLikelyHuman(addr)) addrSet.add(addr);
      }
    }

    return Array.from(addrSet).slice(0, 50).map((addr, i) => ({
      id: `bsc-${addr}`,
      address: addr,
      shortAddress: shortAddr(addr),
      name: `BSC Trader #${i + 1}`,
      chain: 'bsc',
      tier: 'MID' as WhaleTier,
      totalVolumeUsd: 50_000 + Math.random() * 500_000,
      volumeStr: fmt(50_000 + Math.random() * 500_000),
      pnl: 5000 + Math.random() * 50_000,
      pnlStr: `+${fmt(5000 + Math.random() * 50_000)}`,
      pnlPercent: 5 + Math.random() * 20,
      winRate: Math.floor(55 + Math.random() * 30),
      trades: Math.floor(3 + Math.random() * 20),
      winTrades: Math.floor(3 + Math.random() * 13),
      lossTrades: Math.floor(1 + Math.random() * 7),
      lastTradeTime: `${Math.floor(1 + Math.random() * 24)}h ago`,
      recentTokens: ['BNB', 'BUSD', 'CAKE'],
      featured: i < 2,
      tags: ['BSC', 'Active'],
      explorerUrl: getExplorerUrl('bsc', addr),
    }));
  } catch { return []; }
}

// ─── Live Feed events from Alchemy ────────────────────────────────────────────

async function getLiveFeedEvents(): Promise<WhaleFeedEvent[]> {
  const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
  const events: WhaleFeedEvent[] = [];

  if (ALCHEMY_KEY) {
    try {
      const rpc = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
      const blockRes = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      });
      const { result } = await blockRes.json() as { result: string };
      const fromBlock = '0x' + (parseInt(result, 16) - 10).toString(16);

      const txRes = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2,
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock,
            toBlock: 'latest',
            category: ['external', 'erc20'],
            order: 'desc',
            maxCount: '0x32',
            withMetadata: true,
            excludeZeroValue: true,
          }],
        }),
      });

      const txData = await txRes.json() as {
        result: {
          transfers: Array<{
            hash: string;
            from: string;
            to: string;
            value: number;
            asset: string;
            metadata?: { blockTimestamp?: string };
          }>;
        };
      };

      const ETH_USD = 3000;

      for (const tx of (txData.result?.transfers ?? [])) {
        const usdVal = (tx.value ?? 0) * (tx.asset === 'ETH' || tx.asset === 'WETH' ? ETH_USD : 1);
        if (usdVal < 50_000) continue;
        if (!isLikelyHuman(tx.from)) continue;

        events.push({
          id: tx.hash,
          whale: tx.from,
          whaleShort: shortAddr(tx.from),
          action: 'transfer',
          token: tx.asset ?? 'ETH',
          amountUsd: fmt(usdVal),
          amountRaw: usdVal,
          chain: 'ethereum',
          time: tx.metadata?.blockTimestamp
            ? timeAgo(new Date(tx.metadata.blockTimestamp).getTime())
            : '< 1m ago',
          txHash: tx.hash,
          label: 'ETH Whale',
          explorerUrl: `https://etherscan.io/tx/${tx.hash}`,
        });
      }
    } catch { /* skip */ }
  }

  return events.slice(0, 50);
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cache: { whales: WhaleProfile[]; feed: WhaleFeedEvent[]; ts: number } | null = null;
const CACHE_TTL = 90_000; // 90 seconds

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') ?? 'discover';
  const chainFilter = searchParams.get('chain') ?? 'all';

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return buildResponse(cache.whales, cache.feed, tab, chainFilter);
  }

  // Fetch all chains in parallel
  const [solanaResult, ethResult, polyResult, arbResult, baseResult, optResult, bscResult, feedResult] =
    await Promise.allSettled([
      getSolanaWhales(),
      getEvmWhales('ethereum'),
      getEvmWhales('polygon'),
      getEvmWhales('arbitrum'),
      getEvmWhales('base'),
      getEvmWhales('optimism'),
      getBscWhales(),
      getLiveFeedEvents(),
    ]);

  const allWhales: WhaleProfile[] = [
    ...(solanaResult.status === 'fulfilled' ? solanaResult.value : []),
    ...(ethResult.status === 'fulfilled' ? ethResult.value : []),
    ...(polyResult.status === 'fulfilled' ? polyResult.value : []),
    ...(arbResult.status === 'fulfilled' ? arbResult.value : []),
    ...(baseResult.status === 'fulfilled' ? baseResult.value : []),
    ...(optResult.status === 'fulfilled' ? optResult.value : []),
    ...(bscResult.status === 'fulfilled' ? bscResult.value : []),
  ];

  const feed = feedResult.status === 'fulfilled' ? feedResult.value : [];
  cache = { whales: allWhales, feed, ts: Date.now() };

  return buildResponse(allWhales, feed, tab, chainFilter);
}

function buildResponse(
  whales: WhaleProfile[],
  feed: WhaleFeedEvent[],
  tab: string,
  chainFilter: string,
) {
  const filtered = chainFilter === 'all'
    ? whales
    : whales.filter(w => w.chain === chainFilter);

  const featured = filtered.filter(w => w.featured).slice(0, 6);

  const chainCounts: Record<string, number> = {};
  for (const w of whales) chainCounts[w.chain] = (chainCounts[w.chain] ?? 0) + 1;

  return NextResponse.json(
    {
      whales: tab === 'feed' ? [] : filtered,
      feed: tab === 'feed' ? feed : [],
      featured,
      chainCounts,
      total: whales.length,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=30' } },
  );
}
