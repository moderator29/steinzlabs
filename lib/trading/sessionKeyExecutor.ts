import 'server-only';
import { type Address, type Hex, encodeFunctionData, erc20Abi, isAddress } from 'viem';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { usdcForChain } from '@/lib/trading/usdc';
import { getSwapQuote } from '@/lib/services/zerox';
import { executeSessionKeyTx, getZeroDevRpc, aaChainFor, getErc20Balance } from '@/lib/wallet/sessionKeyAA';
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

// Server-side slippage ceiling (audit #47 M3). A user-set max_slippage_bps of,
// say, 9999 would let the background cron execute a ~100%-slippage swap — an
// instant self-rug / MEV magnet. Clamp every AA swap to a sane maximum.
const MAX_SLIPPAGE_BPS = 1000; // 10%

function clampSlippage(bps: number): number {
  if (!Number.isFinite(bps) || bps <= 0) return 200;
  return Math.min(Math.floor(bps), MAX_SLIPPAGE_BPS);
}

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
  /** Actual 0x-quoted fill amounts in base units (audit #47/#68 H4) — so callers
   *  record real on-chain amounts, not price-derived estimates. */
  sellAmountBaseUnits?: string;
  buyAmountBaseUnits?: string;
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
}): Promise<{ txHash: string; sellAmountBaseUnits: string; buyAmountBaseUnits: string } | null> {
  // Validate the token addresses on the money path before they reach 0x / the
  // approve calldata (audit #47 M2) and clamp slippage server-side (M3).
  if (!isAddress(params.sellToken) || !isAddress(params.buyToken)) return null;
  if (!params.sellAmountBaseUnits || !/^\d+$/.test(params.sellAmountBaseUnits)) return null;
  if (BigInt(params.sellAmountBaseUnits) <= BigInt(0)) return null;

  const quote = await getSwapQuote({
    chainId: params.chainId,
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmountBaseUnits,
    taker: params.session.kernel_address!,
    permit2: false,
    slippageBps: clampSlippage(params.slippageBps),
  });
  if (!quote?.transaction?.to || !quote.transaction.data) return null;
  // Audit #47 M2: never broadcast a swap with no real output. If 0x reports no
  // liquidity or a zero/empty buyAmount, abort — otherwise a background userOp
  // would spend the sell token (+ gas) for ~nothing on an illiquid token.
  if (quote.liquidityAvailable === false) return null;
  try {
    if (!quote.buyAmount || BigInt(quote.buyAmount) <= BigInt(0)) return null;
  } catch {
    return null;
  }

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [quote.allowanceTarget as Address, BigInt(params.sellAmountBaseUnits)],
  });

  const txHash = await executeSessionKeyTx({
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
  // Report the quoted fill amounts so callers record real on-chain magnitudes.
  return { txHash, sellAmountBaseUnits: params.sellAmountBaseUnits, buyAmountBaseUnits: String(quote.buyAmount) };
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

  // Software daily USD cap (#46, audit #68 C3). The on-chain rate policy bounds
  // the *count* of trades/24h, not their notional. Enforce daily_cap_usd by
  // summing the user's AA buys on this chain over the trailing 24h — across BOTH
  // the sniper AND the market maker (unified RPC), so the bot can't slip the cap.
  if (session.daily_cap_usd != null) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: spent } = await getSupabaseAdmin().rpc('aa_daily_spend_usd', {
      p_user: params.userId, p_chain: chain, p_since: since,
    });
    if (Number(spent ?? 0) + params.amountUsd > Number(session.daily_cap_usd)) return null;
  }

  // Buy: USDC -> token. Sell amount is denominated in USDC (6dp).
  const res = await executeSessionSwap({
    session,
    sessionPrivateKey,
    chain,
    chainId,
    sellToken: usdc,
    buyToken: params.tokenAddress,
    sellAmountBaseUnits: String(Math.round(params.amountUsd * 1e6)),
    slippageBps: params.slippageBps,
  });
  if (!res) return null;

  return { txHash: res.txHash, kernelAddress: session.kernel_address!, sellAmountBaseUnits: res.sellAmountBaseUnits, buyAmountBaseUnits: res.buyAmountBaseUnits };
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

  // Audit #47 M3: bound the sell to what the kernel actually holds on-chain.
  // tokens_received is a backfilled float and could be stale/inflated; selling
  // more than the real balance just reverts and wastes gas, and over-approving
  // a token is an unnecessary risk. Cap to the live balance when readable.
  let sellAmount = params.tokenAmountBaseUnits;
  try {
    if (isAddress(params.tokenAddress) && isAddress(session.kernel_address!)) {
      const bal = await getErc20Balance(chain, session.kernel_address as Address, params.tokenAddress as Address);
      if (bal != null) {
        if (bal <= BigInt(0)) return null; // nothing to sell
        if (BigInt(sellAmount) > bal) sellAmount = bal.toString();
      }
    }
  } catch { /* fall back to requested amount on read failure */ }

  const res = await executeSessionSwap({
    session,
    sessionPrivateKey,
    chain,
    chainId,
    sellToken: params.tokenAddress,
    buyToken: usdc,
    sellAmountBaseUnits: sellAmount,
    slippageBps: params.slippageBps,
  });
  if (!res) return null;

  return { txHash: res.txHash, kernelAddress: session.kernel_address!, sellAmountBaseUnits: res.sellAmountBaseUnits, buyAmountBaseUnits: res.buyAmountBaseUnits };
}
