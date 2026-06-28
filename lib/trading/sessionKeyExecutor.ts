import 'server-only';
import { type Address, type Hex, encodeFunctionData, erc20Abi } from 'viem';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { usdcForChain } from '@/lib/trading/usdc';
import { getSwapQuote } from '@/lib/services/zerox';
import { executeSessionKeyTx, getZeroDevRpc, aaChainFor } from '@/lib/wallet/sessionKeyAA';
import { decryptServerSecret, vaultConfigured } from '@/lib/wallet/serverKeyVault';

/**
 * Background AA-session execution for the sniper (#41). Given a matched snipe,
 * find the user's active, unexpired, owner-approved session key on that chain
 * and broadcast the buy as a userOperation from their kernel account — capped
 * by the on-chain timestamp + rate policies and the software per-trade cap. No
 * browser, no manual click, no main-key custody.
 *
 * Returns the tx hash on success, or null when AA isn't configured / no active
 * session / over caps — so the caller cleanly falls back to staging a one-tap
 * pending trade. Throws are caught by the caller; this is best-effort.
 */

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, arbitrum: 42161, optimism: 10, polygon: 137, bsc: 56, avalanche: 43114,
};

interface ActiveSession {
  id: string;
  chain: string;
  kernel_address: string | null;
  approval: string | null;
  encrypted_session_key: string | null;
  max_per_trade_usd: number | null;
  daily_cap_usd: number | null;
}

export interface SnipeExecResult {
  txHash: string;
  kernelAddress: string;
}

export async function tryExecuteSnipeViaSessionKey(params: {
  userId: string;
  chain: string;
  tokenAddress: string;
  amountUsd: number;
  slippageBps: number;
}): Promise<SnipeExecResult | null> {
  const chain = params.chain.toLowerCase();
  // Hard gates — any miss → caller falls back to the manual one-tap path.
  if (!vaultConfigured()) return null;
  if (!aaChainFor(chain) || !getZeroDevRpc(chain)) return null;
  const chainId = CHAIN_IDS[chain];
  const usdc = usdcForChain(chain);
  if (!chainId || !usdc) return null;

  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: rows } = await sb
    .from('user_session_keys')
    .select('id, chain, kernel_address, approval, encrypted_session_key, max_per_trade_usd, daily_cap_usd')
    .eq('user_id', params.userId)
    .eq('chain', chain)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .not('approval', 'is', null)
    .not('kernel_address', 'is', null)
    .not('encrypted_session_key', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const session = (rows?.[0] as ActiveSession | undefined) ?? null;
  if (!session?.approval || !session.kernel_address || !session.encrypted_session_key) return null;

  // Software per-trade cap (on-chain timestamp + rate policies handle the rest).
  if (session.max_per_trade_usd != null && params.amountUsd > Number(session.max_per_trade_usd)) {
    return null;
  }

  let sessionPrivateKey: Hex;
  try {
    sessionPrivateKey = decryptServerSecret(session.encrypted_session_key) as Hex;
  } catch {
    return null;
  }

  // Build the buy: USDC -> token via 0x AllowanceHolder (approve + swap, no
  // permit2 signature needed — ideal for a server-side batch). taker is the
  // kernel account, which must hold the USDC + gas.
  const sellAmount = String(Math.round(params.amountUsd * 1e6)); // USDC 6dp
  const quote = await getSwapQuote({
    chainId,
    sellToken: usdc,
    buyToken: params.tokenAddress,
    sellAmount,
    taker: session.kernel_address,
    permit2: false,
    slippageBps: params.slippageBps,
  });
  if (!quote?.transaction?.to || !quote.transaction.data) return null;

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [quote.allowanceTarget as Address, BigInt(sellAmount)],
  });

  const txHash = await executeSessionKeyTx({
    sessionPrivateKey,
    approval: session.approval,
    chainSlug: chain,
    calls: [
      { to: usdc as Address, data: approveData },
      {
        to: quote.transaction.to as Address,
        data: quote.transaction.data as Hex,
        value: quote.transaction.value ? BigInt(quote.transaction.value) : BigInt(0),
      },
    ],
  });

  return { txHash, kernelAddress: session.kernel_address };
}
