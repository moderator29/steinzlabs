import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserByWallet } from '@/lib/database/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/transactions?address=<addr>&chain=<chain>&limit=N
 *
 * Decoded wallet activity. Replaces the localStorage-only path in the
 * wallet-page ActivityTab.
 *
 * - EVM: Etherscan v2 multi-chain endpoint (action=txlist + tokentx merged)
 * - Solana: Helius enhanced parseTransactionHistory
 *
 * Cache hits go through public.transaction_history (keyed by chain+tx_hash).
 * Misses fetch upstream and bulk-upsert before returning. Fail-soft: returns
 * the cache rows when the upstream provider errors, plus an `error` flag in
 * the payload so the UI can surface a banner.
 */

const Q = z.object({
  address: z.string().min(8).max(128),
  chain: z.string().min(2).max(32).default('ethereum'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

interface DecodedTx {
  tx_hash: string;
  chain: string;
  tx_type: string; // 'swap' | 'send' | 'receive' | 'approval' | 'contract' | 'unknown'
  token_in: string | null;
  token_out: string | null;
  amount_in: number | null;
  amount_out: number | null;
  usd_value: number | null;
  timestamp: string; // ISO
  from?: string | null;
  to?: string | null;
}

const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';
const CHAIN_ID: Record<string, number> = {
  ethereum: 1, eth: 1,
  base: 8453,
  arbitrum: 42161, arb: 42161,
  polygon: 137,
  optimism: 10, op: 10,
  bsc: 56, bnb: 56,
  avalanche: 43114,
};

async function fetchEvmTxs(address: string, chain: string, limit: number): Promise<DecodedTx[]> {
  const key = process.env.ETHERSCAN_API_KEY;
  const chainId = CHAIN_ID[chain.toLowerCase()];
  if (!key || !chainId) return [];

  // Normal txlist (native sends + contract calls)
  const txQs = new URLSearchParams({
    chainid: String(chainId),
    module: 'account',
    action: 'txlist',
    address,
    page: '1',
    offset: String(limit),
    sort: 'desc',
    apikey: key,
  });
  const tokenQs = new URLSearchParams({
    chainid: String(chainId),
    module: 'account',
    action: 'tokentx',
    address,
    page: '1',
    offset: String(limit),
    sort: 'desc',
    apikey: key,
  });

  const [txRes, tokenRes] = await Promise.all([
    fetch(`${ETHERSCAN_V2}?${txQs}`, { signal: AbortSignal.timeout(12_000) }).then((r) => r.json()).catch(() => null),
    fetch(`${ETHERSCAN_V2}?${tokenQs}`, { signal: AbortSignal.timeout(12_000) }).then((r) => r.json()).catch(() => null),
  ]);

  const decoded: DecodedTx[] = [];
  const addrLower = address.toLowerCase();

  // Native transfers + contract calls
  const txs: Array<Record<string, unknown>> = Array.isArray(txRes?.result) ? txRes.result : [];
  for (const t of txs) {
    const from = String(t.from ?? '').toLowerCase();
    const to = String(t.to ?? '').toLowerCase();
    const valueWei = String(t.value ?? '0');
    const valueEth = Number(BigInt(valueWei)) / 1e18;
    const isContract = Number(t.input && String(t.input).length > 10 ? 1 : 0);
    let txType: DecodedTx['tx_type'] = 'unknown';
    if (valueEth > 0 && from === addrLower) txType = 'send';
    else if (valueEth > 0 && to === addrLower) txType = 'receive';
    else if (isContract) txType = 'contract';
    decoded.push({
      tx_hash: String(t.hash ?? ''),
      chain,
      tx_type: txType,
      token_in: null,
      token_out: txType === 'send' || txType === 'receive' ? (chain === 'bsc' ? 'BNB' : chain === 'polygon' ? 'MATIC' : chain === 'avalanche' ? 'AVAX' : 'ETH') : null,
      amount_in: null,
      amount_out: valueEth > 0 ? valueEth : null,
      usd_value: null,
      timestamp: new Date(Number(t.timeStamp ?? 0) * 1000).toISOString(),
      from,
      to,
    });
  }

  // ERC-20 transfers (swaps light up here too — we tag both legs as 'transfer'
  // and the UI can fold matching in+out by tx_hash for swap detection).
  const toks: Array<Record<string, unknown>> = Array.isArray(tokenRes?.result) ? tokenRes.result : [];
  for (const t of toks) {
    const from = String(t.from ?? '').toLowerCase();
    const to = String(t.to ?? '').toLowerCase();
    const decimals = Number(t.tokenDecimal ?? 18);
    const raw = String(t.value ?? '0');
    const amount = Number(BigInt(raw)) / 10 ** decimals;
    const symbol = String(t.tokenSymbol ?? '');
    const isOutgoing = from === addrLower;
    decoded.push({
      tx_hash: String(t.hash ?? ''),
      chain,
      tx_type: 'transfer',
      token_in: isOutgoing ? null : symbol,
      token_out: isOutgoing ? symbol : null,
      amount_in: isOutgoing ? null : amount,
      amount_out: isOutgoing ? amount : null,
      usd_value: null,
      timestamp: new Date(Number(t.timeStamp ?? 0) * 1000).toISOString(),
      from,
      to,
    });
  }

  // Fold pairs: same tx_hash with both in + out becomes a 'swap'.
  const byHash = new Map<string, DecodedTx[]>();
  for (const d of decoded) {
    if (!byHash.has(d.tx_hash)) byHash.set(d.tx_hash, []);
    byHash.get(d.tx_hash)!.push(d);
  }
  const merged: DecodedTx[] = [];
  for (const rows of byHash.values()) {
    if (rows.length >= 2) {
      const sentLeg = rows.find((r) => r.amount_out && r.token_out);
      const recvLeg = rows.find((r) => r.amount_in && r.token_in);
      if (sentLeg && recvLeg) {
        merged.push({
          ...sentLeg,
          tx_type: 'swap',
          token_in: recvLeg.token_in,
          amount_in: recvLeg.amount_in,
        });
        continue;
      }
    }
    merged.push(rows[0]);
  }
  return merged.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1)).slice(0, limit);
}

async function fetchSolanaTxs(address: string, limit: number): Promise<DecodedTx[]> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return [];
  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${key}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) }).then((r) => r.json()).catch(() => null);
  if (!Array.isArray(res)) return [];
  const decoded: DecodedTx[] = [];
  for (const t of res as Array<Record<string, unknown>>) {
    const sig = String(t.signature ?? '');
    const ts = Number(t.timestamp ?? 0);
    const type = String(t.type ?? 'UNKNOWN').toLowerCase();
    let txType: DecodedTx['tx_type'] = 'unknown';
    if (type.includes('swap')) txType = 'swap';
    else if (type.includes('transfer')) txType = 'transfer';
    const tokenTransfers = Array.isArray(t.tokenTransfers) ? (t.tokenTransfers as Array<Record<string, unknown>>) : [];
    const nativeTransfers = Array.isArray(t.nativeTransfers) ? (t.nativeTransfers as Array<Record<string, unknown>>) : [];
    const tIn = tokenTransfers.find((x) => String(x.toUserAccount ?? '') === address);
    const tOut = tokenTransfers.find((x) => String(x.fromUserAccount ?? '') === address);
    const nOut = nativeTransfers.find((x) => String(x.fromUserAccount ?? '') === address);
    const nIn = nativeTransfers.find((x) => String(x.toUserAccount ?? '') === address);
    decoded.push({
      tx_hash: sig,
      chain: 'solana',
      tx_type: txType,
      token_in: tIn ? String(tIn.mint ?? '').slice(0, 8) : (nIn ? 'SOL' : null),
      token_out: tOut ? String(tOut.mint ?? '').slice(0, 8) : (nOut ? 'SOL' : null),
      amount_in: tIn ? Number(tIn.tokenAmount ?? 0) : nIn ? Number(nIn.amount ?? 0) / 1e9 : null,
      amount_out: tOut ? Number(tOut.tokenAmount ?? 0) : nOut ? Number(nOut.amount ?? 0) / 1e9 : null,
      usd_value: null,
      timestamp: new Date(ts * 1000).toISOString(),
    });
  }
  return decoded;
}

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse({
    address: req.nextUrl.searchParams.get('address'),
    chain: req.nextUrl.searchParams.get('chain') ?? 'ethereum',
    limit: req.nextUrl.searchParams.get('limit') ?? '25',
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { address, chain, limit } = parsed.data;

  const admin = getSupabaseAdmin();
  // Cache read: rows for this wallet/chain in the last 24h.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: cached } = await admin
    .from('transaction_history')
    .select('tx_hash, chain, tx_type, token_in, token_out, amount_in, amount_out, usd_value, timestamp')
    .eq('wallet', address)
    .eq('chain', chain)
    .gte('created_at', since)
    .order('timestamp', { ascending: false })
    .limit(limit);

  let upstream: DecodedTx[] = [];
  let upstreamErr: string | null = null;
  try {
    upstream = chain === 'solana'
      ? await fetchSolanaTxs(address, limit)
      : await fetchEvmTxs(address, chain, limit);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'wallet/transactions', chain } });
    upstreamErr = err instanceof Error ? err.message : 'upstream failed';
  }

  if (upstream.length > 0) {
    // Bulk upsert by (chain, tx_hash). Best-effort: a single failed insert
    // shouldn't poison the response.
    try {
      // Attribute the cache rows to the wallet's owner (if any) so RLS-bound
      // readers can see them; the column is nullable for unowned wallets.
      const owner = await getUserByWallet(address).catch(() => null);
      const userId = owner?.id ?? null;
      const rows = upstream.map((d) => ({
        user_id: userId,
        wallet: address,
        chain: d.chain,
        tx_hash: d.tx_hash,
        tx_type: d.tx_type,
        token_in: d.token_in,
        token_out: d.token_out,
        amount_in: d.amount_in,
        amount_out: d.amount_out,
        usd_value: d.usd_value,
        timestamp: d.timestamp,
      }));
      // The unique index is idx_tx_history_hash (tx_hash, chain) — conflicting
      // on tx_hash alone matched no constraint and errored every cache write.
      await admin.from('transaction_history').upsert(rows, { onConflict: 'tx_hash,chain' });
    } catch (err) {
      Sentry.captureException(err, { tags: { route: 'wallet/transactions', stage: 'cache-write' } });
    }
  }

  const txs = upstream.length > 0 ? upstream : (cached ?? []);
  return NextResponse.json({ chain, address, transactions: txs, upstream_error: upstreamErr });
}
