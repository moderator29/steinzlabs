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

/**
 * Look up the user's single active, unexpired, owner-approved session key on a
 * chain, after the hard config gates. Returns null when AA is unavailable or
 * there's no usable session — so every caller falls back to one-tap staging.
 */
async function loadActiveSession(
  userId: string,
  chain: string,
): Promise<{ session: ActiveSession; sessionPrivateKey: Hex } | null> {
  if (!vaultConfigured()) return null;
  if (!aaChainFor(chain) || !getZeroDevRpc(chain)) return null;

  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: rows } = await sb
    .from('user_session_keys')
    .select('id, chain, kernel_address, approval, encrypted_session_key, max_per_trade_usd, daily_cap_usd')
    .eq('user_id', userId)
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

  let sessionPrivateKey: Hex;
  try {
    sessionPrivateKey = decryptServerSecret(session.encrypted_session_key) as Hex;
  } catch {
    return null;
  }
  return { session, sessionPrivateKey };
}

/**
 * Shared swap core: approve the SELL token to the 0x AllowanceHolder, then
 * execute the swap, as a single batched userOperation from the kernel account.
 * Works for both directions — buy (USDC→token) and sell (token→USDC) — the only
 * difference is which token is approved (always the sellToken). taker is the
 * kernel account, which must hold the sellToken + gas (or have a paymaster).
 */
async function executeSessionSwap(params: {
  session: ActiveSession;
  sessionPrivateKey: Hex;
  chain: string;
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmountBaseUnits: string;
  slippageBps: number;
}): Promise<string | null> {
  const quote = await getSwapQuote({
    chainId: params.chainId,
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmountBaseUnits,
    taker: params.session.kernel_address!,
    permit2: false,
    slippageBps: params.slippageBps,
  });
  if (!quote?.transaction?.to || !quote.transaction.data) return null;

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [quote.allowanceTarget as Address, BigInt(params.sellAmountBaseUnits)],
  });

  return executeSessionKeyTx({
    sessionPrivateKey: params.sessionPrivateKey,
    approval: params.session.approval!,
    chainSlug: params.chain,
    calls: [
      { to: params.sellToken as Address, data: approveData },
      {
        to: quote.transaction.to as Address,
        data: quote.transaction.data as Hex,
        value: quote.transaction.value ? BigInt(quote.transaction.value) : BigInt(0),
      },
    ],
  });
}

export async function tryExecuteSnipeViaSessionKey(params: {
  userId: string;
  chain: string;
  tokenAddress: string;
  amountUsd: number;
  slippageBps: number;
}): Promise<SnipeExecResult | null> {
  const chain = params.chain.toLowerCase();
  const chainId = CHAIN_IDS[chain];
  const usdc = usdcForChain(chain);
  if (!chainId || !usdc) return null;

  const active = await loadActiveSession(params.userId, chain);
  if (!active) return null;
  const { session, sessionPrivateKey } = active;

  // Software per-trade cap (on-chain timestamp + rate policies handle the rest).
  if (session.max_per_trade_usd != null && params.amountUsd > Number(session.max_per_trade_usd)) {
    return null;
  }

  // Software daily USD cap (#46). The on-chain rate policy bounds the *count* of
  // trades/24h, not their notional — so a swarm of small caps could still drain
  // the kernel. Enforce the configured daily_cap_usd here by summing the user's
  // AA buys on this chain over the trailing 24h before committing another.
  if (session.daily_cap_usd != null) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: recent } = await getSupabaseAdmin()
      .from('sniper_executions')
      .select('buy_amount_usd')
      .eq('user_id', params.userId)
      .eq('chain', chain)
      .gte('executed_at', since)
      .not('buy_amount_usd', 'is', null);
    const spent = (recent ?? []).reduce(
      (s: number, r: { buy_amount_usd: number | null }) => s + Number(r.buy_amount_usd ?? 0),
      0,
    );
    if (spent + params.amountUsd > Number(session.daily_cap_usd)) return null;
  }

  // Buy: USDC -> token. Sell amount is denominated in USDC (6dp).
  const txHash = await executeSessionSwap({
    session,
    sessionPrivateKey,
    chain,
    chainId,
    sellToken: usdc,
    buyToken: params.tokenAddress,
    sellAmountBaseUnits: String(Math.round(params.amountUsd * 1e6)),
    slippageBps: params.slippageBps,
  });
  if (!txHash) return null;

  return { txHash, kernelAddress: session.kernel_address! };
}

/**
 * Auto-sell counterpart (#45): token -> USDC from the kernel account. Given the
 * raw token amount in base units (caller resolves token decimals), approve the
 * TOKEN to the AllowanceHolder and swap it back to USDC. Returns the tx hash, or
 * null when AA isn't usable so the caller falls back to staging a pending sell.
 */
export async function tryExecuteSellViaSessionKey(params: {
  userId: string;
  chain: string;
  tokenAddress: string;
  tokenAmountBaseUnits: string;
  slippageBps: number;
}): Promise<SnipeExecResult | null> {
  const chain = params.chain.toLowerCase();
  const chainId = CHAIN_IDS[chain];
  const usdc = usdcForChain(chain);
  if (!chainId || !usdc) return null;
  if (!params.tokenAmountBaseUnits || params.tokenAmountBaseUnits === '0') return null;

  const active = await loadActiveSession(params.userId, chain);
  if (!active) return null;
  const { session, sessionPrivateKey } = active;

  const txHash = await executeSessionSwap({
    session,
    sessionPrivateKey,
    chain,
    chainId,
    sellToken: params.tokenAddress,
    buyToken: usdc,
    sellAmountBaseUnits: params.tokenAmountBaseUnits,
    slippageBps: params.slippageBps,
  });
  if (!txHash) return null;

  return { txHash, kernelAddress: session.kernel_address! };
}
