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
  const rpc = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC
    || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;
  if (!rpc) return { transfers: [], trades: [] };

  const transfers: TransferEdge[] = [];
  const trades: TokenTradeEvent[] = [];
  const batch = addresses.slice(0, 15);

  await Promise.allSettled(batch.map(async addr => {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [addr, { limit: 40 }] }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return;
      const data = await res.json() as { result?: Array<{ signature: string; blockTime: number | null; slot: number }> };
      const sigs = data.result ?? [];
      for (const sig of sigs) {
        const txRes = await fetch(rpc, {
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
          if (Math.abs(diff) > 0.001 && accountKeys[i]?.pubkey !== addr) {
            if (diff > 0) {
              transfers.push({ from: addr, to: accountKeys[i].pubkey, valueUsd: Math.abs(diff), timestamp: (sig.blockTime ?? 0) * 1000, txHash: sig.signature });
            } else {
              transfers.push({ from: accountKeys[i].pubkey, to: addr, valueUsd: Math.abs(diff), timestamp: (sig.blockTime ?? 0) * 1000, txHash: sig.signature });
            }
          }
        }
        const preTokens = (meta?.preTokenBalances as Array<{ accountIndex: number; uiTokenAmount: { uiAmount: number }; mint: string }>) ?? [];
        const postTokens = (meta?.postTokenBalances as Array<{ accountIndex: number; uiTokenAmount: { uiAmount: number }; mint: string }>) ?? [];
        for (const pt of postTokens) {
          const pre = preTokens.find(p => p.accountIndex === pt.accountIndex && p.mint === pt.mint);
          const diff = (pt.uiTokenAmount?.uiAmount ?? 0) - (pre?.uiTokenAmount?.uiAmount ?? 0);
          if (Math.abs(diff) > 0) {
            trades.push({ address: addr, tokenAddress: pt.mint, side: diff > 0 ? 'buy' : 'sell', valueUsd: Math.abs(diff), timestamp: (sig.blockTime ?? 0) * 1000, blockNumber: sig.slot, txHash: sig.signature });
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
    // Detect if input is a wallet address or token address
    const isWalletAddress = tokenAddress.length >= 32 && tokenAddress.length <= 44 && !tokenAddress.startsWith('0x');
    const isEvmAddress = tokenAddress.startsWith('0x') && tokenAddress.length === 42;

    if (isWalletAddress || isEvmAddress) {
      // Treat as WALLET address — fetch its transactions to find counterparty addresses
      try {
        const walletTransfers = await fetchTransferData([tokenAddress]);
        const counterparties = new Set<string>();
        for (const tx of walletTransfers.transfers) {
          if (tx.from.toLowerCase() !== tokenAddress.toLowerCase()) counterparties.add(tx.from);
          if (tx.to.toLowerCase() !== tokenAddress.toLowerCase()) counterparties.add(tx.to);
        }
        addresses = [tokenAddress, ...Array.from(counterparties).slice(0, 49)];
      } catch (err) {
        console.error('[Wallet Clusters] Failed to fetch wallet transfers:', err);
        addresses = [tokenAddress];
      }
    } else {
      // Treat as TOKEN address — get top holders
      const holders = await getBirdeyeHolders(tokenAddress, 50, 'solana');
      addresses = holders.map(h => h.owner).filter(Boolean);
    }
  } else {
    // No input — try smart_money_wallets, fallback to whale_addresses
    const { data } = await supabase.from('smart_money_wallets').select('address').limit(40);
    addresses = (data ?? []).map((r: { address: string }) => r.address).filter(Boolean);
    if (addresses.length < 3) {
      const { data: whales } = await supabase.from('whale_addresses').select('address').limit(40);
      addresses = (whales ?? []).map((r: { address: string }) => r.address).filter(Boolean);
    }
  }

  if (addresses.length < 3) {
    return NextResponse.json({
      clusters: [], members: [], source: 'live',
      message: addresses.length === 0
        ? 'Enter a wallet or token address to analyze'
        : `Only ${addresses.length} addresses found. Need at least 3 for cluster detection.`,
    });
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
