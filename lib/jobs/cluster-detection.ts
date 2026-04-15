import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getBirdeyeHolders } from '@/lib/services/birdeye';
import { detectCluster } from '@/lib/services/cluster-detection';
import type { TransferEdge, TokenTradeEvent } from '@/lib/services/cluster-detection';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ─── Alchemy Solana helpers ──────────────────────────────────────────────────

const SOLANA_RPC = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC
  || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;

async function getRecentTransfers(addresses: string[]): Promise<TransferEdge[]> {
  if (!SOLANA_RPC) return [];
  const edges: TransferEdge[] = [];
  const batch = addresses.slice(0, 20);
  for (const addr of batch) {
    try {
      const sigRes = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [addr, { limit: 50 }] }),
        signal: AbortSignal.timeout(12000),
      });
      if (!sigRes.ok) continue;
      const sigData = await sigRes.json() as { result?: Array<{ signature: string; blockTime: number | null }> };
      for (const sig of (sigData.result ?? []).slice(0, 10)) {
        const txRes = await fetch(SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] }),
          signal: AbortSignal.timeout(12000),
        });
        if (!txRes.ok) continue;
        const txData = await txRes.json() as { result?: Record<string, unknown> };
        const tx = txData.result;
        if (!tx) continue;
        const meta = tx.meta as Record<string, unknown> | undefined;
        const preBalances = (meta?.preBalances as number[]) ?? [];
        const postBalances = (meta?.postBalances as number[]) ?? [];
        const accountKeys = ((tx.transaction as Record<string, unknown>)?.message as Record<string, unknown>)?.accountKeys as Array<{ pubkey: string }> ?? [];
        for (let i = 0; i < accountKeys.length; i++) {
          const diff = ((postBalances[i] ?? 0) - (preBalances[i] ?? 0)) / 1e9;
          if (Math.abs(diff) > 0.001 && accountKeys[i]?.pubkey !== addr && addresses.includes(accountKeys[i]?.pubkey)) {
            edges.push({ from: diff < 0 ? accountKeys[i].pubkey : addr, to: diff > 0 ? accountKeys[i].pubkey : addr, valueUsd: Math.abs(diff), timestamp: (sig.blockTime ?? 0) * 1000, txHash: sig.signature });
          }
        }
      }
    } catch { /* skip wallet */ }
  }
  return edges;
}

async function getRecentTrades(addresses: string[]): Promise<TokenTradeEvent[]> {
  if (!SOLANA_RPC) return [];
  const events: TokenTradeEvent[] = [];
  const batch = addresses.slice(0, 20);
  for (const addr of batch) {
    try {
      const sigRes = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [addr, { limit: 30 }] }),
        signal: AbortSignal.timeout(12000),
      });
      if (!sigRes.ok) continue;
      const sigData = await sigRes.json() as { result?: Array<{ signature: string; blockTime: number | null; slot: number }> };
      for (const sig of (sigData.result ?? []).slice(0, 10)) {
        const txRes = await fetch(SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] }),
          signal: AbortSignal.timeout(12000),
        });
        if (!txRes.ok) continue;
        const txData = await txRes.json() as { result?: Record<string, unknown> };
        const tx = txData.result;
        if (!tx) continue;
        const meta = tx.meta as Record<string, unknown> | undefined;
        const preTokens = (meta?.preTokenBalances as any[]) ?? [];
        const postTokens = (meta?.postTokenBalances as any[]) ?? [];
        for (const pt of postTokens) {
          const pre = preTokens.find((p: any) => p.accountIndex === pt.accountIndex && p.mint === pt.mint);
          const diff = (pt.uiTokenAmount?.uiAmount ?? 0) - (pre?.uiTokenAmount?.uiAmount ?? 0);
          if (Math.abs(diff) > 0) {
            events.push({ address: addr, tokenAddress: pt.mint, side: diff > 0 ? 'buy' : 'sell', valueUsd: Math.abs(diff), timestamp: (sig.blockTime ?? 0) * 1000, blockNumber: sig.slot, txHash: sig.signature });
          }
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
