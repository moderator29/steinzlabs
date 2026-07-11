import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Resolve a user's on-chain RECEIVE address for a given gift chain.
 *
 * Non-custodial invariant: a gift is a real peer-to-peer transfer to the
 * recipient's OWN wallet. This helper answers "where do I send funds so
 * <user> receives them on <chain>?" using the two sources of truth:
 *
 *   1. wallet_identities - verified, wallet-signature-proven addresses.
 *      `chain` there is coarse: 'evm' covers every EVM network (the same
 *      0x address receives on Ethereum, Base, BSC, ...); 'solana' is its
 *      own row. We prefer is_primary, then most-recently-verified.
 *   2. user_wallets_v2 - the built-in Naka wallet backup. `default_address`
 *      is the EVM address; the `wallets` jsonb array carries the derived
 *      `solanaAddress` per wallet for Solana.
 *
 * Returns the address string, or null when the user has not set a receive
 * wallet on that chain (the gift UI then says so honestly - we never
 * fabricate an address).
 */

// Gift chains the Wire supports. EVM chains all share one 0x receive
// address (identity chain 'evm'); Solana is separate.
const EVM_GIFT_CHAINS = new Set(['ethereum', 'base', 'bsc', 'robinhood']);

interface WalletJson {
  address?: string;
  solanaAddress?: string;
}

function isEvmAddress(a: string | null | undefined): a is string {
  return typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

function isSolanaAddress(a: string | null | undefined): a is string {
  const s = typeof a === 'string' ? a.trim() : '';
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && !/^0x/i.test(s);
}

export async function resolveReceiveAddress(
  userId: string,
  chain: string,
): Promise<string | null> {
  if (!userId || !chain) return null;
  const c = chain.toLowerCase();
  const supabase = getSupabaseAdmin();

  if (EVM_GIFT_CHAINS.has(c)) {
    // 1. Verified EVM identity (prefer primary, then latest verified).
    const { data: ids } = await supabase
      .from('wallet_identities')
      .select('address, is_primary, verified_at')
      .eq('user_id', userId)
      .in('chain', ['evm', 'ethereum', c])
      .order('is_primary', { ascending: false })
      .order('verified_at', { ascending: false, nullsFirst: false })
      .limit(5);
    const verified = (ids ?? []).find((r) => isEvmAddress(r.address));
    if (verified) return verified.address.trim();

    // 2. Built-in wallet default / first EVM address.
    const { data: uw } = await supabase
      .from('user_wallets_v2')
      .select('wallets, default_address')
      .eq('user_id', userId)
      .maybeSingle<{ wallets: WalletJson[] | null; default_address: string | null }>();
    if (isEvmAddress(uw?.default_address)) return uw!.default_address!.trim();
    const firstEvm = (uw?.wallets ?? []).find((w) => isEvmAddress(w?.address));
    if (firstEvm?.address) return firstEvm.address.trim();
    return null;
  }

  if (c === 'solana') {
    // 1. Verified Solana identity.
    const { data: ids } = await supabase
      .from('wallet_identities')
      .select('address, is_primary, verified_at')
      .eq('user_id', userId)
      .in('chain', ['solana', 'sol'])
      .order('is_primary', { ascending: false })
      .order('verified_at', { ascending: false, nullsFirst: false })
      .limit(5);
    const verified = (ids ?? []).find((r) => isSolanaAddress(r.address));
    if (verified) return verified.address.trim();

    // 2. Built-in wallet's derived Solana address (default_address is EVM,
    //    so there is no EVM fallback for Solana - honest null if none).
    const { data: uw } = await supabase
      .from('user_wallets_v2')
      .select('wallets')
      .eq('user_id', userId)
      .maybeSingle<{ wallets: WalletJson[] | null }>();
    const withSol = (uw?.wallets ?? []).find((w) => isSolanaAddress(w?.solanaAddress));
    if (withSol?.solanaAddress) return withSol.solanaAddress.trim();
    return null;
  }

  return null;
}
