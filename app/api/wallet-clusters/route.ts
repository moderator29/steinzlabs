import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectCluster } from '@/lib/services/cluster-detection';
import { getBirdeyeHolders } from '@/lib/services/birdeye';
import type { TransferEdge, TokenTradeEvent } from '@/lib/services/cluster-detection';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fetchTransferData(addresses: string[]): Promise<{ transfers: TransferEdge[]; trades: TokenTradeEvent[] }> {
  const key = process.env.HELIUS_API_KEY_1 ?? process.env.HELIUS_API_KEY_2 ?? '';
  if (!key) return { transfers: [], trades: [] };

  const transfers: TransferEdge[] = [];
  const trades: TokenTradeEvent[] = [];
  const batch = addresses.slice(0, 15);

  await Promise.allSettled(batch.map(async addr => {
    try {
      const [swapRes, txRes] = await Promise.all([
        fetch(`https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${key}&type=SWAP&limit=20`),
        fetch(`https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${key}&type=TRANSFER&limit=20`),
      ]);
      if (swapRes.ok) {
        const swaps = await swapRes.json() as Array<{ signature: string; timestamp: number; slot: number; tokenTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }> }>;
        for (const tx of swaps) {
          for (const t of tx.tokenTransfers ?? []) {
            trades.push({ address: addr, tokenAddress: t.mint, side: t.fromUserAccount === addr ? 'sell' : 'buy', valueUsd: t.tokenAmount, timestamp: tx.timestamp * 1000, blockNumber: tx.slot, txHash: tx.signature });
          }
        }
      }
      if (txRes.ok) {
        const txs = await txRes.json() as Array<{ signature: string; timestamp: number; nativeTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }> }>;
        for (const tx of txs) {
          for (const t of tx.nativeTransfers ?? []) {
            if (addresses.includes(t.toUserAccount)) {
              transfers.push({ from: t.fromUserAccount, to: t.toUserAccount, valueUsd: t.amount / 1e9, timestamp: tx.timestamp * 1000, txHash: tx.signature });
            }
          }
        }
      }
    } catch { /* skip */ }
  }));

  return { transfers, trades };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenAddress = searchParams.get('token');
  const refresh = searchParams.get('refresh') === '1';

  // Try cached results first (skip if refresh requested)
  if (!refresh) {
    const q = supabase.from('wallet_clusters')
      .select('id, name, member_count, coordination_score, risk_level, signals, detected_at, token_address')
      .order('detected_at', { ascending: false })
      .limit(20);
    const { data: cached } = tokenAddress ? await q.eq('token_address', tokenAddress) : await q;
    if (cached && cached.length > 0) {
      const clusterIds = cached.map((c: { id: string }) => c.id);
      const { data: members } = await supabase.from('wallet_cluster_members')
        .select('cluster_id, wallet_address, role').in('cluster_id', clusterIds);
      return NextResponse.json({ clusters: cached, members: members ?? [], source: 'cache' });
    }
  }

  // Fetch fresh addresses
  let addresses: string[] = [];
  if (tokenAddress) {
    const holders = await getBirdeyeHolders(tokenAddress, 50, 'solana');
    addresses = holders.map(h => h.owner).filter(Boolean);
  } else {
    const { data } = await supabase.from('smart_money_wallets').select('address').limit(40);
    addresses = (data ?? []).map((r: { address: string }) => r.address).filter(Boolean);
  }

  if (addresses.length < 3) {
    return NextResponse.json({ clusters: [], members: [], source: 'live', message: 'Insufficient wallets to detect clusters' });
  }

  const { transfers, trades } = await fetchTransferData(addresses);
  const result = detectCluster({ addresses, chain: 'solana', transfers, trades });

  // Build response cluster list
  const clusters = result.detected && result.cluster ? [{
    id: result.cluster.clusterId,
    name: `Cluster ${result.cluster.clusterId.slice(-8).toUpperCase()}`,
    member_count: result.cluster.memberCount,
    coordination_score: result.cluster.coordinationScore,
    risk_level: result.cluster.coordinationScore >= 60 ? 'high' : result.cluster.coordinationScore >= 40 ? 'medium' : 'low',
    signals: result.signals,
    detected_at: new Date().toISOString(),
    token_address: tokenAddress,
  }] : [];

  const members = result.cluster?.members.map(m => ({
    cluster_id: result.cluster!.clusterId,
    wallet_address: m.address,
    role: 'member',
    coordination_score: m.coordinationScore,
  })) ?? [];

  return NextResponse.json({ clusters, members, source: 'live', transfers: transfers.slice(0, 30) });
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  const { tokenAddress } = await request.json() as { tokenAddress?: string };
  const { runClusterDetectionJob } = await import('@/lib/jobs/cluster-detection');
  const result = await runClusterDetectionJob(tokenAddress);
  return NextResponse.json(result);
}
