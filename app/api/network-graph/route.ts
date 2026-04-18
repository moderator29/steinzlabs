import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

const SOLANA_RPC = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC
  || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;

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
  source: 'alchemy' | 'dexscreener' | 'mock';
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
  if (address === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') return 'usdc';
  if (address === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') return 'usdt';
  if (KNOWN_PROTOCOLS[address]) return 'bridge';
  if (volume > 500000 || txCount > 50) return 'high-activity';
  if (volume > 100000 || txCount > 20) return 'high-activity';
  return 'regular';
}

// ─── Static fallback: well-known Solana protocol addresses with representative values ──

const STATIC_NODES: Array<{ address: string; volume: number; txCount: number }> = [
  { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', volume: 28_400_000, txCount: 842 }, // USDC Mint
  { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', volume: 14_200_000, txCount: 371 }, // USDT Mint
  { address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', volume: 9_100_000,  txCount: 612 }, // Jupiter
  { address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', volume: 7_800_000,  txCount: 519 }, // Raydium AMM
  { address: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3sFjno',  volume: 5_600_000,  txCount: 288 }, // Orca Whirlpool
  { address: 'So11111111111111111111111111111111111111112',   volume: 18_700_000, txCount: 931 }, // Wrapped SOL
  { address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', volume: 3_900_000,  txCount: 194 }, // mSOL
  { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', volume: 2_100_000,  txCount: 143 }, // Bonk
  { address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',  volume: 6_200_000,  txCount: 445 }, // Token Program
  { address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bM',  volume: 450_000,    txCount: 31  }, // Associated Token
  { address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',  volume: 380_000,    txCount: 28  }, // Metaplex
  { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', volume: 2_400_000,  txCount: 127 }, // Wallet A
  { address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', volume: 1_850_000,  txCount: 98  }, // Wallet B
  { address: 'GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ', volume: 980_000,    txCount: 67  }, // Wallet C
  { address: '6FzXPMkMDWCHBkpqPCMrFP9xCxCVxCSApwBxXJCd4WHH', volume: 720_000,    txCount: 45  }, // Wallet D
  { address: 'SysvarRent111111111111111111111111111111111',   volume: 120_000,    txCount: 18  }, // Sysvar Rent
];

// Pre-defined edges between the static nodes above (by index)
const STATIC_EDGES: Array<{
  srcIdx: number; tgtIdx: number; type: 'usdc' | 'usdt'; amount: number; count: number;
}> = [
  { srcIdx: 2,  tgtIdx: 0,  type: 'usdc', amount: 4_200_000, count: 312 }, // Jupiter → USDC
  { srcIdx: 2,  tgtIdx: 1,  type: 'usdt', amount: 1_800_000, count: 142 }, // Jupiter → USDT
  { srcIdx: 3,  tgtIdx: 0,  type: 'usdc', amount: 3_900_000, count: 287 }, // Raydium → USDC
  { srcIdx: 3,  tgtIdx: 1,  type: 'usdt', amount: 1_200_000, count: 98  }, // Raydium → USDT
  { srcIdx: 4,  tgtIdx: 0,  type: 'usdc', amount: 2_800_000, count: 195 }, // Orca → USDC
  { srcIdx: 5,  tgtIdx: 2,  type: 'usdc', amount: 5_100_000, count: 421 }, // wSOL → Jupiter
  { srcIdx: 5,  tgtIdx: 3,  type: 'usdc', amount: 4_300_000, count: 358 }, // wSOL → Raydium
  { srcIdx: 5,  tgtIdx: 4,  type: 'usdc', amount: 2_200_000, count: 183 }, // wSOL → Orca
  { srcIdx: 6,  tgtIdx: 2,  type: 'usdc', amount: 1_900_000, count: 112 }, // mSOL → Jupiter
  { srcIdx: 7,  tgtIdx: 3,  type: 'usdc', amount: 890_000,   count: 74  }, // Bonk → Raydium
  { srcIdx: 8,  tgtIdx: 5,  type: 'usdc', amount: 2_400_000, count: 198 }, // Token Prog → wSOL
  { srcIdx: 11, tgtIdx: 2,  type: 'usdc', amount: 980_000,   count: 67  }, // Wallet A → Jupiter
  { srcIdx: 11, tgtIdx: 3,  type: 'usdc', amount: 720_000,   count: 51  }, // Wallet A → Raydium
  { srcIdx: 12, tgtIdx: 2,  type: 'usdc', amount: 820_000,   count: 58  }, // Wallet B → Jupiter
  { srcIdx: 12, tgtIdx: 4,  type: 'usdt', amount: 490_000,   count: 34  }, // Wallet B → Orca
  { srcIdx: 13, tgtIdx: 3,  type: 'usdc', amount: 340_000,   count: 26  }, // Wallet C → Raydium
  { srcIdx: 14, tgtIdx: 2,  type: 'usdc', amount: 280_000,   count: 19  }, // Wallet D → Jupiter
  { srcIdx: 9,  tgtIdx: 8,  type: 'usdc', amount: 180_000,   count: 14  }, // Assoc Token → Token Prog
  { srcIdx: 10, tgtIdx: 9,  type: 'usdc', amount: 150_000,   count: 11  }, // Metaplex → Assoc Token
  { srcIdx: 12, tgtIdx: 5,  type: 'usdc', amount: 620_000,   count: 43  }, // Wallet B → wSOL
  { srcIdx: 13, tgtIdx: 4,  type: 'usdt', amount: 320_000,   count: 22  }, // Wallet C → Orca
  { srcIdx: 14, tgtIdx: 4,  type: 'usdc', amount: 260_000,   count: 17  }, // Wallet D → Orca
];

// Static timeline — 8 buckets × 3h = 24h, normalized 0-100 (most recent = index 7)
const STATIC_TIMELINE = [38, 45, 52, 61, 74, 83, 91, 78];

function generateMockData(): NetworkGraphResponse {
  const nodes: NetworkNode[] = STATIC_NODES.map((n, i) => ({
    id: `node-${i}`,
    address: n.address,
    type: classifyNode(n.address, n.volume, n.txCount),
    volume: n.volume,
    txCount: n.txCount,
  }));

  const edges: NetworkEdge[] = STATIC_EDGES
    .filter(e => e.srcIdx < nodes.length && e.tgtIdx < nodes.length)
    .map(e => ({
      source: nodes[e.srcIdx].id,
      target: nodes[e.tgtIdx].id,
      type: e.type,
      amount: e.amount,
      count: e.count,
    }));

  const usdcTxns = edges.filter(e => e.type === 'usdc').length;
  const usdtTxns = edges.filter(e => e.type === 'usdt').length;
  const n = nodes.length;
  const maxEdges = n * (n - 1);
  const density = maxEdges > 0 ? parseFloat((edges.length / maxEdges).toFixed(4)) : 0;
  const avgDegree = parseFloat(((edges.length * 2) / Math.max(n, 1)).toFixed(2));

  return {
    nodes,
    edges,
    stats: {
      clusters: Math.max(1, Math.floor(n / 5)),
      avgDegree,
      density,
      usdcTxns,
      usdtTxns,
      totalVolume: nodes.reduce((s, nd) => s + nd.volume, 0),
      timelineData: STATIC_TIMELINE,
    },
    source: 'mock',
  };
}

async function fetchSolanaGraphData(wallet: string): Promise<NetworkGraphResponse | null> {
  if (!SOLANA_RPC) return null;

  try {
    // Get transaction signatures via Alchemy Solana RPC
    const sigRes = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [wallet, { limit: 50 }] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!sigRes.ok) return null;
    const sigData = await sigRes.json() as { result?: Array<{ signature: string; blockTime: number | null }> };
    const sigs = sigData.result ?? [];
    if (sigs.length === 0) return null;

    // Fetch transaction details in parallel (batch of 10)
    const txDetails = await Promise.allSettled(
      sigs.slice(0, 30).map(async (sig) => {
        const r = await fetch(SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] }),
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) return null;
        const d = await r.json() as { result?: Record<string, unknown> };
        return d.result ? { ...d.result, timestamp: sig.blockTime } : null;
      })
    );
    const txs = (txDetails as any[])
      .filter((r: any) => r.status === 'fulfilled' && r.value !== null)
      .map((r: any) => r.value);
    if (!Array.isArray(txs) || txs.length === 0) return null;

    const nodeMap = new Map<string, { volume: number; txCount: number; addresses: Set<string> }>();
    const edgeMap = new Map<string, { amount: number; count: number; type: 'usdc' | 'usdt' }>();

    const ensureNode = (addr: string) => {
      if (!nodeMap.has(addr)) {
        nodeMap.set(addr, { volume: 0, txCount: 0, addresses: new Set() });
      }
    };

    for (const tx of txs) {
      const meta = tx.meta as Record<string, unknown> | undefined;
      const preTokens = (meta?.preTokenBalances as any[]) ?? [];
      const postTokens = (meta?.postTokenBalances as any[]) ?? [];
      const accountKeys = ((tx.transaction as any)?.message?.accountKeys ?? []) as Array<{ pubkey: string }>;
      // Build token transfers from balance diffs
      const transfers: Array<{ fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }> = [];
      for (const pt of postTokens) {
        const pre = preTokens.find((p: any) => p.accountIndex === pt.accountIndex && p.mint === pt.mint);
        const diff = (pt.uiTokenAmount?.uiAmount ?? 0) - (pre?.uiTokenAmount?.uiAmount ?? 0);
        if (Math.abs(diff) > 0) {
          const owner = pt.owner || accountKeys[pt.accountIndex]?.pubkey || '';
          if (diff > 0) {
            transfers.push({ fromUserAccount: wallet, toUserAccount: owner, mint: pt.mint, tokenAmount: diff });
          } else {
            transfers.push({ fromUserAccount: owner, toUserAccount: wallet, mint: pt.mint, tokenAmount: Math.abs(diff) });
          }
        }
      }
      for (const t of transfers) {
        const from = t.fromUserAccount || '';
        const to = t.toUserAccount || '';
        const mint = t.mint || '';
        const amount = t.tokenAmount || 0;

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

    // Build timelineData from actual tx timestamps
    // 8 buckets × 3h each = last 24h; index 7 = most recent, index 0 = oldest
    const bucketMs = 3 * 60 * 60 * 1000;
    const windowMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const buckets = new Array(8).fill(0);
    for (const tx of txs) {
      const ts = tx.timestamp ? tx.timestamp * 1000 : 0;
      if (!ts) continue;
      const age = now - ts;
      if (age < 0 || age >= windowMs) continue;
      const bucketIdx = 7 - Math.floor(age / bucketMs);
      if (bucketIdx >= 0 && bucketIdx < 8) buckets[bucketIdx]++;
    }
    // Normalize to 0-100 for chart display
    const maxBucket = Math.max(...buckets, 1);
    const timelineData = buckets.map(v => Math.round((v / maxBucket) * 100));

    return {
      nodes,
      edges,
      stats: {
        clusters: Math.max(1, Math.floor(n / 5)),
        avgDegree,
        density,
        usdcTxns,
        usdtTxns,
        totalVolume: nodes.reduce((s, nd) => s + nd.volume, 0),
        timelineData,
      },
      source: 'alchemy',
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

    // Build timelineData from actual DexScreener h1/h6/h24 transaction counts
    // 8 buckets × 3h each = last 24h; index 7 = most recent (0-3h), index 0 = oldest (21-24h)
    let totalH1 = 0, totalH6 = 0, totalH24 = 0;
    for (const pair of pairs.slice(0, 20)) {
      totalH1  += (parseInt(String(pair.txns?.h1?.buys  ?? 0)) + parseInt(String(pair.txns?.h1?.sells  ?? 0)));
      totalH6  += (parseInt(String(pair.txns?.h6?.buys  ?? 0)) + parseInt(String(pair.txns?.h6?.sells  ?? 0)));
      totalH24 += (parseInt(String(pair.txns?.h24?.buys ?? 0)) + parseInt(String(pair.txns?.h24?.sells ?? 0)));
    }
    // Per-3h bucket rates derived from cumulative windows
    const rate1h  = totalH1;
    const rate6h  = totalH6  > 0 ? totalH6  / 6  : rate1h;   // avg/hour over last 6h
    const rate24h = totalH24 > 0 ? totalH24 / 24 : rate6h;   // avg/hour over last 24h
    const rawBuckets = [
      rate24h * 3, rate24h * 3, rate24h * 3, rate24h * 3,  // buckets 0-3: 12-24h ago
      rate6h * 3,  rate6h * 3,                               // buckets 4-5: 6-12h ago
      rate6h * 3,                                             // bucket 6: 3-6h ago
      rate1h * 3,                                             // bucket 7: 0-3h ago (most recent)
    ];
    const maxBucket = Math.max(...rawBuckets, 1);
    const timelineData = rawBuckets.map(v => Math.round((v / maxBucket) * 100));

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
        timelineData,
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
    // Try Alchemy Solana first, then DexScreener
    result = await fetchSolanaGraphData(wallet);
    if (!result) {
      result = await fetchDexScreenerData(wallet);
    }
  }

  // Fallback to static deterministic mock if no wallet or APIs unavailable
  if (!result) {
    result = generateMockData();
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
