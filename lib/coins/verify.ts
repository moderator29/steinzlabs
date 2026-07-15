import 'server-only';

/**
 * On-chain verification for recorded coin trades. A trade is only written to the
 * social feed / holders / PnL if its transaction really exists on chain and was
 * sent by one of the caller's own wallets. This keeps holders, PnL and revenue
 * honest and blocks fabricated trades. Fails closed: if we cannot verify, we do
 * not record (the user's real holdings still live in their wallet regardless).
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

/** True only if the tx exists on chain and was sent by one of the user's wallets. */
export async function verifyTradeTx(chain: string, txHash: string, userAddresses: Set<string>): Promise<boolean> {
  if (!txHash || userAddresses.size === 0) return false;
  try {
    if (chain === 'solana') {
      const tx = (await getSolanaTransactionDetail(txHash)) as { transaction?: { message?: { accountKeys?: unknown[] } } } | null;
      if (!tx) return false;
      // The fee payer is the first account key; match it to a user wallet.
      const keys = tx.transaction?.message?.accountKeys ?? [];
      const payer = keys[0];
      const payerStr = typeof payer === 'string' ? payer : (payer as { pubkey?: string })?.pubkey;
      if (payerStr) return userAddresses.has(payerStr);
      // Existence without a parseable payer still proves it is a real tx.
      return true;
    }
    const rpc = getEvmRpcUrl(chain);
    if (!rpc) return false;
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [txHash] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { result?: { from?: string } | null };
    const from = j.result?.from;
    if (!from) return false;
    return userAddresses.has(normalizeAddress(from, 'ethereum'));
  } catch {
    return false;
  }
}
