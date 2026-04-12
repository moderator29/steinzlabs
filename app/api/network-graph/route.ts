import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY_1 || process.env.HELIUS_API_KEY_2 || '';

export interface NetworkNode {
  id: string;
  address: string;
  type: 'high-activity' | 'bridge' | 'regular' | 'usdc' | 'usdt';
  volume: number;
  txCount: number;
  x?: number;
  y?: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  type: 'usdc' | 'usdt';
  amount: number;
  count: number;
}

export interface NetworkStats {
  clusters: number;
  avgDegree: number;
  density: number;
  usdcTxns: number;
  usdtTxns: number;
  totalVolume: number;
  timelineData: number[];
}

export interface NetworkGraphResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  stats: NetworkStats;
  source: 'helius' | 'dexscreener' | 'mock';
}

// Known Solana protocol/bridge addresses
const KNOWN_PROTOCOLS: Record<string, string> = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3sFjno': 'Orca Whirlpool',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  'So11111111111111111111111111111111111111112': 'Wrapped SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC Mint',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT Mint',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'Bonk',
};

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
}

function classifyNode(address: string, volume: number, txCount: number): NetworkNode['type'] {
  if (KNOWN_PROTOCOLS[address]) return 'bridge';
  if (address === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') return 'usdc';
  if (address === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') return 'usdt';
  if (volume > 500000 || txCount > 50) return 'high-activity';
  if (volume > 100000 || txCount > 20) return 'high-activity';
  return 'regular';
}

function generateMockData(): NetworkGraphResponse {
  const rng = (min: number, max: number) => Math.random() * (max - min) + min;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const addressPool = [
    '0x9f8B0Da95BbA1f66E1890C2D8E7b7EFAD16e16e',
    '0x7a25E...2F9c',
    '0x3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D',
    '0x1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B',
    '0xDead...Beef1',
    '0xCafe...Babe2',
    '0xF00D...C0DE3',
    '0x1337...H4X04',
    '0xABCD...EF015',
    '0x5678...90AB6',
    '0xBEEF...CAFE7',
    '0x4269...42008',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3sFjno',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    '0x9999...11119',
    '0xAAAA...BBBB10',
    '0xCCCC...DDDD11',
    '0xEEEE...FFFF12',
    '0x1111...222213',
    '0x3333...444414',
  ];

  const count = Math.floor(rng(18, 24));
  const selectedAddresses = addressPool.slice(0, count);

  const nodes: NetworkNode[] = selectedAddresses.map((addr, i) => {
    const isProtocol = !!KNOWN_PROTOCOLS[addr];
    const isStable = addr.includes('EPjF') || addr.includes('Es9v');
    const volume = isProtocol ? rng(2000000, 10000000) :
      isStable ? rng(5000000, 50000000) :
      i < 4 ? rng(500000, 3000000) :
      rng(5000, 200000);
    const txCount = isProtocol ? Math.floor(rng(200, 1000)) :
      i < 4 ? Math.floor(rng(50, 200)) :
      Math.floor(rng(2, 50));
    return {
      id: `node-${i}`,
      address: addr,
      type: classifyNode(addr, volume, txCount),
      volume,
      txCount,
    };
  });

  const edgeCount = Math.floor(rng(22, 32));
  const edges: NetworkEdge[] = [];
  const edgeSet = new Set<string>();

  for (let i = 0; i < edgeCount * 3 && edges.length < edgeCount; i++) {
    const src = pick(nodes);
    let tgt = pick(nodes);
    while (tgt.id === src.id) tgt = pick(nodes);
    const key = `${src.id}-${tgt.id}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);

    const edgeType = pick(['usdc', 'usdt'] as const);
    edges.push({
      source: src.id,
      target: tgt.id,
      type: edgeType,
      amount: rng(1000, 500000),
      count: Math.floor(rng(1, 20)),
    });
  }

  const usdcTxns = edges.filter(e => e.type === 'usdc').length;
  const usdtTxns = edges.filter(e => e.type === 'usdt').length;
  const n = nodes.length;
  const maxEdges = n * (n - 1);
  const density = maxEdges > 0 ? parseFloat((edges.length / maxEdges).toFixed(4)) : 0;
  const degreeSum = edges.length * 2;
  const avgDegree = parseFloat((degreeSum / Math.max(n, 1)).toFixed(2));
  const clusters = Math.max(1, Math.floor(n / 5));

  const timelineData = Array.from({ length: 8 }, () => Math.floor(rng(10, 100)));

  return {
    nodes,
    edges,
    stats: {
      clusters,
      avgDegree,
      density,
      usdcTxns,
      usdtTxns,
      totalVolume: nodes.reduce((s, n) => s + n.volume, 0),
      timelineData,
    },
    source: 'mock',
  };
}

async function fetchHeliusData(wallet: string): Promise<NetworkGraphResponse | null> {
  if (!HELIUS_API_KEY) return null;

  try {
    const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=50&type=TRANSFER`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const txs: any[] = await res.json();
    if (!Array.isArray(txs) || txs.length === 0) return null;

    const nodeMap = new Map<string, { volume: number; txCount: number; addresses: Set<string> }>();
    const edgeMap = new Map<string, { amount: number; count: number; type: 'usdc' | 'usdt' }>();

    const ensureNode = (addr: string) => {
      if (!nodeMap.has(addr)) {
        nodeMap.set(addr, { volume: 0, txCount: 0, addresses: new Set() });
      }
    };

    for (const tx of txs) {
      const transfers = tx.tokenTransfers || [];
      for (const t of transfers) {
        const from = t.fromUserAccount || t.fromTokenAccount || '';
        const to = t.toUserAccount || t.toTokenAccount || '';
        const mint = t.mint || '';
        const amount = parseFloat(t.tokenAmount || '0');

        if (!from || !to || !amount) continue;

        let edgeType: 'usdc' | 'usdt' | null = null;
        if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') edgeType = 'usdc';
        else if (mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') edgeType = 'usdt';
        if (!edgeType) continue;

        ensureNode(from);
        ensureNode(to);

        const fn = nodeMap.get(from)!;
        fn.volume += amount;
        fn.txCount += 1;

        const tn = nodeMap.get(to)!;
        tn.volume += amount;
        tn.txCount += 1;

        const edgeKey = `${from}||${to}`;
        if (edgeMap.has(edgeKey)) {
          const e = edgeMap.get(edgeKey)!;
          e.amount += amount;
          e.count += 1;
        } else {
          edgeMap.set(edgeKey, { amount, count: 1, type: edgeType });
        }
      }
    }

    if (nodeMap.size === 0) return null;

    const addresses = Array.from(nodeMap.keys());
    const addrIndex = new Map(addresses.map((a, i) => [a, i]));

    const nodes: NetworkNode[] = addresses.map((addr, i) => {
      const d = nodeMap.get(addr)!;
      return {
        id: `node-${i}`,
        address: addr,
        type: classifyNode(addr, d.volume, d.txCount),
        volume: d.volume,
        txCount: d.txCount,
      };
    });

    const edges: NetworkEdge[] = Array.from(edgeMap.entries()).map(([key, val]) => {
      const [from, to] = key.split('||');
      return {
        source: `node-${addrIndex.get(from)}`,
        target: `node-${addrIndex.get(to)}`,
        type: val.type,
        amount: val.amount,
        count: val.count,
      };
    });

    const usdcTxns = edges.filter(e => e.type === 'usdc').length;
    const usdtTxns = edges.filter(e => e.type === 'usdt').length;
    const n = nodes.length;
    const maxEdges = n * (n - 1);
    const density = maxEdges > 0 ? parseFloat((edges.length / maxEdges).toFixed(4)) : 0;
    const degreeSum = edges.length * 2;
    const avgDegree = parseFloat((degreeSum / Math.max(n, 1)).toFixed(2));
    const clusters = Math.max(1, Math.floor(n / 5));

    return {
      nodes,
      edges,
      stats: {
        clusters,
        avgDegree,
        density,
        usdcTxns,
        usdtTxns,
        totalVolume: nodes.reduce((s, nd) => s + nd.volume, 0),
        timelineData: Array.from({ length: 8 }, () => Math.floor(Math.random() * 90 + 10)),
      },
      source: 'helius',
    };
  } catch {
    return null;
  }
}

async function fetchDexScreenerData(query: string): Promise<NetworkGraphResponse | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pairs: any[] = data?.pairs || [];
    if (pairs.length === 0) return null;

    const nodeMap = new Map<string, { volume: number; txCount: number }>();

    const ensureNode = (addr: string, vol: number, txs: number) => {
      if (!nodeMap.has(addr)) {
        nodeMap.set(addr, { volume: vol, txCount: txs });
      } else {
        const n = nodeMap.get(addr)!;
        n.volume += vol;
        n.txCount += txs;
      }
    };

    for (const pair of pairs.slice(0, 20)) {
      const baseAddr = pair.baseToken?.address || '';
      const quoteAddr = pair.quoteToken?.address || '';
      const vol24h = parseFloat(pair.volume?.h24 || '0');
      const txCount = parseInt(pair.txns?.h24?.buys || '0') + parseInt(pair.txns?.h24?.sells || '0');
      const pairAddr = pair.pairAddress || '';

      if (baseAddr) ensureNode(baseAddr, vol24h * 0.6, Math.floor(txCount * 0.6));
      if (quoteAddr) ensureNode(quoteAddr, vol24h * 0.4, Math.floor(txCount * 0.4));
      if (pairAddr && pairAddr !== baseAddr && pairAddr !== quoteAddr) {
        ensureNode(pairAddr, vol24h, txCount);
      }
    }

    const addresses = Array.from(nodeMap.keys());
    const addrIndex = new Map(addresses.map((a, i) => [a, i]));

    const nodes: NetworkNode[] = addresses.map((addr, i) => {
      const d = nodeMap.get(addr)!;
      return {
        id: `node-${i}`,
        address: addr,
        type: classifyNode(addr, d.volume, d.txCount),
        volume: d.volume,
        txCount: d.txCount,
      };
    });

    const edges: NetworkEdge[] = [];
    const edgeSet = new Set<string>();

    for (const pair of pairs.slice(0, 20)) {
      const baseAddr = pair.baseToken?.address || '';
      const quoteAddr = pair.quoteToken?.address || '';
      const pairAddr = pair.pairAddress || '';
      const vol = parseFloat(pair.volume?.h24 || '0');
      const txCount = parseInt(pair.txns?.h24?.buys || '0') + parseInt(pair.txns?.h24?.sells || '0');

      if (baseAddr && quoteAddr && addrIndex.has(baseAddr) && addrIndex.has(quoteAddr)) {
        const key = `${baseAddr}||${quoteAddr}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            source: `node-${addrIndex.get(baseAddr)}`,
            target: `node-${addrIndex.get(quoteAddr)}`,
            type: quoteAddr.toLowerCase().includes('usdc') ? 'usdc' : 'usdt',
            amount: vol,
            count: txCount,
          });
        }
      }
      if (pairAddr && baseAddr && addrIndex.has(pairAddr) && addrIndex.has(baseAddr)) {
        const key = `${pairAddr}||${baseAddr}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            source: `node-${addrIndex.get(pairAddr)}`,
            target: `node-${addrIndex.get(baseAddr)}`,
            type: 'usdc',
            amount: vol * 0.5,
            count: Math.floor(txCount * 0.5),
          });
        }
      }
    }

    const usdcTxns = edges.filter(e => e.type === 'usdc').length;
    const usdtTxns = edges.filter(e => e.type === 'usdt').length;
    const n = nodes.length;
    const maxEdges = n * (n - 1);
    const density = maxEdges > 0 ? parseFloat((edges.length / maxEdges).toFixed(4)) : 0;

    return {
      nodes,
      edges,
      stats: {
        clusters: Math.max(1, Math.floor(n / 4)),
        avgDegree: parseFloat(((edges.length * 2) / Math.max(n, 1)).toFixed(2)),
        density,
        usdcTxns,
        usdtTxns,
        totalVolume: nodes.reduce((s, nd) => s + nd.volume, 0),
        timelineData: Array.from({ length: 8 }, () => Math.floor(Math.random() * 90 + 10)),
      },
      source: 'dexscreener',
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet') || '';

  let result: NetworkGraphResponse | null = null;

  if (wallet) {
    // Try Helius first for Solana addresses, then DexScreener
    result = await fetchHeliusData(wallet);
    if (!result) {
      result = await fetchDexScreenerData(wallet);
    }
  }

  // Always fallback to mock if nothing worked
  if (!result) {
    result = generateMockData();
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
