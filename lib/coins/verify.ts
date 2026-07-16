import 'server-only';

/**
 * On-chain verification for recorded coin trades. A trade is only written to the
 * social feed / holders / PnL if its transaction really settled on chain, was
 * sent by one of the caller's own wallets, AND actually interacted with the coin
 * being recorded. This keeps holders, PnL and revenue honest and blocks
 * fabricated trades (a real but unrelated tx can no longer be passed off as a
 * trade of an arbitrary token). Fails closed: if we cannot verify, we do not
 * record (the user's real holdings still live in their wallet regardless).
 */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSolanaTransactionDetail } from '@/lib/services/alchemy-solana';
import { getEvmRpcUrl } from '@/lib/chains/evmRpc';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

interface WalletEntry { address?: string; solanaAddress?: string }

/** All wallet addresses the user controls (EVM lowercased, Solana case-kept). */
export async function getUserWalletAddresses(userId: string): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('user_wallets_v2').select('wallets, default_address').eq('user_id', userId).maybeSingle();
    const row = data as { wallets?: WalletEntry[]; default_address?: string } | null;
    if (!row) return set;
    if (row.default_address) set.add(normalizeAddress(row.default_address, 'ethereum'));
    for (const w of row.wallets ?? []) {
      if (w.address) set.add(normalizeAddress(w.address, 'ethereum'));
      if (w.solanaAddress) set.add(w.solanaAddress);
    }
  } catch { /* empty set means we cannot verify ownership */ }
  return set;
}

/**
 * True only if the tx settled successfully, was sent by one of the user's
 * wallets, and touched the given token (the mint for Solana, the contract for
 * EVM). Every gate must pass; anything unverifiable fails closed.
 */
export async function verifyTradeTx(
  chain: string,
  txHash: string,
  userAddresses: Set<string>,
  tokenAddress: string,
): Promise<boolean> {
  if (!txHash || userAddresses.size === 0 || !tokenAddress) return false;
  try {
    if (chain === 'solana') {
      const tx = (await getSolanaTransactionDetail(txHash)) as {
        meta?: { err?: unknown; preTokenBalances?: Array<{ mint?: string }>; postTokenBalances?: Array<{ mint?: string }> } | null;
        transaction?: { message?: { accountKeys?: unknown[] } };
      } | null;
      if (!tx || !tx.meta) return false;
      // Reverted / failed transactions are not settled trades.
      if (tx.meta.err != null) return false;
      // The fee payer is the first account key; match it to a user wallet.
      const keys = tx.transaction?.message?.accountKeys ?? [];
      const payer = keys[0];
      const payerStr = typeof payer === 'string' ? payer : (payer as { pubkey?: string })?.pubkey;
      if (!payerStr || !userAddresses.has(payerStr)) return false;
      // The tx must actually touch this mint (pre/post token balances).
      const mints = new Set<string>();
      for (const b of tx.meta.preTokenBalances ?? []) if (b?.mint) mints.add(b.mint);
      for (const b of tx.meta.postTokenBalances ?? []) if (b?.mint) mints.add(b.mint);
      return mints.has(tokenAddress);
    }

    const rpc = getEvmRpcUrl(chain);
    if (!rpc) return false;
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { result?: { from?: string; status?: string; logs?: Array<{ address?: string }> } | null };
    const rc = j.result;
    if (!rc) return false;
    // Reverted transactions (status 0x0) are not settled trades.
    if (rc.status !== '0x1') return false;
    const from = rc.from;
    if (!from || !userAddresses.has(normalizeAddress(from, 'ethereum'))) return false;
    // The token contract must appear as a log emitter (its Transfer event).
    const token = normalizeAddress(tokenAddress, 'ethereum');
    return (rc.logs ?? []).some((l) => l?.address && normalizeAddress(l.address, 'ethereum') === token);
  } catch {
    return false;
  }
}
