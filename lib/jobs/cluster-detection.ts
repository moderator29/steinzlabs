import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getBirdeyeHolders } from '@/lib/services/birdeye';
import { detectCluster } from '@/lib/services/cluster-detection';
import type { TransferEdge, TokenTradeEvent } from '@/lib/services/cluster-detection';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ─── Helius helpers ────────────────────────────────────────────────────────────

async function getRecentTransfers(addresses: string[]): Promise<TransferEdge[]> {
  const HELIUS_KEY = process.env.HELIUS_API_KEY ?? process.env.HELIUS_API_KEY_2 ?? '';
  if (!HELIUS_KEY) return [];
  const edges: TransferEdge[] = [];
  const batch = addresses.slice(0, 20); // cap to 20 wallets per job run
  for (const addr of batch) {
    try {
      const res = await fetch(
        `https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${HELIUS_KEY}&type=TRANSFER&limit=50`
      );
      if (!res.ok) continue;
      const txs = await res.json() as Array<{
        signature: string; timestamp: number;
        tokenTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; tokenAmount: number }>;
        nativeTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>;
      }>;
      for (const tx of txs) {
        for (const t of tx.tokenTransfers ?? []) {
          if (addresses.includes(t.toUserAccount)) {
            edges.push({ from: t.fromUserAccount, to: t.toUserAccount, valueUsd: t.tokenAmount, timestamp: tx.timestamp * 1000, txHash: tx.signature });
          }
        }
      }
    } catch { /* skip wallet */ }
  }
  return edges;
}

async function getRecentTrades(addresses: string[]): Promise<TokenTradeEvent[]> {
  const HELIUS_KEY = process.env.HELIUS_API_KEY ?? process.env.HELIUS_API_KEY_2 ?? '';
  if (!HELIUS_KEY) return [];
  const events: TokenTradeEvent[] = [];
  const batch = addresses.slice(0, 20);
  for (const addr of batch) {
    try {
      const res = await fetch(
        `https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${HELIUS_KEY}&type=SWAP&limit=30`
      );
      if (!res.ok) continue;
      const txs = await res.json() as Array<{
        signature: string; timestamp: number; slot: number;
        tokenTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }>;
      }>;
      for (const tx of txs) {
        for (const t of tx.tokenTransfers ?? []) {
          events.push({
            address: addr,
            tokenAddress: t.mint,
            side: t.fromUserAccount === addr ? 'sell' : 'buy',
            valueUsd: t.tokenAmount,
            timestamp: tx.timestamp * 1000,
            blockNumber: tx.slot,
            txHash: tx.signature,
          });
        }
      }
    } catch { /* skip wallet */ }
  }
  return events;
}

// ─── Main job ─────────────────────────────────────────────────────────────────

export interface ClusterJobResult {
  clustersFound: number;
  walletsAnalyzed: number;
  highRiskClusters: number;
  tokenAddress?: string;
}

export async function runClusterDetectionJob(tokenAddress?: string): Promise<ClusterJobResult> {
  let addresses: string[] = [];

  if (tokenAddress) {
    const holders = await getBirdeyeHolders(tokenAddress, 50, 'solana');
    addresses = holders.map(h => h.owner).filter(Boolean);
  } else {
    // Pull known whale wallets from Supabase
    const { data } = await supabase.from('smart_money_wallets').select('address').limit(50);
    addresses = (data ?? []).map((r: { address: string }) => r.address).filter(Boolean);
  }

  if (addresses.length < 3) return { clustersFound: 0, walletsAnalyzed: 0, highRiskClusters: 0, tokenAddress };

  const [transfers, trades] = await Promise.all([
    getRecentTransfers(addresses),
    getRecentTrades(addresses),
  ]);

  const result = detectCluster({ addresses, chain: 'solana', transfers, trades });

  if (!result.detected || !result.cluster) {
    return { clustersFound: 0, walletsAnalyzed: addresses.length, highRiskClusters: 0, tokenAddress };
  }

  const cluster = result.cluster;
  const { data: clusterRow } = await supabase.from('wallet_clusters').insert({
    name: `Cluster ${cluster.clusterId.slice(-8)}`,
    chain: 'solana',
    member_count: cluster.memberCount,
    coordination_score: cluster.coordinationScore,
    risk_level: cluster.coordinationScore >= 60 ? 'high' : cluster.coordinationScore >= 40 ? 'medium' : 'low',
    signals: result.signals,
    token_address: tokenAddress ?? null,
    detected_at: new Date().toISOString(),
  }).select('id').single();

  if (clusterRow?.id) {
    const memberRows = cluster.members.map(m => ({
      cluster_id: clusterRow.id,
      wallet_address: m.address,
      role: 'member',
    }));
    await supabase.from('wallet_cluster_members').insert(memberRows).then(() => {});
  }

  const isHighRisk = cluster.coordinationScore >= 60 ? 1 : 0;
  return {
    clustersFound: 1,
    walletsAnalyzed: addresses.length,
    highRiskClusters: isHighRisk,
    tokenAddress,
  };
}
