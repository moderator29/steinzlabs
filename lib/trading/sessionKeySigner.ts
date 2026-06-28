import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { ethers } from 'ethers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { decryptSessionKey, sessionKeyEncryptionAvailable } from '@/lib/trading/sessionKeyCrypto';
import { checkSessionScope, type SessionKeyRow } from '@/lib/trading/sessionKeyScope';
import { isEvmChain } from '@/lib/utils/addressNormalize';
import { getSwapQuote, getChainId } from '@/lib/services/zerox';

/**
 * 24/7 non-custodial Auto-Copy signer — Phase 2 (see
 * docs/design/2026-06-28-session-key-auto-copy.md).
 *
 * Loads a user's delegated session key, enforces scope + the daily ledger,
 * decrypts the key transiently, fetches FIRM 0x swap calldata bound to the
 * session EOA (raw base-unit sell amount), signs + broadcasts it via our
 * existing RPC, and records the spend. Built on existing platform rails (ethers
 * + the same 0x service the manual pending flow uses + Supabase) — no smart
 * accounts, no outside services.
 *
 * GATED OFF by default. Requires SESSION_KEY_SIGNER_ENABLED=true AND a configured
 * SESSION_KEY_ENCRYPTION_SECRET. Until enabled (and testnet-validated), every
 * caller falls back to the existing pending-trade confirm flow. Disabled or any
 * failure ⇒ returns null so the caller can fall back — it NEVER throws into the
 * money path.
 */

const ALCHEMY_RPC: Record<string, string | undefined> = {
  ethereum: process.env.ETHEREUM_RPC_URL,
  base: process.env.BASE_RPC_URL,
  arbitrum: process.env.ARBITRUM_RPC_URL,
  optimism: process.env.OPTIMISM_RPC_URL,
  polygon: process.env.POLYGON_RPC_URL,
  bsc: process.env.BSC_RPC_URL,
};

function rpcUrl(chain: string): string | null {
  const c = chain.toLowerCase();
  if (ALCHEMY_RPC[c]) return ALCHEMY_RPC[c]!;
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return null;
  const host: Record<string, string> = {
    ethereum: 'eth-mainnet', base: 'base-mainnet', arbitrum: 'arb-mainnet',
    optimism: 'opt-mainnet', polygon: 'polygon-mainnet',
  };
  return host[c] ? `https://${host[c]}.g.alchemy.com/v2/${key}` : null;
}

export function sessionKeySignerEnabled(): boolean {
  return process.env.SESSION_KEY_SIGNER_ENABLED === 'true' && sessionKeyEncryptionAvailable();
}

export interface SessionCopyParams {
  userId: string;
  chain: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amountInRaw: string;   // RAW base units of the from-token (what 0x expects)
  amountUsd: number;     // for cap accounting
  sourceTxHash: string;  // whale tx — idempotency key
  slippageBps: number;
}

export type SessionCopyResult =
  | { executed: true; broadcastTxHash: string; duplicate?: boolean }
  | null; // null = not handled here; caller falls back to pending-trade flow

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

/**
 * Try to auto-execute a copy via the user's session key. Returns null whenever
 * it can't (disabled / no key / out of scope / any error) so the caller falls
 * back. Idempotent on (session_key_id, source_tx_hash) via session_key_spends.
 */
export async function executeWithSessionKey(p: SessionCopyParams): Promise<SessionCopyResult> {
  if (!sessionKeySignerEnabled()) return null;
  if (!isEvmChain(p.chain)) return null; // EVM-first; Solana lands in Phase 3.

  const admin = getSupabaseAdmin();
  try {
    // 1) Active, funded session key for this user+chain.
    const { data: keys } = await admin
      .from('user_session_keys')
      .select('id, chain, max_per_trade_usd, daily_cap_usd, allowed_tokens, expires_at, revoked_at, encrypted_session_key')
      .eq('user_id', p.userId)
      .eq('chain', p.chain.toLowerCase())
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .not('encrypted_session_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const key = keys?.[0] as (SessionKeyRow & { encrypted_session_key: string }) | undefined;
    if (!key) return null;

    // 2) Non-cap scope gate (chain / expiry / per-trade / allowlist). The daily
    //    cap is enforced atomically in step 3 under an advisory lock, so pass 0
    //    here — this is just an early-out for the static checks.
    const verdict = checkSessionScope(key, { chain: p.chain, tokenAddress: p.toTokenAddress, amountUsd: p.amountUsd }, 0, new Date());
    if (!verdict.ok) return null;

    // 3) Atomic claim — advisory-locked daily-cap re-check + idempotent insert on
    //    UNIQUE(session_key_id, source_tx_hash). NULL = cap would breach OR this
    //    whale tx was already claimed, so we must not execute.
    const { data: claimId, error: claimErr } = await admin.rpc('claim_session_spend', {
      p_session_key_id: key.id,
      p_user: p.userId,
      p_amount: p.amountUsd,
      p_daily_cap: key.daily_cap_usd != null ? Number(key.daily_cap_usd) : null,
      p_source_tx: p.sourceTxHash,
    });
    if (claimErr || !claimId) return null;
    const claim = { id: claimId as string };

    // 4) Execute on-chain from the session EOA via a FIRM 0x quote (the same
    //    service the manual pending flow uses). sellAmount is RAW base units;
    //    the quote's calldata is bound to the session EOA as taker.
    const releaseClaim = () => admin.from('session_key_spends').delete().eq('id', claim.id);
    const chainId = getChainId(p.chain);
    const url = rpcUrl(p.chain);
    if (!chainId || !url) { await releaseClaim(); return null; }

    let pk = '';
    try {
      pk = decryptSessionKey(key.encrypted_session_key);
      const provider = new ethers.JsonRpcProvider(url);
      const wallet = new ethers.Wallet(pk, provider);
      const taker = wallet.address;

      const quote = await getSwapQuote({
        chainId,
        sellToken: p.fromTokenAddress,
        buyToken: p.toTokenAddress,
        sellAmount: p.amountInRaw,
        taker,
        slippageBps: p.slippageBps,
      });
      if (!quote?.transaction?.to || !quote.transaction.data) { await releaseClaim(); return null; }

      // ERC-20 approve the 0x AllowanceHolder when selling a token. from-token is
      // a real token (USDC on buys, the whale's token on sells), never native on
      // the copy path. Approve-max-once: skip when allowance already covers it.
      const isNativeIn = /^0x0+$/.test(p.fromTokenAddress)
        || p.fromTokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      if (!isNativeIn && quote.allowanceTarget) {
        const erc20 = new ethers.Contract(p.fromTokenAddress, ERC20_ABI, wallet);
        const current: bigint = await erc20.allowance(taker, quote.allowanceTarget);
        if (current < BigInt(p.amountInRaw)) {
          const approveTx = await erc20.approve(quote.allowanceTarget, ethers.MaxUint256);
          await approveTx.wait(1);
        }
      }

      const tx = await wallet.sendTransaction({
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: BigInt(quote.transaction.value || '0'),
      });
      const receipt = await tx.wait(1);
      const hash = receipt?.hash ?? tx.hash;
      await admin.from('session_key_spends').update({ broadcast_tx_hash: hash }).eq('id', claim.id);
      return { executed: true, broadcastTxHash: hash };
    } catch (err) {
      // On-chain / quote failure: release the claim so a later retry/fallback can act.
      await releaseClaim();
      Sentry.captureException(err, { tags: { module: 'sessionKeySigner.execute', chain: p.chain } });
      return null;
    } finally {
      pk = ''; // best-effort wipe of the plaintext key reference.
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { module: 'sessionKeySigner', chain: p.chain } });
    return null;
  }
}
